"""API de Société 2.0 (FastAPI) + service du site web compilé."""
from __future__ import annotations

import logging
import threading
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import auth, db, planificateur, vcs
from . import config
from .config import FRONTEND_DIST, REFERENCE_SOCIETY_ID
from .engine.household import Menage
from .engine.openfisca_engine import ENGINE
from .evidence import synthese
from .impacts import simulation
from .impacts.menages import simuler_menage_seul
from .model_store import TYPES_SOURCE, get_store

log = logging.getLogger("societe")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    db.init_db()
    store = get_store()
    vcs.ensure_reference(store)
    from .impacts.microsim import prechauffer
    threading.Thread(target=prechauffer, args=(store,), daemon=True).start()
    planificateur.demarrer()
    yield


app = FastAPI(title="Société 2.0", version="0.1.0", lifespan=lifespan,
              description="Numériser les règles de la société française, les forker et mesurer les impacts.")
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ───────────────────────── méta ─────────────────────────
@app.get("/api/sante")
def sante():
    return {"ok": True, "moteur_pret": ENGINE.ready, "moteur_version": ENGINE.version, "erreur_moteur": ENGINE.error}


@app.get("/api/pret")
def pret():
    """Le Système a-t-il fini de préparer ses calculs de référence (après un démarrage ou une mise à jour) ?"""
    from .impacts import microsim
    return {"pret": microsim.PRET}


@app.get("/api/meta")
def meta():
    store = get_store()
    head = vcs.commit_view(vcs.reference_head())
    domaines = []
    stats = store.stats()
    for d in store.domaines:
        domaines.append({**d, "nb_regles": stats["par_domaine"].get(d["id"], 0)})
    return {
        "date_reference": config.TODAY.isoformat(), "mois_reference": config.MOIS_REFERENCE, "annee_reference": config.ANNEE_REFERENCE,
        "stats": stats, "domaines": domaines, "version_societe": head["base_snapshot"], "dernier_commit_systeme": head,
        "moteur": {"nom": "OpenFisca-France", "version": ENGINE.version, "pret": ENGINE.ready},
        "types_sources": TYPES_SOURCE,
    }


def _local_seulement(request: Request):
    if request.client and request.client.host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(403, "Réservé au Système")


@app.post("/api/admin/recharger")
def recharger(request: Request):
    """Réservé au Système (appel local) : recharge le modèle, publie un commit si besoin, met à jour les forks."""
    _local_seulement(request)
    return planificateur.recharger("demande du Système")


@app.post("/api/admin/maj")
def maj_manuelle(request: Request):
    """Réservé au Système (appel local) : lance immédiatement la mise à jour quotidienne en arrière-plan."""
    _local_seulement(request)
    threading.Thread(target=planificateur.lancer_maj_quotidienne, args=("manuel",), daemon=True).start()
    return {"statut": "lancee"}


# ───────────────────────── règles ─────────────────────────
def _modeles_couverts(store) -> set[str]:
    from .impacts import comportements, budget_etat
    s = {rid for rid, r in store.regles.items() if r.get("moteur") or rid in store.correspondances}
    s |= {rid for rid, r in store.regles.items() if budget_etat.est_depense(rid, r)}
    s |= {"prestations.revenu_universel.montant", "prestations.revenu_universel.age_minimum",
          "prestations.revenu_universel.remplace_rsa_prime_activite"}
    s |= set(getattr(comportements, "REGLES_COUVERTES", set()))
    # l'âge légal se règle pour toutes les générations à la fois (effet chiffré sur l'âge « à terme »)
    s |= {rid for rid in store.regles if rid.startswith("retraites.age_legal.")}
    s |= {rid for rid in store.regles if rid.startswith(("budget.regles.article_40", "budget.regles.deficit_public_max",
                                                          "environnement_energie.budget_carbone.periode_"))}
    return s


