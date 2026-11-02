"""Tableau de bord des propositions : extraction des indicateurs clés et cache persistant (sans simulation lourde)."""
import os
import tempfile

os.environ.setdefault("SOCIETE_DATA_DIR", tempfile.mkdtemp(prefix="societe-test-"))

from app import db, indicateurs, vcs  # noqa: E402
from app.model_store import get_store  # noqa: E402

CONF = {"score": 70, "niveau": "eleve", "libelle": "Élevé", "description": "", "facteurs": [], "resume": "x"}
CONF_FAIBLE = {"score": 30, "niveau": "faible", "libelle": "Faible", "description": "", "facteurs": [], "resume": "y"}


def rapport_factice(effet_budget=-2.0, effet_carbone=0.3, gagnants=40.0, perdants=5.0, emplois=(12000, -2000), moyenne=12.5):
    return {
        "equilibres": [
            {"id": "budget", "effet": effet_budget, "statut": "a_compenser", "manque": max(0, -effet_budget), "confiance": CONF,
             "composantes": [{"libelle": "a", "valeur": effet_budget}]},
            {"id": "carbone", "effet": effet_carbone, "statut": "information", "manque": 0, "confiance": CONF_FAIBLE, "composantes": [{}]},
        ],
        "sections": [
            {"id": "redistribution", "donnees": {"perdants_pct": perdants, "moyenne_menage_mois": moyenne}, "indicateurs": [
                {"id": "gagnants", "libelle": "Part des ménages gagnants", "valeur": gagnants, "unite": "pourcent_part", "confiance": CONF},
                {"id": "pauvrete", "libelle": "Taux de pauvreté", "valeur": -0.4, "avant": 15.0, "apres": 14.6, "unite": "points",
                 "confiance": CONF_FAIBLE, "sens": "favorable"}]},
            {"id": "comportements", "donnees": {}, "indicateurs": [
                {"id": f"emploi_{k}", "libelle": f"Emploi {k}", "valeur": v, "unite": "emplois", "confiance": c}
                for k, v, c in zip(("a", "b"), emplois, (CONF, CONF_FAIBLE))]},
        ],
        "bilan": [{"pilier": "economie", "indicateurs": [{"id": "equilibre_budget", "valeur": effet_budget, "sens": "defavorable"}]}],
    }


def test_extraction_ordre_valeurs_et_sens():
    out = indicateurs.extraire(rapport_factice())
    assert list(out) == ["finances", "menages", "pauvrete", "emploi", "climat"]  # même ordre pour toutes les propositions
    assert out["finances"]["valeur"] == -2.0 and out["finances"]["sens"] == "defavorable" and out["finances"]["confiance"]["score"] == 70
    assert out["menages"]["valeur"] == 12.5 and out["menages"]["gagnants"] == 40.0 and out["menages"]["perdants"] == 5.0
    assert out["menages"]["sens"] == "favorable" and out["menages"]["unite"] == "euros_mois"
    assert out["pauvrete"]["valeur"] == -0.4 and out["pauvrete"]["sens"] == "favorable"
    assert out["emploi"]["valeur"] == 10000 and out["emploi"]["sens"] == "favorable"
    assert 30 <= out["emploi"]["confiance"]["score"] <= 70  # moyenne pondérée par l'ampleur, comme les autres sommes du site
    assert out["climat"]["valeur"] == 0.3 and out["climat"]["sens"] == "defavorable"


def test_extraction_non_chiffre_jamais_invente():
    r = {"equilibres": [{"id": "budget", "effet": 0.0, "statut": "respecte", "manque": 0, "confiance": None, "composantes": []},
                        {"id": "carbone", "effet": 0.0, "statut": "non_mesure", "manque": 0, "confiance": None, "composantes": []}],
         "sections": [], "bilan": []}
    out = indicateurs.extraire(r)
    assert all(v["valeur"] is None for v in out.values())


def test_extraction_effet_negligeable_neutre():
    out = indicateurs.extraire(rapport_factice(effet_carbone=0.001, gagnants=10, perdants=8, emplois=(100, 50), moyenne=0.3))
    assert out["climat"]["sens"] == "neutre" and out["menages"]["sens"] == "neutre" and out["emploi"]["sens"] == "neutre"



