"""Apprentis : la prime d'activité ne s'ouvre qu'au-delà du plancher des apprenants (test Inès, apprentie à 900 € nets,
à qui le site annonçait 243 € de prime d'activité en la comptant comme salariée)."""
from fastapi.testclient import TestClient

from app.main import app


def _menage(activite: str, net: float) -> dict:
    return {"menage": {"adultes": [{"age": 20, "activite": activite, "salaire_net_mensuel": net}],
                       "couple": "seul", "logement": "locataire_prive", "loyer_mensuel": 450, "zone": 2}, "montants": "net"}


def test_apprentie_sous_le_plancher_sans_prime_d_activite():
    with TestClient(app) as c:
        salariee = c.post("/api/simulation/menage", json=_menage("salarie", 900)).json()
        apprentie = c.post("/api/simulation/menage", json=_menage("apprenti", 900)).json()
        apprentie_haut = c.post("/api/simulation/menage", json=_menage("apprenti", 1300)).json()
    l_sal = {l["id"]: l["montant"] for l in salariee["lignes"]}
    l_app = {l["id"]: l["montant"] for l in apprentie["lignes"]}
    l_haut = {l["id"]: l["montant"] for l in apprentie_haut["lignes"]}
    # même salaire : la salariée touche la prime d'activité, l'apprentie non (plancher d'environ 1 144 € par mois)
    assert l_sal.get("prime_activite", 0) > 100
    assert l_app.get("prime_activite", 0) < 1
    # au-dessus du plancher, l'apprentie y a droit
    assert l_haut.get("prime_activite", 0) > 50
    # le salaire net saisi reste celui calculé ; l'aide au logement reste due
    assert abs(l_app.get("salaire_net", 0) - 900) < 5 and l_app.get("aides_logement", 0) > 0
