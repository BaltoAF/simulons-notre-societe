"""Fréquentation du site, mesurée par le site lui-même : aucun outil tiers, aucun cookie, aucune adresse IP conservée.

- Chaque page vue est comptée (page, jour, téléphone ou ordinateur, site de provenance) ; les robots sont écartés.
- Les visiteurs du jour sont comptés grâce à une empreinte qui change chaque jour (sel secret + date + adresse IP + navigateur),
  effacée dès le lendemain : seul le nombre de visiteurs de chaque jour est gardé.
- Un navigateur qui demande à ne pas être suivi (« Do Not Track », « Global Privacy Control ») n'est pas compté.
C'est la mesure d'audience que la CNIL dispense de consentement : anonyme, propre au site, limitée aux statistiques.
"""
from __future__ import annotations

import datetime as dt
import re
from urllib.parse import urlparse

from . import db, retours

SCHEMA = """
CREATE TABLE IF NOT EXISTS frequentation_pages (
    jour TEXT NOT NULL, page TEXT NOT NULL, appareil TEXT NOT NULL, vues INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (jour, page, appareil)
);
CREATE TABLE IF NOT EXISTS frequentation_provenances (
    jour TEXT NOT NULL, domaine TEXT NOT NULL, visites INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, domaine)
);
CREATE TABLE IF NOT EXISTS frequentation_empreintes (     -- du jour seulement : effacées le lendemain
    jour TEXT NOT NULL, empreinte TEXT NOT NULL, vues INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (jour, empreinte)
);
CREATE TABLE IF NOT EXISTS frequentation_visiteurs (jour TEXT PRIMARY KEY, visiteurs INTEGER NOT NULL);
"""
ROBOTS = re.compile(r"bot|crawl|spider|slurp|preview|headless|python|curl|wget|httpx|go-http|java/|monitor|uptime|scan", re.I)
TELEPHONE = re.compile(r"mobi|android|iphone|ipod", re.I)
MAX_VUES_VISITEUR = 300  # au-delà, dans la journée, ce n'est plus une lecture humaine


def init():
    conn = db.connect()
    conn.executescript(SCHEMA)
    conn.commit()


def _page(chemin: str) -> str:
    p = (chemin or "/").split("?")[0].split("#")[0][:120]
    return p if p.startswith("/") else "/"


def _domaine(provenance: str, hote: str) -> str | None:
    """Site d'où vient le visiteur (« google.com », « facebook.com »…), jamais l'adresse complète."""
    d = (urlparse(provenance or "").hostname or "").removeprefix("www.")
    return d[:80] if d and d != (hote or "").split(":")[0].removeprefix("www.") else None


def _archiver_les_jours_passes(conn, jour: str):
    """Ne garde que le nombre de visiteurs des jours passés ; leurs empreintes sont effacées."""
    passes = [r[0] for r in conn.execute("SELECT DISTINCT jour FROM frequentation_empreintes WHERE jour < ?", (jour,))]
    for j in passes:
        n = conn.execute("SELECT COUNT(*) FROM frequentation_empreintes WHERE jour = ?", (j,)).fetchone()[0]
        conn.execute("INSERT OR REPLACE INTO frequentation_visiteurs (jour, visiteurs) VALUES (?, ?)", (j, n))
    if passes:
        conn.execute("DELETE FROM frequentation_empreintes WHERE jour < ?", (jour,))


def compter(page: str, provenance: str, ip: str, navigateur: str, hote: str, ne_pas_suivre: bool) -> None:
    if ne_pas_suivre or not navigateur or ROBOTS.search(navigateur):
        return
    jour = dt.date.today().isoformat()
    empreinte = retours.empreinte(f"{ip}|{navigateur}")
    appareil = "telephone" if TELEPHONE.search(navigateur) else "ordinateur"
    with db.transaction() as c:
        _archiver_les_jours_passes(c, jour)
        nouveau = c.execute("INSERT OR IGNORE INTO frequentation_empreintes (jour, empreinte, vues) VALUES (?, ?, 0)",
                            (jour, empreinte)).rowcount
        vues = c.execute("UPDATE frequentation_empreintes SET vues = vues + 1 WHERE jour = ? AND empreinte = ? RETURNING vues",
                         (jour, empreinte)).fetchone()[0]
        if vues > MAX_VUES_VISITEUR:
            return
        c.execute("INSERT INTO frequentation_pages (jour, page, appareil, vues) VALUES (?, ?, ?, 1) "
                  "ON CONFLICT (jour, page, appareil) DO UPDATE SET vues = vues + 1", (jour, _page(page), appareil))
        domaine = _domaine(provenance, hote)
        if nouveau and domaine:  # la provenance compte une fois par visiteur et par jour
            c.execute("INSERT INTO frequentation_provenances (jour, domaine, visites) VALUES (?, ?, 1) "
                      "ON CONFLICT (jour, domaine) DO UPDATE SET visites = visites + 1", (jour, domaine))


def bilan(jours: int = 30) -> dict:
    conn = db.connect()
    jour = dt.date.today().isoformat()
    debut = (dt.date.today() - dt.timedelta(days=jours - 1)).isoformat()
    vues = {r[0]: r[1] for r in conn.execute(
        "SELECT jour, SUM(vues) FROM frequentation_pages WHERE jour >= ? GROUP BY jour", (debut,))}
    visiteurs = {r[0]: r[1] for r in conn.execute("SELECT jour, visiteurs FROM frequentation_visiteurs WHERE jour >= ?", (debut,))}
    visiteurs[jour] = conn.execute("SELECT COUNT(*) FROM frequentation_empreintes WHERE jour = ?", (jour,)).fetchone()[0]
    par_jour = [{"jour": (dt.date.today() - dt.timedelta(days=k)).isoformat()} for k in range(jours - 1, -1, -1)]
    for d in par_jour:
        d["vues"], d["visiteurs"] = vues.get(d["jour"], 0), visiteurs.get(d["jour"], 0)
    pages = [{"page": r[0], "vues": r[1]} for r in conn.execute(
        "SELECT page, SUM(vues) AS v FROM frequentation_pages WHERE jour >= ? GROUP BY page ORDER BY v DESC LIMIT 20", (debut,))]
    appareils = {r[0]: r[1] for r in conn.execute(
        "SELECT appareil, SUM(vues) FROM frequentation_pages WHERE jour >= ? GROUP BY appareil", (debut,))}
    provenances = [{"domaine": r[0], "visites": r[1]} for r in conn.execute(
        "SELECT domaine, SUM(visites) AS v FROM frequentation_provenances WHERE jour >= ? GROUP BY domaine ORDER BY v DESC LIMIT 15",
        (debut,))]
    return {"jours": par_jour, "pages": pages, "appareils": appareils, "provenances": provenances,
            "total_vues": sum(vues.values()), "total_visiteurs_jours": sum(d["visiteurs"] for d in par_jour)}
