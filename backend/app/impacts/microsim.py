"""Microsimulation sur la population synthétique : impact budgétaire et redistributif d'une réforme.

- Budget : somme pondérée des impôts et prestations simulés, avant / après réforme, en Md€ par an.
  Pour les prestations, la variation de dépense tient compte du non-recours (taux de recours issus de
  la base de preuves quand elle les fournit). Chaque poste est comparé au chiffre officiel observé :
  l'écart pour la situation actuelle fixe l'indice de confiance du poste.
- Inégalités : variation du niveau de vie par décile, indice de Gini, taux de pauvreté.
"""
from __future__ import annotations

import json
import threading
from functools import lru_cache

import numpy as np

from ..config import MODEL_DIR
from ..confidence import Confiance, Facteur, confiance_calage
from ..engine.household import Menage
from ..evidence import synthese_par_id
from .base import Indicateur, Section, fr, signe
from .contexte import Contexte

POPULATION_FILE = MODEL_DIR / "population" / "population.json"
_LOCK = threading.Lock()

# Postes budgétaires : (clé moteur, libellé, nature, métrique officielle de contrôle, facteur appliqué à la métrique)
POSTES = [
    ("impot_revenu+pfu", "Impôt sur le revenu (y c. prélèvement forfaitaire)", "recette", "finances_publiques.recettes.impot_revenu", 1e9),
    ("csg", "CSG", "recette", "finances_publiques.recettes.csg", 1e9),
    ("crds", "CRDS", "recette", "impot.crds.recettes_nettes", 1.0),
    ("cotisations", "Cotisations sociales (salariales et patronales, nettes des allègements)", "recette",
     "finances_publiques.recettes.cotisations_sociales_effectives", 1e9),
    ("prelevements_sociaux_capital", "Prélèvements sociaux sur le capital (hors CSG)", "recette", None, 1.0),
    ("rsa", "RSA", "depense", "prestations.rsa.montant_annuel", 1.0),
    ("prime_activite", "Prime d'activité", "depense", "prestations.prime_activite.montant_annuel", 1.0),
    ("aides_logement", "Aides au logement", "depense", "prestations.aides_logement.montant_annuel", 1.0),
    ("allocations_familiales", "Allocations familiales", "depense", "prestations.allocations_familiales.montant_annuel", 1.0),
    ("autres_famille", "Autres prestations familiales (CF, ASF, PAJE, ARS, bourses)", "depense", None, 1.0),
    ("aah", "Allocation aux adultes handicapés", "depense", "prestations.aah.montant_annuel", 1.0),
    ("aspa", "Minimum vieillesse (ASPA)", "depense", "prestations.minimum_vieillesse.montant_annuel", 1.0),
    ("revenu_universel", "Revenu universel", "depense", None, 1.0),
]
# Taux de recours par défaut (part des personnes éligibles qui demandent l'aide), si la base de preuves ne les fournit pas.
RECOURS_DEFAUT = {"rsa": 0.66, "prime_activite": 0.75, "aides_logement": 0.9, "aspa": 0.5, "aah": 0.9}
MOTS_RECOURS = {"rsa": ["rsa"], "prime_activite": ["prime d'activité", "prime d’activité", "prime d activite"],
                "aides_logement": ["aide au logement", "aides au logement", "aides personnelles au logement", "apl,", "(apl"],
                "aspa": ["minimum vieillesse", "aspa"], "aah": ["aah", "allocation aux adultes handicapés"]}


@lru_cache(maxsize=1)
def charger_population() -> tuple[list[Menage], np.ndarray, dict] | None:
    if not POPULATION_FILE.exists():
        return None
    data = json.loads(POPULATION_FILE.read_text(encoding="utf-8"))
    menages = [Menage.from_dict({k: v for k, v in m.items() if k != "poids"}) for m in data["menages"]]
    for m, raw in zip(menages, data["menages"]):
        m.libelle = raw.get("libelle", "")
    poids = np.array([m["poids"] for m in data["menages"]], dtype=float)
    meta = {k: v for k, v in data.items() if k != "menages"}
    return menages, poids, meta


