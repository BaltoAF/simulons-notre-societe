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


def test_taxe_carbone_sur_le_chauffage():
    """Une hausse de l'accise sur le fioul et le gaz de chauffage baisse les émissions des logements, et compte dans le budget
    carbone ; la solution « chauffage » est proposée pour compenser."""
    with TestClient(app) as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {"environnement_energie.accise.fioul_domestique": 36.66,
                                                                    "environnement_energie.accise.gaz_naturel_combustible": 26.66}}).json()
    ind = {i["id"]: i["valeur"] for s in rap["sections"] for i in s["indicateurs"]}
    # fioul : +20 €/hl → +24 € TTC sur 113,25 €/hl, soit +21 % ; × −0,20 × 7,9 Mt ≈ −0,33 Mt
    assert -0.4 < ind["emissions_chauffage_fioul"] < -0.3
    # gaz : +10 €/MWh → +12 € TTC sur 141,4 €, soit +8,5 % ; × −0,17 × 19,6 Mt ≈ −0,28 Mt
    assert -0.35 < ind["emissions_chauffage_gaz"] < -0.2
    assert any(o["id"] == "accise_chauffage" for o in compensations.options_carbone(get_store(), {}, 1.0))


def test_une_taxe_sur_le_gazole_compte_dans_le_pouvoir_d_achat():
    """+10 c€/l d'accise sur le gazole : chaque ménage paie plus à la pompe (dépense de carburants de son décile, Insee
    Budget de famille 2017) ; les gagnants et perdants le comptent, les ménages aisés paient plus en euros."""
    st = get_store()
    rid = "environnement_energie.accise.gazole"
    with TestClient(app) as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {rid: st.rule_value(rid) + 10}}).json()
    red = next(s for s in rap["sections"] if s["id"] == "redistribution")
    assert red["donnees"]["perdants_pct"] > 50
    assert red["donnees"]["moyenne_menage_mois"] < 0
    dec = red["donnees"]["deciles"]
    assert dec[-1]["delta_euros"] < dec[0]["delta_euros"] < 0


def test_une_taxe_sur_l_electricite_compte_pour_chaque_menage():
    """+10 €/MWh d'accise sur l'électricité : dépense d'électricité du décile (Insee 2017) ramenée aux prix de 2025."""
    st = get_store()
    rid = "environnement_energie.accise.electricite_menages"
    with TestClient(app) as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {rid: st.rule_value(rid) + 10}}).json()
    red = next(s for s in rap["sections"] if s["id"] == "redistribution")["donnees"]
    # ≈ 746 € × 1,42 × 12 / 254,6 ≈ 5 % de hausse → environ −4 € par ménage et par mois
    assert -6 < red["moyenne_menage_mois"] < -2
