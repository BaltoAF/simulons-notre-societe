"""Effets comportementaux et macroéconomiques, fondés sur la base de preuves.

Chaque modèle combine trois ingrédients, tous visibles par l'utilisateur :
  1. le changement de règle (avant / après) ;
  2. une statistique publique (nombre de salariés concernés, recettes d'un impôt, PIB…) ;
  3. un effet causal tiré de la synthèse des études (élasticité, multiplicateur…), avec sa fourchette.
L'indice de confiance est celui du maillon le plus faible de la chaîne.
"""
from __future__ import annotations

from ..confidence import Confiance, Facteur, moyenne_ponderee
from ..engine.household import Adulte, Menage
from ..evidence import valeur_ou_defaut
from .base import Indicateur, Section, fr
from .contexte import RU_MONTANT, Contexte

# Règles pour lesquelles un modèle d'impact quantitatif existe (affiché comme « impact chiffré »).
REGLES_COUVERTES = {
    "travail.smic.horaire_brut", "fiscalite.tva.taux_normal", "fiscalite.tva.taux_intermediaire",
    "fiscalite.tva.taux_reduit", "fiscalite.tva.taux_particulier", "fiscalite.is.taux_normal",
    "fiscalite.ifi.bareme.taux_tranche_1", "fiscalite.ifi.bareme.taux_tranche_2", "fiscalite.ifi.bareme.taux_tranche_3",
    "fiscalite.ifi.bareme.taux_tranche_4", "fiscalite.ifi.bareme.taux_tranche_5",
    "travail.chomage.duree_max_moins_55_ans", "travail.chomage.duree_max_55_56_ans", "travail.chomage.duree_max_57_ans_et_plus",
    "travail.duree.legale_hebdomadaire", "environnement_energie.accise.gazole", "environnement_energie.accise.sp95_e10",
    "environnement_energie.accise.fioul_domestique", "environnement_energie.accise.gaz_naturel_combustible",
    "retraites.age_legal.generation_1969_et_apres", "retraites.age_legal.generation_1968", "retraites.age_legal.generation_1967",
    "retraites.age_legal.generation_1966", "transports.vitesse_max.route_bidirectionnelle", "transports.vitesse_max.autoroute",
    "transports.vitesse_max.voie_rapide", "transports.vitesse_max.agglomeration", "sante.tabac.accise_cigarettes_taux",
    "sante.tabac.accise_cigarettes_tarif", "fiscalite.csg.revenus_capital_taux", "fiscalite.csg.revenus_capital_taux_derogatoire",
}


# ───────────────────────── utilitaires ─────────────────────────
def metrique(store, *ids):
    """(valeur, id de source, confiance) de la première métrique disponible parmi `ids`."""
    m = store.find_metric(*ids)
    if not m:
        return None, None, None
    d = m["derniere"]
    src = store.sources.get(d.get("source"), {})
    fiab = src.get("fiabilite", 0.6)
    conf = Confiance(round(100 * fiab * 0.9), [Facteur("Statistique publique", fiab,
                                                       f"{m.get('titre')} ({d.get('date')}), {src.get('editeur', 'source citée')}.")],
                     m.get("titre") or m["id"])
    try:
        return float(d["valeur"]), d.get("source"), conf
    except (TypeError, ValueError):
        return None, None, None


def hypothese(score: float, texte: str) -> Confiance:
    return Confiance(score, [Facteur("Hypothèse de modélisation", score / 100, texte)], texte)


def chaine(*items: Confiance | None) -> Confiance:
    return Confiance.maillon_faible(*[c for c in items if c is not None])


def fourchette(syn, f) -> list[float] | None:
    if not syn or not syn.get("fourchette"):
        return None
    a, b = f(syn["fourchette"][0]), f(syn["fourchette"][1])
    return sorted([a, b])


def ecart(ctx: Contexte, rid: str):
    a, b = ctx.avant(rid), ctx.apres(rid)
    try:
        return float(a), float(b)
    except (TypeError, ValueError):
        return None, None


# ───────────────────────── modèles ─────────────────────────
# coût d'un point de SMIC pour les employeurs publics (Md€, 2017) et SMIC horaire brut de 2017 (groupe d'experts 2017)
COUT_PUBLIC_POINT_SMIC_2017, SMIC_HORAIRE_2017 = 0.26, 9.76


def mod_smic(ctx: Contexte) -> list[Indicateur]:
    rid = "travail.smic.horaire_brut"
    if not ctx.modifie(rid):
        return []
    old, new = ecart(ctx, rid)
    if not old:
        return []
    d = new / old - 1
    out = [Indicateur("smic_gain", "Salaire brut d'un salarié au SMIC à temps plein", (new - old) * 151.67, "euros_mois",
                      old * 151.67, new * 151.67, Confiance(92, [Facteur("Calcul direct", 0.95, "SMIC horaire × 151,67 heures.")], "Calcul direct"),
                      "Variation du salaire brut mensuel pour 35 heures par semaine.")]
    # L'État, les collectivités et les hôpitaux emploient aussi des agents payés au niveau du SMIC (une indemnité
    # différentielle complète leur traitement) : environ 260 M€ par point de SMIC en 2017 selon le groupe d'experts sur
    # le SMIC, 300 M€ selon l'IGF (2010), revalorisés ici comme le SMIC lui-même.
    cout = -COUT_PUBLIC_POINT_SMIC_2017 * (old / SMIC_HORAIRE_2017) * d * 100
    out.append(Indicateur(
        "solde_public_remunerations_publiques", "Salaires des agents publics payés au niveau du SMIC (par an)", cout, "milliards_euros",
        confiance=Confiance(55, [Facteur("Sources", 0.85, "Groupe d'experts sur le SMIC (2017) : 260 M€ par point ; IGF (2010) : 300 M€."),
                                 Facteur("Transposition", 0.6, "Montant de 2017 revalorisé comme le SMIC ; nombre d'agents concernés supposé stable.")],
                            "Coût pour les employeurs publics"),
        explication="Les agents publics dont le traitement est inférieur au SMIC reçoivent une indemnité pour l'atteindre : une hausse du SMIC "
                    "augmente la masse salariale de l'État, des collectivités et des hôpitaux.",
        calcul=[f"{COUT_PUBLIC_POINT_SMIC_2017 * 1000:.0f} M€ par point de SMIC en 2017 × (SMIC {old:.2f} € / {SMIC_HORAIRE_2017:.2f} € en 2017)",
                f"× {d * 100:+.2f} points = {cout:+.2f} Md€"],
        sources=["gex_smic_2017", "ofce_heyer_plane_2012"], sens="favorable" if cout > 0 else "defavorable"))
    elas, conf_e, syn = valeur_ou_defaut(ctx.store, "emploi_smic_elasticite", -0.18)
    part, src_p, conf_p = metrique(ctx.store, "travail.salaries_concernes_revalorisation_smic_part")
    prive, src_s, conf_s = metrique(ctx.store, "emploi.salaries.secteur_prive")
    if part and prive:
        n = part / 100 * prive
        de = elas * d * n
        out.append(Indicateur(
            "emploi_smic", "Effet sur l'emploi des salariés proches du SMIC", de, "emplois", confiance=chaine(conf_e, conf_p),
            explication="Une hausse du salaire minimum augmente le revenu des salariés concernés, mais peut réduire le nombre d'emplois "
                        "peu qualifiés si le coût du travail devient trop élevé. Les études divergent fortement sur l'ampleur de cet effet.",
            calcul=[f"{part:.1f} % des {prive / 1e6:.1f} M salariés du privé sont concernés par une revalorisation du SMIC ≈ {n / 1e6:.2f} M",
                    f"Hausse du SMIC : {d * 100:+.1f} %", f"Élasticité de l'emploi retenue : {elas:.2f}",
                    f"Effet : {elas:.2f} × {d * 100:+.1f} % × {n / 1e6:.2f} M = {de:+,.0f} emplois".replace(",", " ")],
            sources=[s for s in (src_p, src_s) if s], preuves=["emploi_smic_elasticite"],
            sens="favorable" if de > 0 else "defavorable", fourchette=fourchette(syn, lambda e: e * d * n)))
    return out


