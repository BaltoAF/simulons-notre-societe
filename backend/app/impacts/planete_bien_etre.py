"""Impacts écologiques et de bien-être.

Ces indicateurs reposent sur d'autres sources que l'économie : inventaires d'émissions (CITEPA, SDES),
empreinte carbone, enquêtes sur la satisfaction dans la vie (INSEE), études de santé publique. Ils suivent
la même logique de preuve : règle modifiée × statistique observée × effet tiré de la synthèse des études.

- Planète : émissions directement induites par la réforme (carburants, revenus des ménages) — comptées dans
  l'équilibre « budget carbone » — et effet indirect de l'activité, affiché à part.
- Bien-être : satisfaction dans la vie (via le revenu, l'emploi, le temps de travail), santé des personnes
  concernées par un changement de l'âge de la retraite.
"""
from __future__ import annotations

import math

import numpy as np

from ..confidence import Confiance, Facteur, moyenne_ponderee
from ..evidence import valeur_ou_defaut
from .base import Indicateur, Section, fr
from .comportements import chaine, ecart, fourchette, hypothese, metrique
from .contexte import Contexte

PARTS_CARBURANTS = {"gazole": "energie.consommation_gazole_routier", "essence": "energie.consommation_essence_routier"}


# ───────────────────────── planète ─────────────────────────
def em_carburants(ctx: Contexte) -> list[Indicateur]:
    out = []
    em_route, src_e, conf_e = metrique(ctx.store, "environnement.emissions_co2_transport_routier")
    vol_g, _, _ = metrique(ctx.store, PARTS_CARBURANTS["gazole"])
    vol_e, _, _ = metrique(ctx.store, PARTS_CARBURANTS["essence"])
    if not (em_route and vol_g and vol_e):
        return out
    elas, conf_el, syn = valeur_ou_defaut(ctx.store, "elasticite_prix_carburants", -0.34)
    for rid, lib, prix_id, part in [("environnement_energie.accise.gazole", "gazole", "ecologie.prix_moyen_gazole", vol_g / (vol_g + vol_e)),
                                    ("environnement_energie.accise.sp95_e10", "essence", "ecologie.prix_moyen_sp95_e10", vol_e / (vol_g + vol_e))]:
        if not ctx.modifie(rid):
            continue
        prix, src_p, conf_p = metrique(ctx.store, prix_id)
        if not prix:
            out.append(Indicateur(f"impact_emissions_{lib}_donnees", f"Émissions liées au {lib}", None, "mt_co2e",
                                  confiance=hypothese(5, "Prix moyen à la pompe en cours de collecte par le Système"),
                                  explication="Le prix moyen à la pompe, nécessaire pour estimer la baisse de consommation, n'est pas encore disponible."))
            continue
        old, new = ecart(ctx, rid)
        dp = (new - old) / 100 * 1.2 / prix
        de = em_route * part * elas * dp
        out.append(Indicateur(
            f"emissions_{lib}", f"Émissions de CO2 du transport routier ({lib})", de, "mt_co2e",
            confiance=chaine(conf_el, conf_e, conf_p, hypothese(60, "Émissions proportionnelles à l'énergie consommée par carburant")),
            explication="Un carburant plus cher conduit à rouler un peu moins et à changer de véhicule à terme ; les émissions baissent.",
            calcul=[f"Hausse du prix : {dp * 100:+.1f} % (prix moyen {prix:.2f} €/l)", f"Élasticité-prix retenue : {elas:.2f}",
                    f"Émissions du transport routier : {em_route:.0f} MtCO2e, dont {part:.0%} pour le {lib}"],
            sources=[s for s in (src_e, src_p) if s], preuves=["elasticite_prix_carburants"],
            sens="favorable" if de < 0 else "defavorable", fourchette=fourchette(syn, lambda x: em_route * part * x * dp)))
    return out


