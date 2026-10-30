"""Mise à jour invisible de la loi actuelle, au fil de l'eau.

Un fil d'exécution en arrière-plan, lancé avec le serveur :
  - chaque minute, il vérifie si la date a changé (une règle dont la date d'entrée en vigueur arrive
    s'applique alors automatiquement) ou si le modèle (model/) a été modifié par le Système ;
  - chaque nuit (par défaut à 4 h 30), il lance la mise à jour complète (system/maj_quotidienne.py) :
    nouvelle version d'OpenFisca-France, contrôles, population, publication ;
  - après chaque changement, il recharge le modèle, publie un commit sur la loi actuelle, met à jour
    les forks sans conflit et réchauffe les calculs de référence — sans redémarrage ni action de quiconque.

Variables d'environnement : SOCIETE_MAJ=0 désactive tout ; SOCIETE_MAJ_HEURE="04:30" ;
SOCIETE_MAJ_ARGS="--sans-moteur" sur le serveur en ligne, où le moteur et le modèle sont mis à jour par GitHub (voir docs/DEPLOIEMENT.md).
"""
from __future__ import annotations

import datetime as dt
import json
import logging
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

from . import config, db, vcs

log = logging.getLogger("societe.systeme")
ROOT = config.ROOT
_LOCK = threading.Lock()
_ETAT = {"derniere_signature": None, "signature_candidate": None, "dernier_rechargement": None,
         "prochaine_maj": None, "en_cours": False}


def signature_modele() -> tuple:
    """Empreinte rapide du dossier model/ (nombre de fichiers, date de modification la plus récente)."""
    n, latest = 0, 0.0
    for path in config.MODEL_DIR.rglob("*"):
        if path.suffix in (".yaml", ".json") and path.is_file():
            n += 1
            latest = max(latest, path.stat().st_mtime)
    return n, round(latest, 2)


def recharger(raison: str) -> dict:
    """Recharge le modèle, publie la nouvelle version, met à jour les forks et vide les caches de calcul."""
    from .engine.openfisca_engine import ENGINE, reset_pool
    from .impacts import compensations, contexte, microsim, simulation
    from .model_store import get_store
    with _LOCK:
        t = time.time()
        store = get_store(reload=True)
        pub = vcs.ensure_reference(store)
        forks = vcs.auto_sync_forks(store)
        simulation._CACHE.clear()
        contexte._BASE_CACHE.clear()
        contexte._REFORME_CACHE.clear()
        compensations._RENDEMENTS.clear()
        microsim.charger_population.cache_clear()
        ENGINE.vider_caches()
        reset_pool()
        _ETAT["dernier_rechargement"] = dt.datetime.now().isoformat(timespec="seconds")
        res = {"raison": raison, "publication": pub.get("message") or ("aucun changement de règle" if not pub.get("cree") else "création"),
               "commit": pub.get("commit"), "forks": forks, "duree_s": round(time.time() - t, 1)}
        log.info("Rechargement (%s) : %s", raison, res)
    threading.Thread(target=microsim.prechauffer, args=(store,), daemon=True).start()
    return res


def _enregistrer_execution(declencheur: str) -> int:
    with db.transaction() as c:
        cur = c.execute("INSERT INTO systeme_executions (debut, statut, declencheur) VALUES (?, 'en_cours', ?)",
                        (dt.datetime.now().isoformat(timespec="seconds"), declencheur))
        return cur.lastrowid


def _terminer_execution(eid: int, statut: str, resume: dict):
    with db.transaction() as c:
        c.execute("UPDATE systeme_executions SET fin = ?, statut = ?, resume = ? WHERE id = ?",
                  (dt.datetime.now().isoformat(timespec="seconds"), statut, db.dumps(resume), eid))


def derniere_execution_reussie() -> dt.datetime | None:
    r = db.connect().execute("SELECT debut FROM systeme_executions WHERE statut = 'succes' ORDER BY debut DESC LIMIT 1").fetchone()
    return dt.datetime.fromisoformat(r["debut"]) if r else None


