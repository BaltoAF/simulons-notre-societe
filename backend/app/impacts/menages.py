"""Impacts mécaniques sur un foyer (le vôtre) et sur des ménages types."""
from __future__ import annotations

import numpy as np

from ..confidence import Confiance, Facteur, confiance_fixe
from ..engine.household import Adulte, Menage
from ..engine.openfisca_engine import ENGINE, LIBELLES, PRESTATIONS
from .base import Indicateur, Section, signe
from .contexte import Contexte
from . import prix_energie, prix_tva

LIGNES_DETAIL = ["salaire_net", "revenu_micro", "chomage_net", "retraite_nette", "revenus_capital", "pension_alimentaire", "revenu_universel",
                 *PRESTATIONS, "impot_revenu", "pfu", "prelevements_sociaux_capital"]
PRELEVEMENTS = {"impot_revenu", "pfu", "prelevements_sociaux_capital"}


def confiance_moteur(approximations: list[str] | None = None) -> Confiance:
    approximations = approximations or []
    score = 88 - 4 * len(approximations)
    facteurs = [Facteur("Calcul fidèle à la loi", 0.95,
                        "Calcul réalisé par OpenFisca-France, modèle public de la législation socio-fiscale, "
                        "testé sur des milliers de cas et utilisé par l'Assemblée nationale (LexImpact).")]
    for a in approximations:
        facteurs.append(Facteur("Petite approximation", 0.7, a))
    return Confiance(score, facteurs, "Calcul mécanique de la législation")


def detail_menage(res: dict, i: int) -> list[dict]:
    lignes = []
    for k in LIGNES_DETAIL:
        v = float(res.get(k, np.zeros(i + 1))[i])
        if abs(v) >= 0.5:
            lignes.append({"id": k, "libelle": LIBELLES.get(k, k), "montant": round(v, 2),
                           "nature": "prelevement" if k in PRELEVEMENTS else
                           ("prestation" if k in PRESTATIONS or k == "revenu_universel" else "revenu")})
    return lignes


def section_menage(ctx: Contexte) -> Section | None:
    m = ctx.menage
    if m is None:
        return None
    base = ctx.calculer([m], reforme=False)
    ref = ctx.calculer([m], reforme=True) if ctx.touche_moteur else base
    ref, conf_tva = prix_tva.appliquer(ctx, base, ref)  # OpenFisca ne voit pas la TVA payée à chaque achat
    rd0, rd1 = float(base["revenu_disponible"][0]), float(ref["revenu_disponible"][0])
    delta = rd1 - rd0
    lignes = []
    keys = set(LIGNES_DETAIL)
    for k in LIGNES_DETAIL:
        a, b = float(base.get(k)[0]), float(ref.get(k)[0])
        if abs(a) >= 0.5 or abs(b) >= 0.5:
            lignes.append({"id": k, "libelle": LIBELLES.get(k, k), "avant": round(a, 2), "apres": round(b, 2),
                           "delta": round(b - a, 2), "nature": "prelevement" if k in PRELEVEMENTS else
                           ("prestation" if k in PRESTATIONS or k == "revenu_universel" else "revenu")})
    conf = confiance_moteur(ctx.cache.get("approximations_menage"))
    if "tva_prix" in ref:
        cout = -float(ref["tva_prix"][0])  # positif quand la TVA augmente : c'est un coût
        lignes.append({"id": "tva_prix", "libelle": "TVA sur vos achats (estimation)", "avant": 0.0, "apres": round(cout, 2),
                       "delta": round(cout, 2), "nature": "prelevement"})
    # carburants et chauffage : le surcoût (ou l'économie) d'un ménage de niveau de vie comparable
    for poste, x in (ref.get("energie_postes") or {}).items():
        cout = -float(x[0])
        lignes.append({"id": f"energie_{poste}", "libelle": f"{prix_energie.LIBELLES.get(poste, poste)} : taxes payées en plus (estimation)",
                       "avant": 0.0, "apres": round(cout, 2), "delta": round(cout, 2), "nature": "prelevement"})
    if conf_tva is not None:
        conf = Confiance.maillon_faible(conf, conf_tva, resume="Calcul de la législation et estimation des taxes sur les achats")
    ind = Indicateur("revenu_disponible", "Votre revenu disponible", delta, "euros_mois", rd0, rd1, conf,
                     "Ce qui reste chaque mois après impôts et prestations, avant et après la réforme.",
                     ["Revenus nets du foyer + prestations − impôt sur le revenu (÷ 12)"],
                     ["openfisca-france"], [], signe(delta))
    sec = Section("menage", "Pour votre foyer", "Effet direct de la réforme sur votre budget mensuel",
                  [ind], conf,
                  "Calcul des droits et des impôts de votre foyer avec la législation actuelle, puis avec la "
                  "législation modifiée par la réforme, à comportements inchangés.",
                  ["Calcule les droits théoriques : en réalité, une partie des personnes éligibles ne demande pas "
                   "les aides (non-recours).",
                   "Les revenus saisis en net sont convertis en brut par le moteur (approximation de quelques euros)."],
                  {"lignes": lignes}, ordre=10)
    return sec