def test_une_hausse_de_tva_se_voit_dans_la_tuile_des_menages():
    """Anomalie du 01/11/2026 : un point de TVA en plus ne change pas la part de gagnants (ceux qui gagnent beaucoup restent
    gagnants) mais ajoute des perdants et baisse le pouvoir d'achat moyen ; la tuile doit le montrer."""
    sans = indicateurs.extraire(rapport_factice(gagnants=9.0, perdants=59.0, moyenne=4.0))
    avec = indicateurs.extraire(rapport_factice(gagnants=9.0, perdants=91.0, moyenne=-9.0))
    assert sans["menages"]["gagnants"] == avec["menages"]["gagnants"]
    assert avec["menages"]["valeur"] < sans["menages"]["valeur"] and avec["menages"]["sens"] == "defavorable"

def _proposition(nom="Tableau de bord", valeur=700):
    db.init_db()
    indicateurs.init()
    store = get_store()
    vcs.ensure_reference(store)
    conn = db.connect()
    if not conn.execute("SELECT 1 FROM users WHERE pseudo = 'pilote'").fetchone():
        from app import auth
        auth.register("pilote", "pilote@ex.fr", "motdepasse1")
    user = db.row(conn.execute("SELECT * FROM users WHERE pseudo = 'pilote'").fetchone())
    soc = vcs.fork(user, "france", vcs.BRANCHE_PRINCIPALE, nom)
    vcs.commit(user, store, soc["id"], vcs.BRANCHE_PRINCIPALE, [{"regle": "prestations.rsa.montant_forfaitaire", "valeur": valeur}], "RSA")
    return store, user, soc


def test_cache_persistant_cle_et_invalidation():
    store, user, soc = _proposition()
    appels = []

    def simuler_factice(store_, overrides, *a):
        appels.append(dict(overrides))
        return rapport_factice()

    # rien en cache : la page n'attend pas, elle dit « en calcul » (et la proposition est mise en file)
    etat = indicateurs.pour_societe(store, vcs.get_society(soc["id"]), demander_si_absent=False)
    assert etat["statut"] == "en_calcul" and etat["valeurs"] is None
    r = indicateurs.calculer(store, soc["id"], simuler=simuler_factice)
    assert r["statut"] == "pret" and appels == [{"prestations.rsa.montant_forfaitaire": 700}]
    # mêmes règles, même modèle : pas de nouvelle simulation
    indicateurs.calculer(store, soc["id"], simuler=simuler_factice)
    assert len(appels) == 1
    etat = indicateurs.pour_societe(store, vcs.get_society(soc["id"]))
    assert etat["statut"] == "pret" and etat["valeurs"]["finances"]["valeur"] == -2.0
    # une copie identique (même état) profite du même calcul
    copie = vcs.fork(user, soc["id"], vcs.BRANCHE_PRINCIPALE, "Copie")
    assert indicateurs.pour_societe(store, vcs.get_society(copie["id"]), demander_si_absent=False)["statut"] == "pret"
    # nouveau commit : nouvelle empreinte, donc recalcul
    vcs.commit(user, store, soc["id"], vcs.BRANCHE_PRINCIPALE, [{"regle": "prestations.rsa.montant_forfaitaire", "valeur": 720}], "RSA 720")
    assert indicateurs.pour_societe(store, vcs.get_society(soc["id"]), demander_si_absent=False)["statut"] == "en_calcul"
    indicateurs.calculer(store, soc["id"], simuler=simuler_factice)
    assert len(appels) == 2
    # le modèle change (autre version de la loi de référence) : la clé change aussi
    cle = indicateurs.cle_modele(store)
    store._cle_indicateurs = "autre-version"
    assert indicateurs.cle_modele(store) != cle
    assert indicateurs.pour_societe(store, vcs.get_society(soc["id"]), demander_si_absent=False)["statut"] == "en_calcul"
    store._cle_indicateurs = None
    assert indicateurs.cle_modele(store) == cle


def test_echec_garde_sans_boucler():
    store, user, soc = _proposition("Proposition qui échoue", 710)
    n = []

    def en_panne(*a):
        n.append(1)
        raise RuntimeError("panne")
    assert indicateurs.calculer(store, soc["id"], simuler=en_panne)["statut"] == "erreur"
    indicateurs.calculer(store, soc["id"], simuler=en_panne)
    assert len(n) == 1
    assert indicateurs.pour_societe(store, vcs.get_society(soc["id"]))["statut"] == "erreur"


