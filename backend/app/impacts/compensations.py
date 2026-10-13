"""Propositions de compensation : comment rétablir un équilibre dégradé par une réforme.

Pour chaque levier de compensation, le Système connaît son rendement marginal (Md€ ou MtCO2e par unité),
tiré des mêmes données que les simulations (population synthétique, recettes officielles, études). Il en
déduit l'ajustement nécessaire pour combler le manque, que l'utilisateur peut appliquer d'un clic ; la
simulation complète vérifie ensuite le résultat. Les propositions sont présentées sans hiérarchie
politique : dépenses d'abord (esprit de l'article 40), recettes ensuite, puis la possibilité d'assumer.
"""
from __future__ import annotations

import math

from .comportements import metrique
from .equilibres import R_ART40

MISSIONS_EXCLUES = ("engagements_financiers", "remboursements", "charge_dette", "credits_non_repartis")


def _arrondi(x: float, pas: float) -> float:
    return round(math.ceil(abs(x) / pas) * pas * (1 if x >= 0 else -1), 6)


def _baseline_population(store):
    from .contexte import Contexte
    from .microsim import _agreger, charger_population
    pop = charger_population()
    if pop is None:
        return None
    menages, poids, _ = pop
    ctx = Contexte.creer(store, {})
    base = ctx.calculer(menages, reforme=False)
    a = _agreger(base)
    a["csg_salaire"] = base["csg_salaire"]
    return {k: float((v * poids).sum() * 12 / 1e9) for k, v in a.items()}


def _valeur(store, overrides, rid):
    return overrides.get(rid, store.rule_value(rid))


def options_budget(store, overrides: dict, manque: float) -> list[dict]:
    out = []
    agg = _baseline_population(store) or {}
    # 1. Dépenses : toutes les missions de l'État à proportion
    missions = {rid: _valeur(store, overrides, rid) for rid in store.regles
                if rid.startswith("budget.etat.mission.") and not any(x in rid for x in MISSIONS_EXCLUES)}
    missions = {k: float(v) for k, v in missions.items() if isinstance(v, (int, float)) and v > 0}
    total = sum(missions.values())
    if total:
        pct = _arrondi(manque / total * 100, 0.1)
        out.append({"id": "missions_proportion", "famille": "depenses",
                    "titre": f"Baisser de {pct:g} % les crédits de toutes les missions de l'État",
                    "description": f"Chaque ministère fait un effort proportionnel (hors charge de la dette et remboursements d'impôts), sur {total:.0f} Md€ de crédits.",
                    "rendement": round(total * pct / 100, 2),
                    "overrides": {rid: round(v * (1 - pct / 100), 3) for rid, v in missions.items()}})
        # la plus grosse mission (exemple d'arbitrage ciblé ; l'utilisateur peut en choisir une autre dans l'éditeur du budget)
    # 2. Recettes
    tva, _, _ = metrique(store, "fiscalite.tva.recettes_brutes_totales", "finances_publiques.recettes.tva")
    part, _, _ = metrique(store, "fiscalite.tva.part_recettes_taux_normal")
    taux_tva = _valeur(store, overrides, "fiscalite.tva.taux_normal")
    if tva and part and taux_tva:
        par_pt = tva * part / 100 / float(taux_tva)
        d = _arrondi(manque / par_pt, 0.1)
        out.append({"id": "tva", "famille": "recettes", "titre": f"Relever la TVA normale de {taux_tva:g} % à {float(taux_tva) + d:g} %",
                    "description": "Rapide à mettre en œuvre ; pèse proportionnellement plus sur les ménages modestes.",
                    "rendement": round(par_pt * d, 2), "overrides": {"fiscalite.tva.taux_normal": round(float(taux_tva) + d, 2)}})
    csg = _valeur(store, overrides, "fiscalite.csg.salaires_taux")
    if agg.get("csg_salaire") and csg:
        # rendement net : une CSG plus élevée réduit le salaire net et relève un peu la prime d'activité (≈ 15 % de déperdition)
        par_pt = agg["csg_salaire"] * 0.85 / float(csg)
        d = _arrondi(manque / par_pt, 0.05)
        out.append({"id": "csg", "famille": "recettes", "titre": f"Relever la CSG sur les revenus d'activité de {csg:g} % à {float(csg) + d:g} %",
                    "description": "Assiette très large : salaires et revenus d'activité.",
                    "rendement": round(par_pt * d, 2), "overrides": {"fiscalite.csg.salaires_taux": round(float(csg) + d, 3)}})
    bareme = _valeur(store, overrides, "fiscalite.impot_revenu.bareme")
    if agg.get("impot_revenu+pfu") and isinstance(bareme, list):
        ir = agg["impot_revenu+pfu"] * 0.9
        pct = _arrondi(manque / ir * 100, 0.5)
        out.append({"id": "ir", "famille": "recettes", "titre": f"Augmenter de {pct:g} % tous les taux de l'impôt sur le revenu",
                    "description": "Progressif : concerne surtout les foyers aux revenus moyens et élevés (moins de la moitié des foyers paie l'impôt).",
                    "rendement": round(ir * pct / 100, 2),
                    "overrides": {"fiscalite.impot_revenu.bareme": [{"seuil": b["seuil"], "taux": round(b["taux"] * (1 + pct / 100), 2)} for b in bareme]}})
    is_, _, _ = metrique(store, "finances_publiques.recettes.impot_societes")
    taux_is = _valeur(store, overrides, "fiscalite.is.taux_normal")
    if is_ and taux_is:
        par_pt = is_ / float(taux_is)
        d = _arrondi(manque / par_pt, 0.5)
        out.append({"id": "is", "famille": "recettes", "titre": f"Relever l'impôt sur les sociétés de {taux_is:g} % à {float(taux_is) + d:g} %",
                    "description": "Rendement direct ; les études divergent sur l'effet sur l'investissement.",
                    "rendement": round(par_pt * d, 2), "overrides": {"fiscalite.is.taux_normal": round(float(taux_is) + d, 2)}})
    # 3. Assumer
    if R_ART40 in store.regles:
        out.append({"id": "assumer", "famille": "assumer", "titre": "Assumer un déficit plus élevé",
                    "description": "Votre société renonce à la règle de l'article 40 : la réforme est financée par la dette, dont l'évolution reste affichée.",
                    "rendement": 0, "overrides": {R_ART40: False}})
    for o in out:
        o["unite"] = "milliards_euros"
    return out