def em_revenus(ctx: Contexte) -> list[Indicateur]:
    r = ctx.cache.get("microsim")
    if not r:
        return []
    menages, poids, meta, base, ref = r
    drd = float((poids * (ref["revenu_disponible"] - base["revenu_disponible"])).sum() * 12 / 1e9)
    if abs(drd) < 0.05:
        return []
    rdb, src_r, conf_r = metrique(ctx.store, "menages.revenu_disponible_brut_total")
    emp, src_e, conf_e = metrique(ctx.store, "environnement_energie.empreinte_carbone_totale", "ecologie.empreinte_carbone_totale")
    if not (rdb and emp):
        return []
    e, conf_el, syn = valeur_ou_defaut(ctx.store, "elasticite_empreinte_carbone_revenu", 0.6)
    de = e * drd / rdb * emp
    return [Indicateur(
        "emissions_revenus", "Empreinte carbone liée au revenu des ménages", de, "mt_co2e",
        confiance=chaine(conf_el, conf_r, conf_e),
        explication="Plus de revenu, c'est plus de consommation, donc plus d'émissions (en France et à l'étranger), "
                    "dans une proportion qui dépend du niveau de vie.",
        calcul=[f"Variation du revenu disponible des ménages : {drd:+.2f} Md€ sur {rdb:.0f} Md€",
                f"Élasticité de l'empreinte carbone au revenu retenue : {e:.2f}", f"Empreinte carbone de la France : {emp:.0f} MtCO2e"],
        sources=[s for s in (src_r, src_e) if s], preuves=["elasticite_empreinte_carbone_revenu"],
        sens="favorable" if de < 0 else "defavorable", fourchette=fourchette(syn, lambda x: x * drd / rdb * emp))]


def em_activite(ctx: Contexte) -> list[Indicateur]:
    pib = next((i for i in ctx.cache.get("comportements", []) if i.id == "pib"), None)
    if not pib or pib.valeur is None or abs(pib.valeur) < 0.01:
        return []
    emis, src, conf = metrique(ctx.store, "ecologie.emissions_territoriales_totales", "environnement_energie.emissions_ges_hors_utcatf")
    if not emis:
        return []
    de = pib.valeur / 100 * emis
    return [Indicateur("impact_emissions_activite", "Émissions liées au surcroît (ou recul) d'activité", de, "mt_co2e",
                       confiance=chaine(pib.confiance, conf, hypothese(25, "Émissions proportionnelles à l'activité à court terme (pas de découplage)")),
                       explication="Effet indirect et temporaire, non compté dans l'équilibre du budget carbone (trop incertain).",
                       calcul=[f"Variation du PIB : {pib.valeur:+.2f} %", f"Émissions territoriales : {emis:.0f} MtCO2e"],
                       sources=[src] if src else [], preuves=["multiplicateur_budgetaire"],
                       sens="favorable" if de < 0 else "defavorable")]


# ───────────────────────── bien-être ─────────────────────────
def be_revenu(ctx: Contexte) -> list[Indicateur]:
    r = ctx.cache.get("microsim")
    if not r:
        return []
    menages, poids, meta, base, ref = r
    coef, conf_c, syn = valeur_ou_defaut(ctx.store, "revenu_satisfaction_vie", 0.3)
    taille = np.array([m.taille for m in menages], dtype=float)
    wp = poids * taille
    nv0 = np.maximum(base["niveau_de_vie"], 50.0)
    nv1 = np.maximum(ref["niveau_de_vie"], 50.0)
    dln = np.log(nv1 / nv0)
    dsat = coef / math.log(2) * dln
    moyen = float(np.average(dsat, weights=wp))
    if abs(moyen) < 1e-4 and float(np.abs(dsat).max()) < 1e-3:
        return []
    ordre = np.argsort(nv0)
    cum = np.cumsum(wp[ordre]) / wp.sum()
    d1 = ordre[cum <= 0.1]
    d1_moy = float(np.average(dsat[d1], weights=wp[d1])) if len(d1) else 0.0
    sat_moy, src_s, conf_s = metrique(ctx.store, "bien_etre.nir.satisfaction_vie")
    calc = [f"Effet d'un doublement du revenu sur la satisfaction : {coef:+.2f} point sur 10 (synthèse des études)",
            "Chaque euro compte davantage pour un ménage modeste : l'effet est calculé sur l'écart relatif de niveau de vie de chaque ménage."]
    if sat_moy:
        calc.append(f"Satisfaction moyenne en France : {sat_moy:.1f} / 10")
    conf = chaine(conf_c, Confiance(70, [Facteur("Microsimulation", 0.7, "Variation du niveau de vie de chaque ménage simulé.")], "Microsimulation"))
    return [
        Indicateur("bien_etre_satisfaction", "Satisfaction dans la vie (moyenne, via le revenu)", moyen, "points_sur_10",
                   confiance=conf, explication="Variation moyenne de la satisfaction dans la vie (note de 0 à 10) attendue du seul fait des revenus.",
                   calcul=calc, sources=[src_s] if src_s else [], preuves=["revenu_satisfaction_vie"],
                   sens="favorable" if moyen > 0 else "defavorable", fourchette=fourchette(syn, lambda x: moyen * x / coef if coef else 0)),
        Indicateur("bien_etre_satisfaction_d1", "… pour les 10 % les plus modestes", d1_moy, "points_sur_10", confiance=conf,
                   preuves=["revenu_satisfaction_vie"], sens="favorable" if d1_moy > 0 else "defavorable"),
    ]


