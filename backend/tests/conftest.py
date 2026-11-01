"""Les tests travaillent dans une base temporaire : les comptes et propositions qu'ils créent ne doivent jamais apparaître sur le site."""
import os
import shutil
import tempfile

# avant tout import de l'application : config.py lit ce dossier au chargement
_DOSSIER = tempfile.mkdtemp(prefix="societe-tests-")
os.environ["SOCIETE_DATA_DIR"] = _DOSSIER
# pas de calcul des indicateurs clés en arrière-plan pendant les tests : chaque simulation complète prend une minute
# (test_indicateurs.py les teste avec un calcul factice)
os.environ.setdefault("SOCIETE_INDICATEURS", "0")


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_DOSSIER, ignore_errors=True)
