"""Journal des erreurs : regroupé, sans donnée personnelle, effacé après 30 jours, transmis à la routine."""
from fastapi.testclient import TestClient

from app import db, journal
from app.main import app


def test_regroupement_masquage_et_conservation():
    journal.init()
    for k in range(3):  # même erreur, nombres variables : une seule ligne, trois occurrences
        journal.noter("navigateur", f"Cannot read properties of undefined (reading 'montant') #{k}", "at Synthese (synthese.tsx:12)",
                      "/mes-droits?cle=secrete")
    journal.noter("serveur", "ValueError: écrire à jean@exemple.fr", "File \"app/main.py\", line 3", "/api/x")
    rec = {r["origine"]: r for r in journal.recentes(7)}
    assert rec["navigateur"]["occurrences"] == 3 and rec["navigateur"]["page"] == "/mes-droits"   # sans les paramètres
    assert "@" not in rec["serveur"]["message"]
    # au-delà de 30 jours, tout est effacé
    with db.transaction() as c:
        c.execute("UPDATE journal_erreurs SET jour = date('now', '-31 days') WHERE origine = 'serveur'")
    journal.purger()
    assert {r["origine"] for r in journal.recentes(60)} == {"navigateur"}


def test_signalement_du_navigateur_et_lecture_par_la_routine(monkeypatch):
    with TestClient(app) as c:
        h = {"cf-connecting-ip": "203.0.113.80"}
        for k in range(25):  # au plus 20 signalements par visiteur et par jour
            assert c.post("/api/erreur-navigateur", json={"message": f"Erreur de test {k}", "page": "/budget"}, headers=h).status_code == 204
        monkeypatch.setenv("SOCIETE_JETON_AVIS", "jeton-journal")
        paquet = c.get("/api/systeme/avis/a-traiter", headers={"Authorization": "Bearer jeton-journal"}).json()
    erreurs = [e for e in paquet["erreurs_recentes"] if e["message"].startswith("Erreur de test")]
    assert sum(e["occurrences"] for e in erreurs) == 20