def _agreger(res: dict) -> dict[str, np.ndarray]:
    """Regroupe les composantes du moteur en postes budgétaires (€/mois par ménage)."""
    return {
        "impot_revenu+pfu": res["impot_revenu"] + res["pfu"],
        "csg": res["csg_salaire"] + res["csg_remplacement"],
        "crds": res["crds"],
        "cotisations": res["cotisations_salariales"] + res["cotisations_employeur"] - res["allegement_general"],
        "prelevements_sociaux_capital": res["prelevements_sociaux_capital"],
        "rsa": res["rsa"], "prime_activite": res["prime_activite"], "aides_logement": res["aides_logement"],
        "allocations_familiales": res["allocations_familiales"],
        "autres_famille": res["complement_familial"] + res["asf"] + res["paje"] + res["ars"] + res["bourses"],
        "aah": res["aah"], "aspa": res["aspa"], "revenu_universel": res.get("revenu_universel", np.zeros_like(res["rsa"])),
    }


def taux_recours(store) -> dict[str, tuple[float, str]]:
    """Taux de recours par prestation : depuis la fiche de preuves « non_recours_prestations » si elle existe."""
    out = {k: (v, "valeur conventionnelle") for k, v in RECOURS_DEFAUT.items()}
    q = store.preuves.get("non_recours_prestations")
    if not q:
        return out
    for key, mots in MOTS_RECOURS.items():
        vals = []
        for e in q.get("estimations", []):
            champ = (e.get("champ") or "").lower()
            debut = champ.split("—")[0]  # la prestation est nommée en tête du champ
            if isinstance(e.get("valeur"), (int, float)) and any(mo in debut or mo in champ[:60] for mo in mots):
                vals.append(float(e["valeur"]))
        if vals:
            nr = float(np.median(vals))
            out[key] = (max(0.05, min(1.0, 1 - nr / 100)), f"médiane de {len(vals)} estimation(s) du non-recours (fiche non_recours_prestations)")
    return out


def _resultats(ctx: Contexte):
    """Résultats avant / après réforme sur la population (mis en cache dans le contexte)."""
    if "microsim" in ctx.cache:
        return ctx.cache["microsim"]
    pop = charger_population()
    if pop is None:
        ctx.cache["microsim"] = None
        return None
    menages, poids, meta = pop
    base = ctx.calculer(menages, reforme=False)
    if "pop_future" in ctx.cache:
        ref = ctx.cache["pop_future"].result()
    else:
        ref = ctx.calculer(menages, reforme=True) if ctx.touche_moteur else base
    ctx.cache["microsim"] = (menages, poids, meta, base, ref)
    return ctx.cache["microsim"]