def est_levier(rule: dict) -> bool:
    """Une règle est un levier si un fork peut la modifier. Les résultats (recettes, soldes, prévisions)
    et les doublons de contrôle croisé ne le sont pas."""
    from .impacts.budget_etat import est_depense
    if rule.get("levier") is False:
        return False
    rid = rule["id"]
    if ".controle." in rid:
        return False
    if rule["domaine"] == "budget":
        return est_depense(rid, rule) or rid in ("budget.regles.article_40_irrecevabilite_financiere",
                                                 "budget.regles.deficit_public_max_pct_pib")
    return True


def resume_regle(store, r: dict, couverts: set[str]) -> dict:
    types = [store.sources.get(s, {}).get("type") for s in r["valeur_sources"]]
    ordre = list(TYPES_SOURCE)
    meilleur = min((t for t in types if t in ordre), key=ordre.index, default=None)
    return {
        "id": r["id"], "titre": r["titre"], "domaine": r["domaine"], "theme": r["theme"], "type": r["type"],
        "unite": r["unite"], "valeur": r["valeur"], "valeur_depuis": r["valeur_depuis"],
        "nb_sources": len(r["valeur_sources"]), "meilleure_source": meilleur, "a_verifier": bool(r.get("a_verifier")),
        "simulable": r["id"] in couverts, "levier": est_levier(r), "virtuel": bool(r.get("virtuel")),
        "bornes": r.get("bornes"), "choix": r.get("choix"), "explication": r.get("explication", ""),
        "prochaine_valeur": r.get("prochaine_valeur"),
    }


# Règles que le grand public cherche le plus : affichées en tête de leur thème et des recherches
REGLES_CLES = ["travail.smic.horaire_brut", "prestations.rsa.montant_forfaitaire", "prestations.prime_activite.montant_forfaitaire",
               "retraites.age_legal.generation_1969_et_apres", "fiscalite.impot_revenu.bareme", "fiscalite.tva.taux_normal",
               "fiscalite.csg.salaires_taux", "travail.duree.legale_hebdomadaire", "prestations.famille.af_nombre_enfants_minimum",
               "transports.vitesse_max.autoroute"]


def cle_tri(texte: str) -> str:
    """Clé de tri insensible aux accents et à la casse : « Âge » se range avec les « A », pas après le Z."""
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", texte or "") if unicodedata.category(c) != "Mn").lower()


def rang_regle(r: dict) -> tuple:
    return (REGLES_CLES.index(r["id"]) if r["id"] in REGLES_CLES else len(REGLES_CLES), cle_tri(r["titre"]))


@app.get("/api/regles")
def list_regles(domaine: str | None = None, q: str | None = None, simulable: bool | None = None,
                limit: int = 500, offset: int = 0):
    store = get_store()
    couverts = _modeles_couverts(store)
    items = list(store.regles.values())
    if domaine:
        items = [r for r in items if r["domaine"] == domaine]
    if q:
        # tous les mots, dans n'importe quel ordre, sans tenir compte des accents
        mots = cle_tri(q).split()
        items = [r for r in items if all(m in cle_tri(" ".join([r["titre"], r["id"], r.get("explication") or "", r["theme"]])) for m in mots)]
    if simulable is not None:
        items = [r for r in items if (r["id"] in couverts) == simulable]
    items.sort(key=lambda r: (r["domaine"], cle_tri(r["theme"]), *rang_regle(r)))
    return {"total": len(items), "regles": [resume_regle(store, r, couverts) for r in items[offset:offset + limit]]}


@app.get("/api/regles/{rid}")
def get_regle(rid: str):
    store = get_store()
    r = store.regles.get(rid)
    if not r:
        raise HTTPException(404, "Règle introuvable")
    couverts = _modeles_couverts(store)
    srcs = {}
    for v in r["valeurs"]:
        for s in v["sources"]:
            if s in store.sources:
                srcs[s] = store.sources[s]
    preuves = []
    for qid, q in store.preuves.items():
        if rid in (q.get("regles_liees") or []):
            syn = synthese(q, store)
            preuves.append({"id": qid, "titre": q.get("titre"), "unite": q.get("unite"),
                            "valeur_retenue": syn.get("valeur_retenue"), "fourchette": syn.get("fourchette"),
                            "confiance": syn.get("confiance"), "n_estimations": syn.get("n_estimations")})
    return {**resume_regle(store, r, couverts), "valeurs": r["valeurs"], "sources": list(srcs.values()),
            "note": r.get("note"), "tags": r.get("tags", []), "fichier": r["fichier"], "genere": r.get("genere"),
            "verifie_le": r.get("verifie_le"), "moteur": r.get("moteur"), "preuves": preuves,
            "controles": r.get("controles", []),
            "article": next((v.get("article") for v in reversed(r["valeurs"]) if v.get("article")), None)}


