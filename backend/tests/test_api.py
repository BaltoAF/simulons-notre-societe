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
        # la Société 1.0 est en lecture seule
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