def _taux_marginal_concerne(ctx: Contexte) -> tuple[float, str]:
    rid = "fiscalite.impot_revenu.bareme"
    if ctx.modifie(rid):
        old, new = ctx.avant(rid) or [], ctx.apres(rid) or []
        changed = [b for b in new if b not in old] + [b for b in old if b not in new]
        if changed and min(b["taux"] for b in changed) >= 41:
            return 0.45, "changement limité aux tranches hautes : taux marginal de 45 %"
        return 0.30, "changement touchant les tranches moyennes : taux marginal de 30 %"
    return 0.20, "changement de décote, de quotient familial ou d'abattement : taux marginal moyen de 20 %"


def mod_eti(ctx: Contexte) -> list[Indicateur]:
    irs = [r for r in ctx.overrides if r.startswith("fiscalite.impot_revenu.") or r == "fiscalite.capital.pfu_taux_ir"]
    postes = ctx.cache.get("postes")
    if not irs or not postes:
        return []
    dm = postes["impot_revenu+pfu"]["delta"]
    if abs(dm) < 0.01:
        return []
    e, conf_e, syn = valeur_ou_defaut(ctx.store, "elasticite_revenu_imposable", 0.25)
    tau, txt = _taux_marginal_concerne(ctx)
    fb = -dm * e * tau / (1 - tau)
    return [Indicateur(
        "solde_public_comportement_ir", "Réactions des contribuables à l'impôt sur le revenu (par an)", fb, "milliards_euros",
        confiance=chaine(conf_e, hypothese(40, f"Taux marginal des contribuables concernés : {txt}")),
        explication="Quand l'impôt augmente, une partie des contribuables déclare moins de revenus (moins de travail, optimisation, "
                    "évasion) ; quand il baisse, ils en déclarent davantage. Cet effet corrige le rendement mécanique.",
        calcul=[f"Effet mécanique sur l'impôt : {dm:+.2f} Md€", f"Élasticité du revenu imposable retenue : {e:.2f}",
                f"Effet de comportement = −{dm:+.2f} × {e:.2f} × τ/(1−τ), avec τ = {tau:.0%} ({txt})"],
        preuves=["elasticite_revenu_imposable"], sens="favorable" if fb > 0 else "defavorable",
        fourchette=fourchette(syn, lambda x: -dm * x * tau / (1 - tau)))]


TVA_LEVIERS = {"fiscalite.tva.taux_normal": "normal", "fiscalite.tva.taux_intermediaire": "intermediaire",
               "fiscalite.tva.taux_reduit": "reduit", "fiscalite.tva.taux_particulier": "particulier"}


def _rendement_tva(ctx: Contexte, store, tva: float, parts: dict, touches: list[str]):
    """Variation des recettes de TVA (Md€, assiette inchangée) et poids de consommation de chaque taux modifié."""
    drec, dprix_num, poids = 0.0, 0.0, 0.0
    calc: list[str] = []
    sources_tva: list[str] = []
    for r, k in TVA_LEVIERS.items():
        share = parts[k][0]
        rendement, src_r, _ = metrique(store, f"fiscalite.tva.rendement_net_point_taux_{k}")
        if share is None and rendement is None:
            continue
        old, new = ecart(ctx, r)
        if not old:
            continue
        # de préférence, le rendement d'un point chiffré par la DG Trésor (net de la TVA payée par les administrations) ;
        # sinon, la part du taux dans la TVA collectée (qui surestime le poids du taux normal, collecté entre entreprises)
        if rendement is not None:
            drec += rendement * (new - old)
            if r in touches:
                calc.append(f"Taux {k} : 1 point rapporte {rendement:.1f} Md€ nets (DG Trésor) × {new - old:+g} point")
            if src_r:
                sources_tva.append(src_r)
        else:
            drec += tva * share / 100 * (new / old - 1)
        if share is not None:
            c = share / old  # poids de consommation ∝ recettes / taux
            dprix_num += c * (new - old) / (100 + old)
            poids += c
        if r in touches and rendement is None:
            calc.append(f"Taux {k} : {old:g} % → {new:g} % ; {share:.1f} % des recettes")
    return drec, dprix_num, poids, calc, sources_tva


def variation_tva(ctx: Contexte) -> tuple[float, float, Confiance] | None:
    """Si un taux de TVA change : variation relative de la TVA payée (consommation inchangée), part répercutée dans les
    prix (%) et confiance. Sert à ajouter la TVA au pouvoir d'achat des ménages, qu'OpenFisca ne calcule pas."""
    touches = [r for r in TVA_LEVIERS if ctx.modifie(r)]
    if not touches:
        return None
    store = ctx.store
    tva, _, conf_t = metrique(store, "fiscalite.tva.recettes_brutes_totales", "finances_publiques.recettes.tva")
    if not tva:
        return None
    parts = {k: metrique(store, f"fiscalite.tva.part_recettes_taux_{k}") for k in TVA_LEVIERS.values()}
    drec = _rendement_tva(ctx, store, tva, parts, touches)[0]
    p, conf_p, _ = valeur_ou_defaut(store, "tva_repercussion_prix", 50)
    return drec / tva, p, chaine(conf_t, conf_p, hypothese(60, "TVA payée par le foyer estimée d'après les ménages de niveau de vie comparable (INSEE)"))