def options_carbone(store, overrides: dict, manque: float) -> list[dict]:
    out = []
    em_route, _, _ = metrique(store, "environnement.emissions_co2_transport_routier")
    vol_g, _, _ = metrique(store, "energie.consommation_gazole_routier")
    vol_e, _, _ = metrique(store, "energie.consommation_essence_routier")
    from ..evidence import valeur_ou_defaut
    elas, _, _ = valeur_ou_defaut(store, "elasticite_prix_carburants", -0.34)
    for rid, prix_id, vol, lib in [("environnement_energie.accise.gazole", "ecologie.prix_moyen_gazole", vol_g, "gazole"),
                                   ("environnement_energie.accise.sp95_e10", "ecologie.prix_moyen_sp95_e10", vol_e, "essence")]:
        prix, _, _ = metrique(store, prix_id)
        acc = _valeur(store, overrides, rid)
        if not (em_route and vol_g and vol_e and prix and acc):
            continue
        part = vol / (vol_g + vol_e)
        par_euro_hl = -em_route * part * elas * (0.012 / prix)  # baisse d'émissions (Mt) par €/hl d'accise
        if par_euro_hl <= 0:
            continue
        d = _arrondi(manque / par_euro_hl, 0.5)
        out.append({"id": f"accise_{lib}", "famille": "recettes", "titre": f"Relever l'accise sur le {lib} de {acc:g} à {float(acc) + d:g} €/hl",
                    "description": f"Environ +{d * 1.2 / 100:.2f} € par litre à la pompe ; réduit la consommation et les émissions du transport routier.",
                    "rendement": round(par_euro_hl * d, 3), "unite": "mt_co2e", "overrides": {rid: round(float(acc) + d, 2)}})
    return out


def proposer(store, overrides: dict, equilibre: str, manque: float) -> dict:
    if manque <= 0:
        return {"options": []}
    opts = options_budget(store, overrides, manque) if equilibre == "budget" else options_carbone(store, overrides, manque)
    return {"options": opts,
            "note": "Rendements estimés à partir des données de simulation ; la nouvelle simulation vérifie le résultat après application."}
