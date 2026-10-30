"""Les équilibres de la société : finances publiques et budget carbone.

Une réforme peut dégrader un équilibre. Quand cet équilibre est déjà « bloqué » (déficit au-dessus de la
limite européenne, émissions au-dessus du budget carbone légal), toute dégradation doit être compensée
ailleurs : c'est la logique de l'article 40 de la Constitution pour les finances publiques, et celle des
budgets carbone de la stratégie nationale bas-carbone pour le climat.

Chaque équilibre est décrit par des RÈGLES de la société (forkables : une société peut assumer un déficit
ou relever son budget carbone, de façon transparente) et des MÉTRIQUES observées.
"""
from __future__ import annotations

from ..confidence import Confiance, Facteur, moyenne_ponderee
from .base import Indicateur, Section, fr

TOLERANCE = {"budget": 0.1, "carbone": 0.05}  # en Md€/an et MtCO2e/an
# En dessous de ce score de confiance, un dépassement est signalé (« à surveiller ») sans bloquer l'enregistrement.
CONFIANCE_MIN_BLOCAGE = 25

# Composantes du solde qui relèvent d'effets de comportement ou macroéconomiques : affichées, mais exclues de
# l'effet direct soumis à la règle de financement (comme le chiffrage d'un amendement).
SOLDE_INDIRECT = ("comportement", "retour", "solde_public_chomage")

R_ART40 = "budget.regles.article_40_irrecevabilite_financiere"
R_DEFICIT_MAX = "budget.regles.deficit_public_max_pct_pib"


def _indicateurs(sections: list[Section]):
    for s in sections:
        for i in s.indicateurs:
            yield s, i


def effet_budget_direct(sections: list[Section]) -> tuple[float, Confiance | None, list[dict]]:
    comp = []
    for s, i in _indicateurs(sections):
        if i.id.startswith("solde_public") and i.valeur is not None and not any(k in i.id for k in SOLDE_INDIRECT):
            comp.append((i.valeur, i.confiance, i.libelle, s.titre))
    total = sum(v for v, *_ in comp)
    conf = moyenne_ponderee([(v, c) for v, c, *_ in comp], "Effet direct sur les finances publiques") if comp else None
    return total, conf, [{"libelle": l, "section": t, "valeur": round(v, 3)} for v, _, l, t in comp]


def effet_emissions_direct(sections: list[Section]) -> tuple[float, Confiance | None, list[dict]]:
    comp = []
    for s, i in _indicateurs(sections):
        if i.id.startswith("emissions_") and i.valeur is not None:
            comp.append((i.valeur, i.confiance, i.libelle, s.titre))
    total = sum(v for v, *_ in comp)
    conf = moyenne_ponderee([(v, c) for v, c, *_ in comp], "Effet direct sur les émissions") if comp else None
    return total, conf, [{"libelle": l, "section": t, "valeur": round(v, 3)} for v, _, l, t in comp]


def _regle(ctx, rid, defaut=None):
    """Valeur de la règle dans la société simulée (surcharge éventuelle), sinon dans la loi actuelle."""
    if rid in ctx.overrides:
        return ctx.overrides[rid]
    return ctx.store.rule_value(rid, defaut)


def _budget_carbone_en_cours(ctx) -> tuple[str | None, float | None]:
    from .. import config
    an = config.TODAY.year
    meilleur = None
    for rid, r in ctx.store.regles.items():
        if not rid.startswith("environnement_energie.budget_carbone.periode_"):
            continue
        try:
            a, b = (int(x) for x in rid.rsplit("periode_", 1)[1].split("_")[:2])
        except ValueError:
            continue
        if a <= an <= b:
            meilleur = rid
    if not meilleur:
        return None, None
    try:
        return meilleur, float(_regle(ctx, meilleur))
    except (TypeError, ValueError):
        return meilleur, None