def mod_tva(ctx: Contexte) -> list[Indicateur]:
    touches = [r for r in TVA_LEVIERS if ctx.modifie(r)]
    if not touches:
        return []
    store = ctx.store
    tva, src_t, conf_t = metrique(store, "fiscalite.tva.recettes_brutes_totales", "finances_publiques.recettes.tva")
    parts = {k: metrique(store, f"fiscalite.tva.part_recettes_taux_{k}") for k in TVA_LEVIERS.values()}
    p, conf_p, syn = valeur_ou_defaut(store, "tva_repercussion_prix", 50)
    out = []
    # un taux dont la part dans les recettes n'est pas documentée n'empêche pas de chiffrer les autres : il est signalé
    chiffrables = [r for r in touches if parts[TVA_LEVIERS[r]][0] is not None
                   or metrique(store, f"fiscalite.tva.rendement_net_point_taux_{TVA_LEVIERS[r]}")[0] is not None]
    if tva and chiffrables:
        drec, dprix_num, poids, calc, sources_tva = _rendement_tva(ctx, store, tva, parts, touches)
        calc = [f"Recettes de TVA : {tva:.1f} Md€"] + [f"Taux {TVA_LEVIERS[r]} : part des recettes inconnue, changement non compté"
                                                      for r in touches if r not in chiffrables] + calc
        conf = chaine(conf_t, *(parts[TVA_LEVIERS[r]][2] for r in chiffrables if parts[TVA_LEVIERS[r]][2]), hypothese(55, "Assiette inchangée (effet statique)"))
        out.append(Indicateur("solde_public_tva", "Recettes de TVA (par an, assiette inchangée)", drec, "milliards_euros", confiance=conf,
                              explication="Variation des recettes si la consommation taxée restait identique.",
                              calcul=calc, sources=list(dict.fromkeys(s for s in [src_t] + sources_tva + [parts[TVA_LEVIERS[r]][1] for r in chiffrables] if s)),
                              sens="favorable" if drec > 0 else "defavorable"))
        rel = drec / tva  # variation relative de la TVA payée, à consommation inchangée
        for dec, lib in ((1, "des 10 % les plus modestes"), (10, "des 10 % les plus aisés")):
            part, src_d, conf_d = metrique(store, f"consommation.tva_part_revenu_disponible_decile_{dec}")
            if part:
                eff = -part * rel * p / 100
                out.append(Indicateur(f"pouvoir_achat_tva_d{dec}", f"Pouvoir d'achat {lib}", eff, "pourcent",
                                      confiance=chaine(conf_d, conf_p, conf),
                                      explication="Variation du revenu disponible réel : la TVA pèse plus lourd, en proportion du revenu, "
                                                  "pour les ménages modestes, qui consomment l'essentiel de leurs revenus.",
                                      calcul=[f"TVA payée : {part:.1f} % du revenu disponible", f"Variation de la TVA payée : {rel * 100:+.1f} %",
                                              f"Répercussion dans les prix : {p:.0f} %"],
                                      sources=[src_d] if src_d else [], preuves=["tva_repercussion_prix"],
                                      sens="favorable" if eff > 0 else "defavorable",
                                      fourchette=fourchette(syn, lambda x, part=part: -part * rel * x / 100)))
        if poids:
            dprix = dprix_num / poids * 100 * p / 100
            out.append(Indicateur("prix_tva", "Effet sur les prix des biens et services soumis à la TVA", dprix, "pourcent",
                                  confiance=chaine(conf_p, conf),
                                  explication="Les commerçants ne répercutent qu'une partie des variations de TVA dans leurs prix ; "
                                              "les hausses sont souvent plus répercutées que les baisses.",
                                  calcul=[f"Répercussion retenue : {p:.0f} %"], preuves=["tva_repercussion_prix"],
                                  sens="defavorable" if dprix > 0 else "favorable",
                                  fourchette=fourchette(syn, lambda x: dprix_num / poids * 100 * x / 100)))
    else:
        out.append(Indicateur("tva_donnees", "Recettes de TVA", None, "milliards_euros",
                              confiance=hypothese(5, "Répartition des recettes de TVA par taux non disponible"),
                              explication="Le Système ne dispose pas encore de la répartition officielle des recettes de TVA par taux : "
                                          "le rendement de ce changement n'est pas chiffré.", preuves=["tva_repercussion_prix"]))
    return out


def mod_allegements(ctx: Contexte) -> list[Indicateur]:
    if not ctx.modifie("fiscalite.cotisations.allegement_general") or not ctx.cache.get("postes"):
        return []
    dc = ctx.cache["postes"]["cotisations"]["delta"]
    if abs(dc) < 0.01:
        return []
    k, conf_k, syn = valeur_ou_defaut(ctx.store, "allegements_cotisations_emploi", 8889)
    de = -dc * k
    return [Indicateur("emploi_allegements", "Effet sur l'emploi des allègements de cotisations", de, "emplois", confiance=conf_k,
                       explication="Moins d'allègements renchérit le coût du travail, surtout près du SMIC ; davantage d'allègements le réduit.",
                       calcul=[f"Variation des cotisations patronales nettes : {dc:+.2f} Md€", f"Emplois par milliard d'allègement : {k:,.0f}".replace(",", " ")],
                       preuves=["allegements_cotisations_emploi"], sens="favorable" if de > 0 else "defavorable",
                       fourchette=fourchette(syn, lambda x: -dc * x))]