def section_budget(ctx: Contexte) -> Section | None:
    if not ctx.touche_moteur:
        return None
    r = _resultats(ctx)
    if r is None:
        return None
    menages, poids, meta, base, ref = r
    store = ctx.store
    a0, a1 = _agreger(base), _agreger(ref)
    recours = taux_recours(store)
    postes, solde, confs, poids_conf = [], 0.0, [], []
    for key, lib, nature, metric, facteur in POSTES:
        v0 = float((a0[key] * poids).sum() * 12 / 1e9)
        v1 = float((a1[key] * poids).sum() * 12 / 1e9)
        tr, tr_src = recours.get(key, (1.0, "")) if nature == "depense" else (1.0, "")
        officiel, ecart = None, None
        if metric and metric in store.metriques:
            officiel = store.metric_value(metric) * facteur / 1e9 if facteur != 1e9 else store.metric_value(metric)
            if facteur == 1.0:
                officiel = store.metric_value(metric) / 1e9
            simule_recours = v0 * tr
            ecart = (simule_recours - officiel) / officiel if officiel else None
        delta = (v1 - v0) * tr
        if key == "revenu_universel":
            delta = v1 - v0  # versé automatiquement : pas de non-recours
        effet = delta if nature == "recette" else -delta
        solde += effet
        conf = confiance_calage(ecart, lib) if officiel else Confiance(40, [Facteur("Calage", 0.4, "Pas de chiffre officiel de comparaison pour ce poste.")], lib)
        if abs(delta) > 0.01:
            confs.append(conf)
            poids_conf.append(abs(delta))
        postes.append({"cle": key, "libelle": lib, "nature": nature, "avant": round(v0 * tr, 3), "apres": round(v1 * tr if key != "revenu_universel" else v1, 3),
                       "delta": round(delta, 3), "effet_solde": round(effet, 3), "taux_recours": tr, "source_recours": tr_src,
                       "calage": {"officiel": round(officiel, 2) if officiel else None, "ecart": round(ecart, 3) if ecart is not None else None,
                                  "metrique": metric}, "confiance": conf.to_dict()})
    if confs:
        score = sum(c.score * w for c, w in zip(confs, poids_conf)) / sum(poids_conf)
        conf = Confiance(score - 5, [Facteur("Calage des postes concernés", score / 100,
                                             "Moyenne, pondérée par l'ampleur des variations, de la fiabilité de chaque poste (écart entre simulation et chiffre officiel)."),
                                     Facteur("Population synthétique", 0.6, f"{meta['n_menages']} ménages fictifs calés sur {len(meta['calage'])} statistiques officielles.")],
                         "Microsimulation sur population synthétique")
    else:
        conf = Confiance(60, [], "Aucun poste significativement modifié")
    ctx.cache.setdefault("soldes", {})["microsimulation"] = (solde, conf)
    ctx.cache["postes"] = {p["cle"]: p for p in postes}
    touches = [p for p in postes if abs(p["delta"]) > 0.005]
    detail = ", ".join(f"{p['libelle'].split(' (')[0]} {p['effet_solde']:+.1f}" for p in sorted(touches, key=lambda p: -abs(p["effet_solde"]))[:3])
    ind = [Indicateur("solde_public_mecanique", "Effet sur le solde public (par an, à comportements inchangés)", solde, "milliards_euros",
                      confiance=conf,
                      explication="Recettes en plus moins dépenses en plus, pour l'ensemble des ménages, avant tout effet sur l'activité.",
                      calcul=[f"Σ (poids × variation mensuelle × 12) sur {meta['n_menages']} ménages représentant {meta['menages_representes']:,} ménages".replace(",", " "),
                              "Prestations : variation des droits × taux de recours", detail and f"Principaux postes : {detail} Md€"],
                      sources=["openfisca-france", *meta.get("sources_calage", [])][:8],
                      preuves=["non_recours_prestations"] if any(p["nature"] == "depense" and abs(p["delta"]) > 0.005 for p in postes) else [],
                      sens="favorable" if solde > 0 else "defavorable")]
    return Section("budget", "Pour les finances publiques", f"Impôts et aides des ménages : {'gain' if solde >= 0 else 'coût'} de {fr(abs(solde))} milliard{'s' if round(abs(solde), 1) >= 2 else ''} € par an, avant tout autre effet",
                   ind, conf,
                   "Le moteur calcule impôts et prestations pour chaque ménage de la population synthétique, avec et sans réforme ; "
                   "les montants sont pondérés pour représenter les 31 millions de ménages. La colonne « chiffre officiel » permet de "
                   "juger la fidélité de la simulation pour la situation actuelle.",
                   ["Population synthétique construite à partir de statistiques séparées (pas de données individuelles ouvertes) : ordre de grandeur.",
                    "Les cotisations simulées supposent que tous les actifs occupés sont salariés du privé.",
                    "Effet « statique » : les effets sur l'emploi, les prix et la croissance sont traités dans « Effets économiques »."],
                   {"postes": postes}, ordre=30)


def _wquantiles(x, w, qs):
    o = np.argsort(x)
    xs, ws = x[o], w[o]
    c = np.cumsum(ws) / ws.sum()
    return [float(xs[min(np.searchsorted(c, q), len(xs) - 1)]) for q in qs]


def _gini(x, w):
    o = np.argsort(x)
    xs, ws = x[o], w[o]
    cw = np.cumsum(ws)
    cxw = np.cumsum(xs * ws)
    return float(1 - 2 * np.sum(ws * (cxw - xs * ws / 2)) / (cw[-1] * cxw[-1]))


