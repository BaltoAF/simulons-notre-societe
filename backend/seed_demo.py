"""Données de démonstration : comptes d'exemple et propositions, pour explorer les fonctions collaboratives.

Les propositions publiques sont équilibrées (financées, sous le plafond climat) avec les solutions que le site
propose à tous : la vitrine respecte les règles qu'elle annonce.

Usage : backend/.venv/Scripts/python backend/seed_demo.py
Mot de passe des comptes : variable SOCIETE_MDP_DEMO (tests en local) ; sans elle, il est aléatoire et personne ne peut s'y connecter.
Toutes les sociétés créées sont signalées « [Exemple] » dans leur nom.
"""
from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import HTTPException  # noqa: E402

from app import auth, db, vcs  # noqa: E402
from app.model_store import get_store  # noqa: E402

# SOCIETE_MDP_DEMO s'il est fourni (tests en local) ; sinon un mot de passe aléatoire jamais affiché : sur le site en ligne,
# personne ne peut se connecter aux comptes d'exemple ni modifier leurs propositions.
MOT_DE_PASSE_DEMO = os.environ.get("SOCIETE_MDP_DEMO") or secrets.token_urlsafe(18)
COMPTES = [("camille_demo", "camille@demo.test"), ("sacha_demo", "sacha@demo.test"), ("lou_demo", "lou@demo.test")]


def compte(pseudo: str, email: str) -> dict:
    conn = db.connect()
    u = db.row(conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone())
    if u:
        return u
    auth.register(pseudo, email, MOT_DE_PASSE_DEMO)
    return db.row(conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone())


def equilibrer(store, user: dict, sid: str, preferences: list[str]) -> None:
    """Applique, comme le ferait un utilisateur, les solutions proposées par le site jusqu'à respecter les équilibres.

    Le climat d'abord (une taxe sur le carburant rapporte aussi de l'argent), en préférant la limitation à 110 km/h sur
    autoroute ; puis le budget pour le seul manque restant : on évite ainsi de prélever plus que nécessaire.
    """
    from app.impacts import compensations, simulation
    st = vcs.state_of(vcs.branch_head(sid, vcs.BRANCHE_PRINCIPALE))
    ref = store.snapshot()
    etat = {k: v for k, v in st.items() if k in ref and db.dumps(v) != db.dumps(ref[k])}
    depart, titres = dict(etat), []
    for equilibre in ("carbone", "budget"):
        for _ in range(3):
            e = next(x for x in simulation.simuler(store, etat, None, None, None)["equilibres"] if x["id"] == equilibre)
            if e["statut"] != "a_compenser":
                break
            if equilibre == "carbone":
                opts = compensations.options_carbone(store, etat, e["manque"])
                choix = next((o for pid in ("vitesse_autoroute", "accise_gazole", "accise_essence") for o in opts
                              if o["id"].startswith(pid) and not set(o["overrides"]) & set(etat)), opts[0] if opts else None)
                if choix and "transports.vitesse_max.autoroute" in choix["overrides"]:
                    choix = {**choix, "titre": "Abaisser la vitesse maximale sur les autoroutes de 130 à 110 km/h",
                             "overrides": {"transports.vitesse_max.autoroute": max(110, choix["overrides"]["transports.vitesse_max.autoroute"])}}
            else:
                opts = compensations.options_budget(store, etat, e["manque"])
                choix = next((o for pid in preferences for o in opts if o["id"] == pid), None)
            if not choix:
                break
            etat.update(choix["overrides"])
            titres.append(choix["titre"])
    changements = [{"regle": k, "valeur": v, "justification": "Équilibrer la proposition"} for k, v in etat.items()
                   if db.dumps(v) != db.dumps(depart.get(k))]
    if changements:
        vcs.commit(user, store, sid, vcs.BRANCHE_PRINCIPALE, changements, "Équilibrer : " + " ; ".join(titres))


