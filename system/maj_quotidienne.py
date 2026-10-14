"""Le Système — mise à jour quotidienne, sans intervention humaine.

Étapes (chacune ne fait quelque chose que si c'est nécessaire) :
  1. Moteur : si une nouvelle version d'OpenFisca-France (même version majeure) est publiée, l'installe,
     la valide sur des cas de contrôle, et revient à la version précédente en cas d'échec.
  2. Leviers : resynchronise les règles fiscales et sociales si le moteur ou le catalogue des leviers a changé.
  3. Population : recale la population synthétique si les statistiques de calage ont changé.
  4. Contrôles : vérifie la cohérence du modèle (sources, identifiants, contrôles croisés). Bloque la
     publication en cas d'erreur.
  5. Publication : enregistre une nouvelle version de la Société 1.0 si des règles ont changé (y compris
     les règles dont la date d'entrée en vigueur est arrivée), puis met à jour les forks sans conflit.
  6. Banc d'essai : si le moteur, la population, les modèles d'impact ou les chiffrages officiels ont changé, rejoue
     les réformes chiffrées par des institutions publiques et publie l'écart (page « Nos chiffres sont-ils justes ? »).
  7. Sources : vérifie qu'une partie des liens des sources répond encore (rotation quotidienne).

Usage : backend/.venv/Scripts/python system/maj_quotidienne.py [--json] [--sans-moteur] [--sans-liens]
La dernière ligne affichée avec --json est un résumé JSON (lu par le planificateur du serveur).
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable
sys.path.insert(0, str(ROOT / "backend"))
import os  # noqa: E402
ENV = {**os.environ, "PYTHONIOENCODING": "utf-8"}

VALIDATION = r"""
import sys
sys.path.insert(0, r'%s')
from app.engine.openfisca_engine import ENGINE
from app.engine.household import Menage, Adulte
ENGINE.load()
r = ENGINE._compute_local([Menage([Adulte(40, activite='inactif')], loyer_mensuel=450),
                           Menage([Adulte(40, salaire_brut_mensuel=2500)], logement='proprietaire')])
