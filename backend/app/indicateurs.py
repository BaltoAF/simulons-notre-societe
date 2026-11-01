"""Le tableau de bord d'une proposition : quelques indicateurs clés, toujours les mêmes, dans le même ordre.

Les chiffres viennent du rapport de simulation complet (`impacts.simulation.simuler`), qui prend une minute ou plus :
on ne simule donc JAMAIS à l'affichage d'une liste. Les indicateurs sont gardés en base (table `indicateurs_cles`),
indexés par une empreinte de ce qui est simulé :
  - les règles que la proposition change par rapport à la loi actuelle (calculées comme `/api/simulation/reforme`,
    elles dépendent du commit de tête de la branche ET de la loi de référence) ;
  - la version du modèle : valeurs des règles, statistiques, études, date de calcul, version d'OpenFisca-France,
    code des modules d'impact et version de cette extraction.
Le commit de tête et la société sont enregistrés à côté, pour information.

Calcul en arrière-plan, sur un fil unique (une simulation à la fois), avec une file bornée :
  - déclenché à la création ou à la modification d'une proposition (en tête de file) ;
  - paresseusement, quand la liste ou la page d'une proposition demande des indicateurs absents (en fin de file) ;
  - le fil attend que les calculs de référence soient prêts, baisse sa priorité système et marque une pause entre
    deux simulations, pour laisser la main aux visiteurs sur un petit serveur.
Variables d'environnement : SOCIETE_INDICATEURS=0 désactive le calcul en arrière-plan (les tests) ;
SOCIETE_INDICATEURS_FILE (20 par défaut) borne la file ; SOCIETE_INDICATEURS_PAUSE (5 s par défaut).
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import threading
import time
from collections import deque
from importlib import metadata
from pathlib import Path

from . import config, db, vcs

log = logging.getLogger("societe.indicateurs")

# à changer quand l'extraction ci-dessous change : les indicateurs déjà gardés sont alors recalculés
VERSION_EXTRACTION = 2  # 2 : pouvoir d'achat moyen (TVA comprise) en tête de la tuile des ménages
MAX_FILE = int(os.environ.get("SOCIETE_INDICATEURS_FILE", "20"))
PAUSE_S = float(os.environ.get("SOCIETE_INDICATEURS_PAUSE", "5"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS indicateurs_cles (
    empreinte TEXT PRIMARY KEY,       -- règles changées + version du modèle
    society_id TEXT NOT NULL,
    branche TEXT NOT NULL,
    commit_id TEXT NOT NULL,          -- commit de tête au moment du calcul (pour information)
    cle_modele TEXT NOT NULL,
    statut TEXT NOT NULL,             -- pret | erreur
    indicateurs TEXT,
    erreur TEXT,
    duree_s REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_indicateurs_cles_societe ON indicateurs_cles(society_id, branche);
"""

# L'ordre d'affichage, identique pour toutes les propositions
ORDRE = ["finances", "menages", "pauvrete", "emploi", "climat"]


def init():
    conn = db.connect()
    conn.executescript(SCHEMA)
    conn.commit()


# ───────────────────────── empreintes ─────────────────────────


def _empreinte_code() -> str:
    h = hashlib.sha1()
    app = Path(__file__).resolve().parent
    for p in sorted([*(app / "impacts").glob("*.py"), *(app / "engine").glob("*.py"), app / "evidence.py", app / "confidence.py"]):
        try:
            h.update(p.name.encode())
            h.update(p.read_bytes())
        except OSError:
            pass
    return h.hexdigest()[:12]


def cle_modele(store) -> str:
    """Version de tout ce qui fait varier le résultat d'une simulation, à proposition égale."""
    if getattr(store, "_cle_indicateurs", None) is None:  # gardée sur le modèle chargé : un rechargement la recalcule
        try:
            of = metadata.version("openfisca-france")
        except metadata.PackageNotFoundError:
            of = "?"
        contenu = {
            "regles": store.snapshot_hash(),
            "metriques": {m: (v.get("derniere") or {}).get("valeur") for m, v in sorted(store.metriques.items())},
            "preuves": {q: v.get("estimations") for q, v in sorted(store.preuves.items())},
            "openfisca_france": of, "code": _empreinte_code(), "extraction": VERSION_EXTRACTION,
        }
        store._cle_indicateurs = hashlib.sha1(json.dumps(contenu, sort_keys=True, default=str).encode()).hexdigest()[:16]
    # la date de calcul (mois des prestations, année de l'impôt) change le résultat : elle avance sans recharger le modèle
    return f"{store._cle_indicateurs}-{config.MOIS_REFERENCE}"