def mod_participation(ctx: Contexte) -> list[Indicateur]:
    leviers = [r for r in ctx.overrides if r.startswith(("prestations.rsa.", "prestations.prime_activite.", "prestations.revenu_universel."))]
    if not leviers:
        return []
    from ..engine.openfisca_engine import ENGINE
    smic = ENGINE._smic_mensuel()
    cas = [Menage([Adulte(35, activite="inactif")], loyer_mensuel=500),
           Menage([Adulte(35, salaire_brut_mensuel=smic / 2)], loyer_mensuel=500),
           Menage([Adulte(35, salaire_brut_mensuel=smic)], loyer_mensuel=500)]
    b = ctx.calculer(cas, reforme=False)["revenu_disponible"]
    r = ctx.calculer(cas, reforme=True)["revenu_disponible"]
    gains0 = [b[1] - b[0], b[2] - b[0]]
    gains1 = [r[1] - r[0], r[2] - r[0]]
    # la plupart des bénéficiaires de la prime d'activité travaillent près du temps plein : pondération 30 % mi-temps, 70 % temps plein
    dg = sum(w * (g1 / g0 - 1) for w, g0, g1 in zip((0.3, 0.7), gains0, gains1) if g0 > 0)
    if abs(dg) < 0.002:
        return []
    eta, conf_e, syn = valeur_ou_defaut(ctx.store, "offre_travail_marge_extensive", 0.25)
    pop, src, conf_m = metrique(ctx.store, "prestations.prime_activite.foyers_allocataires")
    if not pop:
        return []
    de = eta * dg * pop
    return [Indicateur(
        "emploi_incitations", "Incitation à travailler : effet sur l'emploi des personnes à bas revenus", de, "emplois",
        confiance=chaine(conf_e, conf_m, hypothese(40, "Population concernée approchée par les foyers bénéficiaires de la prime d'activité")),
        explication="Le gain financier à reprendre un emploi (écart de revenu disponible entre travailler et ne pas travailler) "
                    "influence la décision de travailler. Le moteur calcule ce gain avant et après la réforme. Hypothèse haute : "
                    "tous les foyers bénéficiaires de la prime d'activité sont supposés réagir comme l'indiquent les études.",
        calcul=[f"Gain à travailler à mi-temps au SMIC : {gains0[0]:.0f} € → {gains1[0]:.0f} € par mois",
                f"Gain à travailler à temps plein au SMIC : {gains0[1]:.0f} € → {gains1[1]:.0f} € par mois",
                f"Variation moyenne du gain (30 % mi-temps, 70 % temps plein) : {dg * 100:+.1f} %", f"Élasticité de participation retenue : {eta:.2f}",
                f"Population concernée : {pop / 1e6:.2f} M foyers (bénéficiaires de la prime d'activité)"],
        sources=[src] if src else [], preuves=["offre_travail_marge_extensive"], sens="favorable" if de > 0 else "defavorable",
        fourchette=fourchette(syn, lambda x: x * dg * pop))]


def mod_revenu_universel(ctx: Contexte) -> list[Indicateur]:
    montant = float(ctx.apres(RU_MONTANT, 0) or 0)
    if montant <= 0:
        return []
    v, conf_v, syn = valeur_ou_defaut(ctx.store, "revenu_universel_offre_travail", 0.0)
    emploi, src, conf_m = metrique(ctx.store, "travail.emploi_total", "emploi.actifs_occupes")
    if not emploi:
        return []
    echelle = min(1.0, montant / 1000)
    de = v / 100 * emploi * echelle
    return [Indicateur(
        "emploi_revenu_universel", "Effet du revenu universel sur l'emploi", de, "emplois",
        confiance=chaine(conf_v, conf_m, hypothese(30, "Effets mesurés pour des transferts d'environ 1 000 $/€ par mois, ramenés au montant choisi")),
        explication="Les expériences de revenu inconditionnel (Finlande, Kenya, États-Unis…) trouvent des effets sur l'emploi allant "
                    "d'une légère baisse à aucun effet ; leur durée et leur échelle restent limitées.",
        calcul=[f"Variation de l'offre de travail retenue : {v:+.2f} %", f"Mise à l'échelle : {montant:.0f} € / 1 000 € = {echelle:.2f}",
                f"Emploi total : {emploi / 1e6:.1f} M"],
        sources=[src] if src else [], preuves=["revenu_universel_offre_travail"], sens="favorable" if de > 0 else "defavorable",
        fourchette=fourchette(syn, lambda x: x / 100 * emploi * echelle))]


def mod_aides_logement(ctx: Contexte) -> list[Indicateur]:
    if not ctx.cache.get("postes"):
        return []
    da = ctx.cache["postes"]["aides_logement"]["delta"]
    if abs(da) < 0.01:
        return []
    c, conf_c, syn = valeur_ou_defaut(ctx.store, "aides_logement_effet_loyers", 50)
    capt = da * c / 100
    return [Indicateur(
        "loyers_captation", "Part des aides au logement captée par les loyers (à moyen terme)", capt, "milliards_euros",
        confiance=conf_c,
        explication="Quand les aides au logement augmentent, une partie finit dans des loyers plus élevés, au bénéfice des propriétaires.",
        calcul=[f"Variation des aides au logement versées : {da:+.2f} Md€", f"Part captée retenue : {c:.0f} %"],
        preuves=["aides_logement_effet_loyers"], sens="neutre", fourchette=fourchette(syn, lambda x: da * x / 100))]


def mod_is(ctx: Contexte) -> list[Indicateur]:
    rid = "fiscalite.is.taux_normal"
    if not ctx.modifie(rid):
        return []
    old, new = ecart(ctx, rid)
    if not old:
        return []
    is_, src, conf = metrique(ctx.store, "finances_publiques.recettes.impot_societes")
    out = []
    if is_:
        drec = is_ * (new / old - 1)
        out.append(Indicateur("solde_public_is", "Recettes d'impôt sur les sociétés (par an, bénéfices inchangés)", drec, "milliards_euros",
                              confiance=chaine(conf, hypothese(50, "Recettes proportionnelles au taux normal, bénéfices inchangés")),
                              explication="Effet direct sur les recettes, avant toute réaction des entreprises.",
                              calcul=[f"Recettes d'IS : {is_:.1f} Md€ × ({new:g} / {old:g} − 1)"], sources=[src] if src else [],
                              sens="favorable" if drec > 0 else "defavorable"))
    sel, conf_s, syn = valeur_ou_defaut(ctx.store, "impot_societes_investissement", 1.0)
    fbcf, src_f, conf_f = metrique(ctx.store, "entreprises.fbcf_societes_non_financieres")
    if fbcf:
        dinv = sel * (old - new) / 100 * fbcf
        out.append(Indicateur("investissement_is", "Effet sur l'investissement des entreprises (moyen terme)", dinv, "milliards_euros",
                              confiance=chaine(conf_s, conf_f),
                              explication="Un impôt sur les sociétés plus bas rend l'investissement plus rentable ; l'ampleur de l'effet est débattue.",
                              calcul=[f"Semi-élasticité retenue : {sel:.2f} % d'investissement par point de taux en moins",
                                      f"Investissement des sociétés non financières : {fbcf:.0f} Md€"],
                              sources=[src_f] if src_f else [], preuves=["impot_societes_investissement"],
                              sens="favorable" if dinv > 0 else "defavorable",
                              fourchette=fourchette(syn, lambda x: x * (old - new) / 100 * fbcf)))
    return out


