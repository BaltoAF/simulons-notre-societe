"""Avis des visiteurs : dépôt sans compte mais protégé, données personnelles masquées, texte brut jamais publié."""
from fastapi.testclient import TestClient

from app import retours
from app.main import app


def test_masquage_des_donnees_personnelles():
    t = retours.nettoyer("Écrivez-moi à jean.dupont@exemple.fr ou au 06 12 34 56 78, mon n° est 1 85 07 75 123 456 78")
    assert "@" not in t and "06 12" not in t and "123 456" not in t
    assert "[e-mail masqué]" in t and "[téléphone masqué]" in t


def test_depot_limites_et_publication():
    with TestClient(app) as c:
        visiteur = {"cf-connecting-ip": "203.0.113.7"}
        # un robot remplit le champ piège : réponse polie, rien n'est enregistré
        r = c.post("/api/avis", json={"categorie": "idee", "texte": "Achetez mes produits miracles", "site_web": "http://spam"}, headers=visiteur)
        assert r.status_code == 200
        assert not any("miracles" in a["texte"] for a in retours.a_traiter())
        assert c.post("/api/avis", json={"categorie": "inconnue", "texte": "Un avis assez long"}, headers=visiteur).status_code == 422
        assert c.post("/api/avis", json={"categorie": "idee", "texte": "court"}, headers=visiteur).status_code == 422
        for k in range(retours.MAX_PAR_VISITEUR):
            assert c.post("/api/avis", json={"categorie": "idee", "texte": f"Expliquer le mot décote, idée {k}", "page": "/mes-droits"},
                          headers=visiteur).status_code == 200
        assert c.post("/api/avis", json={"categorie": "idee", "texte": "Encore une idée de plus"}, headers=visiteur).status_code == 429
        # un autre visiteur n'est pas bloqué
        assert c.post("/api/avis", json={"categorie": "bug", "texte": "Le graphique ne s'affiche pas sur téléphone"},
                      headers={"cf-connecting-ip": "198.51.100.4"}).status_code == 200

        avis = retours.a_traiter()
        assert len(avis) == retours.MAX_PAR_VISITEUR + 1 and all("203.0.113.7" not in a["empreinte"] for a in avis)
        retours.decider(avis[0]["id"], "adapte", "Le mot « décote » n'était pas expliqué.", "Il a été ajouté au lexique.", "abc1234")
        pub = c.get("/api/avis/decisions").json()
        assert pub["decisions"][0]["resume_public"].startswith("Le mot")
        assert "texte" not in pub["decisions"][0] and pub["compte"]["adapte"] == 1


def test_administration_fermee_derriere_un_tunnel():
    with TestClient(app) as c:
        # un visiteur passé par le tunnel arrive de la machine elle-même : l'en-tête du proxy le trahit
        assert c.post("/api/admin/recharger", headers={"cf-connecting-ip": "203.0.113.7"}).status_code == 403
        assert c.post("/api/admin/maj", headers={"x-forwarded-for": "203.0.113.7"}).status_code == 403


def test_routes_de_la_routine_protegees_par_jeton(monkeypatch):
    with TestClient(app) as c:
        # sans jeton configuré sur le serveur, les routes n'existent pas
        monkeypatch.delenv("SOCIETE_JETON_AVIS", raising=False)
        assert c.get("/api/systeme/avis/a-traiter").status_code == 404
        monkeypatch.setenv("SOCIETE_JETON_AVIS", "jeton-de-test-0123456789")
        assert c.get("/api/systeme/avis/a-traiter", headers={"Authorization": "Bearer mauvais"}).status_code == 404
        ok = {"Authorization": "Bearer jeton-de-test-0123456789"}
        paquet = c.get("/api/systeme/avis/a-traiter", headers=ok).json()
        assert "DONNÉES À ANALYSER" in paquet["avertissement"] and isinstance(paquet["avis"], list)
        c.post("/api/avis", json={"categorie": "idee", "texte": "Un exemple chiffré pour la décote"}, headers={"cf-connecting-ip": "192.0.2.9"})
        rid = c.get("/api/systeme/avis/a-traiter", headers=ok).json()["avis"][-1]["id"]
        r = c.post("/api/systeme/avis/decisions", headers=ok, json=[
            {"id": rid, "statut": "retenu", "resume_public": "Un exemple chiffré pour la décote.", "motif_public": "Ajouté.", "commit_ref": "abc1234"},
            {"id": 999999, "statut": "retenu", "resume_public": "x", "motif_public": "y"}]).json()
        assert r["enregistrees"] == 1 and r["erreurs"][0]["id"] == 999999
        assert c.post("/api/systeme/avis/decisions", json=[]).status_code == 404