def _ref_dumps(store) -> dict[str, str]:
    if getattr(store, "_ref_dumps_indicateurs", None) is None:
        store._ref_dumps_indicateurs = {rid: db.dumps(v) for rid, v in store.snapshot().items()}
    return store._ref_dumps_indicateurs


def overrides_de(store, etat: dict) -> dict:
    """Règles d'un état qui diffèrent de la loi actuelle : exactement ce que simule `/api/simulation/reforme`."""
    ref = _ref_dumps(store)
    return {k: v for k, v in etat.items() if k in ref and db.dumps(v) != ref[k]}


def overrides_societe(store, sid: str, branche: str = vcs.BRANCHE_PRINCIPALE) -> tuple[str, dict]:
    head = vcs.branch_head(sid, branche)
    return head, overrides_de(store, vcs.state_of(head))


def empreinte(store, overrides: dict) -> str:
    return hashlib.sha1((db.dumps(overrides) + "|" + cle_modele(store)).encode()).hexdigest()[:20]


# ───────────────────────── extraction depuis le rapport ─────────────────────────
def _conf_min(confs: list[dict | None]) -> dict | None:
    cs = [c for c in confs if c]
    return min(cs, key=lambda c: c.get("score", 0)) if cs else None


def _sens(v: float | None, seuil: float, plus_est_favorable: bool = True) -> str:
    if v is None or abs(v) < seuil:
        return "neutre"
    return "favorable" if (v > 0) == plus_est_favorable else "defavorable"


def _non_chiffre() -> dict:
    return {"valeur": None, "sens": "neutre", "confiance": None}


def extraire(rapport: dict) -> dict:
    """Les indicateurs clés, tels que le rapport les calcule (rien n'est recalculé ici). Absent = non chiffré (valeur None).

    Le sens (favorable, défavorable, neutre) reprend celui du bilan du rapport, avec ses seuils d'effet négligeable."""
    from .impacts.bilan import NEGLIGEABLE
    from .confidence import Confiance, Facteur, moyenne_ponderee
    eqs = {e["id"]: e for e in rapport.get("equilibres") or []}
    inds = {i["id"]: (i, s) for s in rapport.get("sections") or [] for i in s.get("indicateurs") or []}
    bilan = {x["id"]: x for p in rapport.get("bilan") or [] for x in p.get("indicateurs") or []}
    out: dict[str, dict] = {}

    # 1. Argent public : effet direct sur le solde (par an), celui que la règle de financement contrôle
    b = eqs.get("budget")
    if b and (b.get("confiance") or b.get("composantes")):
        out["finances"] = {"valeur": b["effet"], "unite": "milliards_euros",
                           "sens": (bilan.get("equilibre_budget") or {}).get("sens") or _sens(b["effet"], 0.05),
                           "confiance": b.get("confiance"), "statut": b.get("statut"), "manque": b.get("manque")}
    else:
        out["finances"] = _non_chiffre()

    # 2. Ménages gagnants et perdants (à comportements inchangés)
    g = inds.get("gagnants")
    if g and g[0].get("valeur") is not None:
        perdants = (g[1].get("donnees") or {}).get("perdants_pct")
        sens = (bilan.get("gagnants") or {}).get("sens")
        if sens is None:
            diff = (g[0]["valeur"] or 0) - (perdants or 0)
            sens = "favorable" if diff >= 20 else "defavorable" if diff <= -20 else "neutre"
        # la part de gagnants seule cache les pertes (un point de TVA ne change pas les gagnants, il ajoute des perdants) :
        # en tête, l'effet moyen par ménage, TVA comprise, puis gagnants et perdants
        moy = (g[1].get("donnees") or {}).get("moyenne_menage_mois")
        if moy is not None:
            sens = _sens(moy, 1.0)
        out["menages"] = {"valeur": round(moy, 2) if moy is not None else None, "gagnants": round(g[0]["valeur"], 2),
                          "perdants": round(perdants, 2) if perdants is not None else None,
                          "unite": "euros_mois", "sens": sens, "confiance": g[0].get("confiance")}
    else:
        out["menages"] = _non_chiffre()

    # 3. Taux de pauvreté (variation, en points)
    p = inds.get("pauvrete")
    if p and p[0].get("valeur") is not None:
        out["pauvrete"] = {"valeur": p[0]["valeur"], "avant": p[0].get("avant"), "apres": p[0].get("apres"), "unite": "points",
                           "sens": (bilan.get("pauvrete") or {}).get("sens") or _sens(p[0]["valeur"], NEGLIGEABLE["pauvrete"], False),
                           "confiance": p[0].get("confiance")}
    else:
        out["pauvrete"] = _non_chiffre()

    # 4. Emploi : la somme des effets chiffrés sur le nombre d'emplois (comme le fait le module d'activité)
    emplois = [i for i, _ in inds.values() if i["id"].startswith("emploi_") and i.get("unite") == "emplois" and i.get("valeur") is not None]
    if emplois:
        total = sum(i["valeur"] for i in emplois)

        def conf(d):
            return Confiance(d["score"], [Facteur(f["nom"], f["valeur"], f["explication"]) for f in d.get("facteurs") or []],
                             d.get("resume") or d.get("libelle") or "")
        avec = [(i["valeur"], conf(i["confiance"])) for i in emplois if i.get("confiance")]
        c = moyenne_ponderee(avec, "Effet total sur l'emploi").to_dict() if any(abs(v) > 1e-9 for v, _ in avec) else _conf_min([i.get("confiance") for i in emplois])
        out["emploi"] = {"valeur": round(total), "unite": "emplois", "sens": _sens(total, NEGLIGEABLE["emploi_"]), "confiance": c,
                         "composantes": [{"libelle": i["libelle"], "valeur": i["valeur"]} for i in emplois]}
    else:
        out["emploi"] = _non_chiffre()

    # 5. Climat : effet direct sur les émissions (par an)
    cb = eqs.get("carbone")
    if cb and cb.get("statut") != "non_mesure":
        bil = bilan.get("equilibre_carbone") or bilan.get("equilibre_carbone_revenus") or {}
        out["climat"] = {"valeur": cb["effet"], "unite": "mt_co2e",
                         "sens": bil.get("sens") or _sens(cb["effet"], NEGLIGEABLE["equilibre_carbone"], False),
                         "confiance": cb.get("confiance"), "statut": cb.get("statut"), "manque": cb.get("manque")}
    else:
        out["climat"] = _non_chiffre()
    return {k: out[k] for k in ORDRE}


