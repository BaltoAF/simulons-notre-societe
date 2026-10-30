"""« Avez-vous pensé à… ? » : chaque fiche d'aide renvoie à une page officielle et à des sources connues, et l'API les résout."""
from fastapi.testclient import TestClient

from app.main import app
from app.model_store import ModelStore

STORE = ModelStore.load()


def test_fiches_completes_et_sourcees():
    assert len(STORE.aides_oubliees) >= 10
    assert not [i for i in STORE.issues if "aide" in i.message.lower() and i.niveau == "erreur"]
    for a in STORE.aides_oubliees:
        assert a["url_officielle"].startswith("https://"), a["id"]
        for sid in [a["source_id"], *(a.get("sources_complementaires") or []), a.get("non_recours_source")]:
            assert sid is None or sid in STORE.sources, f"{a['id']} : source inconnue {sid}"
        # une aide calculée par le moteur doit correspondre à une ligne du résultat de « Mes droits »
        assert a["criteres"].get("calculee") in (None, "prime_activite", "aspa", "asf", "ars", "aides_logement"), a["id"]


def test_api_resout_les_sources():
    with TestClient(app) as c:
        aides = c.get("/api/aides-oubliees").json()["aides"]
    assert {a["id"] for a in aides} >= {"c2s", "cheque_energie", "pension_reversion", "prime_activite"}
    for a in aides:
        assert a["source"] and a["source"]["url"], a["id"]
        assert "fichier" not in a
