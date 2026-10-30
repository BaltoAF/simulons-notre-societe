"""Allocations familiales dès le premier enfant (dispositif proposé) : versées aux familles, comptées dans le budget."""
from fastapi.testclient import TestClient

from app.main import app

PARENT_UN_ENFANT = {"adultes": [{"age": 30, "activite": "salarie", "salaire_net_mensuel": 1800}], "couple": "seul",
                    "enfants": [4], "logement": "locataire_prive", "loyer_mensuel": 600}


def test_allocations_familiales_premier_enfant():
    with TestClient(app) as c:
        r = c.post("/api/simulation/reforme", json={"overrides": {"prestations.famille.af_premier_enfant_montant": 77},
                                                     "menage": PARENT_UN_ENFANT, "montants": "net"}).json()
    detail = {l["id"]: l["delta_mois"] for l in r["pour_vous"]["detail"]}
    assert abs(detail["allocations_familiales"] - 77) < 0.5
    postes = {p["cle"]: p for s in r["sections"] for p in (s.get("donnees") or {}).get("postes", [])}
    # plusieurs millions de familles : plusieurs milliards d'euros par an
    assert postes["allocations_familiales"]["delta"] > 3
    assert not any(s["id"] == "non_modelise" for s in r["sections"])