def be_emploi(ctx: Contexte) -> list[Indicateur]:
    # Seules les pertes (ou créations) d'emploi subies comptent ici : choisir de moins travailler parce qu'une aide
    # augmente n'est pas un passage par le chômage, et l'effet du revenu est déjà pris en compte par ailleurs.
    from .comportements import OFFRE_TRAVAIL
    emplois = sum(i.valeur for i in ctx.cache.get("comportements", [])
                  if i.id.startswith("emploi_") and i.id not in OFFRE_TRAVAIL and i.valeur is not None)
    if abs(emplois) < 500:
        return []
    eff, conf_e, syn = valeur_ou_defaut(ctx.store, "chomage_satisfaction_vie", -0.7)
    concernes = -emplois
    return [Indicateur("bien_etre_emploi", "Bien-être des personnes qui perdent ou retrouvent un emploi", concernes, "personnes",
                       confiance=chaine(conf_e, *[i.confiance for i in ctx.cache.get("comportements", []) if i.id.startswith("emploi_")],
                                        hypothese(35, "Chaque emploi perdu (gagné) correspond à une personne au chômage en plus (en moins)")),
                       explication=f"Le chômage fait baisser la satisfaction dans la vie d'environ {abs(eff):.1f} point sur 10 pour la personne concernée, "
                                   "au-delà de la perte de revenu : c'est l'un des effets les mieux établis des études sur le bien-être.",
                       calcul=[f"Variation de l'emploi estimée : {emplois:+,.0f}".replace(",", " "), f"Effet du chômage sur la satisfaction : {eff:+.2f} point sur 10"],
                       preuves=["chomage_satisfaction_vie"], sens="favorable" if concernes < 0 else "defavorable")]


def be_temps_travail(ctx: Contexte) -> list[Indicateur]:
    rid = "travail.duree.legale_hebdomadaire"
    if not ctx.modifie(rid):
        return []
    old, new = ecart(ctx, rid)
    dh = new - old
    eff, conf_e, syn = valeur_ou_defaut(ctx.store, "temps_travail_bien_etre", 0.1)
    f = dh / -4
    out = [Indicateur("temps_libre", "Temps libre des salariés à temps plein", -dh * 47, "heures",
                      confiance=Confiance(80, [Facteur("Calcul direct", 0.85, "Variation hebdomadaire × 47 semaines travaillées environ.")], "Calcul direct"),
                      explication="Variation du temps libre par an, si la durée effective suit la durée légale.",
                      calcul=[f"{-dh:+g} h par semaine × 47 semaines"], sens="favorable" if dh < 0 else "defavorable")]
    out.append(Indicateur("bien_etre_temps_travail", "Satisfaction des salariés concernés", eff * f, "points_sur_10",
                          confiance=chaine(conf_e, hypothese(35, "Effet mesuré pour une baisse de 4 heures, transposé proportionnellement")),
                          preuves=["temps_travail_bien_etre"], sens="favorable" if eff * f > 0 else "defavorable",
                          fourchette=fourchette(syn, lambda x: x * f)))
    return out


