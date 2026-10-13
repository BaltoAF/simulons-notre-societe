"""« Vos droits au-delà de l'argent » : interroger une société pour connaître ses droits et obligations.

Les réponses sont calculées à partir des RÈGLES (Société 1.0 ou n'importe quel fork) et du profil de la
personne. Comparer deux sociétés permet de prévoir ce qu'un changement de règles changerait pour soi.
"""
from __future__ import annotations

import datetime as dt

from . import config

AGE_LEGAL = [  # (de AAAA-MM, à AAAA-MM inclus, règle)
    ("1955-01", "1961-08", "retraites.age_legal.generation_1955_aout_1961"),
    ("1961-09", "1961-12", "retraites.age_legal.generation_sept_dec_1961"),
    ("1962-01", "1962-12", "retraites.age_legal.generation_1962"),
    ("1963-01", "1963-12", "retraites.age_legal.generation_1963"),
    ("1964-01", "1964-12", "retraites.age_legal.generation_1964"),
    ("1965-01", "1965-03", "retraites.age_legal.generation_janv_mars_1965"),
    ("1965-04", "1965-12", "retraites.age_legal.generation_avril_dec_1965"),
    ("1966-01", "1966-12", "retraites.age_legal.generation_1966"),
    ("1967-01", "1967-12", "retraites.age_legal.generation_1967"),
    ("1968-01", "1968-12", "retraites.age_legal.generation_1968"),
    ("1969-01", "9999-12", "retraites.age_legal.generation_1969_et_apres"),
]
TRIMESTRES = [
    ("1955-01", "1957-12", "retraites.duree_assurance.generation_1955_1957"),
    ("1958-01", "1960-12", "retraites.duree_assurance.generation_1958_1960"),
    ("1961-01", "1961-08", "retraites.duree_assurance.generation_janv_aout_1961"),
    ("1961-09", "1961-12", "retraites.duree_assurance.generation_sept_dec_1961"),
    ("1962-01", "1962-12", "retraites.duree_assurance.generation_1962"),
    ("1963-01", "1963-12", "retraites.duree_assurance.generation_1963"),
    ("1964-01", "1964-12", "retraites.duree_assurance.generation_1964"),
    ("1965-01", "1965-03", "retraites.duree_assurance.generation_janv_mars_1965"),
    ("1965-04", "1965-12", "retraites.duree_assurance.generation_avril_dec_1965"),
    ("1966-01", "9999-12", "retraites.duree_assurance.generation_1966_et_apres"),
]
MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"]


def _fr(x, d: int) -> str:
    return f"{float(x):,.{d}f}".replace(",", " ").replace(".", ",")


def _tranche(table, ym: str) -> str | None:
    for a, b, rid in table:
        if a <= ym <= b:
            return rid
    return None


def _ans_mois(x: float) -> str:
    ans = int(x)
    mois = round((x - ans) * 12)
    return f"{ans} ans" + (f" et {mois} mois" if mois else "")


def _date_plus(naissance: dt.date, age: float) -> str:
    total = naissance.year * 12 + (naissance.month - 1) + round(age * 12)
    return f"{MOIS[total % 12]} {total // 12}"


