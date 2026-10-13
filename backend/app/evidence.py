"""Synthèse des études (base de preuves) et indice de confiance associé.

Pour chaque question (ex. « effet d'une hausse du SMIC sur l'emploi »), on dispose de plusieurs
estimations, parfois contradictoires. Le Système TRANCHE en calculant une valeur retenue, mais il
publie aussi la fourchette, le poids de chaque étude et un indice de confiance détaillé.

Méthode (volontairement simple et explicable) :
  poids d'une étude = qualité × pertinence pour la France × fraîcheur × précision
  valeur retenue    = médiane pondérée des estimations (robuste aux études extrêmes)
  fourchette        = percentiles pondérés 10 % – 90 %
  confiance         = moyenne géométrique pondérée : volume (25 %), qualité (25 %), accord (30 %), pertinence (20 %)
                      — un seul facteur faible (études contradictoires, trop peu nombreuses…) suffit à faire baisser l'indice.
"""
from __future__ import annotations

import math

from .confidence import Confiance, Facteur

QUALITE_TYPE = {
    "meta_analyse": 1.0,
    "experimental": 0.95,
    "quasi_experimental": 0.85,
    "structurel": 0.65,
    "simulation_institutionnelle": 0.6,
    "descriptif": 0.5,
}
LIBELLE_TYPE = {
    "meta_analyse": "Méta-analyse",
    "experimental": "Expérimentation contrôlée",
    "quasi_experimental": "Quasi-expérience",
    "structurel": "Modèle structurel",
    "simulation_institutionnelle": "Simulation institutionnelle",
    "descriptif": "Étude descriptive",
}
EUROPE = {"FR", "DE", "IT", "ES", "PT", "BE", "NL", "LU", "AT", "CH", "UK", "GB", "IE", "DK", "SE", "NO", "FI",
          "PL", "CZ", "SK", "HU", "SI", "HR", "GR", "EE", "LV", "LT", "RO", "BG", "UE", "EU", "ZE", "EUROPE", "EA"}


def _pertinence(pays: str | None) -> float:
    if not pays:
        return 0.6
    codes = {c.strip().upper() for c in str(pays).replace("/", ",").replace(";", ",").split(",") if c.strip()}
    if "FR" in codes or "FRANCE" in codes:
        return 1.0
    if codes & EUROPE:
        return 0.75
    if codes & {"OCDE", "OECD", "INT", "MONDE", "WORLD", "MULTI", "INTERNATIONAL"}:
        return 0.7
    return 0.55


def _fraicheur(annee) -> float:
    try:
        y = int(str(annee)[:4])
    except (TypeError, ValueError):
        return 0.8
    if y >= 2015:
        return 1.0
    if y >= 2005:
        return 0.85
    if y >= 1995:
        return 0.7
    return 0.55


def _wquantile(values: list[float], weights: list[float], q: float) -> float:
    pairs = sorted(zip(values, weights))
    total = sum(w for _, w in pairs)
    acc = 0.0
    for v, w in pairs:
        acc += w
        if acc >= q * total - 1e-12:
            return v
    return pairs[-1][0]


