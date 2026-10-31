"""Leviers pour le climat : des émissions évitées, et leur coût pour l'argent public, comptés dans les deux équilibres."""
from fastapi.testclient import TestClient

from app.impacts import compensations
from app.main import app
from app.model_store import get_store


def test_un_levier_compte_dans_les_deux_equilibres():
    with TestClient(app) as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {"environnement_energie.leviers.renovation_logements_mt": 2}}).json()
    sec = next(s for s in rap["sections"] if s["id"] == "climat_leviers")
    ind = {i["id"]: i["valeur"] for i in sec["indicateurs"]}
    assert ind["emissions_levier_renovation_logements"] == -2
    assert abs(ind["solde_public_levier_renovation_logements"] + 0.5) < 1e-9  # 2 Mt × 250 €/t = 0,5 Md€ par an
    eq = {e["id"]: e for e in rap["equilibres"]}
    assert any("Rénovation" in x["libelle"] for x in eq["carbone"]["composantes"])
    assert any("Rénovation" in x["libelle"] for x in eq["budget"]["composantes"])


def test_les_solutions_pour_le_climat_sont_variees():
    opts = compensations.options_carbone(get_store(), {}, 3.1)
    familles = {o["famille"] for o in opts}
    assert {"prix", "regles", "investir", "pratiques"} <= familles and len(opts) >= 8
    # une solution n'est proposée que si elle peut couvrir le manque (borne de la règle)
    assert not any(o["id"] == "levier_engrais_azotes" for o in compensations.options_carbone(get_store(), {}, 6))
