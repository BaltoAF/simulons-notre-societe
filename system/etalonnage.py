"""Le Système — banc d'essai : rejoue les réformes chiffrées par des institutions publiques et publie l'écart.

Usage : backend/.venv/Scripts/python system/etalonnage.py [id ...] [--json]
Écrit model/etalonnage/resultats.json (lu par le site, page « Nos chiffres face aux chiffrages officiels »).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.model_store import ModelStore  # noqa: E402
from app.engine.openfisca_engine import ENGINE  # noqa: E402
from app import etalonnage  # noqa: E402


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    store = ModelStore.load()
    if not ENGINE.ready:
        ENGINE.load()
    res = etalonnage.tout_rejouer(store, args or None)
    refs = {r["id"]: r for r in store.etalonnage}
    for r in res["resultats"]:
        if args and r["id"] not in args:
            continue
        if r.get("erreur"):
            print(f"  ERREUR  {r['id']}: {r['erreur']}")
            continue
        print(f"  {r['verdict']:<10} {r['id']:<40} officiel {r['officiel_md']:>+7.2f}  simulé {r['simule_md']:>+7.2f}  "
              f"écart {r['ecart_md']:>+6.2f} ({r['ecart_pct'] if r['ecart_pct'] is not None else '—'} %)  [{refs[r['id']].get('perimetre')}]")
    bilan = {v: sum(1 for x in res["resultats"] if x.get("verdict") == v) for v in ("concordant", "proche", "ecart")}
    print("Bilan :", bilan)
    if "--json" in sys.argv:
        print(json.dumps({"bilan": bilan, "n": len(res["resultats"])}, ensure_ascii=False))


if __name__ == "__main__":
    main()