def synthese(question: dict, store=None) -> dict:
    """Calcule la synthèse d'une fiche de preuves. `store` permet de qualifier les sources citées."""
    lignes = []
    for e in question.get("estimations", []):
        val = e.get("valeur")
        src = (store.sources.get(str(e.get("source"))) if store else None) or {}
        fiab = src.get("fiabilite", 0.6)
        q_type = QUALITE_TYPE.get(e.get("type_etude"), 0.5)
        peer = 1.0 if e.get("revue_par_les_pairs") else 0.8
        qualite = q_type * peer * (0.5 + 0.5 * fiab)
        pert = _pertinence(e.get("pays"))
        fraich = _fraicheur(e.get("annee_donnees") or src.get("date_publication"))
        ic = e.get("intervalle_95")
        se = None
        if isinstance(ic, (list, tuple)) and len(ic) == 2 and all(isinstance(x, (int, float)) for x in ic):
            se = abs(ic[1] - ic[0]) / 3.92 or None
        lignes.append({
            "source": e.get("source"),
            "titre_source": src.get("titre"),
            "auteurs": src.get("auteurs") or [],
            "url": src.get("url"),
            "valeur": val if isinstance(val, (int, float)) else None,
            "intervalle_95": ic,
            "methode": e.get("methode"),
            "champ": e.get("champ"),
            "pays": e.get("pays"),
            "annee_donnees": e.get("annee_donnees"),
            "type_etude": e.get("type_etude"),
            "type_etude_libelle": LIBELLE_TYPE.get(e.get("type_etude"), e.get("type_etude") or "—"),
            "revue_par_les_pairs": bool(e.get("revue_par_les_pairs")),
            "note": e.get("note"),
            "_qualite": qualite, "_pertinence": pert, "_fraicheur": fraich, "_se": se,
        })

    num = [l for l in lignes if l["valeur"] is not None]
    ses = sorted(l["_se"] for l in num if l["_se"])
    med_se = ses[len(ses) // 2] if ses else None
    for l in lignes:
        prec = 1.0
        if l["valeur"] is not None and l["_se"] and med_se:
            prec = max(0.5, min(2.0, med_se / l["_se"]))
        l["poids_brut"] = l["_qualite"] * l["_pertinence"] * l["_fraicheur"] * prec if l["valeur"] is not None else 0.0

    total = sum(l["poids_brut"] for l in num) or 1.0
    for l in lignes:
        l["poids"] = round(l["poids_brut"] / total, 4) if l["valeur"] is not None else 0.0
        l["qualite"] = round(l.pop("_qualite"), 3)
        l["pertinence"] = round(l.pop("_pertinence"), 3)
        l["fraicheur"] = round(l.pop("_fraicheur"), 3)
        l.pop("_se")
        l.pop("poids_brut")

    result = {
        "question_id": question.get("id"),
        "unite": question.get("unite"),
        "n_estimations": len(lignes),
        "n_chiffrees": len(num),
        "estimations": lignes,
    }
    if not num:
        result.update({"valeur_retenue": None, "fourchette": None,
                       "confiance": Confiance(5, [Facteur("Volume de preuves", 0, "Aucune estimation chiffrée.")],
                                              "Aucune estimation chiffrée").to_dict()})
        return result

    vals = [l["valeur"] for l in num]
    ws = [l["poids"] for l in num]
    med = _wquantile(vals, ws, 0.5)
    p10, p25, p75, p90 = (_wquantile(vals, ws, q) for q in (0.1, 0.25, 0.75, 0.9))
    mean_abs = sum(abs(v) * w for v, w in zip(vals, ws))

    # facteurs de confiance
    n_eff = (sum(ws) ** 2) / sum(w * w for w in ws)
    f_vol = min(1.0, n_eff / 6.0)
    f_qual = sum(l["qualite"] * l["poids"] for l in num)
    sign = 1 if med > 0 else (-1 if med < 0 else 0)
    if sign == 0:
        accord_signe = sum(w for v, w in zip(vals, ws) if abs(v) <= 0.25 * (mean_abs or 1))
    else:
        accord_signe = sum(w for v, w in zip(vals, ws) if v * sign > 0)
    echelle = max(abs(med), 0.25 * mean_abs, 1e-9)
    dispersion = (p90 - p10) / echelle  # largeur de la fourchette plausible rapportée à la valeur retenue
    f_acc = accord_signe * (1.0 / (1.0 + dispersion))
    f_pert = sum(l["pertinence"] * l["poids"] for l in num)
    eps = 1e-3
    score = 100 * (max(f_vol, eps) ** 0.25) * (max(f_qual, eps) ** 0.25) * (max(f_acc, eps) ** 0.30) * (max(f_pert, eps) ** 0.20)
    if len(num) == 1:
        score = min(score, 35)
    sens = question.get("sens_attendu")
    facteurs = [
        Facteur("Volume de preuves", f_vol,
                f"{len(num)} estimation(s) chiffrée(s), soit l'équivalent de {n_eff:.1f} études indépendantes de même poids (6 ou plus = maximum)."),
        Facteur("Qualité des études", f_qual,
                "Moyenne pondérée de la qualité : méta-analyses et expériences contrôlées comptent plus que les études descriptives ; la relecture par des pairs et le sérieux de l'éditeur aussi."),
        Facteur("Accord entre les études", f_acc,
                f"{accord_signe * 100:.0f} % du poids des études va dans le même sens que la valeur retenue ; "
                f"la fourchette plausible (10e-90e percentile) est {dispersion:.1f} fois plus large que la valeur retenue."),
        Facteur("Pertinence pour la France", f_pert,
                "Les études menées en France comptent pleinement, celles d'autres pays européens un peu moins, celles d'ailleurs encore moins."),
    ]
    resume = f"Synthèse de {len(num)} estimation(s)"
    result.update({
        "valeur_retenue": med,
        "fourchette": [p10, p90],
        "quartiles": [p25, p75],
        "moyenne_ponderee": sum(v * w for v, w in zip(vals, ws)),
        "sens_attendu": sens,
        "confiance": Confiance(score, facteurs, resume).to_dict(),
    })
    return result


def synthese_par_id(store, qid: str) -> dict | None:
    q = store.preuves.get(qid)
    return synthese(q, store) if q else None


def confiance_objet(syn: dict) -> Confiance:
    c = syn["confiance"]
    return Confiance(c["score"], [Facteur(f["nom"], f["valeur"], f["explication"]) for f in c["facteurs"]], c["resume"])


def valeur_ou_defaut(store, qid: str, defaut: float, ajustement: float = 1.0) -> tuple[float, Confiance, dict | None]:
    """Valeur retenue d'une question de preuves, ou valeur par défaut (confiance très faible) si la fiche manque."""
    syn = synthese_par_id(store, qid)
    if syn and syn.get("valeur_retenue") is not None:
        return syn["valeur_retenue"] * ajustement, confiance_objet(syn), syn
    return defaut, Confiance(10, [Facteur("Volume de preuves", 0.0,
                                         "Fiche de preuves absente : valeur conventionnelle provisoire.")],
                             "Hypothèse provisoire sans fiche de preuves"), None


def is_number(x) -> bool:
    return isinstance(x, (int, float)) and not (isinstance(x, float) and math.isnan(x))