def equilibre_budget(ctx, sections) -> dict:
    store = ctx.store
    effet, conf, comp = effet_budget_direct(sections)
    art40 = _regle(ctx, R_ART40, True)
    art40 = True if art40 is None else bool(art40)
    lim = _regle(ctx, R_DEFICIT_MAX, 3)
    try:
        lim = float(lim)
    except (TypeError, ValueError):
        lim = 3.0
    solde_pct = store.metric_value("finances_publiques.solde_public_pct_pib")
    pib = store.metric_value("finances_publiques.pib_valeur")
    marge_md = None
    if solde_pct is not None and pib:
        marge_md = (float(solde_pct) + lim) / 100 * float(pib)  # négatif : déficit au-delà de la limite
    # La règle de financement (article 40) s'applique tant que la société la conserve ; une société qui y renonce
    # « assume » le déficit supplémentaire, dont l'effet sur la dette reste affiché.
    bloque = art40
    manque = max(0.0, -effet) if bloque else 0.0
    if effet >= -TOLERANCE["budget"]:
        statut = "respecte"
    elif not bloque:
        statut = "assume"
    elif conf is not None and conf.score < CONFIANCE_MIN_BLOCAGE:
        statut = "a_surveiller"
    else:
        statut = "a_compenser"
    autorise = 0.0
    contexte = []
    if solde_pct is not None:
        contexte.append(f"Déficit public actuel : {fr(abs(float(solde_pct)))} % du PIB, pour une limite européenne de {fr(lim, 0)} %.")
    if marge_md is not None and marge_md <= 0:
        contexte.append("Le déficit dépasse déjà cette limite : il n'y a pas de marge.")
    if art40:
        contexte.append("Article 40 de la Constitution : une proposition ne peut pas créer une charge publique ou réduire "
                        "les ressources sans compensation.")
    else:
        contexte.append("Cette société a renoncé à la règle de l'article 40 : un déficit supplémentaire est accepté.")
    return {
        "id": "budget", "titre": "Finances publiques", "unite": "milliards_euros", "effet": round(effet, 3),
        "statut": statut, "manque": round(manque, 3), "bloque": bloque, "marge_disponible": round(autorise, 3),
        "regles": [r for r in (R_ART40, R_DEFICIT_MAX) if r in store.regles],
        "regle_desactivable": R_ART40 if R_ART40 in store.regles else None,
        "explication": " ".join(contexte), "composantes": comp,
        "confiance": conf.to_dict() if conf else None,
        "par_menage_mois": round(effet * 1e9 / (store.metric_value("menages.nombre_total", 31.3e6) or 31.3e6) / 12, 2),
    }


def equilibre_carbone(ctx, sections) -> dict:
    store = ctx.store
    effet, conf, comp = effet_emissions_direct(sections)
    rid, budget = _budget_carbone_en_cours(ctx)
    emis = store.find_metric("ecologie.emissions_territoriales_totales", "environnement_energie.emissions_ges_hors_utcatf")
    actuel = float(emis["derniere"]["valeur"]) if emis else None
    marge = (budget - actuel) if (budget is not None and actuel is not None) else None
    bloque = marge is not None and marge <= 0
    autorise = 0.0 if (bloque or marge is None) else marge
    manque = max(0.0, effet - autorise)
    if not comp:
        statut = "non_mesure"
    elif effet <= TOLERANCE["carbone"] or manque <= TOLERANCE["carbone"]:
        statut = "respecte"
    elif marge is None:
        statut = "information"  # budget carbone de la période pas encore intégré : on informe sans contraindre
    elif conf is not None and conf.score < CONFIANCE_MIN_BLOCAGE:
        statut = "a_surveiller"
    else:
        statut = "a_compenser"
    texte = []
    if actuel is not None:
        texte.append(f"Émissions de gaz à effet de serre de la France : {fr(actuel, 0)} millions de tonnes d'équivalent CO₂ ({emis['derniere'].get('date', '')[:4]}).")
    if budget is not None:
        texte.append(f"Plafond fixé par la loi pour la période en cours (« budget carbone ») : {fr(budget, 0)} millions de tonnes par an en moyenne.")
        texte.append("La France est au-dessus : toute hausse doit être compensée." if bloque else
                     f"Marge disponible : {fr(marge, 0)} millions de tonnes par an.")
    else:
        texte.append("Budget carbone de la période en cours en cours d'intégration par le Système.")
    return {
        "id": "carbone", "titre": "Budget carbone (climat)", "unite": "mt_co2e", "effet": round(effet, 4),
        "statut": statut, "manque": round(manque, 4), "bloque": bloque, "marge_disponible": round(autorise, 3) if marge is not None else None,
        "regles": [r for r in (rid,) if r], "regle_desactivable": None, "explication": " ".join(texte), "composantes": comp,
        "confiance": conf.to_dict() if conf else None,
    }


def calculer(ctx, sections) -> list[dict]:
    return [equilibre_budget(ctx, sections), equilibre_carbone(ctx, sections)]