def situation_actuelle(store) -> dict:
    """Pour la loi actuelle : le point de départ, en statistiques publiques (aucune simulation)."""
    def m(*ids):
        for mid in ids:
            if mid in store.metriques:
                d = store.metriques[mid].get("derniere") or {}
                if d.get("valeur") is not None:
                    return {"valeur": d["valeur"], "annee": str(d.get("date") or "")[:4], "source": d.get("source"), "metrique": mid}
        return None
    vals = {
        "finances": (m("finances_publiques.solde_public"), "milliards_euros"),
        "menages": (None, None),
        "pauvrete": (m("revenus.pauvrete.taux_seuil_60"), "pourcent"),
        "emploi": (m("travail.taux_chomage_bit", "emploi.taux_chomage_bit"), "pourcent"),
        "climat": (m("ecologie.emissions_territoriales_totales", "environnement_energie.emissions_ges_hors_utcatf"), "mt_co2e"),
    }
    return {k: ({**v, "unite": u} if v else {"valeur": None}) for k, (v, u) in vals.items()}


# ───────────────────────── stockage ─────────────────────────
def lire(emp: str) -> dict | None:
    r = db.row(db.connect().execute("SELECT * FROM indicateurs_cles WHERE empreinte = ?", (emp,)).fetchone())
    if r:
        r["indicateurs"] = db.loads(r["indicateurs"]) if r["indicateurs"] else None
    return r


def enregistrer(emp: str, sid: str, branche: str, commit_id: str, cle: str, statut: str, indicateurs: dict | None,
                erreur: str | None = None, duree: float | None = None):
    with db.transaction() as c:
        c.execute("INSERT OR REPLACE INTO indicateurs_cles (empreinte, society_id, branche, commit_id, cle_modele, statut, indicateurs,"
                  " erreur, duree_s) VALUES (?,?,?,?,?,?,?,?,?)",
                  (emp, sid, branche, commit_id, cle, statut, db.dumps(indicateurs) if indicateurs is not None else None,
                   (erreur or "")[:1000] or None, duree))


# ───────────────────────── file de calcul ─────────────────────────
_FILE: deque[tuple[str, str]] = deque()
_COND = threading.Condition()
_EN_COURS: dict = {"job": None}
_FIL: dict = {"thread": None}


