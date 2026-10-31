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


def test_vitesses_routes_et_ville_sans_surestimer():
    """À 80 km/h, le gain est faible (CGDD, 0,21 Mt pour -10 km/h) ; en ville, l'effet sur le CO2 n'est pas mesuré (compté nul)."""
    with TestClient(app) as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {"transports.vitesse_max.route_bidirectionnelle": 70,
                                                                    "transports.vitesse_max.agglomeration": 30}}).json()
    ind = {i["id"]: i["valeur"] for s in rap["sections"] for i in s["indicateurs"]}
    assert abs(ind["emissions_vitesse_route_bidirectionnelle"] + 0.21) < 1e-9
    assert ind["emissions_vitesse_agglomeration"] == 0


def test_idees_faibles_montrees_a_part():
    st = get_store()
    carbone = {f["id"]: f for f in compensations.idees_faibles(st, {}, "carbone", 1.0)}
    assert {"faible_vitesse_routes", "faible_vitesse_ville", "faible_forets"} <= set(carbone)
    assert carbone["faible_forets"]["overrides"] is None  # expliquée, pas proposée : la forêt ne compte pas pour le budget carbone
    budget = compensations.idees_faibles(st, {}, "budget", 5.0)
    assert budget and all(f["rendement"] < 1 for f in budget)