@app.get("/api/domaines/{did}")
def get_domaine(did: str):
    store = get_store()
    d = next((x for x in store.domaines if x["id"] == did), None)
    if not d:
        raise HTTPException(404, "Domaine introuvable")
    couverts = _modeles_couverts(store)
    regles = sorted((r for r in store.regles.values() if r["domaine"] == did), key=lambda r: (cle_tri(r["theme"]), *rang_regle(r)))
    themes: dict[str, list] = {}
    for r in regles:
        themes.setdefault(r["theme"], []).append(resume_regle(store, r, couverts))
    prefixes = {"fiscalite": ("impot", "finances", "revenus"), "prestations": ("prestations",),
                "budget": ("finances_publiques", "apu", "macro"), "travail": ("emploi", "travail", "salaires", "chomage"),
                "retraites": ("retraite",), "justice_penale": ("justice", "penal", "prison"),
                "institutions": ("institutions", "elections"), "education": ("education",), "sante": ("sante",),
                "logement": ("logement",), "environnement_energie": ("environnement", "energie", "climat"),
                "nationalite_immigration": ("immigration", "nationalite", "asile"),
                "droit_civil": ("famille", "civil", "demographie")}.get(did, (did,))
    metriques = [_metric_summary(m) for mid, m in sorted(store.metriques.items())
                 if any(mid.startswith(p) or p in mid for p in prefixes)][:40]
    return {**d, "themes": [{"titre": t, "regles": rs} for t, rs in themes.items()], "metriques": metriques}


# ───────────────────────── sources, métriques, preuves ─────────────────────────
@app.get("/api/sources")
def list_sources(type: str | None = None, q: str | None = None, limit: int = 300, offset: int = 0):
    store = get_store()
    items = list(store.sources.values())
    if type:
        items = [s for s in items if s.get("type") == type]
    if q:
        ql = q.lower()
        items = [s for s in items if ql in (s.get("titre") or "").lower() or ql in (s.get("editeur") or "").lower()
                 or ql in " ".join(s.get("auteurs") or []).lower()]
    ordre = list(TYPES_SOURCE)
    items.sort(key=lambda s: (ordre.index(s["type"]) if s.get("type") in ordre else 99, -len(store.citations.get(s["id"], []))))
    out = []
    for s in items[offset:offset + limit]:
        out.append({**{k: s.get(k) for k in ("id", "type", "editeur", "titre", "url", "date_publication", "consulte_le",
                                              "auteurs", "fiabilite")},
                    "nb_citations": len(store.citations.get(s["id"], []))})
    par_type = {}
    for s in store.sources.values():
        par_type[s.get("type")] = par_type.get(s.get("type"), 0) + 1
    return {"total": len(items), "par_type": par_type, "sources": out}


@app.get("/api/sources/{sid}")
def get_source(sid: str):
    store = get_store()
    s = store.sources.get(sid)
    if not s:
        raise HTTPException(404, "Source introuvable")
    cit = []
    for c in store.citations.get(sid, []):
        if c["type"] == "regle" and c["id"] in store.regles:
            cit.append({**c, "titre": store.regles[c["id"]]["titre"]})
        elif c["type"] == "metrique" and c["id"] in store.metriques:
            cit.append({**c, "titre": store.metriques[c["id"]].get("titre")})
        elif c["type"] == "preuve" and c["id"] in store.preuves:
            cit.append({**c, "titre": store.preuves[c["id"]].get("titre")})
    uniq = {(c["type"], c["id"]): c for c in cit}
    return {**s, "citee_par": list(uniq.values())}


