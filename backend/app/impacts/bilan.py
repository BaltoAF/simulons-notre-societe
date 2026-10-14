"""Le bilan d'une réforme en quatre piliers : économie, social, écologie, bien-être.

Chaque pilier reprend les indicateurs clés calculés par les modules d'impact, avec leur confiance, et un
verdict lisible (amélioration, dégradation, effets contrastés). Rien n'est agrégé en une note unique :
les arbitrages entre piliers appartiennent au citoyen.
"""
from __future__ import annotations

from .base import Section

PILIERS = [
    ("economie", "Économie", ["solde_public_mecanique", "solde_public_credits", "pib", "emploi_"]),
    ("social", "Social", ["gini", "pauvrete", "gagnants", "pouvoir_achat_tva_d1"]),
    ("ecologie", "Écologie", ["emissions_", "impact_emissions_activite"]),
    ("bien_etre", "Bien-être", ["bien_etre_satisfaction", "bien_etre_satisfaction_d1", "securite_routiere_tues_", "consommation_tabac",
                                "bien_etre_emploi", "temps_libre", "bien_etre_temps_travail", "bien_etre_sante_retraite"]),
]


# En dessous de ces seuils, l'effet est présenté comme « quasiment inchangé » : il ne doit pas colorer le verdict.
NEGLIGEABLE = {"bien_etre_satisfaction": 0.002, "pib": 0.01, "gini": 0.02, "pauvrete": 0.02, "emissions_": 0.005,
               "impact_emissions_activite": 0.005, "equilibre_carbone": 0.005, "emploi_": 500, "equilibre_budget": 0.05}
# Un effet de confiance très faible est affiché, mais ne suffit pas à juger un pilier.
CONFIANCE_MIN_VERDICT = 25


def _negligeable(item: dict) -> bool:
    v = abs(item["valeur"] or 0)
    for motif, seuil in NEGLIGEABLE.items():
        if item["id"] == motif or (motif.endswith("_") and item["id"].startswith(motif)) or item["id"].startswith(motif + "_"):
            return v < seuil
    return False


def _item(i, section: Section) -> dict:
    return {"id": i.id, "libelle": i.libelle, "valeur": i.valeur, "unite": i.unite, "sens": i.sens, "section": section.id,
            "confiance": i.confiance.to_dict() if i.confiance else None,
            "perdants": section.donnees.get("perdants_pct") if i.id == "gagnants" else None,
            # l'activité mêle des mécanismes de sens contraires : le résumé dit lesquels
            "explication": i.explication if i.id == "pib" else None}


def construire(sections: list[Section], equilibres: list[dict]) -> list[dict]:
    tous = [(s, i) for s in sections for i in s.indicateurs if i.valeur is not None]
    out = []
    for pid, titre, motifs in PILIERS:
        items = []
        for motif in motifs:
            for s, i in tous:
                if (i.id == motif or (motif.endswith("_") and i.id.startswith(motif))) and all(x["id"] != i.id for x in items):
                    items.append(_item(i, s))
        if pid == "economie":
            eq = next((e for e in equilibres if e["id"] == "budget"), None)
            if eq and (any(x["id"].startswith("solde_public") for x in items) or abs(eq["effet"]) > 0.01):
                items = [x for x in items if not x["id"].startswith("solde_public")]
                items.insert(0, {"id": "equilibre_budget", "libelle": "Effet direct sur les finances publiques (par an)",
                                 "valeur": eq["effet"], "unite": "milliards_euros",
                                 "sens": "favorable" if eq["effet"] > 0.05 else "defavorable" if eq["effet"] < -0.05 else "neutre",
                                 "section": "budget", "confiance": eq["confiance"]})
        if pid == "ecologie":
            eq = next((e for e in equilibres if e["id"] == "carbone"), None)
            directs = [x for x in items if x["id"].startswith("emissions_")]
            if eq and directs:
                items = [x for x in items if not x["id"].startswith("emissions_")]
                # si l'essentiel vient de la consommation (revenus en hausse ou en baisse), la phrase le dira
                dominant = max(directs, key=lambda x: abs(x["valeur"] or 0))
                via_revenus = dominant["id"] == "emissions_revenus" and abs(dominant["valeur"] or 0) >= 0.5 * abs(eq["effet"] or 0)
                items.insert(0, {"id": "equilibre_carbone_revenus" if via_revenus else "equilibre_carbone",
                                 "libelle": "Émissions de gaz à effet de serre (effet direct, par an)",
                                 "valeur": eq["effet"], "unite": "mt_co2e",
                                 "sens": "favorable" if eq["effet"] < -0.01 else "defavorable" if eq["effet"] > 0.01 else "neutre",
                                 "section": "planete", "confiance": eq["confiance"]})
        for x in items:
            if _negligeable(x):
                x["sens"] = "neutre"
            if x["id"] == "gagnants":  # nettement plus de perdants que de gagnants (ou l'inverse) : cela compte aussi
                g, p = x["valeur"] or 0, x.get("perdants") or 0
                x["sens"] = "favorable" if g - p >= 20 else "defavorable" if p - g >= 20 else "neutre"
        comptes = [x for x in items if (x["confiance"] or {}).get("score", 30) >= CONFIANCE_MIN_VERDICT]
        pos = sum((x["confiance"] or {}).get("score", 30) for x in comptes if x["sens"] == "favorable")
        neg = sum((x["confiance"] or {}).get("score", 30) for x in comptes if x["sens"] == "defavorable")
        if not items:
            verdict = "non_mesure"
        elif not pos and not neg and any(x["sens"] != "neutre" for x in items):
            verdict = "incertain"
        elif pos and neg and min(pos, neg) > 0.35 * max(pos, neg):
            verdict = "contraste"
        elif pos > neg:
            verdict = "amelioration"
        elif neg > pos:
            verdict = "degradation"
        else:
            verdict = "neutre"
        out.append({"pilier": pid, "titre": titre, "verdict": verdict, "indicateurs": items[:5]})
    return out