def mod_ifi(ctx: Contexte) -> list[Indicateur]:
    taux = [f"fiscalite.ifi.bareme.taux_tranche_{i}" for i in range(1, 6)]
    touches = [r for r in taux if ctx.modifie(r)]
    if not touches:
        return []
    ifi = ctx.store.rule_value("budget.etat.recettes.impot_fortune_immobiliere")
    if not ifi:
        return []
    rel, dpts = [], []
    for r in taux:
        a, b = ecart(ctx, r)
        if a:
            rel.append(b / a)
            dpts.append(b - a)
    f = sum(rel) / len(rel)
    dt = sum(dpts) / len(dpts)
    mech = ifi * (f - 1)
    sel, conf_s, syn = valeur_ou_defaut(ctx.store, "isf_ifi_exil_fiscal", -12)
    comp = ifi * f * sel * dt / 100
    conf_mech = hypothese(55, "Recettes proportionnelles au taux moyen du barème")
    srcs = ctx.store.regles["budget.etat.recettes.impot_fortune_immobiliere"]["valeur_sources"]
    return [
        Indicateur("solde_public_ifi", "Recettes d'IFI (par an, patrimoines inchangés)", mech, "milliards_euros", confiance=conf_mech,
                   calcul=[f"Recettes d'IFI prévues : {ifi:.2f} Md€ × variation moyenne des taux ({(f - 1) * 100:+.0f} %)"], sources=srcs,
                   sens="favorable" if mech > 0 else "defavorable"),
        Indicateur("solde_public_comportement_ifi", "Réactions des contribuables à l'IFI (départs, optimisation)", comp, "milliards_euros",
                   confiance=chaine(conf_s, conf_mech),
                   explication="Une partie du patrimoine imposable « disparaît » de l'assiette quand l'impôt augmente (départs, sous-déclaration).",
                   calcul=[f"Semi-élasticité retenue : {sel:.1f} % de patrimoine déclaré par point de taux",
                           f"Variation moyenne des taux : {dt:+.2f} point"], preuves=["isf_ifi_exil_fiscal"],
                   sens="favorable" if comp > 0 else "defavorable", fourchette=fourchette(syn, lambda x: ifi * f * x * dt / 100)),
    ]


# Part des nouveaux retraités dont le départ suit l'âge légal (ceux qui partent à l'âge légal, avec décote, ou entre
# l'ancien et le nouvel âge). Calée pour retrouver l'effet moyen d'un an d'âge chiffré par la Cour des comptes en 2025
# (7,1 Md€ : moyenne de 5,8 Md€ pour 63 ans et de 8,4 Md€ pour 65 ans, en 2035) ; voir model/etalonnage/.
PART_DEPARTS_CONCERNES = 0.40


def mod_retraite_age(ctx: Contexte) -> list[Indicateur]:
    gens = [r for r in ctx.overrides if r.startswith("retraites.age_legal.")]
    if not gens:
        return []
    rid = "retraites.age_legal.generation_1969_et_apres" if "retraites.age_legal.generation_1969_et_apres" in gens else gens[0]
    old, new = ecart(ctx, rid)
    if old is None:
        return []
    dage = new - old
    if abs(dage) < 0.01:
        return []
    out = []
    pp, conf_pp, syn = valeur_ou_defaut(ctx.store, "age_retraite_emploi_seniors", 12)
    pop5564, src_p, conf_p = metrique(ctx.store, "demographie.population_55_64")
    if pop5564:
        cohorte = pop5564 / 10
        de = pp / 100 * dage * cohorte
        out.append(Indicateur("emploi_seniors", "Effet sur l'emploi des seniors (à terme)", de, "emplois", confiance=chaine(conf_pp, conf_p),
                              explication="Reculer l'âge légal maintient une partie des personnes concernées en emploi ; d'autres passent par le chômage, "
                                          "l'invalidité ou les minima sociaux.",
                              calcul=[f"Variation de l'âge légal : {dage:+.2f} an", f"Personnes par année d'âge : {cohorte / 1e3:.0f} milliers",
                                      f"Hausse du taux d'emploi des personnes concernées : {pp:.1f} points"],
                              sources=[src_p] if src_p else [], preuves=["age_retraite_emploi_seniors"],
                              sens="favorable" if de > 0 else "defavorable", fourchette=fourchette(syn, lambda x: x / 100 * dage * cohorte)))
    nouveaux, src_n, conf_n = metrique(ctx.store, "retraites.nouveaux_retraites_par_an")
    pension, src_m, conf_m = metrique(ctx.store, "retraites.pension_moyenne_brute")
    part, src_a, conf_a = metrique(ctx.store, "retraites.part_departs_age_legal")
    if nouveaux and pension:
        # 12,1 % des nouveaux retraités du régime général partent EXACTEMENT à l'âge légal au taux plein ; un report touche
        # aussi ceux qui partent avec décote ou entre l'ancien et le nouvel âge : on retient la moitié des départs (hypothèse),
        # avec la statistique observée comme borne basse.
        part_v = PART_DEPARTS_CONCERNES
        borne_basse = part / 100 if part else 0.1
        conf_part = hypothese(45, "Part des départs concernés calée sur les chiffrages de la Cour des comptes (2025) : 5,8 Md€ pour un an "
                                  "d'âge en moins et 8,4 Md€ pour un an de plus, en 2035 (borne basse : départs exactement à l'âge légal)")
        eco = dage * nouveaux * part_v * pension * 12 / 1e9
        out.append(Indicateur("solde_public_retraites", "Effet sur le solde : pensions de retraite (régime permanent, par an)", eco, "milliards_euros",
                              confiance=chaine(conf_n, conf_m, conf_part, hypothese(40, "Hors cotisations supplémentaires et hors dépenses de chômage, d'invalidité et de minima sociaux")),
                              explication="Ordre de grandeur des pensions versées en plus (signe −) ou en moins (signe +) une fois la mesure pleinement montée en charge.",
                              calcul=[f"{dage:+.2f} an × {nouveaux / 1e3:.0f} milliers de nouveaux retraités par an × {part_v:.0%} de départs concernés",
                                      f"× pension moyenne brute {pension:.0f} €/mois × 12",
                                      f"Borne basse : {borne_basse:.1%} des départs ont lieu exactement à l'âge légal au taux plein (régime général)"],
                              sources=[s for s in (src_n, src_m, src_a) if s], sens="favorable" if eco > 0 else "defavorable",
                              fourchette=sorted([eco * borne_basse / part_v, eco * 1.2])))
    return out


