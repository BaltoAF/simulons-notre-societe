"""Auto-entrepreneurs : cotisations au taux de la règle du site, impôt et aides calculés par le moteur (régime micro)."""
from fastapi.testclient import TestClient

from app.main import app


def _menage(ca: float, activite: str = "services") -> dict:
    return {"menage": {"adultes": [{"age": 24, "activite": "independant", "ca_micro_mensuel": ca, "activite_micro": activite}],
                       "couple": "seul", "logement": "locataire_prive", "loyer_mensuel": 550, "zone": 2}, "montants": "net"}


def test_livreur_auto_entrepreneur():
    with TestClient(app) as c:
        petit = c.post("/api/simulation/menage", json=_menage(1700)).json()
        grand = c.post("/api/simulation/menage", json=_menage(4000)).json()
    lignes = {l["id"]: l["montant"] for l in petit["lignes"]}
    # 21,2 % de cotisations sur les prestations de services (Service Public Entreprendre, F36232)
    assert abs(lignes["revenu_micro"] - 1700 * (1 - 0.212)) < 1
    # un chiffre d'affaires modeste ouvre la prime d'activité et l'aide au logement ; pas d'impôt
    assert lignes.get("prime_activite", 0) > 100 and lignes.get("aides_logement", 0) > 0 and "impot_revenu" not in lignes
    # plus haut, l'impôt apparaît (après l'abattement forfaitaire de 50 %) et les aides baissent
    lignes_g = {l["id"]: l["montant"] for l in grand["lignes"]}
    assert lignes_g.get("impot_revenu", 0) > 0 and lignes_g.get("prime_activite", 0) < lignes["prime_activite"]