def _metric_summary(m: dict) -> dict:
    return {"id": m["id"], "titre": m.get("titre"), "unite": m.get("unite"), "derniere": m.get("derniere"),
            "explication": m.get("explication", ""), "nb_points": len(m.get("serie", []))}


@app.get("/api/metriques")
def list_metriques(q: str | None = None, prefixe: str | None = None):
    store = get_store()
    items = sorted(store.metriques.values(), key=lambda m: m["id"])
    if prefixe:
        items = [m for m in items if m["id"].startswith(prefixe)]
    if q:
        ql = q.lower()
        items = [m for m in items if ql in (m.get("titre") or "").lower() or ql in m["id"].lower()]
    return {"total": len(items), "metriques": [_metric_summary(m) for m in items]}


@app.get("/api/metriques/{mid}")
def get_metrique(mid: str):
    store = get_store()
    m = store.metriques.get(mid)
    if not m:
        raise HTTPException(404, "Métrique introuvable")
    srcs = {p.get("source"): store.sources.get(p.get("source")) for p in m["serie"] if p.get("source")}
    return {**m, "sources": [s for s in srcs.values() if s]}


@app.get("/api/preuves")
def list_preuves():
    store = get_store()
    out = []
    for qid, q in sorted(store.preuves.items()):
        syn = synthese(q, store)
        out.append({"id": qid, "titre": q.get("titre"), "definition": q.get("definition"), "unite": q.get("unite"),
                    "valeur_retenue": syn.get("valeur_retenue"), "fourchette": syn.get("fourchette"),
                    "n_estimations": syn["n_estimations"], "confiance": syn["confiance"],
                    "regles_liees": q.get("regles_liees") or []})
    return {"total": len(out), "preuves": out}


@app.get("/api/preuves/{qid}")
def get_preuve(qid: str):
    store = get_store()
    q = store.preuves.get(qid)
    if not q:
        raise HTTPException(404, "Fiche introuvable")
    syn = synthese(q, store)
    regles = [{"id": rid, "titre": store.regles[rid]["titre"]} for rid in (q.get("regles_liees") or []) if rid in store.regles]
    return {"id": qid, "titre": q.get("titre"), "definition": q.get("definition"), "unite": q.get("unite"),
            "sens_attendu": q.get("sens_attendu"), "note_synthese": q.get("note_synthese"), "regles_liees": regles,
            "fichier": q["fichier"], "synthese": syn}


@app.get("/api/qualite")
def qualite():
    store = get_store()
    etat_liens = {}
    chemin = config.DATA_DIR / "sources_etat.json"
    if chemin.exists():
        import json as _json
        try:
            etat_liens = _json.loads(chemin.read_text(encoding="utf-8"))
        except ValueError:
            etat_liens = {}
    bilan_liens = {}
    for v in etat_liens.values():
        bilan_liens[v.get("statut")] = bilan_liens.get(v.get("statut"), 0) + 1
    introuvables = [{"id": k, "titre": store.sources.get(k, {}).get("titre"), "verifie_le": v.get("verifie_le")}
                    for k, v in etat_liens.items() if v.get("statut") == "introuvable"][:30]
    return {"stats": store.stats(), "problemes": [i.to_dict() for i in store.issues][:500], "controles": store.controles,
            "liens": {"verifies": len(etat_liens), "total": sum(1 for x in store.sources.values() if (x.get("url") or "").startswith("http")),
                      "bilan": bilan_liens, "introuvables": introuvables}}


# ───────────────────────── simulations ─────────────────────────
class MenageIn(BaseModel):
    menage: dict
    montants: str = "net"  # net | brut


