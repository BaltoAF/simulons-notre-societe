"""Du budget national au budget de chaque ménage.

- Vue nationale : où va la dépense publique (fonctions COFOG, Eurostat/INSEE), d'où viennent les recettes,
  déficit et dette, ramenés par habitant et par ménage.
- Vue particulière : ce que paie un ménage (impôts directs, CSG, cotisations, TVA estimée, taxe foncière),
  ce qu'il reçoit (prestations), et ce que finance sa contribution, au prorata de la dépense publique.
"""
from __future__ import annotations

import numpy as np

from .engine.household import Menage
from .engine.openfisca_engine import ENGINE

FONCTIONS = [
    ("protection_sociale", "Protection sociale", "Retraites, famille, chômage, logement, lutte contre l'exclusion"),
    ("sante", "Santé", "Hôpitaux, soins de ville, médicaments, prévention"),
    ("services_generaux", "Services publics généraux", "Administration, charge de la dette, recherche fondamentale, action extérieure"),
    ("affaires_economiques", "Affaires économiques", "Transports, aides aux entreprises, agriculture, énergie"),
    ("enseignement", "Enseignement", "Écoles, collèges, lycées, universités"),
    ("defense", "Défense", "Armées"),
    ("ordre_securite", "Ordre et sécurité publics", "Police, gendarmerie, justice, pompiers"),
    ("loisirs_culture", "Loisirs, culture et cultes", "Culture, sport, médias publics"),
    ("logement_equipements", "Logement et équipements collectifs", "Aménagement, eau, éclairage public"),
    ("environnement", "Protection de l'environnement", "Déchets, eaux usées, pollution, biodiversité"),
]
SOUS_PROTECTION = [("protection_sociale_vieillesse", "Retraites (vieillesse)"), ("protection_sociale_survivants", "Pensions de réversion"),
                   ("protection_sociale_maladie_invalidite", "Maladie et invalidité"), ("protection_sociale_famille", "Famille et enfants"),
                   ("protection_sociale_chomage", "Chômage"), ("protection_sociale_logement", "Aides au logement"),
                   ("protection_sociale_exclusion", "Exclusion sociale (minima sociaux)")]
RECETTES = [("finances_publiques.recettes.cotisations_sociales_effectives", "Cotisations sociales"),
            ("finances_publiques.recettes.tva", "TVA"), ("finances_publiques.recettes.csg", "CSG"),
            ("finances_publiques.recettes.impot_revenu", "Impôt sur le revenu"), ("finances_publiques.recettes.impot_societes", "Impôt sur les sociétés"),
            ("finances_publiques.recettes.taxe_fonciere", "Taxe foncière")]


def _m(store, mid):
    m = store.metriques.get(mid)
    if not m or not m.get("derniere"):
        return None
    d = m["derniere"]
    return {"valeur": d.get("valeur"), "date": d.get("date"), "source": d.get("source"), "titre": m.get("titre")}


def vue_nationale(store) -> dict:
    pop = store.metric_value("demographie.population_totale") or 69e6
    men = store.metric_value("menages.nombre_total") or 31.3e6
    fonctions, total = [], 0.0
    for fid, titre, desc in FONCTIONS:
        m = _m(store, f"finances_publiques.cofog_md.{fid}")
        if m and m["valeur"] is not None:
            total += float(m["valeur"])
            fonctions.append({"id": fid, "titre": titre, "description": desc, "md": float(m["valeur"]), "annee": (m["date"] or "")[:4],
                              "source": m["source"]})
    for f in fonctions:
        f["part"] = f["md"] / total if total else None
        f["par_habitant_an"] = f["md"] * 1e9 / pop
        if f["id"] == "protection_sociale":
            f["detail"] = []
            for sid, lib in SOUS_PROTECTION:
                m = _m(store, f"finances_publiques.cofog_md.{sid}")
                if m and m["valeur"] is not None:
                    f["detail"].append({"id": sid, "titre": lib, "md": float(m["valeur"]), "par_habitant_an": float(m["valeur"]) * 1e9 / pop})
    recettes = []
    for mid, lib in RECETTES:
        m = _m(store, mid)
        if m and m["valeur"] is not None:
            recettes.append({"id": mid, "titre": lib, "md": float(m["valeur"]), "annee": (m["date"] or "")[:4], "source": m["source"],
                             "par_habitant_an": float(m["valeur"]) * 1e9 / pop})
    dep = _m(store, "finances_publiques.depenses_publiques")
    rec = _m(store, "finances_publiques.recettes_publiques")
    solde = _m(store, "finances_publiques.solde_public")
    dette = _m(store, "finances_publiques.dette_maastricht")
    # budget de l'État par mission et de la Sécurité sociale par branche (règles votées)
    missions = sorted(({"id": rid, "titre": r["titre"].replace(" : crédits de paiement 2026", "").replace("Mission ", ""),
                        "md": float(r["valeur"])} for rid, r in store.regles.items()
                       if rid.startswith("budget.etat.mission.") and isinstance(r["valeur"], (int, float))), key=lambda x: -x["md"])
    branches = [{"id": rid, "titre": r["titre"], "md": float(r["valeur"])} for rid, r in store.regles.items()
                if rid.startswith("budget.secu.objectif_depenses.") and isinstance(r["valeur"], (int, float))]
    return {
        "population": pop, "menages": men,
        "depenses": dep, "recettes_totales": rec, "solde": solde, "dette": dette,
        "fonctions": fonctions, "total_fonctions": total, "recettes": recettes,
        "par_habitant": {"depense": (dep["valeur"] * 1e9 / pop) if dep else None,
                         "dette": (dette["valeur"] * 1e9 / pop) if dette else None},
        "par_menage": {"depense": (dep["valeur"] * 1e9 / men) if dep else None},
        "etat_missions": missions, "secu_branches": branches,
    }


