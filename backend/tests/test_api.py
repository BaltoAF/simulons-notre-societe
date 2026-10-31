"""Tests de bout en bout de l'API : consultation, simulation, forks, commits, propositions."""
import os
import tempfile

os.environ.setdefault("SOCIETE_DATA_DIR", tempfile.mkdtemp(prefix="societe-test-"))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.engine.openfisca_engine import ENGINE  # noqa: E402

ENGINE.load()


def client():
    return TestClient(app)


def test_meta_et_regles():
    with client() as c:
        m = c.get("/api/meta").json()
        assert m["stats"]["regles"] > 30
        r = c.get("/api/regles", params={"domaine": "prestations"}).json()
        assert any(x["id"] == "prestations.rsa.montant_forfaitaire" for x in r["regles"])
        d = c.get("/api/regles/prestations.rsa.montant_forfaitaire").json()
        assert d["valeur"] > 500 and d["sources"]


def test_simulation_menage_et_reforme():
    with client() as c:
        menage = {"adultes": [{"age": 40, "activite": "inactif"}], "loyer_mensuel": 450, "zone": 2}
        r = c.post("/api/simulation/menage", json={"menage": menage}).json()
        rsa = next(l for l in r["lignes"] if l["id"] == "rsa")
        assert rsa["montant"] > 400
        rap = c.post("/api/simulation/reforme", json={"overrides": {"prestations.rsa.montant_forfaitaire": 800},
                                                      "menage": menage}).json()
        sec = {s["id"]: s for s in rap["sections"]}
        assert sec["menage"]["indicateurs"][0]["valeur"] > 100
        assert "cas_types" in sec


def test_fork_commit_proposition_fusion():
    with client() as c:
        a = c.post("/api/auth/inscription", json={"pseudo": "alice", "email": "a@ex.fr", "mot_de_passe": "motdepasse1"})
        assert a.status_code == 200, a.text
        # la loi actuelle est en lecture seule
        r = c.post("/api/societes/france/commits", json={"changements": [{"regle": "prestations.rsa.montant_forfaitaire", "valeur": 900}]})
        assert r.status_code == 403
        s = c.post("/api/societes", json={"nom": "Société solidaire", "changements": [
            {"regle": "prestations.rsa.montant_forfaitaire", "valeur": 900, "justification": "Lutter contre la pauvreté"}]}).json()
        sid = s["id"]
        info = c.get(f"/api/societes/{sid}").json()
        assert len(info["differences_reference"]) == 1
        # Bob forke la société d'Alice et propose un changement
        c.post("/api/auth/deconnexion")
        c.cookies.clear()
        c.post("/api/auth/inscription", json={"pseudo": "bob", "email": "b@ex.fr", "mot_de_passe": "motdepasse2"})
        s2 = c.post("/api/societes", json={"source": sid, "nom": "Variante de Bob"}).json()
        c.post(f"/api/societes/{s2['id']}/commits", json={"changements": [
            {"regle": "fiscalite.tva.taux_normal", "valeur": 21}], "message": "TVA à 21 %"})
        p = c.post("/api/propositions", json={"source": s2["id"], "cible": sid, "titre": "Financer par la TVA"}).json()
        assert p["changements"] and not p["conflits"]
        # Bob ne peut pas fusionner chez Alice
        assert c.post(f"/api/propositions/{p['id']}/fusionner", json={}).status_code == 403
        c.cookies.clear()
        c.post("/api/auth/connexion", json={"identifiant": "alice", "mot_de_passe": "motdepasse1"})
        f = c.post(f"/api/propositions/{p['id']}/fusionner", json={})
        assert f.status_code == 200, f.text
        info = c.get(f"/api/societes/{sid}").json()
        assert len(info["differences_reference"]) == 2
        log = c.get(f"/api/societes/{sid}/commits").json()["commits"]
        assert log[0]["message"].startswith("Fusionne")
        rap = c.post("/api/simulation/reforme", json={"societe": sid}).json()
        assert {r["regle"] for r in rap["regles_modifiees"]} == {"prestations.rsa.montant_forfaitaire", "fiscalite.tva.taux_normal"}