def cas_types() -> list[Menage]:
    smic = ENGINE._smic_mensuel()
    return [
        Menage([Adulte(30, salaire_brut_mensuel=smic)], loyer_mensuel=550,
               libelle="Personne seule au SMIC, locataire"),
        Menage([Adulte(45, activite="chomeur", chomage_brut_mensuel=1200)], loyer_mensuel=500,
               libelle="Personne seule au chômage, locataire"),
        Menage([Adulte(40, activite="inactif")], loyer_mensuel=450, libelle="Personne seule sans revenu, locataire"),
        Menage([Adulte(35, salaire_brut_mensuel=smic / 2)], enfants=[4, 9], logement="locataire_social",
               loyer_mensuel=520, libelle="Parent isolé, 2 enfants, mi-temps au SMIC"),
        Menage([Adulte(36, salaire_brut_mensuel=smic), Adulte(34, salaire_brut_mensuel=smic)], couple="marie",
               enfants=[6, 10], loyer_mensuel=800, libelle="Couple au SMIC, 2 enfants, locataire"),
        Menage([Adulte(42, salaire_brut_mensuel=2700), Adulte(40, salaire_brut_mensuel=2400)], couple="marie",
               enfants=[8, 12], logement="proprietaire", libelle="Couple aux revenus médians, 2 enfants"),
        Menage([Adulte(38, salaire_brut_mensuel=2500), Adulte(37, activite="inactif")], couple="marie",
               enfants=[2, 5, 9, 13], logement="locataire_social", loyer_mensuel=700,
               libelle="Famille nombreuse, 4 enfants, un salaire"),
        Menage([Adulte(50, salaire_brut_mensuel=5000, cadre=True), Adulte(48, salaire_brut_mensuel=5000, cadre=True)],
               couple="marie", logement="proprietaire", revenus_capital_annuels=3000,
               libelle="Couple de cadres sans enfant"),
        Menage([Adulte(52, salaire_brut_mensuel=12000, cadre=True)], logement="proprietaire",
               revenus_capital_annuels=25000, libelle="Cadre dirigeant, hauts revenus"),
        Menage([Adulte(74, activite="retraite", retraite_brute_mensuelle=1300)], loyer_mensuel=500,
               libelle="Retraité seul, petite pension, locataire"),
        Menage([Adulte(70, activite="retraite", retraite_brute_mensuelle=1900),
                Adulte(68, activite="retraite", retraite_brute_mensuelle=1500)], couple="marie",
               logement="proprietaire", revenus_capital_annuels=2000, libelle="Couple de retraités propriétaires"),
        Menage([Adulte(33, activite="inactif", handicap=True)], loyer_mensuel=450,
               libelle="Personne handicapée sans emploi"),
    ]


def section_cas_types(ctx: Contexte) -> Section | None:
    tva = prix_tva.touche_prix(ctx)
    if not ctx.touche_moteur and not tva:
        return None
    ms = cas_types()
    base = ctx.calculer(ms, reforme=False)
    ref = ctx.calculer(ms, reforme=True) if ctx.touche_moteur else base
    ref, conf_tva = prix_tva.appliquer(ctx, base, ref)
    rows = []
    for i, m in enumerate(ms):
        a, b = float(base["revenu_disponible"][i]), float(ref["revenu_disponible"][i])
        rows.append({"libelle": m.libelle, "avant": round(a, 2), "apres": round(b, 2), "delta": round(b - a, 2),
                     "delta_pct": round((b - a) / a * 100, 2) if a else None,
                     "detail_avant": detail_menage(base, i), "detail_apres": detail_menage(ref, i)})
    gagnants = sum(1 for r in rows if r["delta"] > 0.5)
    perdants = sum(1 for r in rows if r["delta"] < -0.5)
    conf = confiance_moteur()
    if conf_tva is not None:
        conf = Confiance.maillon_faible(conf, conf_tva, resume="Calcul de la législation et estimation de la TVA payée")
    ind = [Indicateur("cas_types_gagnants", "Ménages types gagnants", gagnants, "menages", confiance=conf,
                      explication=f"Sur {len(rows)} ménages types, {gagnants} gagnent et {perdants} perdent du revenu disponible. Ce sont "
                                  "des exemples choisis, pas un échantillon : pour toute la population, voir « Pour les inégalités »."),
           Indicateur("cas_types_perdants", "Ménages types qui y perdent", perdants, "menages", confiance=conf)]
    return Section("cas_types", "Pour des ménages types", "Qui gagne, qui perd, parmi des situations courantes",
                   ind, conf,
                   "Mêmes calculs que pour votre foyer, appliqués à des situations représentatives "
                   "(inspirées des « cas types » utilisés par la DREES et la DG Trésor).",
                   ["Ces ménages illustrent des situations courantes ; ils ne sont pas pondérés par leur poids dans la population."],
                   {"cas": rows}, ordre=20)


def simuler_menage_seul(store, menage: Menage, approximations: list[str] | None = None) -> dict:
    """Droits et impôts d'un foyer dans la loi actuelle (sans réforme)."""
    res = ENGINE.compute([menage])
    return {
        "revenu_disponible": round(float(res["revenu_disponible"][0]), 2),
        "niveau_de_vie": round(float(res["niveau_de_vie"][0]), 2),
        "lignes": detail_menage(res, 0),
        "confiance": confiance_moteur(approximations).to_dict(),
        "unites_consommation": menage.unites_consommation,
        "decote_annuelle": round(abs(float(res.get("decote", [0])[0])) * 12, 0),
        # taux de CSG réellement appliqué à la pension (0 %, 3,8 %, 6,6 % ou 8,3 % selon le revenu du foyer) : sans lui,
        # une personne exonérée croit subir le taux plein dont parle la règle
        "taux_csg_pension": _taux_csg_pension(menage, res),
    }


def _taux_csg_pension(menage: Menage, res) -> float | None:
    pension = sum(a.retraite_brute_mensuelle for a in menage.adultes)
    if pension <= 0 or any(a.chomage_brut_mensuel > 0 for a in menage.adultes):
        return None  # la CSG de remplacement mêlerait chômage et retraite
    return round(abs(float(res["csg_remplacement"][0])) / pension * 100, 1)