def _part_tva(store, nv_annuel: float) -> tuple[float | None, str]:
    """Part du revenu disponible consacrée à la TVA, selon la position du ménage dans l'échelle des niveaux de vie."""
    seuils = [store.metric_value(f"revenus.niveau_vie.d{k}") for k in range(1, 10)]
    if any(s is None for s in seuils):
        return None, ""
    dec = 1 + sum(1 for s in seuils if nv_annuel > s)
    connus = {k: store.metric_value(f"consommation.tva_part_revenu_disponible_decile_{k}") for k in (1, 2, 9, 10)}
    connus = {k: v for k, v in connus.items() if v is not None}
    if not connus:
        return None, ""
    if dec in connus:
        return connus[dec] / 100, f"décile {dec}"
    ks = sorted(connus)
    bas = max((k for k in ks if k < dec), default=ks[0])
    haut = min((k for k in ks if k > dec), default=ks[-1])
    if bas == haut:
        return connus[bas] / 100, f"décile {dec}"
    v = connus[bas] + (connus[haut] - connus[bas]) * (dec - bas) / (haut - bas)
    return v / 100, f"décile {dec} (interpolé entre les déciles {bas} et {haut})"


def vue_menage(store, m: Menage) -> dict:
    res = ENGINE.compute([m])
    g = lambda k: float(res[k][0]) * 12  # noqa: E731 — annuel
    nat = vue_nationale(store)
    payes = [
        {"id": "impot_revenu", "titre": "Impôt sur le revenu", "montant": g("impot_revenu") + g("pfu"), "nature": "direct"},
        {"id": "csg_crds", "titre": "CSG et CRDS", "montant": g("csg_salaire") + g("csg_remplacement") + g("crds"), "nature": "direct"},
        {"id": "cotisations", "titre": "Cotisations sociales (part salariale)", "montant": g("cotisations_salariales"), "nature": "direct"},
        {"id": "prelevements_capital", "titre": "Prélèvements sociaux sur l'épargne", "montant": g("prelevements_sociaux_capital"), "nature": "direct"},
    ]
    rd = g("revenu_disponible")
    tva_part, tva_txt = _part_tva(store, float(res["niveau_de_vie"][0]) * 12)
    if tva_part is not None:
        payes.append({"id": "tva", "titre": "TVA (estimation)", "montant": rd * tva_part, "nature": "estime",
                      "note": f"{tva_part * 100:.1f} % du revenu disponible, part moyenne observée pour les ménages du {tva_txt}".replace(".", ",", 1)})
    if m.logement == "proprietaire":
        tf = store.metric_value("impots_locaux.taxe_fonciere_moyenne_par_avis")
        if tf:
            payes.append({"id": "taxe_fonciere", "titre": "Taxe foncière (moyenne nationale)", "montant": float(tf), "nature": "estime",
                          "note": "Montant moyen par propriétaire ; le vôtre dépend de votre commune et de votre logement."})
    employeur = max(0.0, g("cotisations_employeur") - g("allegement_general"))
    total = sum(p["montant"] for p in payes if p["montant"] > 0.5)
    recues = [{"id": k, "titre": t, "montant": g(k)} for k, t in
              [("rsa", "RSA"), ("prime_activite", "Prime d'activité"), ("aides_logement", "Aides au logement"),
               ("allocations_familiales", "Allocations familiales"), ("aah", "AAH"), ("aspa", "Minimum vieillesse"),
               ("complement_familial", "Complément familial"), ("paje", "Prestation d'accueil du jeune enfant"),
               ("ars", "Allocation de rentrée scolaire"), ("asf", "Allocation de soutien familial"), ("bourses", "Bourses scolaires")]
              if g(k) > 0.5]
    finance = []
    for f in nat["fonctions"]:
        if f.get("part"):
            item = {"id": f["id"], "titre": f["titre"], "montant": total * f["part"], "description": f["description"]}
            if f.get("detail"):
                item["detail"] = [{"titre": d["titre"], "montant": total * d["md"] / nat["total_fonctions"]} for d in f["detail"]]
            finance.append(item)
    personnes = m.taille
    return {
        "paye": [p for p in payes if p["montant"] > 0.5], "total_paye": total,
        "cotisations_employeur": employeur, "recu": recues, "total_recu": sum(r["montant"] for r in recues),
        "finance": finance, "revenu_disponible": rd,
        "depense_publique_moyenne_foyer": (nat["par_habitant"]["depense"] or 0) * personnes,
        "personnes": personnes,
        "note": "Montants annuels. La TVA et la taxe foncière sont estimées à partir de moyennes ; la répartition de votre contribution "
                "suit celle de la dépense publique totale (fonctions COFOG).",
    }
