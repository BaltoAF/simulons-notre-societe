"""Banc d'essai : les réformes officielles se traduisent bien en règles, et les verdicts suivent les seuils annoncés."""
from app import etalonnage
from app.model_store import ModelStore

STORE = ModelStore.load()


def test_references_chargees_et_sourcees():
    assert len(STORE.etalonnage) >= 10
    for ref in STORE.etalonnage:
        assert ref["source_id"] in STORE.sources, ref["id"]
        assert etalonnage.overrides_de(STORE, ref), f"{ref['id']} ne change aucune règle"


def test_operations_relatives():
    tva = STORE.regles["fiscalite.tva.taux_normal"]["valeur"]
    ov = etalonnage.overrides_de(STORE, {"id": "t", "overrides": {"fiscalite.tva.taux_normal": {"plus": 1}}})
    assert ov == {"fiscalite.tva.taux_normal": tva + 1}
    # plafonner l'âge légal : seules les générations au-dessus changent, toutes à la même valeur
    ov = etalonnage.overrides_de(STORE, {"id": "r", "overrides": {"retraites.age_legal.generation_*": {"max": 62}}})
    assert ov and all(v == 62 for v in ov.values())
    assert all(STORE.regles[k]["valeur"] > 62 for k in ov)
    # barème : un taux remplacé, les seuils intacts
    ov = etalonnage.overrides_de(STORE, {"id": "b", "overrides": {"fiscalite.impot_revenu.bareme": {"taux": {45: 46}}}})
    bareme = ov["fiscalite.impot_revenu.bareme"]
    assert [t["seuil"] for t in bareme] == [t["seuil"] for t in STORE.regles["fiscalite.impot_revenu.bareme"]["valeur"]]
    assert bareme[-1]["taux"] == 46


def test_verdicts():
    assert etalonnage.verdict(10.5, 10.1, None) == "concordant"      # 4 %
    assert etalonnage.verdict(-0.33, -0.24, None) == "concordant"    # petit écart en milliards
    assert etalonnage.verdict(12.5, 10.0, None) == "proche"          # 25 %
    assert etalonnage.verdict(20.0, 10.0, None) == "ecart"
    assert etalonnage.verdict(-3.0, 2.0, None) == "ecart"            # pas le même sens
    assert etalonnage.verdict(-14.0, -12.6, [-15.7, -10.0]) == "concordant"


def test_reference_reconnue_dans_l_atelier():
    ref = next(r for r in STORE.etalonnage if r["id"] == "retraite_retour_62_ans_age_seul")
    ov = etalonnage.overrides_de(STORE, ref)
    assert etalonnage.reference_pour(STORE, ov)["id"] == ref["id"]
    assert etalonnage.reference_pour(STORE, {"fiscalite.tva.taux_normal": 27}) is None