def menage_depuis_saisie(payload: dict, montants: str) -> tuple[Menage, list[str]]:
    approximations = []
    data = dict(payload)
    adultes = []
    for a in data.get("adultes", [])[:2]:
        a = dict(a)
        if montants == "net":
            for champ, kind in (("salaire_brut_mensuel", "salaire"), ("chomage_brut_mensuel", "chomage"),
                                ("retraite_brute_mensuelle", "retraite")):
                net_key = champ.replace("brut_mensuel", "net_mensuel").replace("brute_mensuelle", "nette_mensuelle")
                net = float(a.pop(net_key, 0) or a.get(champ, 0) or 0)
                if net > 0:
                    if not ENGINE.ready:
                        ENGINE.load()
                    a[champ] = ENGINE.net_to_brut(kind, net)
                    approximations.append("Montants saisis en net, convertis en brut par le moteur.")
                else:
                    a[champ] = 0
        adultes.append(a)
    data["adultes"] = adultes
    m = Menage.from_dict(data)
    if montants == "net":
        m = _ajuster_au_net(m, payload)
    return m, sorted(set(approximations))


def _ajuster_au_net(m: Menage, payload: dict, tours: int = 2) -> Menage:
    """La conversion net → brut se fait sur un cas type ; mais la CSG d'une pension dépend du revenu de tout le foyer.
    On corrige donc le brut jusqu'à ce que le moteur retrouve exactement les montants nets saisis par la personne."""
    from dataclasses import replace
    cibles = {}
    for kind, champ, sortie in (("salaire", "salaire_net_mensuel", "salaire_net"), ("retraite", "retraite_nette_mensuelle", "retraite_nette"),
                                ("chomage", "chomage_net_mensuel", "chomage_net")):
        total = sum(float(a.get(champ, 0) or 0) for a in payload.get("adultes", [])[:2])
        if total > 0:
            cibles[kind] = (total, sortie)
    brut_attr = {"salaire": "salaire_brut_mensuel", "retraite": "retraite_brute_mensuelle", "chomage": "chomage_brut_mensuel"}
    for _ in range(tours):
        if not cibles:
            break
        res = ENGINE.compute([m])
        adultes = list(m.adultes)
        bouge = False
        for kind, (cible, sortie) in cibles.items():
            obtenu = float(res[sortie][0])
            if obtenu > 0 and abs(obtenu - cible) > 0.5:
                f = cible / obtenu
                adultes = [replace(a, **{brut_attr[kind]: round(getattr(a, brut_attr[kind]) * f, 2)}) for a in adultes]
                bouge = True
        if not bouge:
            break
        m = replace(m, adultes=adultes)
    return m


@app.post("/api/simulation/menage")
def simuler_menage(body: MenageIn):
    if not ENGINE.ready:
        ENGINE.load()
    store = get_store()
    m, approx = menage_depuis_saisie(body.menage, body.montants)
    res = simuler_menage_seul(store, m, approx)
    res["menage"] = m.to_dict()
    return res


class ReformeIn(BaseModel):
    overrides: dict[str, Any] = Field(default_factory=dict)
    societe: str | None = None
    branche: str = vcs.BRANCHE_PRINCIPALE
    menage: dict | None = None
    montants: str = "net"
    modules: list[str] | None = None  # ex. ["menage"] pour un calcul rapide limité au foyer


@app.post("/api/simulation/reforme")
def simuler_reforme(body: ReformeIn, user: dict | None = Depends(auth.current_user)):
    if not ENGINE.ready:
        ENGINE.load()
    store = get_store()
    overrides = dict(body.overrides)
    if body.societe:
        soc = vcs.get_society(body.societe)
        if soc["visibilite"] == "privee" and (not user or user["id"] != soc["owner_id"]):
            raise HTTPException(403, "Société privée")
        ref = store.snapshot()
        st = vcs.state_of(vcs.branch_head(body.societe, body.branche))
        base = {k: v for k, v in st.items() if k in ref and vcs.db.dumps(v) != vcs.db.dumps(ref[k])}
        base.update(overrides)
        overrides = base
    menage, approx = (None, [])
    if body.menage:
        menage, approx = menage_depuis_saisie(body.menage, body.montants)
    return simulation.simuler(store, overrides, menage, approx, body.modules)


@app.get("/api/budget/national")
def budget_national():
    """Où va l'argent public, d'où il vient, ramené par habitant et par ménage."""
    from .budget_vue import vue_nationale
    return vue_nationale(get_store())


