"""Fin des droits au chômage (test Karim) : l'allocation de solidarité spécifique est calculée par le moteur pour un
demandeur d'emploi non indemnisé qui a travaillé 5 ans au cours des 10 dernières années, et pas sans cette condition."""
from fastapi.testclient import TestClient

from app.main import app


def _menage(cinq_ans: bool) -> dict:
    return {"menage": {"adultes": [{"age": 46, "activite": "chomeur", "chomage_net_mensuel": 0, "ass_precondition": cinq_ans}],
                       "couple": "seul", "logement": "locataire_social", "loyer_mensuel": 450, "zone": 2}, "montants": "net"}


def test_ass_selon_la_condition_de_duree_de_travail():
    with TestClient(app) as c:
        avec = {l["id"]: l["montant"] for l in c.post("/api/simulation/menage", json=_menage(True)).json()["lignes"]}
        sans = {l["id"]: l["montant"] for l in c.post("/api/simulation/menage", json=_menage(False)).json()["lignes"]}
    # environ 30 jours × 19,48 € (règle travail.chomage.ass_montant_journalier) pour une personne seule sans ressources
    assert 450 < avec.get("ass", 0) < 650
    assert sans.get("ass", 0) == 0 and sans.get("rsa", 0) > 0