def repondre(state: dict, profil: dict) -> list[dict]:
    """Réponses personnalisées à partir des valeurs des règles (`state`) et du profil."""
    g = state.get
    aujourd_hui = config.TODAY
    annee = int(profil.get("annee_naissance") or (aujourd_hui.year - int(profil.get("age", 35))))
    mois = int(profil.get("mois_naissance") or 1)
    naissance = dt.date(annee, mois, 1)
    age = (aujourd_hui.year - annee) - (1 if (aujourd_hui.month, aujourd_hui.day) < (mois, 1) else 0)
    ym = f"{annee}-{mois:02d}"
    out = []

    def add(theme, question, reponse, regles, valeur=None, unite=""):
        out.append({"theme": theme, "question": question, "reponse": reponse, "regles": [r for r in regles if r],
                    "valeur": valeur, "unite": unite})

    # Retraite
    r_age, r_trim = _tranche(AGE_LEGAL, ym), _tranche(TRIMESTRES, ym)
    if r_age and g(r_age) is not None:
        al = float(g(r_age))
        txt = f"Âge légal de départ : {_ans_mois(al)}, soit à partir de {_date_plus(naissance, al)}."
        if r_trim and g(r_trim) is not None:
            txt += f" Pour une retraite à taux plein, il faut {int(g(r_trim))} trimestres de cotisation"
            if g("retraites.taux_plein.age_automatique") is not None:
                txt += f" (ou attendre {int(g('retraites.taux_plein.age_automatique'))} ans)."
        add("Retraite", "À quel âge pourrai-je partir à la retraite ?", txt,
            [r_age, r_trim, "retraites.taux_plein.age_automatique"], al, "ans")
    elif annee < 1955:
        add("Retraite", "À quel âge pourrai-je partir à la retraite ?", "Votre génération a déjà atteint l'âge légal de départ.", [])

    # Chômage
    if age < 55:
        rid, tranche = "travail.chomage.duree_max_moins_55_ans", "moins de 55 ans"
    elif age < 57:
        rid, tranche = "travail.chomage.duree_max_55_56_ans", "55 et 56 ans"
    else:
        rid, tranche = "travail.chomage.duree_max_57_ans_et_plus", "57 ans et plus"
    if g(rid) is not None and age < 67:
        j = float(g(rid))
        add("Travail", "Si je perds mon emploi, combien de temps serai-je indemnisé au maximum ?",
            f"Jusqu'à {round(j)} jours (environ {j / 30.4:.0f} mois) pour les {tranche}, si vous avez assez travaillé auparavant.",
            [rid, "travail.chomage.affiliation_jours_travailles"], j, "jours")
    if g("travail.duree.legale_hebdomadaire") is not None:
        add("Travail", "Combien d'heures dois-je travailler, combien de congés ?",
            f"Durée légale : {g('travail.duree.legale_hebdomadaire'):g} heures par semaine ; au-delà, ce sont des heures supplémentaires majorées. "
            f"Congés payés : {g('travail.conges.jours_ouvrables_par_an'):g} jours ouvrables par an (soit 5 semaines)."
            if g("travail.conges.jours_ouvrables_par_an") is not None else
            f"Durée légale : {g('travail.duree.legale_hebdomadaire'):g} heures par semaine.",
            ["travail.duree.legale_hebdomadaire", "travail.conges.jours_ouvrables_par_an"], g("travail.duree.legale_hebdomadaire"), "heures")
    if g("travail.smic.horaire_brut") is not None:
        add("Travail", "Quel est le salaire minimum ?",
            f"SMIC : {_fr(g('travail.smic.horaire_brut'), 2)} € brut de l'heure, soit {_fr(float(g('travail.smic.horaire_brut')) * 151.67, 0)} € brut par mois pour 35 heures.",
            ["travail.smic.horaire_brut"], g("travail.smic.horaire_brut"), "euros")

    # Citoyenneté
    va = g("institutions.vote.age_minimum")
    if va is not None:
        if age >= float(va):
            txt = f"Oui : on peut voter à partir de {va:g} ans."
        else:
            txt = f"Pas encore : on peut voter à partir de {va:g} ans, soit en {annee + int(va)}."
        elig = [(lib, g(rid)) for lib, rid in (("député", "institutions.eligibilite.depute_age_min"),
                                               ("sénateur", "institutions.eligibilite.senateur_age_min"),
                                               ("président de la République", "institutions.eligibilite.president_age_min")) if g(rid) is not None]
        if elig:
            txt += " Âge pour être candidat : " + ", ".join(f"{lib} {v:g} ans" for lib, v in elig) + "."
        add("Citoyenneté", "Puis-je voter, être candidat ?", txt,
            ["institutions.vote.age_minimum", "institutions.eligibilite.depute_age_min", "institutions.eligibilite.senateur_age_min",
             "institutions.eligibilite.president_age_min"], va, "ans")

    # Route
    if g("transports.permis_b.age_minimal") is not None:
        txt = (f"Permis voiture possible dès {g('transports.permis_b.age_minimal'):g} ans (conduite accompagnée dès "
               f"{g('transports.apprentissage_anticipe.age_minimal'):g} ans). ") if g("transports.apprentissage_anticipe.age_minimal") is not None else \
            f"Permis voiture possible dès {g('transports.permis_b.age_minimal'):g} ans. "
        if g("transports.permis_points.capital_initial_probatoire") is not None:
            txt += f"Un nouveau permis compte {g('transports.permis_points.capital_initial_probatoire'):g} points, puis {g('transports.permis_points.capital_maximum'):g} au maximum. "
        if g("transports.alcool.taux_max_general") is not None:
            txt += (f"Alcool au volant : {g('transports.alcool.taux_max_general'):g} g/l maximum "
                    f"({g('transports.alcool.taux_max_probatoire'):g} g/l pour les jeunes conducteurs).").replace(".", ",", 2)
        add("Route", "Permis de conduire et alcool au volant : quelles règles ?", txt,
            ["transports.permis_b.age_minimal", "transports.apprentissage_anticipe.age_minimal",
             "transports.permis_points.capital_initial_probatoire", "transports.alcool.taux_max_general",
             "transports.alcool.taux_max_probatoire"], g("transports.permis_b.age_minimal"), "ans")
        vit = [(lib, g(rid)) for lib, rid in (("autoroute", "transports.vitesse_max.autoroute"),
                                              ("route à double sens", "transports.vitesse_max.route_bidirectionnelle"),
                                              ("ville", "transports.vitesse_max.agglomeration")) if g(rid) is not None]
        if vit:
            add("Route", "Quelles sont les limitations de vitesse ?", (", ".join(f"{lib} : {v:g} km/h" for lib, v in vit) + ".").capitalize(),
                ["transports.vitesse_max.autoroute", "transports.vitesse_max.route_bidirectionnelle", "transports.vitesse_max.agglomeration"])

    # Santé
    if g("sante.consultation.generaliste_tarif") is not None:
        txt = f"Une consultation chez un généraliste (secteur 1) coûte {g('sante.consultation.generaliste_tarif'):g} €"
        if g("sante.participation_forfaitaire.montant") is not None:
            txt += f", dont {g('sante.participation_forfaitaire.montant'):g} € restent toujours à votre charge (participation forfaitaire)"
        txt += "."
        if g("sante.reste_a_charge.plafond_annuel_cumule_franchises_participations") is not None:
            txt += f" Au total, franchises et participations sont plafonnées à {g('sante.reste_a_charge.plafond_annuel_cumule_franchises_participations'):g} € par an."
        if age < float(g("sante.reste_a_charge.age_exoneration_franchises") or 18):
            txt += " Vous en êtes exonéré, car vous avez moins de 18 ans."
        add("Santé", "Combien me coûte une consultation chez le médecin ?", txt,
            ["sante.consultation.generaliste_tarif", "sante.participation_forfaitaire.montant",
             "sante.reste_a_charge.plafond_annuel_cumule_franchises_participations"], g("sante.consultation.generaliste_tarif"), "euros")
    if g("sante.conge_maternite.duree_1er_2e_enfant") is not None and age < 50:
        add("Famille", "En cas de naissance, quels congés ?",
            f"Congé maternité : {g('sante.conge_maternite.duree_1er_2e_enfant'):g} semaines pour un 1er ou 2e enfant "
            f"({g('sante.conge_maternite.duree_3e_enfant'):g} à partir du 3e). Congé de paternité : {g('sante.conge_paternite.duree_totale'):g} jours.",
            ["sante.conge_maternite.duree_1er_2e_enfant", "sante.conge_maternite.duree_3e_enfant", "sante.conge_paternite.duree_totale"])
    return out


def comparer(state_a: dict, state_b: dict, profil: dict) -> list[dict]:
    ra, rb = repondre(state_a, profil), repondre(state_b, profil)
    idx = {x["question"]: x for x in rb}
    for x in ra:
        y = idx.get(x["question"])
        x["autre"] = y["reponse"] if y else None
        x["change"] = bool(y and y["reponse"] != x["reponse"])
    return ra