def test_file_bornee_et_prioritaire():
    indicateurs._FILE.clear()
    for i in range(indicateurs.MAX_FILE):
        assert indicateurs.demander(f"s{i}")
    assert not indicateurs.demander("de-trop")             # pleine : une demande paresseuse attend la prochaine visite
    assert indicateurs.demander("s3")                      # déjà en file : rien ne double
    assert len(indicateurs._FILE) == indicateurs.MAX_FILE
    assert indicateurs.demander("modifiee", prioritaire=True)  # une proposition modifiée passe devant
    assert indicateurs._FILE[0] == ("modifiee", "principale") and len(indicateurs._FILE) == indicateurs.MAX_FILE
    indicateurs._FILE.clear()


def test_reference_situation_actuelle_sans_simulation():
    store = get_store()
    out = indicateurs.pour_societe(store, {"id": "france", "reference": True})
    assert out["statut"] == "reference"
    assert list(out["valeurs"]) == indicateurs.ORDRE
    assert out["valeurs"]["menages"]["valeur"] is None  # pas de sens pour la loi actuelle : non chiffré, pas zéro
    assert out["valeurs"]["finances"]["valeur"] is not None and out["valeurs"]["finances"]["annee"]


def test_api_liste_renvoie_indicateurs_sans_simuler(monkeypatch):
    from fastapi.testclient import TestClient
    from app.impacts import simulation
    from app.main import app

    def interdit(*a, **k):
        raise AssertionError("la liste ne doit jamais simuler")
    monkeypatch.setattr(simulation, "simuler", interdit)
    with TestClient(app) as c:
        lst = c.get("/api/societes").json()["societes"]
        assert lst and all("indicateurs" in s for s in lst)
        ref = next(s for s in lst if s["reference"])
        assert ref["indicateurs"]["statut"] == "reference"
        autres = [s for s in lst if not s["reference"]]
        assert all(s["indicateurs"]["statut"] in ("pret", "en_calcul", "erreur", "aucun_changement") for s in autres)
        sid = autres[0]["id"]
        assert c.get(f"/api/societes/{sid}").json()["indicateurs"]["statut"] in ("pret", "en_calcul", "erreur", "aucun_changement")


def test_effet_incertain_quand_la_fourchette_contient_zero():
    """RSA à 800 € : −268 000 emplois au centre, mais de −751 000 à +43 000 selon les études. La tuile ne doit pas présenter
    ce chiffre comme un effet établi : fourchette affichée, sens neutre."""
    r = rapport_factice(emplois=(-268000, 0))
    r["sections"][1]["indicateurs"][0]["fourchette"] = [-751000, 43000]
    e = indicateurs.extraire(r)["emploi"]
    assert e["fourchette"] == [-751000, 43000] and e["incertain"] and e["sens"] == "neutre"
    # une fourchette entièrement négative garde son sens
    r["sections"][1]["indicateurs"][0]["fourchette"] = [-400000, -100000]
    e = indicateurs.extraire(r)["emploi"]
    assert not e.get("incertain") and e["sens"] == "defavorable"


def test_la_simulation_renvoie_les_tuiles_de_pilotage():
    """L'atelier affiche les mêmes tuiles que la liste : la réponse de simulation les contient, extraites du rapport."""
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        rap = c.post("/api/simulation/reforme", json={"overrides": {"prestations.rsa.montant_forfaitaire": 700}}).json()
    cles = rap["indicateurs_cles"]
    assert cles["statut"] == "pret"
    assert {"finances", "menages", "emploi"} <= set(cles["valeurs"])


def test_tva_repercussion_selon_le_type_de_taux():
    """Taux normal : fiche des études sur le taux normal (≈ 92 %) ; taux réduit : fiche des taux réduits (≈ 50 %)."""
    from fastapi.testclient import TestClient
    from app.main import app
    with TestClient(app) as c:
        n = c.post("/api/simulation/reforme", json={"overrides": {"fiscalite.tva.taux_normal": 21}}).json()
        r = c.post("/api/simulation/reforme", json={"overrides": {"fiscalite.tva.taux_reduit": 6.5}}).json()
    pn = next(i for s in n["sections"] for i in s["indicateurs"] if i["id"] == "prix_tva")
    pr = next(i for s in r["sections"] for i in s["indicateurs"] if i["id"] == "prix_tva")
    assert pn["preuves"] == ["tva_repercussion_prix_taux_normal"] and pr["preuves"] == ["tva_repercussion_prix_taux_reduits"]
    assert "92 %" in pn["calcul"][0] and "50 %" in pr["calcul"][0]
