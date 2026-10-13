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

# Date de référence de la Société 1.0 (« législation en vigueur »).
TODAY = dt.date.fromisoformat(os.environ.get("SOCIETE_DATE", dt.date.today().isoformat()))
# Période de calcul : mois courant pour les prestations (versées mensuellement), année civile pour l'impôt.
MOIS_REFERENCE = TODAY.strftime("%Y-%m")
ANNEE_REFERENCE = str(TODAY.year)

REFERENCE_SOCIETY_ID = "france"
SESSION_DAYS = 30
