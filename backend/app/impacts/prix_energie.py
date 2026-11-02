"""Carburants et chauffage dans le pouvoir d'achat des ménages.

OpenFisca ne calcule pas les taxes payées à la pompe ou sur la facture de chauffage. Quand une réforme change une accise
(gazole, essence, fioul domestique, gaz), on retire au revenu de chaque ménage la hausse de ce qu'il paie (ou on lui
ajoute la baisse) : les quantités qu'il achète (sa dépense de ce poste selon son décile de niveau de vie, enquête Budget
de famille 2017 de l'Insee, divisée par le prix moyen de 2017) × variation de la taxe par litre ou par MWh, TVA comprise. Consommation inchangée (effet immédiat, avant que les ménages s'adaptent)
et taxe entièrement répercutée dans le prix : c'est la convention habituelle des chiffrages « à comportements inchangés ».
"""
from __future__ import annotations

import numpy as np

from ..confidence import Confiance
from .comportements import chaine, ecart, hypothese, metrique
from .contexte import Contexte

# chaque accise : poste de dépense (préfixe des métriques consommation.depense_<poste>_decile_<k>), prix moyen de 2017
# (l'année de l'enquête : il ramène la dépense à une quantité) et diviseur qui ramène l'accise à l'unité du prix
# (€/hl → €/l : 100 ; €/MWh : 1)
ACCISES = {
    "environnement_energie.accise.gazole": ("carburants", "ecologie.prix_2017_gazole", 100.0),
    "environnement_energie.accise.sp95_e10": ("carburants", "ecologie.prix_2017_sp95", 100.0),
    "environnement_energie.accise.sp95_e5_sp98": ("carburants", "ecologie.prix_2017_sp95", 100.0),
    "environnement_energie.accise.fioul_domestique": ("fioul", "ecologie.prix_2017_fioul_domestique", 100.0),
    "environnement_energie.accise.gaz_naturel_combustible": ("gaz", "ecologie.prix_2017_gaz_menages", 1.0),
}
LIBELLES = {"carburants": "Carburants", "fioul": "Fioul domestique", "gaz": "Gaz", "electricite": "Électricité"}
TVA = 1.2


def _part_carburant(store, rid: str) -> float:
    """Part du gazole (ou d'une essence) dans les volumes de carburants routiers : la dépense de carburants mêle les deux."""
    g, _, _ = metrique(store, "energie.consommation_gazole_routier")
    e, _, _ = metrique(store, "energie.consommation_essence_routier")
    part_g = g / (g + e) if g and e else 0.5
    if rid.endswith("gazole"):
        return part_g
    # deux règles pour l'essence (E10 et E5/SP98) : chacune pour la moitié des volumes d'essence, faute de mieux
    return (1 - part_g) / 2


def variations(ctx: Contexte) -> tuple[dict[str, float], Confiance] | None:
    """Pour chaque poste touché, le surcoût TTC par euro dépensé en 2017 (0,05 = 5 centimes de plus par euro de 2017),
    et la confiance de l'estimation."""
    store = ctx.store
    out: dict[str, float] = {}
    confs = []
    for rid, (poste, prix_id, div) in ACCISES.items():
        if not ctx.modifie(rid):
            continue
        old, new = ecart(ctx, rid)
        prix, _, conf_p = metrique(store, prix_id)
        if old is None or new is None or not prix:
            continue
        # quantité achetée pour 1 € dépensé en 2017 (1 / prix 2017) × hausse de taxe par unité, TVA comprise
        dp = (new - old) / div * TVA / prix
        if poste == "carburants":
            dp *= _part_carburant(store, rid)
        out[poste] = out.get(poste, 0.0) + dp
        confs.append(conf_p)
    # électricité : pas de prix moyen de 2017 publié ; la dépense de 2017 est ramenée aux prix de 2025 par l'indice
    # des prix de l'Insee, puis multipliée par la hausse relative du prix d'aujourd'hui
    def maj_2017(mid: str) -> float | None:
        m = store.metriques.get(mid)
        pts = {str(x.get("date", ""))[:4]: x.get("valeur") for x in (m or {}).get("serie", [])}
        return pts["2025"] / pts["2017"] if pts.get("2017") and pts.get("2025") else None
    rid = "environnement_energie.accise.electricite_menages"
    if ctx.modifie(rid):
        old, new = ecart(ctx, rid)
        prix, _, conf_p = metrique(store, "environnement_energie.prix_moyen_electricite_menages")
        k = maj_2017("prix.ipc_electricite")
        if old is not None and new is not None and prix and k:
            out["electricite"] = (new - old) * TVA / prix * k
            confs.append(conf_p)
    # le tabac n'est pas compté ménage par ménage : seule une minorité fume ; répartir la hausse sur tous les ménages
    # ferait de chacun un « perdant », ce qui serait faux (la hausse est comptée dans les recettes et la consommation)
    if not out:
        return None
    return out, chaine(*confs, hypothese(55, "Quantités de carburants, de chauffage et d'électricité du ménage estimées d'après les ménages de "
                                             "niveau de vie comparable (Insee, Budget de famille 2017, dépenses ramenées à des "
                                             "quantités par les prix de 2017, ou aux prix de 2025 par l'indice des prix pour "
                                             "l'électricité), consommation inchangée, taxe entièrement répercutée dans le prix"))


def _decile(store, nv_annuel: float) -> int | None:
    seuils = [store.metric_value(f"revenus.niveau_vie.d{k}") for k in range(1, 10)]
    if any(s is None for s in seuils):
        return None
    return 1 + sum(1 for s in seuils if nv_annuel > s)


def couts_mensuels(ctx: Contexte, niveau_vie_mensuel) -> tuple[np.ndarray, dict[str, np.ndarray], Confiance] | None:
    """Pour chaque ménage, le surcoût mensuel (positif = il paie plus), au total et par poste."""
    v = variations(ctx)
    if v is None:
        return None
    dps, conf = v
    store = ctx.store
    nv = np.atleast_1d(np.asarray(niveau_vie_mensuel, dtype=float))
    deciles = [_decile(store, float(x) * 12) for x in nv]
    par_poste = {}
    for poste, dp in dps.items():
        dep = {k: store.metric_value(f"consommation.depense_{poste}_decile_{k}") for k in range(1, 11)}
        moy = store.metric_value(f"consommation.depense_{poste}_ensemble")
        par_poste[poste] = np.array([(dep.get(d) if d else None) or moy or 0.0 for d in deciles]) * dp / 12
    total = sum(par_poste.values())
    return total, par_poste, conf


def appliquer(ctx: Contexte, base: dict, ref: dict) -> tuple[dict, Confiance | None]:
    """Résultats « après réforme » diminués du surcoût de carburants et de chauffage (copie ; `ref` n'est pas modifié)."""
    c = couts_mensuels(ctx, base["niveau_de_vie"])
    if c is None:
        return ref, None
    total, par_poste, conf = c
    out = dict(ref)
    rd = np.asarray(ref["revenu_disponible"], dtype=float)
    nv = np.asarray(ref["niveau_de_vie"], dtype=float)
    uc = np.where(nv > 0, rd / np.where(nv > 0, nv, 1), 1.0)  # unités de consommation du ménage
    out["revenu_disponible"] = rd - total
    out["niveau_de_vie"] = nv - total / uc
    out["energie_prix"] = -total
    out["energie_postes"] = {p: -x for p, x in par_poste.items()}
    return out, conf
