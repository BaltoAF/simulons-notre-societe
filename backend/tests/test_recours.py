"""Taux de recours appliqués aux dépenses : le non-recours en montant passe avant le non-recours en personnes."""
from app.impacts.microsim import taux_recours
from app.model_store import get_store


def test_minimum_vieillesse_recours_en_montant():
    tr, source = taux_recours(get_store())["aspa"]
    # DREES, Dossier n° 97 (2022) : 790 M€ non versés pour 1 300 M€ versés, soit environ 38 % de non-recours en montant
    assert abs(tr - 0.622) < 0.005 and "en montant" in source
    # les autres prestations gardent leurs estimations en personnes
    assert "en montant" not in taux_recours(get_store())["rsa"][1]