def main():
    db.init_db()
    store = get_store()
    vcs.ensure_reference(store)
    existantes = {s["nom"] for s in vcs.list_societies(store, None, limit=500)}
    camille, sacha, lou = (compte(p, e) for p, e in COMPTES)
    bareme = store.regles["fiscalite.impot_revenu.bareme"]["valeur"]

    def creer(user, nom, description, changements, message, source="france", preferences=None, visibilite="publique"):
        if nom in existantes:
            return next(s for s in vcs.list_societies(store, user, limit=500) if s["nom"] == nom)
        soc = vcs.fork(user, source, vcs.BRANCHE_PRINCIPALE, nom, description, visibilite=visibilite)
        vcs.commit(user, store, soc["id"], vcs.BRANCHE_PRINCIPALE, changements, message)
        if preferences:
            equilibrer(store, user, soc["id"], preferences)
        return soc

    solidaire = creer(camille, "[Exemple] Une France plus solidaire",
                      "Exemple de démonstration : porter le RSA à 800 € par mois et créer une tranche d'impôt à 50 % au-delà de 250 000 € par part. "
                      "Cette tranche rapporte peu, car les foyers concernés sont peu nombreux : le financement est complété par une petite hausse "
                      "de tous les taux de l'impôt sur le revenu (la nouvelle tranche passe ainsi à un peu plus de 50 %). Les émissions en plus "
                      "(le RSA augmente la consommation) sont compensées par une limitation à 110 km/h sur autoroute.",
                      [{"regle": "prestations.rsa.montant_forfaitaire", "valeur": 800, "justification": "Rapprocher le RSA du seuil de grande pauvreté"},
                       {"regle": "fiscalite.impot_revenu.bareme", "valeur": [b for b in bareme if b["seuil"] < 250000] + [{"seuil": 250000, "taux": 50}],
                        "justification": "Financer la hausse par les revenus les plus élevés"}],
                      "RSA à 800 € et tranche à 50 %", preferences=["ir", "csg", "missions_proportion"])
    creer(sacha, "[Exemple] Le travail mieux payé",
          "Exemple de démonstration : augmenter le revenu des travailleurs modestes (prime d'activité +100 €, CSG −0,5 point), "
          "financé par des économies sur les autres dépenses de l'État. Les émissions en plus (davantage de consommation) sont compensées.",
          [{"regle": "prestations.prime_activite.montant_forfaitaire", "valeur": 738.28, "justification": "Mieux récompenser le travail"},
           {"regle": "fiscalite.csg.salaires_taux", "valeur": 8.7, "justification": "Baisser les prélèvements sur les salaires"}],
          "Prime d'activité +100 € et CSG −0,5 point", preferences=["missions_proportion", "ir", "csg"])
    # test Nadia : les exemples publics penchaient tous du même côté ; celui-ci part d'idées opposées
    creer(lou, "[Exemple] Travailler plus longtemps, moins d'impôts",
          "Exemple de démonstration : l'âge légal de la retraite passe à 65 ans pour les personnes nées à partir de 1966, et la première "
          "tranche de l'impôt sur le revenu baisse de 11 % à 9 %. Le reste est financé par des économies sur les autres dépenses de l'État. "
          "Les émissions en plus (davantage de consommation) sont compensées.",
          [{"regle": f"retraites.age_legal.generation_{g}", "valeur": max(65, store.regles[f"retraites.age_legal.generation_{g}"]["valeur"]),
            "justification": "On vit plus longtemps : partir plus tard pour payer les pensions"} for g in ("1966", "1967", "1968", "1969_et_apres")]
          + [{"regle": "fiscalite.impot_revenu.bareme", "valeur": [dict(t, taux=9) if t["taux"] == 11 else t for t in bareme],
              "justification": "Moins d'impôt pour les foyers qui en paient peu"}],
          "Retraite à 65 ans et première tranche à 9 %", preferences=["missions_proportion", "tva", "csg"])
    creer(lou, "[Exemple] Revenu universel",
          "Exemple de démonstration, non financé : un revenu universel de 600 € par adulte coûterait environ 360 milliards € par an. "
          "Pour l'enregistrer publiquement, il faudrait le financer (par exemple par un impôt proportionnel sur tous les revenus).",
          [{"regle": "prestations.revenu_universel.montant", "valeur": 600},
           {"regle": "prestations.revenu_universel.remplace_rsa_prime_activite", "valeur": True}],
          "Revenu universel de 600 €", visibilite="privee")
    variante = creer(sacha, "[Exemple] Plus solidaire, financée aussi par la TVA",
                     "Exemple de démonstration : une variante de la proposition de Camille, qui finance la hausse du RSA par une tranche à 50 % "
                     "et un point de TVA. Cela rapporte plus que nécessaire : l'excédent réduit le déficit. Les émissions en plus sont compensées "
                     "par une limitation à 110 km/h sur autoroute.",
                     [{"regle": "fiscalite.tva.taux_normal", "valeur": 21, "justification": "Élargir le financement"}],
                     "TVA à 21 %", source=solidaire["id"], preferences=["tva", "ir", "csg"])
    try:
        if not vcs.list_proposals(solidaire["id"]):
            vcs.create_proposal(sacha, variante["id"], vcs.BRANCHE_PRINCIPALE, solidaire["id"], vcs.BRANCHE_PRINCIPALE,
                                "Financer aussi par une hausse de TVA",
                                "La tranche à 50 % rapporte peu ; je propose d'ajouter un point de TVA. Les effets sont visibles dans l'onglet « Ses effets ».")
            vcs.add_comment(camille, "societe", solidaire["id"], "Bienvenue ! Les impacts sur les ménages types sont intéressants, n'hésitez pas à créer votre version.")
    except HTTPException as e:
        print("Proposition non créée :", e.detail)
    print("Données de démonstration prêtes. Comptes :", ", ".join(p for p, _ in COMPTES), "— mot de passe : SOCIETE_MDP_DEMO, ou aléatoire s'il n'est pas défini.")


if __name__ == "__main__":
    main()
