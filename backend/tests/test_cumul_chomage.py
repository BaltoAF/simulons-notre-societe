"""Reprise d'un emploi en gardant une partie de l'allocation chômage (test Karim) : l'allocation baisse de 70 % du
salaire brut repris (règle travail.chomage.cumul_part_salaire_deduite, service-public F14860)."""
from fastapi.testclient import TestClient

from app.main import app


def _menage(cumul: bool) -> dict:
    adulte = {"age": 46, "activite": "salarie", "salaire_net_mensuel": 800}
    if cumul:
        adulte |= {"chomage_net_mensuel": 1150, "cumul_are": True}
    return {"menage": {"adultes": [adulte], "couple": "seul", "logement": "locataire_social", "loyer_mensuel": 450, "zone": 2},
            "montants": "net"}


def test_allocation_reduite_de_70_pourcent_du_salaire_brut():
    with TestClient(app) as c:
        avec = c.post("/api/simulation/menage", json=_menage(True)).json()
        sans = c.post("/api/simulation/menage", json=_menage(False)).json()
    l_avec = {l["id"]: l["montant"] for l in avec["lignes"]}
    # 800 € nets, c'est environ 1 030 € bruts : l'allocation (1 150 € nets) baisse d'environ 720 € bruts
    assert 250 < l_avec.get("chomage_net", 0) < 600
    assert abs(l_avec.get("salaire_net", 0) - 800) < 5
    # garder une partie de l'allocation rapporte plus, mais moins que l'allocation gardée : elle réduit la prime
    # d'activité et l'aide au logement, qui comptent les ressources du foyer
    gain = avec["revenu_disponible"] - sans["revenu_disponible"]
    assert 0 < gain < l_avec["chomage_net"]
