"""Les tests travaillent dans une base temporaire : les comptes et propositions qu'ils créent ne doivent jamais apparaître sur le site."""
import os
import shutil
import tempfile

# avant tout import de l'application : config.py lit ce dossier au chargement
_DOSSIER = tempfile.mkdtemp(prefix="societe-tests-")
os.environ["SOCIETE_DATA_DIR"] = _DOSSIER


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_DOSSIER, ignore_errors=True)
