"""Revalorisation des pensions de base : appliquée à la part « de base » des retraites des ménages, et chiffrée."""
from fastapi.testclient import TestClient

from app.main import app

RETRAITE_SEULE = {"adultes": [{"age": 72, "activite": "retraite", "retraite_nette_mensuelle": 1500}],
                  "couple": "seul", "logement": "proprietaire"}


def test_gel_des_pensions_de_base():
    with TestClient(app) as c:
        r = c.post("/api/simulation/reforme", json={"overrides": {"retraites.revalorisation.pensions_base": 0},
                                                     "menage": RETRAITE_SEULE, "montants": "net",
                                                     "modules": ["menage"]}).json()
        regles = {x["id"]: x for x in c.get("/api/regles?limit=5000").json()["regles"]}
    # 0 % au lieu de 0,9 %, sur environ les trois quarts de la retraite (part des régimes de base, DREES) : environ −10 €
    delta = r["pour_vous"]["delta_mois"]
    assert -12 < delta < -8
    assert not any(s["id"] == "non_modelise" for s in r["sections"])
    assert regles["retraites.revalorisation.pensions_base"]["simulable"]