def be_retraite(ctx: Contexte) -> list[Indicateur]:
    gens = [r for r in ctx.overrides if r.startswith("retraites.age_legal.")]
    if not gens:
        return []
    old, new = ecart(ctx, gens[0])
    if old is None:
        return []
    v, conf_v, syn = valeur_ou_defaut(ctx.store, "retraite_sante", 0.05)
    eff = -(new - old) * v  # retarder la retraite prive les personnes concernées de l'effet du départ sur la santé
    return [Indicateur("bien_etre_sante_retraite", "Santé des personnes concernées par le changement d'âge", eff, "ecart_type",
                       confiance=chaine(conf_v, hypothese(40, "Effet du départ en retraite sur la santé appliqué à chaque année de décalage")),
                       explication="Les études mesurent l'effet du passage à la retraite sur la santé (perçue, mentale, mortalité) ; leurs conclusions divergent.",
                       calcul=[f"Variation de l'âge légal : {new - old:+.2f} an", f"Effet du départ à la retraite sur la santé : {v:+.3f} écart-type"],
                       preuves=["retraite_sante"], sens="favorable" if eff > 0 else "defavorable",
                       fourchette=fourchette(syn, lambda x: -(new - old) * x))]


# ───────────────────────── route : vitesses ─────────────────────────
# Répartition approximative des tués et du trafic par type de réseau : hypothèse de modélisation, signalée comme telle,
# en attendant l'intégration des séries détaillées de l'ONISR et du SDES par le Système.
RESEAUX = {
    "transports.vitesse_max.route_bidirectionnelle": ("routes à double sens hors agglomération", 0.55, 0.35),
    "transports.vitesse_max.autoroute": ("autoroutes", 0.08, 0.25),
    "transports.vitesse_max.voie_rapide": ("voies rapides", 0.05, 0.15),
    "transports.vitesse_max.agglomeration": ("agglomérations", 0.30, 0.25),
}


def _vitesses(ctx: Contexte):
    for rid, (lib, part_tues, part_trafic) in RESEAUX.items():
        if ctx.modifie(rid):
            old, new = ecart(ctx, rid)
            if old is not None and new is not None and new != old:
                yield rid, lib, part_tues, part_trafic, new - old


def em_vitesse(ctx: Contexte) -> list[Indicateur]:
    out = []
    em_route, src, conf_e = metrique(ctx.store, "environnement.emissions_co2_transport_routier")
    if not em_route:
        return out
    v, conf_v, syn = valeur_ou_defaut(ctx.store, "vitesse_limite_emissions_co2", -5.0)
    for rid, lib, _, part_trafic, dv in _vitesses(ctx):
        de = em_route * part_trafic * (v / 100) * (dv / -10)
        if rid.endswith("agglomeration"):
            # en ville, rouler moins vite ne réduit pas forcément la consommation : l'effet sur le CO2 n'est pas mesuré
            out.append(Indicateur(
                f"emissions_vitesse_{rid.rsplit('.', 1)[1]}", f"Émissions du trafic dans les {lib}", 0.0, "mt_co2e",
                confiance=hypothese(15, "Effet sur le CO2 de la vitesse en ville : non mesuré par les études réunies"),
                explication="En ville, rouler moins vite ne réduit pas forcément la consommation (arrêts, redémarrages) : aucune étude réunie "
                            "ici ne mesure l'effet sur le CO2. L'effet compté est donc nul ; le gain est surtout pour la sécurité et le bruit.",
                calcul=[f"Vitesse maximale : {dv:+g} km/h", "Effet sur les émissions : non mesuré, compté nul"],
                preuves=["vitesse_limite_emissions_co2"], sens="neutre"))
            continue
        if rid.endswith("route_bidirectionnelle") and (ctx.avant(rid) or 90) <= 80:
            # à 80 km/h, les voitures consomment déjà près de leur minimum : gain « négligeable » selon le CGDD (0,21 MtCO2 pour
            # -10 km/h) ; l'effet mesuré pour le passage de 90 à 80 km/h (Cerema, environ 1 Mt) sert de borne haute
            haut = de
            de = 0.21 * (dv / 10)  # dv < 0 (vitesse abaissée) : émissions en baisse
            out.append(Indicateur(
                f"emissions_vitesse_{rid.rsplit('.', 1)[1]}", f"Émissions du trafic sur les {lib}", de, "mt_co2e",
                confiance=chaine(conf_e, hypothese(20, "Gain jugé négligeable sous 80 km/h (CGDD) ; borne haute : passage de 90 à 80 km/h (Cerema)")),
                explication="À 80 km/h, les voitures consomment déjà près de leur minimum : rouler encore moins vite ne réduit que peu les émissions.",
                calcul=[f"Vitesse maximale : {dv:+g} km/h", "Effet retenu : 0,21 MtCO2 par tranche de 10 km/h (CGDD), jusqu'à environ 1 Mt (Cerema, 90 → 80 km/h)"],
                sources=[src] if src else [], preuves=["vitesse_limite_emissions_co2"],
                sens="favorable" if de < 0 else "defavorable", fourchette=sorted([de, haut])))
            continue
        out.append(Indicateur(
            f"emissions_vitesse_{rid.rsplit('.', 1)[1]}", f"Émissions du trafic sur les {lib}", de, "mt_co2e",
            confiance=chaine(conf_v, conf_e, hypothese(30, f"Part du trafic routier sur les {lib} : {part_trafic:.0%} (ordre de grandeur)")),
            explication="Rouler moins vite réduit la consommation de carburant et les émissions, surtout au-delà de 90 km/h.",
            calcul=[f"Vitesse maximale : {dv:+g} km/h", f"Effet retenu pour −10 km/h : {v:+.1f} % d'émissions",
                    f"Émissions du transport routier : {em_route:.0f} MtCO2e, dont environ {part_trafic:.0%} sur ce réseau"],
            sources=[src] if src else [], preuves=["vitesse_limite_emissions_co2"],
            sens="favorable" if de < 0 else "defavorable",
            fourchette=fourchette(syn, lambda x, pt=part_trafic, d=dv: em_route * pt * x / 100 * d / -10)))
    return out