def lancer_maj_quotidienne(declencheur: str = "planifie") -> dict:
    """Exécute system/maj_quotidienne.py dans un processus séparé, puis recharge le serveur."""
    if _ETAT["en_cours"]:
        return {"statut": "deja_en_cours"}
    _ETAT["en_cours"] = True
    eid = _enregistrer_execution(declencheur)
    try:
        options = os.environ.get("SOCIETE_MAJ_ARGS", "").split()
        out = subprocess.run([sys.executable, str(ROOT / "system" / "maj_quotidienne.py"), "--json", *options],
                             cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=3600,
                             env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        resume = {}
        for line in reversed(out.stdout.splitlines()):
            if line.startswith("{"):
                try:
                    resume = json.loads(line)
                    break
                except json.JSONDecodeError:
                    pass
        statut = "succes" if out.returncode == 0 else "echec"
        if out.returncode != 0:
            resume["erreur"] = (out.stderr or out.stdout)[-2000:]
        if resume.get("redemarrage_requis"):
            resume["note"] = "Nouvelle version du moteur installée : elle sera chargée au prochain redémarrage du serveur."
        resume["rechargement"] = recharger(f"mise à jour quotidienne ({declencheur})")
        _terminer_execution(eid, statut, resume)
        return {"statut": statut, **resume}
    except Exception as e:  # la mise à jour ne doit jamais faire tomber le site
        _terminer_execution(eid, "echec", {"erreur": f"{type(e).__name__}: {e}"})
        return {"statut": "echec", "erreur": str(e)}
    finally:
        _ETAT["en_cours"] = False


def _heure_planifiee() -> dt.time:
    h = os.environ.get("SOCIETE_MAJ_HEURE", "04:30")
    try:
        hh, mm = h.split(":")
        return dt.time(int(hh), int(mm))
    except ValueError:
        return dt.time(4, 30)


def _prochaine_echeance(apres: dt.datetime) -> dt.datetime:
    h = _heure_planifiee()
    cible = dt.datetime.combine(apres.date(), h)
    return cible if cible > apres else cible + dt.timedelta(days=1)


def boucle():
    _ETAT["derniere_signature"] = signature_modele()
    maintenant = dt.datetime.now()
    derniere = derniere_execution_reussie()
    if derniere is None or maintenant - derniere > dt.timedelta(hours=26):
        _ETAT["prochaine_maj"] = maintenant + dt.timedelta(minutes=10)  # rattrapage, sans ralentir le démarrage
        declencheur_suivant = "rattrapage"
    else:
        _ETAT["prochaine_maj"] = _prochaine_echeance(maintenant)
        declencheur_suivant = "planifie"
    while True:
        time.sleep(60)
        try:
            if config.rafraichir_dates():
                recharger("nouvelle date : entrée en vigueur des règles datées d'aujourd'hui")
            sig = signature_modele()
            if sig != _ETAT["derniere_signature"]:
                # on attend que la signature soit stable une minute (fichiers en cours d'écriture)
                if sig == _ETAT["signature_candidate"]:
                    _ETAT["derniere_signature"] = sig
                    _ETAT["signature_candidate"] = None
                    recharger("le Système a modifié le modèle")
                else:
                    _ETAT["signature_candidate"] = sig
            if dt.datetime.now() >= _ETAT["prochaine_maj"]:
                lancer_maj_quotidienne(declencheur_suivant)
                _ETAT["derniere_signature"] = signature_modele()
                _ETAT["prochaine_maj"] = _prochaine_echeance(dt.datetime.now())
                declencheur_suivant = "planifie"
        except Exception:  # pragma: no cover
            log.exception("Erreur du planificateur")


def demarrer():
    if os.environ.get("SOCIETE_MAJ", "1") == "0":
        return
    threading.Thread(target=boucle, daemon=True, name="planificateur-systeme").start()


def etat() -> dict:
    return {k: (v.isoformat(timespec="minutes") if isinstance(v, dt.datetime) else v)
            for k, v in _ETAT.items() if k not in ("derniere_signature", "signature_candidate")} | {
        "actif": os.environ.get("SOCIETE_MAJ", "1") != "0", "heure_planifiee": _heure_planifiee().strftime("%H:%M")}
