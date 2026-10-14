"""Banc d'essai : les réformes chiffrées par des institutions publiques (Cour des comptes, COR, DG Trésor, PLF…)
sont rejouées par le moteur, et l'écart entre notre chiffre et le leur est publié.

Chaque référence (model/etalonnage/*.yaml) décrit la réforme par des changements de règles, éventuellement relatifs
à la loi en vigueur, pour rester valable quand la loi change :

    overrides:
      fiscalite.tva.taux_normal: 21                        # valeur absolue
      fiscalite.csg.salaires_taux: {plus: 1}               # + 1 (point, euro…)
      prestations.rsa.montant_forfaitaire: {fois: 1.1}     # + 10 %
      "retraites.age_legal.generation_*": {max: 62}        # toutes les règles correspondantes, plafonnées à 62
      fiscalite.impot_revenu.bareme: {taux: {11: 14}}      # un taux du barème remplacé
      fiscalite.impot_revenu.bareme: {ajout: [{seuil: 250000, taux: 50}]}

Le chiffre comparé est l'effet direct sur les finances publiques (comportements inchangés, comme un chiffrage
d'amendement) pour les références « statique » ou « constate », et l'effet total hors retour de la croissance à court
terme pour « avec_comportements ».
"""
from __future__ import annotations

import datetime as dt
import fnmatch
import json
import time
from pathlib import Path

from .model_store import MODEL_DIR

RESULTATS = MODEL_DIR / "etalonnage" / "resultats.json"
# écart toléré pour dire « concordant » : 15 % du chiffrage officiel, ou 0,2 Md€ pour les petites mesures
TOLERANCE_REL, TOLERANCE_ABS, PROCHE_REL = 0.15, 0.2, 0.35


def _appliquer(op, actuelle):
    """Valeur de la règle après l'opération décrite dans la référence."""
    if not isinstance(op, dict):
        return op
    if "plus" in op:
        return round(float(actuelle) + float(op["plus"]), 6)
    if "fois" in op:
        return round(float(actuelle) * float(op["fois"]), 6)
    if "max" in op:
        return min(float(actuelle), float(op["max"]))
    if "min" in op:
        return max(float(actuelle), float(op["min"]))
    if "taux" in op:  # barème : {ancien taux: nouveau taux}
        rempl = {float(k): float(v) for k, v in op["taux"].items()}
        return [{**t, "taux": rempl.get(float(t["taux"]), t["taux"])} for t in actuelle]
    if "ajout" in op:  # barème : nouvelles tranches (les tranches existantes au-delà du seuil sont retirées)
        seuil_min = min(float(t["seuil"]) for t in op["ajout"])
        return sorted([t for t in actuelle if float(t["seuil"]) < seuil_min] + list(op["ajout"]), key=lambda t: float(t["seuil"]))
    raise ValueError(f"Opération inconnue : {op}")


def overrides_de(store, ref: dict) -> dict:
    out = {}
    for motif, op in ref["overrides"].items():
        ids = [rid for rid in store.regles if fnmatch.fnmatchcase(rid, motif)] if any(c in motif for c in "*?[") else [motif]
        for rid in ids:
            if rid not in store.regles:
                raise KeyError(f"Règle inconnue dans la référence {ref['id']} : {rid}")
            v = _appliquer(op, store.regles[rid]["valeur"])
            if v != store.regles[rid]["valeur"]:
                out[rid] = v
    return out


def verdict(simule: float, officiel: float, fourchette: list | None) -> str:
    if fourchette and len(fourchette) == 2:
        bas, haut = sorted(float(x) for x in fourchette)
        marge = 0.1 * max(abs(bas), abs(haut))
        if bas - marge <= simule <= haut + marge:
            return "concordant"
    if officiel and simule * officiel < 0 and abs(simule) > TOLERANCE_ABS:
        return "ecart"  # pas le même sens
    ecart = abs(simule - officiel)
    if ecart <= TOLERANCE_ABS or (officiel and ecart / abs(officiel) <= TOLERANCE_REL):
        return "concordant"
    if officiel and ecart / abs(officiel) <= PROCHE_REL:
        return "proche"
    return "ecart"