@app.post("/api/budget/menage")
def budget_menage(body: MenageIn):
    """Ce que paie et reçoit un ménage, et ce que finance sa contribution."""
    from .budget_vue import vue_menage
    if not ENGINE.ready:
        ENGINE.load()
    m, _ = menage_depuis_saisie(body.menage, body.montants)
    return vue_menage(get_store(), m)


class DroitsIn(BaseModel):
    profil: dict
    societe: str | None = None
    branche: str = vcs.BRANCHE_PRINCIPALE


@app.post("/api/droits")
def droits(body: DroitsIn, user: dict | None = Depends(auth.current_user)):
    """Vos droits au-delà de l'argent, dans la Société 1.0 et, en option, dans une autre société (comparaison)."""
    from .droits import comparer, repondre
    store = get_store()
    ref = store.snapshot()
    if not body.societe:
        return {"reponses": repondre(ref, body.profil)}
    soc = vcs.get_society(body.societe)
    _check_visible(soc, user)
    st = vcs.state_of(vcs.branch_head(body.societe, body.branche))
    return {"reponses": comparer(ref, st, body.profil), "societe": {"id": soc["id"], "nom": soc["nom"]}}


class CompensationIn(BaseModel):
    overrides: dict[str, Any] = Field(default_factory=dict)
    equilibre: str = "budget"
    manque: float


@app.post("/api/compensations")
def compensations(body: CompensationIn):
    """Propositions pour compenser une réforme qui dégrade un équilibre (finances publiques, budget carbone)."""
    from .impacts.compensations import proposer
    return proposer(get_store(), body.overrides, body.equilibre, body.manque)


# ───────────────────────── comptes ─────────────────────────
class InscriptionIn(BaseModel):
    pseudo: str
    email: str
    mot_de_passe: str


class ConnexionIn(BaseModel):
    identifiant: str
    mot_de_passe: str


def _set_cookie(resp: Response, token: str):
    resp.set_cookie("societe_session", token, httponly=True, samesite="lax", max_age=30 * 86400)


@app.post("/api/auth/inscription")
def inscription(body: InscriptionIn, response: Response):
    user, token = auth.register(body.pseudo, body.email, body.mot_de_passe)
    _set_cookie(response, token)
    return {"utilisateur": user, "token": token}


@app.post("/api/auth/connexion")
def connexion(body: ConnexionIn, response: Response):
    user, token = auth.login(body.identifiant, body.mot_de_passe)
    _set_cookie(response, token)
    return {"utilisateur": user, "token": token}


@app.post("/api/auth/deconnexion")
def deconnexion(request: Request, response: Response):
    token = request.cookies.get("societe_session")
    if token:
        auth.logout(token)
    response.delete_cookie("societe_session")
    return {"ok": True}


@app.get("/api/auth/moi")
def moi(user: dict | None = Depends(auth.current_user)):
    return {"utilisateur": auth.public_user(user)}


# ───────────────────────── sociétés (forks) ─────────────────────────
class ForkIn(BaseModel):
    source: str = REFERENCE_SOCIETY_ID
    branche: str = vcs.BRANCHE_PRINCIPALE
    nom: str = ""
    description: str = ""
    visibilite: str = "publique"
    changements: list[dict] = Field(default_factory=list)
    message: str = ""


@app.get("/api/societes")
def list_societes(tri: str = "recent", q: str = "", auteur: str | None = None,
                  user: dict | None = Depends(auth.current_user)):
    return {"societes": vcs.list_societies(get_store(), user, tri, q, auteur)}


@app.post("/api/societes")
def creer_societe(body: ForkIn, user: dict = Depends(auth.require_user)):
    soc = vcs.fork(user, body.source, body.branche, body.nom, body.description, body.visibilite)
    if body.changements:
        vcs.commit(user, get_store(), soc["id"], vcs.BRANCHE_PRINCIPALE, body.changements,
                   body.message or "Premières modifications")
    return vcs.get_society(soc["id"])


def _check_visible(soc: dict, user: dict | None):
    if soc["visibilite"] == "privee" and (not user or user["id"] != soc["owner_id"]):
        raise HTTPException(404, "Société introuvable")