def be_route(ctx: Contexte) -> list[Indicateur]:
    out = []
    tues, src, conf_t = metrique(ctx.store, "securite_routiere.tues_annee")
    if not tues:
        return out
    v, conf_v, syn = valeur_ou_defaut(ctx.store, "vitesse_limite_mortalite_routiere", -15.0)
    for rid, lib, part_tues, _, dv in _vitesses(ctx):
        d = tues * part_tues * (v / 100) * (dv / -10)
        out.append(Indicateur(
            f"securite_routiere_tues_{rid.rsplit('.', 1)[1]}", f"Tués sur les routes ({lib}, par an)", d, "personnes",
            confiance=chaine(conf_v, conf_t, hypothese(35, f"Part des tués sur les {lib} : {part_tues:.0%} (ordre de grandeur)")),
            explication="La vitesse est un facteur majeur de la gravité des accidents : la relation entre vitesse et mortalité "
                        "est l'une des plus robustes de la sécurité routière. Contrepartie : des trajets un peu plus longs (non chiffré).",
            calcul=[f"Vitesse maximale : {dv:+g} km/h", f"Effet retenu pour −10 km/h : {v:+.1f} % de tués",
                    f"Tués sur les routes : {tues:,.0f} par an, dont environ {part_tues:.0%} sur ce réseau".replace(",", " ")],
            sources=[src] if src else [], preuves=["vitesse_limite_mortalite_routiere"],
            sens="favorable" if d < 0 else "defavorable",
            fourchette=fourchette(syn, lambda x, pt=part_tues, dd=dv: tues * pt * x / 100 * dd / -10)))
    return out