def mod_chomage_duree(ctx: Contexte) -> list[Indicateur]:
    rids = ["travail.chomage.duree_max_moins_55_ans", "travail.chomage.duree_max_55_56_ans", "travail.chomage.duree_max_57_ans_et_plus"]
    touches = [r for r in rids if ctx.modifie(r)]
    if not touches:
        return []
    old, new = ecart(ctx, touches[0])
    dmois = (new - old) / 30.4
    el, conf_el, syn = valeur_ou_defaut(ctx.store, "duree_indemnisation_chomage_retour_emploi", 0.13)
    stock, src_s, conf_s = metrique(ctx.store, "travail.chomeurs_indemnises_moyenne_annuelle", "travail.allocataires_indemnises")
    duree, src_d, conf_d = metrique(ctx.store, "travail.duree_moyenne_indemnisation_chomage")
    alloc, src_a, conf_a = metrique(ctx.store, "travail.allocation_chomage_moyenne_nette")
    if not (stock and duree):
        return []
    dduree = el * dmois
    dstock = stock * dduree / duree
    out = [Indicateur("chomage_duree", "Effet sur le nombre de chômeurs indemnisés", dstock, "personnes", confiance=chaine(conf_el, conf_s, conf_d),
                      explication="Une indemnisation plus longue allonge un peu la durée de recherche d'emploi (et inversement).",
                      calcul=[f"Durée maximale : {dmois:+.1f} mois", f"Allongement de la durée de chômage : {el:.2f} mois par mois d'indemnisation",
                              f"Durée moyenne d'indemnisation : {duree:.1f} mois ; chômeurs indemnisés : {stock / 1e6:.2f} M"],
                      sources=[s for s in (src_s, src_d) if s], preuves=["duree_indemnisation_chomage_retour_emploi"],
                      sens="defavorable" if dstock > 0 else "favorable", fourchette=fourchette(syn, lambda x: stock * x * dmois / duree))]
    if alloc:
        cout = dstock * alloc / 0.93 * 12 / 1e9
        out.append(Indicateur("solde_public_chomage", "Effet sur le solde : assurance chômage (comportements, par an)", -cout, "milliards_euros",
                              confiance=chaine(conf_el, conf_s, conf_d, conf_a),
                              calcul=[f"{dstock:+,.0f} chômeurs indemnisés × allocation moyenne".replace(",", " ")],
                              sources=[s for s in (src_a,) if s], sens="favorable" if cout < 0 else "defavorable"))
    return out


def mod_duree_legale(ctx: Contexte) -> list[Indicateur]:
    rid = "travail.duree.legale_hebdomadaire"
    if not ctx.modifie(rid):
        return []
    old, new = ecart(ctx, rid)
    dh = new - old
    v, conf_v, syn = valeur_ou_defaut(ctx.store, "duree_legale_travail_emploi", 0.0)
    emploi, src, conf_m = metrique(ctx.store, "travail.emploi_salarie", "emploi.salaries.total")
    if not emploi:
        return []
    f = dh / -4
    de = v * f / 100 * emploi
    return [Indicateur("emploi_duree_legale", "Effet sur l'emploi salarié", de, "emplois",
                       confiance=chaine(conf_v, conf_m, hypothese(30, "Effets du passage de 39 à 35 heures transposés proportionnellement")),
                       explication="Les évaluations du passage aux 35 heures concluent à des effets sur l'emploi allant de nuls à modérément positifs, "
                                   "avec de fortes divergences ; une hausse de la durée légale n'a pas été évaluée en France.",
                       calcul=[f"Variation : {dh:+g} h", f"Effet retenu pour −4 h : {v:+.1f} % d'emploi", f"Transposition : × {f:+.2f}"],
                       sources=[src] if src else [], preuves=["duree_legale_travail_emploi"], sens="favorable" if de > 0 else "defavorable",
                       fourchette=fourchette(syn, lambda x: x * f / 100 * emploi))]


# Contenu énergétique moyen d'un litre (pouvoir calorifique inférieur) ; 1 tep = 41 868 MJ par définition.
MJ_PAR_LITRE = {"gazole": 35.9, "essence": 32.2}
MJ_PAR_TEP = 41868


def _litres(store, vol_id: str, carburant: str):
    vol, src, conf = metrique(store, vol_id)
    if not vol:
        return None, None, None, []
    unite = ((store.metriques.get(vol_id) or {}).get("unite") or "").lower()
    calc = []
    if unite in ("mtep", "millions_tep"):
        litres = vol * 1e6 * MJ_PAR_TEP / MJ_PAR_LITRE[carburant]
        calc.append(f"{vol:.1f} Mtep × 41 868 MJ/tep ÷ {MJ_PAR_LITRE[carburant]} MJ/l = {litres / 1e9:.1f} milliards de litres")
        conf = chaine(conf, hypothese(65, "Conversion énergie → volume avec un contenu énergétique moyen par litre"))
    elif unite in ("millions_m3", "mm3", "milliards_litres"):
        litres = vol * 1e9
    else:
        return None, None, None, []
    return litres, src, conf, calc


def mod_carburants(ctx: Contexte) -> list[Indicateur]:
    out = []
    for rid, vol_id, lib in [("environnement_energie.accise.gazole", "energie.consommation_gazole_routier", "gazole"),
                             ("environnement_energie.accise.sp95_e10", "energie.consommation_essence_routier", "essence")]:
        if not ctx.modifie(rid):
            continue
        old, new = ecart(ctx, rid)
        dl = (new - old) / 100  # €/litre hors TVA
        out.append(Indicateur(f"prix_{lib}", f"Prix du litre de {lib} à la pompe (TVA comprise)", dl * 1.2, "euros",
                              confiance=Confiance(85, [Facteur("Calcul direct", 0.9, "Accise (€/hl) ÷ 100, plus 20 % de TVA, supposée intégralement répercutée.")], "Calcul direct"),
                              calcul=[f"Accise : {old:g} → {new:g} €/hl"], sens="defavorable" if dl > 0 else "favorable"))
        litres, src, conf, calc = _litres(ctx.store, vol_id, lib)
        if litres:
            drec = dl * litres / 1e9
            out.append(Indicateur(f"solde_public_accise_{lib}", f"Recettes d'accise sur le {lib} (par an, consommation inchangée)", drec,
                                  "milliards_euros", confiance=chaine(conf, hypothese(55, "Consommation inchangée (effet statique)")),
                                  explication="Rendement direct ; à moyen terme, la consommation baisse quand le prix augmente (voir l'élasticité-prix des carburants).",
                                  calcul=calc + [f"{dl:+.3f} €/l × {litres / 1e9:.1f} milliards de litres"], sources=[src] if src else [],
                                  preuves=["elasticite_prix_carburants"], sens="favorable" if drec > 0 else "defavorable"))
    return out


