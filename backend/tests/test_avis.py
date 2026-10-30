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