assert r['rsa'][0] > 300 and r['impot_revenu'][1] > 0, 'résultats de contrôle incohérents'
print('ok')
""" % str(ROOT / "backend")


def sha(*paths: Path) -> str:
    h = hashlib.sha256()
    for p in paths:
        if p.exists():
            h.update(p.read_bytes())
    return h.hexdigest()[:16]


def version_installee() -> str:
    from importlib.metadata import version
    return version("openfisca-france")


def derniere_version() -> str | None:
    out = subprocess.run([PY, "-m", "pip", "index", "versions", "openfisca-france"], capture_output=True, text=True, timeout=120)
    first = (out.stdout or "").splitlines()[:1]
    if first and "(" in first[0]:
        return first[0].split("(")[1].split(")")[0].strip()
    return None


def pip_install(v: str) -> bool:
    return subprocess.run([PY, "-m", "pip", "install", "-q", f"openfisca-france=={v}"], timeout=900).returncode == 0


def valider_moteur() -> bool:
    return subprocess.run([PY, "-I", "-c", VALIDATION], capture_output=True, text=True, timeout=600).returncode == 0


def etape_moteur(resume: dict):
    actuelle = version_installee()
    derniere = derniere_version()
    resume["moteur"] = {"version": actuelle, "derniere_publiee": derniere}
    if not derniere or derniere == actuelle:
        return
    if derniere.split(".")[0] != actuelle.split(".")[0]:
        resume["moteur"]["note"] = "Nouvelle version majeure : à valider manuellement avant installation."
        return
    if pip_install(derniere) and valider_moteur():
        resume["moteur"].update({"mise_a_jour": f"{actuelle} → {derniere}"})
        resume["redemarrage_requis"] = True
    else:
        pip_install(actuelle)
        resume["moteur"]["note"] = f"Version {derniere} rejetée par les contrôles : retour à {actuelle}."


def etape_leviers(resume: dict):
    import yaml
    vm_path = ROOT / "model" / "moteur" / "valeurs_moteur.yaml"
    vm = yaml.safe_load(vm_path.read_text(encoding="utf-8")) if vm_path.exists() else {}
    h = sha(ROOT / "model" / "moteur" / "openfisca_leviers.yaml")
    if vm and vm.get("version_openfisca") == version_installee() and vm.get("hash_leviers") == h:
        resume["leviers"] = "à jour"
        return
    r = subprocess.run([PY, str(ROOT / "system" / "sync_openfisca.py")], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", env=ENV, timeout=900)
    resume["leviers"] = (r.stdout.strip().splitlines() or ["?"])[-1] if r.returncode == 0 else f"échec : {r.stderr[-300:]}"


def etape_population(resume: dict):
    m = ROOT / "model"
    h = sha(m / "metriques" / "population.yaml", m / "metriques" / "travail_retraites.yaml",
            m / "preuves" / "non_recours_prestations.yaml", ROOT / "system" / "build_population.py")
    pop = m / "population" / "population.json"
    if pop.exists():
        try:
            if json.loads(pop.read_text(encoding="utf-8")).get("hash_calage") == h:
                resume["population"] = "à jour"
                return
        except json.JSONDecodeError:
            pass
    r = subprocess.run([PY, str(ROOT / "system" / "build_population.py"), "--hash-calage", h], cwd=ROOT,
                       capture_output=True, text=True, encoding="utf-8", env=ENV, timeout=1800)
    resume["population"] = "recalée" if r.returncode == 0 else f"échec : {r.stderr[-300:]}"


def etape_etalonnage(resume: dict):
    m = ROOT / "model"
    fichiers = sorted((m / "etalonnage").glob("*.yaml")) + [m / "population" / "population.json", m / "moteur" / "openfisca_leviers.yaml"]         + sorted((ROOT / "backend" / "app" / "impacts").glob("*.py")) + [ROOT / "backend" / "app" / "etalonnage.py"]
    h = sha(*fichiers) + version_installee()
    res = m / "etalonnage" / "resultats.json"
    try:
        if json.loads(res.read_text(encoding="utf-8")).get("empreinte") == h:
            resume["etalonnage"] = "à jour"
            return
    except (OSError, json.JSONDecodeError):
        pass
    r = subprocess.run([PY, str(ROOT / "system" / "etalonnage.py"), "--json"], cwd=ROOT, capture_output=True, text=True,
                       encoding="utf-8", env=ENV, timeout=3600)
    if r.returncode != 0:
        resume["etalonnage"] = f"échec : {r.stderr[-300:]}"
        return
    data = json.loads(res.read_text(encoding="utf-8"))
    data["empreinte"] = h
    res.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    resume["etalonnage"] = json.loads((r.stdout.strip().splitlines() or ["{}"])[-1]).get("bilan")


def etape_publication(resume: dict) -> bool:
    from app import db, vcs
    from app.model_store import ModelStore
    store = ModelStore.load()
    st = store.stats()
    resume["controles"] = {"regles": st["regles"], "erreurs": st["erreurs"], "avertissements": st["avertissements"],
                           "controles_croises": f"{sum(1 for c in store.controles if c['concordant'])}/{len(store.controles)}"}
    if st["erreurs"]:
        resume["publication"] = "bloquée : erreurs de cohérence"
        resume["erreurs"] = [i.message for i in store.issues if i.niveau == "erreur"][:10]
        return False
    db.init_db()
    pub = vcs.ensure_reference(store)
    resume["publication"] = pub.get("message") or "aucun changement de règle"
    resume["forks"] = vcs.auto_sync_forks(store)
    return True


def etape_liens(resume: dict, n: int = 40):
    """Vérifie une partie des liens des sources chaque jour (rotation), sans surcharger les sites publics."""
    from app import config
    from app.model_store import ModelStore
    store = ModelStore.load()
    etat_path = config.DATA_DIR / "sources_etat.json"
    etat = json.loads(etat_path.read_text(encoding="utf-8")) if etat_path.exists() else {}
    candidats = sorted((s for s in store.sources.values() if (s.get("url") or "").startswith("http")),
                       key=lambda s: etat.get(s["id"], {}).get("verifie_le", ""))[:n]
    bilan = {"ok": 0, "bloque": 0, "introuvable": 0, "injoignable": 0}
    for s in candidats:
        code, statut = None, "injoignable"
        req = urllib.request.Request(s["url"], method="GET", headers={"User-Agent": "Societe2.0-Systeme/0.2 (verification des sources)"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                code = resp.status
                statut = "ok"
        except urllib.error.HTTPError as e:
            code = e.code
            statut = "introuvable" if e.code in (404, 410) else "bloque" if e.code in (401, 403, 405, 429) else "injoignable"
        except Exception:
            statut = "injoignable"
        bilan[statut] += 1
        etat[s["id"]] = {"statut": statut, "code": code, "verifie_le": dt.date.today().isoformat()}
        time.sleep(0.5)
    etat_path.write_text(json.dumps(etat, ensure_ascii=False, indent=0), encoding="utf-8")
    resume["liens"] = bilan


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--sans-moteur", action="store_true")
    ap.add_argument("--sans-liens", action="store_true")
    args = ap.parse_args()
    t = time.time()
    resume: dict = {"date": dt.date.today().isoformat()}
    for nom, fn in [("moteur", None if args.sans_moteur else etape_moteur), ("leviers", etape_leviers),
                    ("population", etape_population)]:
        if fn:
            try:
                fn(resume)
            except Exception as e:  # une étape défaillante n'empêche pas les suivantes
                resume[nom] = f"échec : {type(e).__name__}: {e}"
    ok = etape_publication(resume)
    if ok:
        try:
            etape_etalonnage(resume)
        except Exception as e:
            resume["etalonnage"] = f"échec : {type(e).__name__}: {e}"
    if not args.sans_liens:
        try:
            etape_liens(resume)
        except Exception as e:
            resume["liens"] = f"échec : {e}"
    resume["duree_s"] = round(time.time() - t, 1)
    if args.json:
        print(json.dumps(resume, ensure_ascii=False, default=str))
    else:
        print(json.dumps(resume, ensure_ascii=False, indent=2, default=str))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