def mod_csg_capital(ctx: Contexte) -> list[Indicateur]:
    """CSG sur les revenus du capital (hors moteur, faute de revenus du capital détaillés dans la population simulée) :
    rendement d'un point déduit des recettes observées et du chiffrage de la hausse de 2026."""
    rdc, rder = "fiscalite.csg.revenus_capital_taux", "fiscalite.csg.revenus_capital_taux_derogatoire"
    if not (ctx.modifie(rdc) or ctx.modifie(rder)):
        return []
    rec, src_r, conf_r = metrique(ctx.store, "fiscalite.csg.recettes_capital")
    pt_dc, src_d, conf_d = metrique(ctx.store, "fiscalite.csg.rendement_point_capital_droit_commun")
    if not rec or not pt_dc:
        return []
    pt_total = rec / 9.2  # en 2025, toutes ces assiettes étaient à 9,2 %
    pt_der = max(pt_total - pt_dc, 0.0)
    calc, drec = [f"Recettes 2025 : {rec:.1f} Md€ à 9,2 %, soit {pt_total:.2f} Md€ par point",
                  f"Dont taux de droit commun : {pt_dc:.2f} Md€ par point (hausse de 2026) ; taux maintenu : {pt_der:.2f} Md€"], 0.0
    for rid, pt, lib in ((rdc, pt_dc, "droit commun"), (rder, pt_der, "taux maintenu")):
        if ctx.modifie(rid):
            old, new = ecart(ctx, rid)
            drec += pt * (new - old)
            calc.append(f"Taux {lib} : {old:g} % → {new:g} % ({new - old:+.2f} point × {pt:.2f} Md€)")
    conf = chaine(conf_r, conf_d, hypothese(55, "Revenus du capital inchangés (effet statique)"))
    return [Indicateur("solde_public_csg_capital", "CSG sur les revenus du capital (par an, revenus inchangés)", drec, "milliards_euros",
                       confiance=conf, explication="Recettes en plus (ou en moins) si les revenus du patrimoine et des placements restaient identiques.",
                       calcul=calc, sources=[s for s in (src_r, src_d) if s], sens="favorable" if drec > 0 else "defavorable")]


MODELES = [mod_smic, mod_eti, mod_tva, mod_csg_capital, mod_allegements, mod_participation, mod_revenu_universel, mod_aides_logement,
           mod_is, mod_ifi, mod_retraite_age, mod_chomage_duree, mod_duree_legale, mod_carburants]


# Effets sur l'offre de travail : des personnes choisissent de travailler (ou non) selon ce que le travail leur rapporte.
# Contrairement aux pertes d'emploi subies (licenciements), ce sont des choix : ils réduisent la production, pas le bien-être.
OFFRE_TRAVAIL = ("emploi_incitations", "emploi_revenu_universel", "emploi_seniors")
# coût du travail d'un emploi concerné, en multiple du SMIC chargé : peu qualifié pour les incitations, salaire moyen
# pour les seniors qui partent plus tôt ou plus tard en retraite
PRODUCTIVITE_SMIC = {"emploi_incitations": 1.0, "emploi_revenu_universel": 1.0, "emploi_seniors": 2.5,
                     "emploi_smic": 1.0, "emploi_allegements": 1.1, "emploi_duree_legale": 2.0}


