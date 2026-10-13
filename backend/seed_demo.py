"""Données de démonstration : comptes d'exemple et propositions, pour explorer les fonctions collaboratives.

Les propositions publiques sont équilibrées (financées, sous le plafond climat) avec les solutions que le site
propose à tous : la vitrine respecte les règles qu'elle annonce.

Usage : backend/.venv/Scripts/python backend/seed_demo.py
Les comptes créés sont des comptes de TEST locaux (mot de passe ci-dessous), à ne jamais utiliser en production.
Toutes les sociétés créées sont signalées « [Exemple] » dans leur nom.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import HTTPException  # noqa: E402

from app import auth, db, vcs  # noqa: E402
from app.model_store import get_store  # noqa: E402

MOT_DE_PASSE_DEMO = "demo-societe-2026"
COMPTES = [("camille_demo", "camille@demo.test"), ("sacha_demo", "sacha@demo.test"), ("lou_demo", "lou@demo.test")]


def compte(pseudo: str, email: str) -> dict:
    conn = db.connect()
    u = db.row(conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone())
    if u:
        return u
    auth.register(pseudo, email, MOT_DE_PASSE_DEMO)
    return db.row(conn.execute("SELECT * FROM users WHERE pseudo = ?", (pseudo,)).fetchone())


def equilibrer(store, user: dict, sid: str, preferences: list[str]) -> None:
    """Applique, comme le ferait un utilisateur, les solutions proposées par le site jusqu'à respecter les équilibres."""
    from app.impacts import compensations, simulation
    for _ in range(3):
        st = vcs.state_of(vcs.branch_head(sid, vcs.BRANCHE_PRINCIPALE))
        ref = store.snapshot()
        etat = {k: v for k, v in st.items() if k in ref and db.dumps(v) != db.dumps(ref[k])}
        manques = [e for e in simulation.simuler(store, etat, None, None, None)["equilibres"] if e["statut"] == "a_compenser"]
        if not manques:
            return
        changements, titres = [], []
        for e in manques:
            if e["id"] == "budget":
                opts = compensations.options_budget(store, etat, e["manque"])
                choix = next((o for pid in preferences for o in opts if o["id"] == pid), None)
            else:
                opts = compensations.options_carbone(store, etat, e["manque"])
                choix = next((o for o in opts if o["id"].startswith("accise_gazole")), opts[0] if opts else None)
            if choix:
                titres.append(choix["titre"])
                changements += [{"regle": r, "valeur": v, "justification": "Financer la réforme" if e["id"] == "budget" else "Compenser les émissions"}
                                for r, v in choix["overrides"].items()]
        if not changements:
            return
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
                      "Exemple de démonstration : relever le revenu minimum et financer la mesure par une tranche d'impôt supplémentaire sur les très hauts revenus.",
                      [{"regle": "prestations.rsa.montant_forfaitaire", "valeur": 800, "justification": "Rapprocher le RSA du seuil de grande pauvreté"},
                       {"regle": "fiscalite.impot_revenu.bareme", "valeur": [b for b in bareme if b["seuil"] < 250000] + [{"seuil": 250000, "taux": 50}],
                        "justification": "Financer la hausse par les revenus les plus élevés"}],
                      "RSA à 800 € et tranche à 50 %", preferences=["ir", "csg", "missions_proportion"])
    creer(sacha, "[Exemple] Le travail mieux payé",
          "Exemple de démonstration : augmenter le revenu net des travailleurs modestes via la prime d'activité et la CSG.",
          [{"regle": "prestations.prime_activite.montant_forfaitaire", "valeur": 738.28, "justification": "Mieux récompenser le travail"},
           {"regle": "fiscalite.csg.salaires_taux", "valeur": 8.7, "justification": "Baisser les prélèvements sur les salaires"}],
          "Prime d'activité +100 € et CSG −0,5 point", preferences=["missions_proportion", "ir", "csg"])
    creer(lou, "[Exemple] Revenu universel",
          "Exemple de démonstration, non financé : un revenu universel de 600 € par adulte coûterait environ 360 milliards € par an. "
          "Pour l'enregistrer publiquement, il faudrait le financer (par exemple par un impôt proportionnel sur tous les revenus).",
          [{"regle": "prestations.revenu_universel.montant", "valeur": 600},
           {"regle": "prestations.revenu_universel.remplace_rsa_prime_activite", "valeur": True}],
          "Revenu universel de 600 €", visibilite="privee")
    variante = creer(sacha, "[Exemple] Plus solidaire, financée aussi par la TVA",
                     "Exemple de démonstration : une variante de la proposition de Camille, qui propose de financer aussi par la TVA.",
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
    print("Données de démonstration prêtes. Comptes :", ", ".join(p for p, _ in COMPTES), "— mot de passe : voir MOT_DE_PASSE_DEMO dans ce fichier.")


if __name__ == "__main__":
    main()
