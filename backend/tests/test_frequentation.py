"""Mesure d'audience maison : anonyme, sans les robots ni les navigateurs qui refusent d'être suivis, page privée."""
from fastapi.testclient import TestClient

from app import db
from app.main import app

NAVIGATEUR = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36"


def test_comptage_anonyme_et_page_privee(monkeypatch):
    with TestClient(app) as c:
        h = {"user-agent": NAVIGATEUR, "cf-connecting-ip": "203.0.113.50"}
        assert c.post("/api/visite", json={"page": "/mes-droits", "provenance": "https://www.google.com/search?q=x"}, headers=h).status_code == 204
        c.post("/api/visite", json={"page": "/comprendre/dette"}, headers=h)
        c.post("/api/visite", json={"page": "/"}, headers={"user-agent": "Googlebot/2.1", "cf-connecting-ip": "66.249.66.1"})
        c.post("/api/visite", json={"page": "/"}, headers={**h, "dnt": "1", "cf-connecting-ip": "198.51.100.7"})
        # aucune adresse IP ni adresse complète de provenance n'est conservée
        lignes = [tuple(r) for t in ("frequentation_pages", "frequentation_provenances", "frequentation_empreintes")
                  for r in db.connect().execute(f"SELECT * FROM {t}")]
        assert not any("203.0.113.50" in str(x) or "search?q" in str(x) for x in lignes)
        # page privée : introuvable sans la clé du serveur, ou avec une mauvaise clé
        monkeypatch.delenv("SOCIETE_CLE_FREQUENTATION", raising=False)
        assert c.get("/api/frequentation?cle=x").status_code == 404
        monkeypatch.setenv("SOCIETE_CLE_FREQUENTATION", "cle-de-test")
        assert c.get("/api/frequentation?cle=mauvaise").status_code == 404
        b = c.get("/api/frequentation?cle=cle-de-test").json()
    assert b["jours"][-1]["visiteurs"] == 1 and b["total_vues"] == 2          # le robot et le « ne pas suivre » sont exclus
    assert b["appareils"] == {"telephone": 2} and b["provenances"] == [{"domaine": "google.com", "visites": 1}]
