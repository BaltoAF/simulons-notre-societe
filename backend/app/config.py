from __future__ import annotations

import datetime as dt
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "model"
DATA_DIR = Path(os.environ.get("SOCIETE_DATA_DIR", ROOT / "backend" / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "societe.sqlite3"
FRONTEND_DIST = ROOT / "frontend" / "dist"

# Date de référence de la Société 1.0 (« législation en vigueur ») : elle avance chaque jour, sans redémarrage,
# pour que les règles dont la date d'entrée en vigueur arrive s'appliquent automatiquement.
# Période de calcul : mois courant pour les prestations (versées mensuellement), année civile pour l'impôt.
TODAY: dt.date
MOIS_REFERENCE: str
ANNEE_REFERENCE: str


def rafraichir_dates() -> bool:
    """Met à jour la date de référence ; renvoie True si elle a changé."""
    global TODAY, MOIS_REFERENCE, ANNEE_REFERENCE
    nouveau = dt.date.fromisoformat(os.environ.get("SOCIETE_DATE", dt.date.today().isoformat()))
    change = globals().get("TODAY") != nouveau
    TODAY = nouveau
    MOIS_REFERENCE = TODAY.strftime("%Y-%m")
    ANNEE_REFERENCE = str(TODAY.year)
    return change


rafraichir_dates()

REFERENCE_SOCIETY_ID = "france"
SESSION_DAYS = 30
