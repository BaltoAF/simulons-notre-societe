"""Deux erreurs relevées par le test débutants du 30/10/2026, qui ne doivent pas revenir :
- une hausse de TVA affichait « rien ne change » pour les ménages (OpenFisca ne calcule pas la TVA payée à chaque achat) ;
- l'allocation de soutien familial supposait toujours qu'aucune pension alimentaire n'était versée."""
from fastapi.testclient import TestClient

from app.main import app

NADIA = {"couple": "seul", "enfants": [7, 12], "logement": "locataire_social", "loyer_mensuel": 520, "zone": 3,
         "revenus_capital_annuels": 0,
         "adultes": [{"age": 41, "activite": "salarie", "cadre": False, "handicap": False, "salaire_net_mensuel": 1450}]}


def test_hausse_de_tva_compte_pour_les_menages():
    with TestClient(app) as c:
        r = c.post("/api/simulation/reforme", json={"overrides": {"fiscalite.tva.taux_normal": 21.9}, "menage": NADIA,
                                                   "montants": "net", "modules": ["menage", "cas_types"]}).json()
    sections = {s["id"]: s for s in r["sections"]}
    menage = sections["menage"]
    assert menage["indicateurs"][0]["valeur"] < -1, "le foyer doit perdre du pouvoir d'achat"
    assert any(l["id"] == "tva_prix" and l["delta"] > 0 for l in menage["donnees"]["lignes"])
    assert all(cas["delta"] < 0 for cas in sections["cas_types"]["donnees"]["cas"])


def test_pension_alimentaire_reduit_l_asf():
    with TestClient(app) as c:
        sans = c.post("/api/simulation/menage", json={"menage": NADIA, "montants": "net"}).json()
        avec = c.post("/api/simulation/menage", json={"menage": {**NADIA, "pension_alimentaire_mensuelle": 150}, "montants": "net"}).json()
    asf = lambda r: next((l["montant"] for l in r["lignes"] if l["id"] == "asf"), 0)  # noqa: E731
    assert asf(sans) > 350 and abs(asf(sans) - asf(avec) - 150) < 1
    assert any(l["id"] == "pension_alimentaire" and abs(l["montant"] - 150) < 0.01 for l in avec["lignes"])
