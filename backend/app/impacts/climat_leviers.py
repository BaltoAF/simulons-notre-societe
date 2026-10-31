"""Les leviers pour le climat (règles environnement_energie.leviers.*, inexistantes dans la loi actuelle).

Chaque levier fixe des émissions à éviter chaque année (en Mt CO2e). Le site en déduit :
- l'effet sur les émissions (indicateur « emissions_… », compté dans l'équilibre du budget carbone) ;
- le coût pour l'argent public (indicateur « solde_public_… », compté dans l'équilibre des finances publiques), égal aux
  tonnes évitées multipliées par le coût par tonne de France Stratégie : on suppose que l'État paie tout le surcoût.
Le coût par tonne de France Stratégie est un coût pour la collectivité, annualisé (travaux ou véhicules moins les économies
d'énergie) ; l'effet n'est atteint qu'à terme, au fil des travaux ou du renouvellement des voitures : fiabilité faible.
"""
from __future__ import annotations

from .base import Indicateur, Section, fr
from .comportements import chaine, ecart, hypothese, metrique
from ..confidence import moyenne_ponderee
from .contexte import Contexte

# règle, nom court, libellé, statistique du coût par tonne (None : pas de coût pour l'État), ce que l'effet suppose
LEVIERS = [
    ("environnement_energie.leviers.renovation_logements_mt", "renovation_logements", "Rénovation des logements",
     "climat.cout_abattement.renovation_logements", "travaux d'isolation et chauffage électrique, au fil des années"),
    ("environnement_energie.leviers.pompes_a_chaleur_fioul_mt", "pompes_a_chaleur", "Fin du chauffage au fioul",
     "climat.cout_abattement.pompes_a_chaleur_fioul", "logements au fioul rénovés et équipés d'une pompe à chaleur"),
    ("environnement_energie.leviers.voitures_electriques_mt", "voitures_electriques", "Voitures électriques",
     "climat.cout_abattement.voiture_electrique", "renouvellement progressif des voitures"),
    ("environnement_energie.leviers.engrais_azotes_mt", "engrais_azotes", "Moins d'engrais azotés",
     None, "changement de pratiques agricoles, d'ici 2030"),
]


def indicateurs(ctx: Contexte) -> list[Indicateur]:
    out = []
    for rid, nom, libelle, cout_id, suppose in LEVIERS:
        if not ctx.modifie(rid):
            continue
        avant, apres = ecart(ctx, rid)
        if avant is None or apres is None or apres == avant:
            continue
        mt = apres - avant
        regle = ctx.store.regles.get(rid, {})
        base = hypothese(30, f"Effet atteint à terme ({suppose}), si les moyens suivent")
        if cout_id:
            cout, src, conf_c = metrique(ctx.store, cout_id)
        else:
            cout, src, conf_c = None, None, None
        out.append(Indicateur(
            f"emissions_levier_{nom}", f"{libelle} : émissions évitées", -mt, "mt_co2e",
            confiance=chaine(conf_c, base), sens="favorable" if mt > 0 else "defavorable",
            explication=regle.get("explication", ""),
            calcul=[f"Objectif retenu : {fr(mt, 1)} Mt de CO2 évitées par an", f"Hypothèse : {suppose}"],
            sources=[src] if src else []))
        if cout:
            md = mt * cout / 1000  # Mt × €/t = M€ ; ÷ 1000 = Md€
            out.append(Indicateur(
                f"solde_public_levier_{nom}", f"{libelle} : coût pour l'argent public (par an)", -md, "milliards_euros",
                confiance=chaine(conf_c, hypothese(30, "L'État paie tout le surcoût (coût pour la collectivité selon France Stratégie)")),
                sens="defavorable" if md > 0 else "favorable",
                explication=f"Environ {fr(cout, 0)} € par tonne de CO2 évitée (France Stratégie), payés par l'État. Une partie pourrait être "
                            "payée par les ménages ou les entreprises, avec d'autres effets sur leur budget.",
                calcul=[f"{fr(mt, 1)} Mt × {fr(cout, 0)} € par tonne = {fr(md, 2)} milliards € par an"],
                sources=[src] if src else []))
    return out


def section_climat_leviers(ctx: Contexte) -> Section | None:
    inds = indicateurs(ctx)
    if not inds:
        return None
    em = [i for i in inds if i.id.startswith("emissions_")]
    total = -sum(i.valeur for i in em)
    cout = -sum(i.valeur for i in inds if i.id.startswith("solde_public_"))
    conf = moyenne_ponderee([(i.valeur, i.confiance) for i in em], "Leviers pour le climat") if em else None
    sous = f"{fr(total, 1)} Mt de CO2 évitées par an à terme" + (f", pour environ {fr(cout, 1)} milliards € d'argent public par an" if cout > 0.005 else "")
    return Section("climat_leviers", "Les leviers pour le climat", sous, inds, conf,
                   "Chaque levier fixe des émissions à éviter par an ; le coût pour l'argent public vaut ces tonnes multipliées par le coût "
                   "par tonne évitée calculé par France Stratégie (« Les coûts d'abattement »), en supposant que l'État paie tout le surcoût.",
                   ["L'effet n'est atteint qu'à terme : au fil des travaux, du renouvellement des voitures ou des changements de pratiques.",
                    "Les coûts par tonne sont des moyennes ; ils montent quand on va plus loin (les premières tonnes sont les moins chères).",
                    "Planter des forêts n'est pas proposé ici : la loi compte le budget carbone hors forêts et sols (décret n° 2026-636)."],
                   {}, ordre=46)


MODULES = [section_climat_leviers]
