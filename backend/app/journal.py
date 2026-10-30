"""Journal des erreurs du site, gardé 30 jours au plus, lu chaque jour par la routine d'auto-amélioration pour les corriger.

- Erreurs du serveur (une requête qui échoue de façon imprévue) et du navigateur (un script du site qui plante chez un visiteur).
- Regroupées par « signature » (même erreur au même endroit) et comptées par jour : une erreur fréquente ne noie pas les autres.
- Aucune donnée personnelle : ni adresse IP, ni saisie ; adresses de page sans paramètres ; e-mails et numéros masqués ;
  textes tronqués. Tout est effacé au bout de 30 jours.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import re
import traceback

from . import db
from .retours import nettoyer

CONSERVATION_JOURS = 30
SCHEMA = """
CREATE TABLE IF NOT EXISTS journal_erreurs (
    jour TEXT NOT NULL,
    signature TEXT NOT NULL,
    origine TEXT NOT NULL,            -- serveur | navigateur
    message TEXT NOT NULL,
    detail TEXT NOT NULL DEFAULT '',  -- pile d'appels, tronquée
    page TEXT NOT NULL DEFAULT '',
    occurrences INTEGER NOT NULL DEFAULT 1,
    derniere TEXT NOT NULL,
    PRIMARY KEY (jour, signature)
);
"""


def init():
    conn = db.connect()
    conn.executescript(SCHEMA)
    purger()
    conn.commit()


def purger():
    with db.transaction() as c:
        c.execute("DELETE FROM journal_erreurs WHERE jour < date('now', ?)", (f"-{CONSERVATION_JOURS} days",))


def _page(p: str) -> str:
    return (p or "").split("?")[0].split("#")[0][:150]


def noter(origine: str, message: str, detail: str = "", page: str = "") -> None:
    message = nettoyer(message or "erreur sans message")[:300]
    detail = nettoyer(detail or "")[-2000:]
    page = _page(page)
    # même erreur au même endroit : le message sans ses nombres variables, et la dernière ligne utile de la pile
    lieu = next((l for l in reversed(detail.splitlines()) if l.strip().startswith(("File ", "at "))), "")
    cle = f"{origine}|{re.sub(r'[0-9]+', '#', message)}|{lieu.strip()}"
    signature = hashlib.sha1(cle.encode("utf-8")).hexdigest()[:16]
    maintenant = dt.datetime.now().isoformat(timespec="seconds")
    try:
        with db.transaction() as c:
            c.execute("INSERT INTO journal_erreurs (jour, signature, origine, message, detail, page, derniere) VALUES (date('now'), ?, ?, ?, ?, ?, ?) "
                      "ON CONFLICT (jour, signature) DO UPDATE SET occurrences = occurrences + 1, derniere = excluded.derniere",
                      (signature, origine, message, detail, page, maintenant))
    except Exception:  # pragma: no cover — le journal ne doit jamais provoquer d'erreur à son tour
        pass


def noter_exception(exc: BaseException, page: str) -> None:
    pile = "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))
    noter("serveur", f"{type(exc).__name__}: {exc}", pile, page)


def recentes(jours: int = 7) -> list[dict]:
    """Erreurs des derniers jours, regroupées par signature, les plus fréquentes d'abord (pour la routine)."""
    rows = db.connect().execute(
        "SELECT signature, origine, message, MAX(detail) AS detail, MAX(page) AS page, SUM(occurrences) AS occurrences, "
        "MIN(jour) AS premier_jour, MAX(derniere) AS derniere FROM journal_erreurs WHERE jour >= date('now', ?) "
        "GROUP BY signature ORDER BY occurrences DESC LIMIT 50", (f"-{max(1, jours)} days",))
    return [dict(r) for r in rows]