def rejouer(store, ref: dict) -> dict:
    from .impacts import simulation
    t0 = time.time()
    try:
        ov = overrides_de(store, ref)
        rapport = simulation.simuler(store, ov)
    except Exception as e:  # une référence défaillante ne doit pas bloquer les autres
        return {"id": ref["id"], "erreur": f"{type(e).__name__}: {e}"}
    budget = next((e for e in rapport["equilibres"] if e["id"] == "budget"), None)
    direct = float(budget["effet"]) if budget else 0.0
    total = rapport["synthese"].get("solde_public_annuel_md") or 0.0
    # « avec comportements » : réactions des personnes (emploi, contribuables), sans l'effet macroéconomique de court terme
    # (retour de la croissance), que les chiffrages officiels à moyen terme ne comptent pas
    retour = sum(i["valeur"] or 0 for s in rapport["sections"] for i in s["indicateurs"] if i["id"] == "solde_public_retour_croissance")
    total = float(total) - retour
    simule = total if ref.get("perimetre") == "avec_comportements" else direct
    officiel = float(ref["valeur_md"])
    return {
        "id": ref["id"], "simule_md": round(simule, 3), "direct_md": round(direct, 3), "total_md": round(float(total), 3),
        "officiel_md": officiel, "ecart_md": round(simule - officiel, 3),
        "ecart_pct": round((simule - officiel) / abs(officiel) * 100, 1) if officiel else None,
        "verdict": verdict(simule, officiel, ref.get("fourchette_md")), "regles": sorted(ov), "duree": round(time.time() - t0, 1),
    }


def tout_rejouer(store, ids: list[str] | None = None) -> dict:
    from .engine.openfisca_engine import ENGINE
    anciens = {r["id"]: r for r in lire().get("resultats", [])}
    for ref in store.etalonnage:
        if ids and ref["id"] not in ids:
            continue
        anciens[ref["id"]] = rejouer(store, ref)
    connus = {r["id"] for r in store.etalonnage}
    res = {"genere_le": dt.datetime.now().isoformat(timespec="seconds"), "moteur": getattr(ENGINE, "version", ""),
           "resultats": [r for k, r in anciens.items() if k in connus]}
    RESULTATS.parent.mkdir(parents=True, exist_ok=True)
    RESULTATS.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


def lire() -> dict:
    try:
        return json.loads(Path(RESULTATS).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def vue(store) -> dict:
    """Références et derniers résultats, pour le site."""
    res = {r["id"]: r for r in lire().get("resultats", [])}
    items = []
    for ref in store.etalonnage:
        src = store.sources.get(ref.get("source_id"), {})
        items.append({**{k: ref.get(k) for k in ("id", "reforme", "titre", "valeur_md", "fourchette_md", "perimetre", "annee",
                                                 "citation", "note", "domaine", "comparabilite")},
                      "source": {"id": ref.get("source_id"), "titre": src.get("titre"), "editeur": src.get("editeur"), "url": src.get("url")},
                      "resultat": res.get(ref["id"])})
    r = [i["resultat"] for i in items if i["resultat"] and not i["resultat"].get("erreur")]
    return {"genere_le": lire().get("genere_le"), "references": items,
            "bilan": {v: sum(1 for x in r if x["verdict"] == v) for v in ("concordant", "proche", "ecart")}}


def reference_pour(store, overrides: dict) -> dict | None:
    """La référence officielle qui correspond exactement à ces changements de règles (pour l'afficher à côté du calcul)."""
    for ref in store.etalonnage:
        try:
            if overrides_de(store, ref) == overrides:
                src = store.sources.get(ref.get("source_id"), {})
                return {"id": ref["id"], "valeur_md": ref["valeur_md"], "annee": ref.get("annee"), "perimetre": ref.get("perimetre"),
                        "fourchette_md": ref.get("fourchette_md"), "source": {"editeur": src.get("editeur"), "titre": src.get("titre"), "url": src.get("url")}}
        except (KeyError, ValueError, TypeError):
            continue
    return None