def mod_multiplicateur(ctx: Contexte, soldes: dict, inds: list[Indicateur] | None = None) -> list[Indicateur]:
    s = sum(v for v, _ in soldes.values())
    # tous les emplois gagnés ou perdus, choisis (offre de travail) ou subis (coût du travail), changent la production
    offre = [i for i in (inds or []) if i.id.startswith("emploi_") and i.unite == "emplois" and i.valeur]
    d_offre = sum(i.valeur for i in offre)
    if abs(s) < 0.05 and abs(d_offre) < 500:
        return []
    m, conf_m, syn = valeur_ou_defaut(ctx.store, "multiplicateur_budgetaire", 1.0)
    pib, src_p, conf_p = metrique(ctx.store, "finances_publiques.pib_valeur")
    po, src_o, conf_o = metrique(ctx.store, "finances_publiques.prelevements_obligatoires_pct_pib")
    if not pib:
        return []
    d_demande = -m * s if abs(s) >= 0.05 else 0.0
    # Production d'un emploi peu qualifié ≈ son coût du travail : SMIC brut chargé (≈ +7 % après allègements),
    # 0,85 équivalent temps plein (même pondération mi-temps / temps plein que le calcul des incitations).
    d_prod = 0.0
    calcul = []
    if d_demande:
        calcul += [f"Impulsion budgétaire : {-s:+.2f} Md€", f"Multiplicateur retenu : {m:.2f}", f"Effet par la demande : {d_demande:+.1f} Md€"]
    if offre:
        from ..engine.openfisca_engine import ENGINE
        prod_emploi = ENGINE._smic_mensuel() * 12 * 1.07 * 0.85 / 1e9
        d_prod = sum(i.valeur * prod_emploi * PRODUCTIVITE_SMIC.get(i.id, 1.0) for i in offre)
        calcul += [f"Personnes en emploi en plus ou en moins (choix de travailler) : {fr(d_offre, 0)}",
                   f"Production d'un emploi au SMIC (0,85 temps plein, coût du travail) : {fr(prod_emploi * 1e9, 0)} € par an",
                   f"Effet par le travail : {d_prod:+.1f} Md€"]
    # Deux horizons, comme les modèles macroéconomiques publics (Mésange de la DG Trésor, par exemple) : à court
    # terme, l'activité suit surtout la demande (l'argent public injecté ou retiré) ; à long terme, cet effet de
    # demande s'estompe (une mesure permanente finit par être financée) et il reste l'effet sur le nombre de personnes
    # qui travaillent. Les additionner mélangerait deux moments différents.
    conf_s = moyenne_ponderee(list(soldes.values()), "Effet budgétaire de la réforme") if soldes else None
    md = lambda v: fr(v, 0 if abs(v) >= 10 else 1)  # noqa: E731
    mds = lambda v: f"{md(v)} milliard{'s' if abs(v) >= 2 else ''} €"  # noqa: E731  (« 1,6 milliard », « 2 milliards »)
    out = []
    if d_demande:
        calcul.append(f"Effet à court terme : {d_demande:+.1f} Md€, soit {d_demande / pib * 100:+.2f} % du PIB ({pib:.0f} Md€)")
        # dit sans présumer de la cause (impôt, cotisation, aide, dépense) : c'est le solde public qui compte ici
        retraites = soldes.get("solde_public_retraites", (0.0, None))[0]
        if abs(retraites) >= 0.5 * abs(s):
            # une mesure de retraite : dire de quel argent il s'agit, plutôt qu'une explication générale
            pourquoi = (f"Les pensions versées plus tôt (sans financement en face) se dépensent : environ {mds(d_demande)} "
                        f"d'activité en plus." if d_demande > 0 else
                        f"Les pensions versées plus tard laissent moins d'argent à dépenser : environ {mds(-d_demande)} "
                        f"d'activité en moins.")
        else:
            pourquoi = (f"L'argent public rendu aux ménages et aux entreprises (dépenses ou aides en plus, impôts ou cotisations en moins) "
                        f"soutient la consommation : environ {mds(d_demande)} d'activité en plus."
                        if d_demande > 0 else
                        f"L'argent qui rentre en plus dans les caisses publiques (impôts ou cotisations en plus, aides ou dépenses en moins) "
                        f"ne sert plus à consommer : environ {mds(-d_demande)} d'activité en moins.")
        if d_prod and (d_prod > 0) != (d_demande > 0):
            # les deux horizons vont en sens contraire : le dire, sinon le verdict d'ensemble paraît contredire ce chiffre
            pourquoi += (f" C'est un effet de court terme, qui s'estompe : à long terme, l'activité "
                         f"{'baisse' if d_prod < 0 else 'progresse'} d'environ {mds(abs(d_prod))} par an.")
        out.append(Indicateur("pib", "Effet sur l'activité à court terme (PIB, à 1-2 ans)", d_demande / pib * 100, "pourcent",
                              confiance=chaine(conf_m, *[c for c in (conf_s,) if c]), explication=pourquoi, calcul=calcul,
                              sources=[src_p] if src_p else [], preuves=["multiplicateur_budgetaire"],
                              sens="favorable" if d_demande > 0 else "defavorable",
                              fourchette=fourchette(syn, lambda x: -x * s / pib * 100)))
    if d_prod:
        pourquoi = (f"{'Moins' if d_prod < 0 else 'Plus'} de personnes au travail (environ {fr(abs(round(d_offre, -3)), 0)}), "
                    f"c'est {'moins' if d_prod < 0 else 'plus'} de production : environ {mds(abs(d_prod))} par an"
                    f"{' en moins' if d_prod < 0 else ' en plus'}, durablement.")
        out.append(Indicateur("pib_long_terme", "Effet sur l'activité à long terme (PIB, une dizaine d'années)", d_prod / pib * 100, "pourcent",
                              confiance=chaine(*[i.confiance for i in offre if i.confiance]) if any(i.confiance for i in offre) else None,
                              explication=pourquoi, calcul=[c for c in calcul if not c.startswith(("Impulsion", "Multiplicateur", "Effet par la demande", "Effet à court"))]
                              + [f"Effet à long terme : {d_prod:+.1f} Md€, soit {d_prod / pib * 100:+.2f} % du PIB"],
                              sources=[src_p] if src_p else [], preuves=[p for i in offre for p in i.preuves],
                              sens="favorable" if d_prod > 0 else "defavorable"))
    if po and d_prod:
        # chaque emploi en plus ou en moins, c'est des impôts et des cotisations en plus ou en moins (à long terme) : la Cour
        # des comptes les compte dans le « coût complet » d'une réforme des retraites (7,2 Md€ pour un an d'âge en moins)
        rec = d_prod * po / 100
        out.append(Indicateur("solde_public_comportement_emploi", "Impôts et cotisations des emplois gagnés ou perdus (à long terme, par an)", rec,
                              "milliards_euros", confiance=chaine(*[i.confiance for i in offre if i.confiance], conf_o) if conf_o else None,
                              explication="Plus de personnes au travail, c'est plus d'impôts et de cotisations (et inversement).",
                              calcul=[f"{d_prod:+.1f} Md€ de production × taux de prélèvements obligatoires {po:.1f} %"],
                              sources=[src_o] if src_o else [], preuves=[p for i in offre for p in i.preuves],
                              sens="favorable" if rec > 0 else "defavorable"))
    if po and d_demande:
        retour = d_demande * po / 100
        out.append(Indicateur("solde_public_retour_croissance", "Effet en retour de l'activité sur les recettes publiques (court terme)", retour, "milliards_euros",
                              confiance=chaine(conf_m, conf_s, conf_o),
                              explication="Plus d'activité, c'est plus de recettes fiscales et sociales (et inversement) : une partie du coût ou du gain initial se compense.",
                              calcul=[f"{d_demande:+.1f} Md€ de PIB × taux de prélèvements obligatoires {po:.1f} %"], sources=[src_o] if src_o else [],
                              preuves=["multiplicateur_budgetaire"], sens="favorable" if retour > 0 else "defavorable"))
    return out


def section_comportements(ctx: Contexte) -> Section | None:
    inds: list[Indicateur] = []
    for mod in MODELES:
        inds += mod(ctx)
    soldes = dict(ctx.cache.get("soldes", {}))
    for i in inds:
        if i.id.startswith("solde_public") and i.valeur is not None and i.confiance is not None:
            soldes[i.id] = (i.valeur, i.confiance)
    inds += mod_multiplicateur(ctx, soldes, inds)
    ctx.cache["comportements"] = inds
    if not inds:
        return None
    scores = [i.confiance.score for i in inds if i.confiance]
    conf = Confiance(sum(scores) / len(scores), [Facteur("Indicateurs", sum(scores) / len(scores) / 100,
                                                         "Moyenne des indices de confiance des indicateurs de cette section : chacun a le sien.")],
                     "Effets économiques (variable selon l'indicateur)") if scores else None
    return Section("comportements", "Effets économiques et comportementaux",
                   "Emploi, prix, activité, réactions des contribuables — selon les études disponibles",
                   inds, conf,
                   "Chaque indicateur combine le changement de règle, une statistique publique et un effet tiré de la synthèse des études "
                   "(voir « Comment c'est calculé ? »). La fourchette reflète le désaccord entre études.",
                   ["Effets estimés séparément les uns des autres ; leurs interactions ne sont pas modélisées.",
                    "Les effets de long terme (formation, innovation, démographie) ne sont pas pris en compte."],
                   {"regles_couvertes": [r for r in ctx.overrides if r in REGLES_COUVERTES or r.startswith("retraites.age_legal.")]},
                   ordre=50)


MODULES = [section_comportements]
