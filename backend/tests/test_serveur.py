"""État du serveur (mises à jour de sécurité…) : alertes claires, transmis à la routine et à la page privée seulement."""
import datetime as dt
import json

from fastapi.testclient import TestClient

from app import serveur
from app.main import app

MAINTENANT = dt.datetime(2026, 11, 2, 9, 0, tzinfo=dt.timezone.utc)


def _ecrire(**modif):
    il_y_a = lambda **k: (MAINTENANT - dt.timedelta(**k)).isoformat()
    e = {
        "date": il_y_a(minutes=20),
        "systeme": {"nom": "Ubuntu 26.04 LTS", "noyau": "7.0.0-10-generic", "fin_support": "2031-05-29"},
        "mises_a_jour": {"automatiques": True, "en_attente": 12, "securite": 0, "derniere_execution": il_y_a(hours=5), "erreurs": []},
        "redemarrage": {"requis": False, "depuis": None, "paquets": []},
        "pare_feu_actif": True, "fail2ban": {"actif": True, "adresses_bloquees": 3},
        "disque_utilise_pct": 31.0, "images_rafraichies_le": il_y_a(days=3), "derniere_sauvegarde": il_y_a(hours=8),
    }
    for cle, val in modif.items():
        e[cle] = {**e[cle], **val} if isinstance(val, dict) else val
    serveur.FICHIER.write_text(json.dumps(e), encoding="utf-8")


def test_serveur_en_bonne_sante():
    _ecrire()
    e = serveur.etat(MAINTENANT)
    assert e["statut"] == "ok" and e["alertes"] == []


def test_alertes_quand_les_mises_a_jour_coincent():
    _ecrire(mises_a_jour={"securite": 4, "derniere_execution": (MAINTENANT - dt.timedelta(days=3)).isoformat()},
            redemarrage={"requis": True, "depuis": (MAINTENANT - dt.timedelta(days=4)).isoformat(), "paquets": ["linux-image-7.0.0-11"]},
            disque_utilise_pct=88.0)
    e = serveur.etat(MAINTENANT)
    textes = " ".join(a["texte"] for a in e["alertes"])
    assert e["statut"] == "a_traiter"
    assert "4 mise(s) à jour de sécurité" in textes and "linux-image-7.0.0-11" in textes and "88 %" in textes
    # un redémarrage attendu depuis quelques heures est normal : il aura lieu à 4 h 30
    _ecrire(redemarrage={"requis": True, "depuis": (MAINTENANT - dt.timedelta(hours=3)).isoformat(), "paquets": []})
    assert serveur.etat(MAINTENANT)["statut"] == "ok"


def test_etat_trop_ancien_et_fin_de_support():
    _ecrire(date=(MAINTENANT - dt.timedelta(hours=9)).isoformat(), systeme={"fin_support": "2027-04-30"})
    e = serveur.etat(MAINTENANT)
    assert e["statut"] == "a_traiter"
    assert any("6 heures" in a["texte"] for a in e["alertes"]) and any("30/04/2027" in a["texte"] for a in e["alertes"])


def test_transmis_a_la_routine_et_a_la_page_privee_seulement(monkeypatch):
    _ecrire()
    monkeypatch.setenv("SOCIETE_JETON_AVIS", "jeton-serveur")
    monkeypatch.setenv("SOCIETE_CLE_FREQUENTATION", "cle-serveur")
    with TestClient(app) as c:
        assert c.get("/api/systeme/avis/a-traiter", headers={"Authorization": "Bearer jeton-serveur"}).json()["serveur"]["systeme"]["nom"]
        assert "serveur" in c.get("/api/frequentation?cle=cle-serveur").json()
        assert c.get("/api/systeme/avis/a-traiter").status_code in (401, 403, 404)
    serveur.FICHIER.unlink()
    assert serveur.etat(MAINTENANT)["statut"] == "inconnu"