@app.get("/api/societes/{sid}")
def get_societe(sid: str, branche: str = vcs.BRANCHE_PRINCIPALE, user: dict | None = Depends(auth.current_user)):
    store = get_store()
    soc = vcs.get_society(sid)
    _check_visible(soc, user)
    head = vcs.branch_head(sid, branche)
    st = vcs.state_of(head)
    diff = vcs.diff_states(vcs.reference_state(), st, store)
    parent_diff = None
    if soc["parent_id"] and soc["parent_id"] != REFERENCE_SOCIETY_ID:
        try:
            pst = vcs.state_of(vcs.branch_head(soc["parent_id"], vcs.BRANCHE_PRINCIPALE))
            parent_diff = vcs.diff_states(pst, st, store)
        except HTTPException:
            parent_diff = None
    ref_head = vcs.reference_head()
    a_jour = ref_head in set(vcs._ancestors(head))
    if not soc["reference"] and diff:
        prov = vcs.provenance(sid, branche, {d["regle"] for d in diff})
        orig = vcs.origines(sid, branche, {d["regle"] for d in diff})
        for d in diff:
            d["provenance"] = prov.get(d["regle"])
            d["pour_equilibrer"] = vcs.est_equilibrage(orig.get(d["regle"]))
            try:
                d["variation_pct"] = (float(d["apres"]) / float(d["avant"]) - 1) * 100 if float(d["avant"]) else None
            except (TypeError, ValueError):
                d["variation_pct"] = None
    mises_a_jour = [c for c in vcs.log(sid, branche, 60) if c["auteur_systeme"] and c["society_id"] == sid][:10]
    return {**soc, "branche": branche, "head": vcs.commit_view(head), "branches": vcs.list_branches(sid),
            "differences_reference": diff, "differences_parent": parent_diff, "a_jour_reference": a_jour,
            "conflits_loi": [c for c in vcs.conflits_en_attente(sid) if c["branche"] == branche],
            "mises_a_jour_auto": mises_a_jour,
            "etoile": vcs.has_star(user, sid), "proprietaire": bool(user and user["id"] == soc["owner_id"]),
            "propositions": vcs.list_proposals(sid)}


class SocietePatch(BaseModel):
    nom: str | None = None
    description: str | None = None
    visibilite: str | None = None


@app.patch("/api/societes/{sid}")
def patch_societe(sid: str, body: SocietePatch, user: dict = Depends(auth.require_user)):
    return vcs.update_society(user, sid, body.nom, body.description, body.visibilite)


class BrancheIn(BaseModel):
    nom: str
    depuis: str = vcs.BRANCHE_PRINCIPALE


@app.post("/api/societes/{sid}/branches")
def creer_branche(sid: str, body: BrancheIn, user: dict = Depends(auth.require_user)):
    return vcs.create_branch(user, sid, body.nom, body.depuis)


@app.get("/api/societes/{sid}/commits")
def commits(sid: str, branche: str = vcs.BRANCHE_PRINCIPALE, user: dict | None = Depends(auth.current_user)):
    _check_visible(vcs.get_society(sid), user)
    return {"commits": vcs.log(sid, branche)}


class CommitIn(BaseModel):
    branche: str = vcs.BRANCHE_PRINCIPALE
    changements: list[dict]
    message: str = ""


@app.post("/api/societes/{sid}/commits")
def creer_commit(sid: str, body: CommitIn, user: dict = Depends(auth.require_user)):
    return vcs.commit(user, get_store(), sid, body.branche, body.changements, body.message)


@app.get("/api/commits/{cid}")
def get_commit(cid: str):
    return vcs.commit_view(cid)


@app.get("/api/societes/{sid}/etat")
def etat_societe(sid: str, branche: str = vcs.BRANCHE_PRINCIPALE, user: dict | None = Depends(auth.current_user)):
    """Surcharges de la branche par rapport à la Société 1.0 actuelle (pour l'atelier de réforme)."""
    store = get_store()
    _check_visible(vcs.get_society(sid), user)
    st = vcs.state_of(vcs.branch_head(sid, branche))
    ref = store.snapshot()
    return {"overrides": {k: v for k, v in st.items() if k in ref and vcs.db.dumps(v) != vcs.db.dumps(ref[k])}}