# ───────────────────────── tabac ─────────────────────────
def be_tabac(ctx: Contexte) -> list[Indicateur]:
    r_taux, r_tarif = "sante.tabac.accise_cigarettes_taux", "sante.tabac.accise_cigarettes_tarif"
    if not (ctx.modifie(r_taux) or ctx.modifie(r_tarif)):
        return []
    p = ctx.store.rule_value("sante.tabac.prix_moyen_pondere_cigarettes")
    rec, src_r, conf_r = metrique(ctx.store, "tabac.recettes_fiscales")
    if not p or not rec:
        return []
    t0, t1 = (x / 100 for x in ecart(ctx, r_taux))
    s0, s1 = ecart(ctx, r_tarif)
    tva = 1 / 6  # TVA à 20 % incluse dans le prix
    net = p * (1 - t0 - tva) - s0                       # part du fabricant et du buraliste, supposée inchangée
    p1 = (net + s1) / (1 - t1 - tva)                     # répercussion intégrale dans le prix
    dp = p1 / p - 1
    e, conf_e, syn = valeur_ou_defaut(ctx.store, "elasticite_prix_tabac", -0.4)
    dq = e * dp
    acc0, acc1 = t0 * p + s0, t1 * p1 + s1
    statique = rec * 0.8 * (acc1 / acc0 - 1)             # cigarettes ≈ 80 % des accises sur le tabac (hypothèse)
    comportement = rec * 0.8 * (acc1 / acc0) * dq
    conf_h = hypothese(45, "Cigarettes ≈ 80 % des accises sur le tabac ; prix du fabricant inchangé")
    return [
        Indicateur("prix_tabac", "Prix moyen du paquet de 20 cigarettes", (p1 - p) / 50, "euros", confiance=conf_h,
                   calcul=[f"Prix moyen : {p / 50:.2f} € → {p1 / 50:.2f} € le paquet"], sens="neutre"),
        Indicateur("consommation_tabac", "Consommation de cigarettes", dq * 100, "pourcent", confiance=chaine(conf_e, conf_h),
                   explication="Le prix est le levier le plus efficace contre le tabagisme, première cause de mortalité évitable.",
                   calcul=[f"Hausse du prix : {dp * 100:+.1f} %", f"Élasticité-prix retenue : {e:.2f}"], preuves=["elasticite_prix_tabac"],
                   sens="favorable" if dq < 0 else "defavorable", fourchette=fourchette(syn, lambda x: x * dp * 100)),
        Indicateur("solde_public_tabac", "Recettes des accises sur le tabac (par an, consommation inchangée)", statique, "milliards_euros",
                   confiance=chaine(conf_r, conf_h), sources=[src_r] if src_r else [], sens="favorable" if statique > 0 else "defavorable"),
        Indicateur("solde_public_comportement_tabac", "… dont baisse des ventes (effet de comportement)", comportement, "milliards_euros",
                   confiance=chaine(conf_e, conf_r, conf_h), preuves=["elasticite_prix_tabac"],
                   sens="favorable" if comportement > 0 else "defavorable"),
    ]


def section_planete(ctx: Contexte) -> Section | None:
    inds = em_carburants(ctx) + em_vitesse(ctx) + em_revenus(ctx) + em_activite(ctx)
    if not inds:
        return None
    directes = [i for i in inds if i.id.startswith("emissions_") and i.valeur is not None]
    total = sum(i.valeur for i in directes)
    conf = moyenne_ponderee([(i.valeur, i.confiance) for i in directes], "Effet direct sur les émissions") if directes else None
    quantite = (f"{fr(abs(total), 1)} million{'s' if abs(total) >= 2 else ''} de tonnes" if abs(total) >= 1
                else f"{fr(round(abs(total) * 1000) * 1000, 0)} tonnes")
    sous = (f"Les émissions {'augmentent' if total > 0 else 'baissent'} de {quantite} de CO₂ par an (effet direct)" if directes else
            "Seulement des effets indirects, via l'activité économique")
    return Section("planete", "Pour la planète", sous, inds, conf,
                   "Émissions de gaz à effet de serre induites par la réforme : effet direct (carburants, consommation des ménages) "
                   "et effet indirect de l'activité. Seul l'effet direct est comparé au budget carbone.",
                   ["Les effets sur la biodiversité, l'eau ou l'artificialisation ne sont pas encore modélisés."],
                   {}, ordre=45)


def section_bien_etre(ctx: Contexte) -> Section | None:
    inds = be_revenu(ctx) + be_emploi(ctx) + be_temps_travail(ctx) + be_retraite(ctx) + be_route(ctx) + be_tabac(ctx)
    if not inds:
        return None
    scores = [i.confiance.score for i in inds if i.confiance]
    conf = Confiance(sum(scores) / len(scores), [], "Bien-être (variable selon l'indicateur)") if scores else None
    fav = sum(1 for i in inds if i.sens == "favorable")
    dfv = sum(1 for i in inds if i.sens == "defavorable")
    pl = lambda n, mot: f"{n} {mot}{'s' if n > 1 else ''}"
    sous = f"{pl(len(inds), 'effet')} mesuré{'s' if len(inds) > 1 else ''} : {pl(fav, 'plutôt favorable')}, {pl(dfv, 'plutôt défavorable')}"
    return Section("bien_etre", "Pour le bien-être", sous, inds, conf,
                   "Le bien-être est mesuré par la satisfaction dans la vie (enquêtes de l'INSEE et de la statistique européenne) "
                   "et par la santé. Les effets passent par le revenu, l'emploi, le temps libre et l'âge de la retraite.",
                   ["Les effets sur les liens sociaux, le sentiment de sécurité ou la qualité de l'environnement ne sont pas encore chiffrés."],
                   {}, ordre=48)


MODULES = [section_planete, section_bien_etre]
