"""Le Système — avis des visiteurs pour l'auto-amélioration quotidienne (voir system/auto_amelioration/TACHE.md).

Usage :
  python system/retours.py [--distant URL] a-traiter [FICHIER]   avis non examinés + commentaires récents, en JSON
  python system/retours.py [--distant URL] decider FICHIER       enregistre les décisions (liste JSON, voir ci-dessous)
  python system/retours.py bilan                                 nombre d'avis par statut (base locale)

--distant URL : travaille sur le site en ligne (ex. https://simulons.example.fr) au lieu de la base locale ; le jeton secret
est lu dans la variable d'environnement SOCIETE_JETON_AVIS (le même que sur le serveur).

Format des décisions : [{"id": 12, "statut": "adapte", "resume_public": "…", "motif_public": "…", "commit_ref": "abc1234"}]
Statuts : retenu, adapte, deja_fait, a_l_etude, ecarte, doublon. Le résumé et le motif sont publiés : neutres, sans donnée personnelle.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))


def _distant(url: str, chemin: str, corps=None):
    jeton = os.environ.get("SOCIETE_JETON_AVIS")
    if not jeton:
        sys.exit("SOCIETE_JETON_AVIS n'est pas défini : impossible de lire les avis du site en ligne.")
    req = urllib.request.Request(url.rstrip("/") + chemin, method="POST" if corps is not None else "GET",
                                 data=json.dumps(corps).encode() if corps is not None else None,
                                 headers={"Authorization": f"Bearer {jeton}", "Content-Type": "application/json",
                                          "User-Agent": "SimulonsNotreSociete-AutoAmelioration/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8"))


def a_traiter(chemin: str | None, distant: str | None):
    if distant:
        sortie = _distant(distant, "/api/systeme/avis/a-traiter")
    else:
        from app import journal, retours
        sortie = {**retours.paquet_a_traiter(), "erreurs_recentes": journal.recentes(7)}
    texte = json.dumps(sortie, ensure_ascii=False, indent=2)
    if chemin:
        Path(chemin).write_text(texte, encoding="utf-8")
        print(f"{len(sortie['avis'])} avis, {len(sortie['commentaires_recents'])} commentaires et "
              f"{len(sortie.get('erreurs_recentes', []))} erreurs du site écrits dans {chemin}")
    else:
        print(texte)


def decider(chemin: str, distant: str | None):
    decisions = json.loads(Path(chemin).read_text(encoding="utf-8"))
    if distant:
        res = _distant(distant, "/api/systeme/avis/decisions", decisions)
        ok, erreurs = res["enregistrees"], [f"{e['id']} : {e['erreur']}" for e in res["erreurs"]]
    else:
        from app import retours
        ok, erreurs = 0, []
        for d in decisions:
            try:
                retours.decider(int(d["id"]), d["statut"], d["resume_public"], d["motif_public"], d.get("commit_ref"))
                ok += 1
            except (KeyError, ValueError) as e:
                erreurs.append(f"{d.get('id')} : {e}")
    print(f"{ok} décision(s) enregistrée(s)")
    for e in erreurs:
        print("ERREUR", e)
    if erreurs:
        sys.exit(1)


def bilan():
    from app import db
    for statut, n in db.connect().execute("SELECT statut, COUNT(*) FROM retours GROUP BY statut ORDER BY statut"):
        print(f"{statut:12} {n}")


def main():
    args = sys.argv[1:]
    distant = None
    if args[:1] == ["--distant"] and len(args) > 1:
        distant, args = args[1], args[2:]
    if not args or args[0] not in ("a-traiter", "decider", "bilan"):
        print(__doc__)
        sys.exit(2)
    if not distant:
        from app import db, journal, retours
        db.init_db()
        retours.init()
        journal.init()
    if args[0] == "a-traiter":
        a_traiter(args[1] if len(args) > 1 else None, distant)
    elif args[0] == "decider":
        if len(args) < 2:
            sys.exit("decider : indiquez le fichier JSON des décisions")
        decider(args[1], distant)
    else:
        bilan()


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
