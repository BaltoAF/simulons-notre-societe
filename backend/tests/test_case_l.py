"""Demi-part des personnes seules qui ont élevé seules un enfant pendant au moins 5 ans (case L ; test Monique) :
l'impôt sur le revenu baisse (demi-part plafonnée), le reste ne change pas."""
from fastapi.testclient import TestClient

from app.main import app


def _menage(case_l: bool) -> dict:
    return {"menage": {"adultes": [{"age": 63, "activite": "retraite", "retraite_nette_mensuelle": 2300}], "couple": "seul",
                       "logement": "proprietaire", "zone": 3, "enfant_eleve_seul": case_l}, "montants": "net"}


def test_demi_part_case_l_baisse_l_impot():
    with TestClient(app) as c:
        avec = {l["id"]: l["montant"] for l in c.post("/api/simulation/menage", json=_menage(True)).json()["lignes"]}
        sans = {l["id"]: l["montant"] for l in c.post("/api/simulation/menage", json=_menage(False)).json()["lignes"]}
    assert sans.get("impot_revenu", 0) > 50
    # demi-part plafonnée : l'impôt baisse, d'au plus environ 1 000 € par an (environ 85 € par mois)
    assert 0 < sans["impot_revenu"] - avec.get("impot_revenu", 0) < 90
    assert abs(avec["retraite_nette"] - sans["retraite_nette"]) < 1