def test_mise_a_jour_automatique_des_forks():
    """Quand la loi change, un fork est mis à jour sans conflit ; sinon le conflit est enregistré pour son propriétaire."""
    from app import vcs, db
    from app.model_store import get_store
    store = get_store()
    with client() as c:
        c.post("/api/auth/inscription", json={"pseudo": "chloe", "email": "c@ex.fr", "mot_de_passe": "motdepasse3"})
        s = c.post("/api/societes", json={"nom": "Fork de test", "changements": [
            {"regle": "prestations.rsa.montant_forfaitaire", "valeur": 900}]}).json()
    # la loi change : une règle non modifiée par le fork, et une règle modifiée par le fork
    head = vcs.reference_head()
    snap = dict(vcs.get_snapshot(vcs.get_commit(head)["base_snapshot"]))
    snap["fiscalite.tva.taux_normal"] = 20.5
    h = vcs.save_snapshot(snap)
    cid = vcs._insert_commit("france", head, None, "Test : la loi change", h, {}, [], systeme=True)
    vcs._set_head("france", "principale", cid)
    bilan = vcs.auto_sync_forks(store)
    assert bilan["mises_a_jour"] >= 1
    st = vcs.state_of(vcs.branch_head(s["id"], "principale"))
    assert st["fiscalite.tva.taux_normal"] == 20.5 and st["prestations.rsa.montant_forfaitaire"] == 900
    # conflit : la loi change le RSA que le fork a modifié
    snap2 = dict(snap)
    snap2["prestations.rsa.montant_forfaitaire"] = 700
    cid2 = vcs._insert_commit("france", cid, None, "Test : le RSA change", vcs.save_snapshot(snap2), {}, [], systeme=True)
    vcs._set_head("france", "principale", cid2)
    vcs.auto_sync_forks(store)
    assert vcs.conflits_en_attente(s["id"])
    st = vcs.state_of(vcs.branch_head(s["id"], "principale"))
    assert st["prestations.rsa.montant_forfaitaire"] == 900  # rien n'est imposé au propriétaire
    # remise en état de la référence pour les autres tests
    vcs._set_head("france", "principale", head)
    with db.transaction() as conn:
        conn.execute("DELETE FROM synchronisations")


def test_budget_national_et_menage():
    with client() as c:
        n = c.get("/api/budget/national").json()
        assert n["fonctions"] and n["par_habitant"]["depense"] > 10000
        m = c.post("/api/budget/menage", json={"menage": {"adultes": [{"age": 40, "activite": "salarie", "salaire_net_mensuel": 2500}],
                                                           "logement": "proprietaire"}}).json()
        assert m["total_paye"] > 5000 and m["finance"]


def test_droits_non_monetaires():
    with client() as c:
        r = c.post("/api/droits", json={"profil": {"annee_naissance": 1968, "mois_naissance": 5}}).json()
        retraite = next(x for x in r["reponses"] if x["theme"] == "Retraite")
        assert "63 ans et 9 mois" in retraite["reponse"]


def test_equilibres_et_compensation():
    with client() as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {"prestations.rsa.montant_forfaitaire": 800}}).json()
        budget = next(e for e in rap["equilibres"] if e["id"] == "budget")
        assert budget["statut"] == "a_compenser" and budget["manque"] > 1
        opts = c.post("/api/compensations", json={"overrides": {"prestations.rsa.montant_forfaitaire": 800},
                                                  "equilibre": "budget", "manque": budget["manque"]}).json()["options"]
        tva = next(o for o in opts if o["id"] == "tva")
        rap2 = c.post("/api/simulation/reforme", json={"overrides": {"prestations.rsa.montant_forfaitaire": 800, **tva["overrides"]}}).json()
        assert next(e for e in rap2["equilibres"] if e["id"] == "budget")["statut"] == "respecte"
        assert {p["pilier"] for p in rap["bilan"]} == {"economie", "social", "ecologie", "bien_etre"}


def test_suggestion_en_un_parcours():
    """« Proposer un changement » depuis la proposition de quelqu'un : une copie avec les changements, en un appel, puis la
    suggestion à l'auteur (les deux appels de « Envoyer ma suggestion » dans l'atelier)."""
    with client() as c:
        c.post("/api/auth/inscription", json={"pseudo": "dora", "email": "d@ex.fr", "mot_de_passe": "motdepasse4"})
        sid = c.post("/api/societes", json={"nom": "Programme de Dora", "changements": [
            {"regle": "prestations.rsa.montant_forfaitaire", "valeur": 850}]}).json()["id"]
        c.post("/api/auth/deconnexion")
        c.cookies.clear()
        c.post("/api/auth/inscription", json={"pseudo": "elie", "email": "e@ex.fr", "mot_de_passe": "motdepasse5"})
        copie = c.post("/api/societes", json={"source": sid, "branche": "principale", "nom": "Suggestion pour « Programme de Dora »",
                                              "description": "Financer la hausse", "message": "TVA à 20,5 %",
                                              "changements": [{"regle": "fiscalite.tva.taux_normal", "valeur": 20.5}]})
        assert copie.status_code == 200, copie.text
        p = c.post("/api/propositions", json={"source": copie.json()["id"], "source_branche": "principale", "cible": sid,
                                              "cible_branche": "principale", "titre": "TVA à 20,5 %", "description": "Financer la hausse"})
        assert p.status_code == 200, p.text
        assert [ch["regle"] for ch in p.json()["changements"]] == ["fiscalite.tva.taux_normal"]
        assert c.get(f"/api/societes/{sid}").json()["propositions"][0]["titre"] == "TVA à 20,5 %"