def actif() -> bool:
    return os.environ.get("SOCIETE_INDICATEURS", "1") != "0"


def demander(sid: str, branche: str = vcs.BRANCHE_PRINCIPALE, prioritaire: bool = False) -> bool:
    """Met une proposition dans la file de calcul. Renvoie False si la file est pleine (on redemandera plus tard)."""
    job = (sid, branche)
    with _COND:
        if job == _EN_COURS["job"]:
            return True
        if job in _FILE:
            if prioritaire:
                _FILE.remove(job)
                _FILE.appendleft(job)
            return True
        if len(_FILE) >= MAX_FILE:
            if not prioritaire:
                return False
            _FILE.pop()  # une proposition qu'on vient de modifier passe avant une demande paresseuse
        if prioritaire:
            _FILE.appendleft(job)
        else:
            _FILE.append(job)
        _COND.notify()
    return True


def en_attente(sid: str, branche: str = vcs.BRANCHE_PRINCIPALE) -> bool:
    with _COND:
        return (sid, branche) == _EN_COURS["job"] or (sid, branche) in _FILE


def calculer(store, sid: str, branche: str = vcs.BRANCHE_PRINCIPALE, simuler=None) -> dict | None:
    """Calcule et garde les indicateurs d'une proposition (rien si déjà gardés pour cet état). Une seule à la fois."""
    if simuler is None:
        from .impacts.simulation import simuler
    head, ov = overrides_societe(store, sid, branche)
    emp, cle = empreinte(store, ov), cle_modele(store)
    if (deja := lire(emp)) is not None:
        return deja
    t0 = time.time()
    try:
        rapport = simuler(store, ov, None, None, None)
        enregistrer(emp, sid, branche, head, cle, "pret", extraire(rapport), duree=round(time.time() - t0, 1))
    except Exception as e:  # une proposition qui fait échouer le calcul ne doit pas bloquer les autres
        log.exception("Indicateurs de %s : échec", sid)
        enregistrer(emp, sid, branche, head, cle, "erreur", None, f"{type(e).__name__}: {e}", round(time.time() - t0, 1))
    return lire(emp)


def _baisser_priorite():
    try:  # sous Linux, chaque fil a sa propre priorité : seul ce fil passe en arrière-plan
        os.setpriority(os.PRIO_PROCESS, threading.get_native_id(), 10)
    except (AttributeError, OSError, PermissionError):
        pass


def _boucle():
    from .impacts import microsim
    from .model_store import get_store
    _baisser_priorite()
    while True:
        with _COND:
            while not _FILE:
                _COND.wait()
            job = _FILE.popleft()
            _EN_COURS["job"] = job
        try:
            while not microsim.PRET:  # les calculs de référence d'abord (démarrage, mise à jour du modèle)
                time.sleep(5)
            calculer(get_store(), *job)
        except Exception:  # pragma: no cover  (proposition supprimée, branche disparue…)
            log.exception("Indicateurs : tâche %s abandonnée", job)
        finally:
            with _COND:
                _EN_COURS["job"] = None
        time.sleep(PAUSE_S)


def demarrer():
    if not actif() or _FIL["thread"] is not None:
        return
    t = threading.Thread(target=_boucle, daemon=True, name="indicateurs-cles")
    _FIL["thread"] = t
    t.start()


# ───────────────────────── ce que l'API renvoie ─────────────────────────
def pour_societe(store, soc: dict, branche: str = vcs.BRANCHE_PRINCIPALE, etat: dict | None = None, demander_si_absent: bool = True) -> dict:
    """{statut: reference | pret | en_calcul | erreur | aucun_changement, valeurs: {...}, calcule_le}"""
    if soc.get("reference"):
        return {"statut": "reference", "valeurs": situation_actuelle(store)}
    try:
        if etat is None:
            etat = vcs.state_of(vcs.branch_head(soc["id"], branche))
    except Exception:
        return {"statut": "erreur", "valeurs": None}
    ov = overrides_de(store, etat)
    if not ov:
        return {"statut": "aucun_changement", "valeurs": None}
    r = lire(empreinte(store, ov))
    if r and r["statut"] == "pret":
        return {"statut": "pret", "valeurs": r["indicateurs"], "calcule_le": r["created_at"]}
    if r and r["statut"] == "erreur":
        return {"statut": "erreur", "valeurs": None}
    if demander_si_absent and actif():
        demander(soc["id"], branche)
    return {"statut": "en_calcul", "valeurs": None}