class SyncIn(BaseModel):
    branche: str = vcs.BRANCHE_PRINCIPALE
    resolutions: dict[str, str] = Field(default_factory=dict)


@app.post("/api/societes/{sid}/synchroniser")
def synchroniser(sid: str, body: SyncIn, user: dict = Depends(auth.require_user)):
    return vcs.sync_with_reference(user, get_store(), sid, body.branche, body.resolutions)


@app.post("/api/societes/{sid}/etoile")
def etoile(sid: str, user: dict = Depends(auth.require_user)):
    return vcs.toggle_star(user, sid)


@app.get("/api/comparer")
def comparer(a: str, b: str, branche_a: str = vcs.BRANCHE_PRINCIPALE, branche_b: str = vcs.BRANCHE_PRINCIPALE,
             user: dict | None = Depends(auth.current_user)):
    store = get_store()
    sa, sb = vcs.get_society(a), vcs.get_society(b)
    _check_visible(sa, user)
    _check_visible(sb, user)
    da = vcs.state_of(vcs.branch_head(a, branche_a))
    dbb = vcs.state_of(vcs.branch_head(b, branche_b))
    return {"a": {"id": a, "nom": sa["nom"]}, "b": {"id": b, "nom": sb["nom"]},
            "differences": vcs.diff_states(da, dbb, store)}


# ── propositions ──
class PropositionIn(BaseModel):
    source: str
    source_branche: str = vcs.BRANCHE_PRINCIPALE
    cible: str
    cible_branche: str = vcs.BRANCHE_PRINCIPALE
    titre: str
    description: str = ""


@app.post("/api/propositions")
def creer_proposition(body: PropositionIn, user: dict = Depends(auth.require_user)):
    return vcs.create_proposal(user, body.source, body.source_branche, body.cible, body.cible_branche,
                               body.titre, body.description)


@app.get("/api/propositions/{pid}")
def get_proposition(pid: int):
    p = vcs.get_proposal(pid, get_store())
    p["commentaires"] = vcs.list_comments("proposition", str(pid))
    return p


class FusionIn(BaseModel):
    resolutions: dict[str, str] = Field(default_factory=dict)


@app.post("/api/propositions/{pid}/fusionner")
def fusionner(pid: int, body: FusionIn, user: dict = Depends(auth.require_user)):
    return vcs.merge_proposal(user, get_store(), pid, body.resolutions)


@app.post("/api/propositions/{pid}/fermer")
def fermer(pid: int, user: dict = Depends(auth.require_user)):
    return vcs.close_proposal(user, pid)


class CommentaireIn(BaseModel):
    cible_type: str
    cible_id: str
    corps: str


@app.get("/api/commentaires")
def commentaires(cible_type: str, cible_id: str):
    return {"commentaires": vcs.list_comments(cible_type, cible_id)}


@app.post("/api/commentaires")
def commenter(body: CommentaireIn, user: dict = Depends(auth.require_user)):
    return vcs.add_comment(user, body.cible_type, body.cible_id, body.corps)


# ───────────────────────── le Système ─────────────────────────
@app.get("/api/systeme/journal")
def journal(limit: int = 50):
    return {"commits": vcs.log(REFERENCE_SOCIETY_ID, vcs.BRANCHE_PRINCIPALE, limit)}


@app.get("/api/systeme/executions")
def executions(limit: int = 30):
    """Journal des mises à jour automatiques du Système et état du planificateur."""
    return {"executions": vcs.log_executions(limit), "planificateur": planificateur.etat()}


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    detail = exc.detail
    body = detail if isinstance(detail, dict) else {"message": detail}
    return JSONResponse(status_code=exc.status_code, content={"erreur": body})


# ───────────────────────── site web compilé ─────────────────────────
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Ressource inconnue")
        f = FRONTEND_DIST / path
        if path and f.is_file():
            return FileResponse(f)
        return FileResponse(FRONTEND_DIST / "index.html")