def section_redistribution(ctx: Contexte) -> Section | None:
    if not ctx.touche_moteur:
        return None
    r = _resultats(ctx)
    if r is None:
        return None
    menages, poids, meta, base, ref = r
    taille = np.array([m.taille for m in menages], dtype=float)
    wp = poids * taille  # pondération par personne (convention INSEE)
    nv0, nv1 = base["niveau_de_vie"], ref["niveau_de_vie"]
    seuils = _wquantiles(nv0, wp, [i / 10 for i in range(1, 10)])
    dec = np.searchsorted(seuils, nv0, side="right") + 1
    deciles = []
    for k in range(1, 11):
        msk = dec == k
        if not msk.any():
            continue
        m0 = float(np.average(nv0[msk], weights=wp[msk]))
        m1 = float(np.average(nv1[msk], weights=wp[msk]))
        deciles.append({"decile": k, "avant": round(m0, 2), "apres": round(m1, 2), "delta_euros": round(m1 - m0, 2),
                        "delta_pct": round((m1 - m0) / m0 * 100, 3) if m0 else 0})
    g0, g1 = _gini(nv0, wp), _gini(nv1, wp)

    def pauvrete(nv):
        med = _wquantiles(nv, wp, [0.5])[0]
        return float(wp[nv < 0.6 * med].sum() / wp.sum() * 100)
    p0, p1 = pauvrete(nv0), pauvrete(nv1)
    delta_men = ref["revenu_disponible"] - base["revenu_disponible"]
    gagnants = float(poids[delta_men > 1].sum() / poids.sum() * 100)
    perdants = float(poids[delta_men < -1].sum() / poids.sum() * 100)
    store = ctx.store
    gini_off = store.metric_value("revenus.niveau_vie.indice_gini")
    pauv_off = store.metric_value("revenus.pauvrete.taux_seuil_60")
    e_g = abs(g0 - gini_off) / gini_off if gini_off else None
    e_p = abs(p0 - pauv_off) / pauv_off if pauv_off else None
    conf_g = confiance_calage(e_g, "Indice de Gini simulé")
    conf_p = confiance_calage(e_p, "Taux de pauvreté simulé")
    conf_d = Confiance(70, [Facteur("Calage des déciles", 0.9, "Les déciles de niveau de vie de la population synthétique sont calés sur ceux de l'INSEE."),
                            Facteur("Concept de revenu", 0.6, "Le niveau de vie simulé n'inclut pas tous les revenus (patrimoine, transferts privés…).")],
                       "Variation par décile")
    srcs = [store.metriques[m]["derniere"].get("source") for m in ("revenus.niveau_vie.indice_gini", "revenus.pauvrete.taux_seuil_60") if m in store.metriques]
    ind = [
        Indicateur("gini", "Inégalités (indice de Gini)", (g1 - g0) * 100, "points", g0 * 100, g1 * 100, conf_g,
                   "Variation de l'indice de Gini (×100). Une baisse signifie moins d'inégalités de niveau de vie.",
                   [f"Gini simulé aujourd'hui {g0:.3f} (officiel INSEE : {gini_off})", f"Gini après réforme {g1:.3f}"], srcs,
                   sens="favorable" if g1 < g0 else "defavorable" if g1 > g0 else "neutre"),
        Indicateur("pauvrete", "Taux de pauvreté (seuil à 60 % du niveau de vie médian)", p1 - p0, "points", p0, p1, conf_p,
                   "Part des personnes sous le seuil de pauvreté, recalculé avec la médiane de chaque situation.",
                   [f"Taux simulé aujourd'hui {p0:.1f} % (officiel INSEE : {pauv_off} %)"], srcs,
                   sens="favorable" if p1 < p0 else "defavorable" if p1 > p0 else "neutre"),
        Indicateur("gagnants", "Part des ménages gagnants", gagnants, "pourcent_part", confiance=conf_d,
                   explication=f"{gagnants:.0f} % des ménages gagnent plus de 1 € par mois, {perdants:.0f} % perdent plus de 1 € par mois."),
    ]
    best = max(deciles, key=lambda d: abs(d["delta_pct"])) if deciles else None
    if best and abs(best["delta_pct"]) > 0.005:
        sens_txt = "hausse" if best["delta_pct"] > 0 else "baisse"
        qui = {1: "les 10 % les plus modestes", 10: "les 10 % les plus aisés"}.get(best["decile"], f"le {best['decile']}e dixième de la population")
        sous = f"Plus forte {sens_txt} relative du niveau de vie : {qui} ({best['delta_pct']:+.2f} %)".replace(".", ",")
    else:
        sous = "Effet négligeable sur la répartition des revenus"
    return Section("redistribution", "Pour les inégalités", sous, ind, Confiance.maillon_faible(conf_d, conf_g, resume="Effets redistributifs"),
                   "Les personnes sont classées par niveau de vie (revenu disponible du ménage divisé par le nombre d'unités de "
                   "consommation, convention INSEE), puis on mesure la variation moyenne dans chaque dixième de la population.",
                   ["À comportements inchangés.", "Les droits aux prestations sont supposés intégralement perçus dans ce calcul de répartition."],
                   {"deciles": deciles, "gagnants_pct": gagnants, "perdants_pct": perdants}, ordre=40)


def prechauffer(store) -> None:
    """Prépare les calculs de référence (population et ménages types) pour que la première simulation soit rapide."""
    from ..engine.openfisca_engine import ENGINE, warm_pool
    from .menages import cas_types
    ENGINE.load()
    warm_pool()
    ctx = Contexte.creer(store, {})
    pop = charger_population()
    if pop:
        ctx.calculer(pop[0], reforme=False)
    ctx.calculer(cas_types(), reforme=False)
