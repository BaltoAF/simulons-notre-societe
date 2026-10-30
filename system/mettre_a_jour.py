"""Le Système — mise à jour complète de la loi actuelle.

Enchaîne les étapes automatiques puis publie une nouvelle version (commit du Système) si le modèle a changé :
  1. synchronisation des leviers fiscaux et sociaux depuis OpenFisca-France ;
  2. contrôle de cohérence du modèle (sources citées existantes, identifiants uniques…) ;
  3. reconstruction et recalage de la population synthétique (optionnel : --population) ;
  4. publication d'un commit sur la loi actuelle.

La collecte documentaire (textes, statistiques, études) est réalisée par les agents de recherche du Système,
qui écrivent dans model/ ; ce script consolide et publie.

Usage : backend/.venv/Scripts/python system/mettre_a_jour.py [--population]
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable
sys.path.insert(0, str(ROOT / "backend"))


def etape(titre: str, *cmd: str):
    print(f"\n── {titre}")
    r = subprocess.run([PY, *cmd], cwd=ROOT)
    if r.returncode != 0:
        raise SystemExit(f"Échec de l'étape « {titre} »")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--population", action="store_true", help="reconstruire la population synthétique")
    args = ap.parse_args()
    etape("Synchronisation OpenFisca-France", "system/sync_openfisca.py")
    if args.population:
        etape("Population synthétique", "system/build_population.py")

    from app import db, vcs
    from app.model_store import ModelStore
    store = ModelStore.load()
    st = store.stats()
    print(f"\n── Contrôle du modèle : {st['regles']} règles, {st['sources']} sources, {st['metriques']} métriques, "
          f"{st['preuves']} fiches d'études ; {st['erreurs']} erreur(s), {st['avertissements']} avertissement(s)")
    for i in store.issues[:20]:
        print(f"   [{i.niveau}] {i.fichier} : {i.message}")
    if st["erreurs"]:
        raise SystemExit("Des erreurs bloquent la publication : corrigez-les avant de publier une nouvelle version.")
    db.init_db()
    res = vcs.ensure_reference(store)
    print("\n── Publication :", res.get("message") or ("loi actuelle créée" if res.get("cree") else "aucun changement"),
          f"(commit {res['commit']})")


if __name__ == "__main__":
    main()
