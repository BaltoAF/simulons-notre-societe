"""Lire un article de loi dans les données ouvertes de la DILA (base LEGI), sans passer par Légifrance.

Légifrance bloque les lectures automatiques ; la DILA, son éditeur, publie la même base en fichiers libres
(https://echanges.dila.gouv.fr/OPENDATA/LEGI/) : une archive complète (« Freemium_legi_global », plus d'un Go) et une
mise à jour par jour ouvré. Cet outil lit ces archives en flux, sans les garder sur le disque, et n'en conserve que
les articles demandés (dans system/cache/legi/), puis affiche leur texte et leurs dates de vigueur.

Usage :
    python system/legi.py LEGIARTI000038929265            # un article (identifiant Légifrance)
    python system/legi.py LEGIARTI000038929265 --frais    # ignorer le cache et relire les archives

Un article modifié change d'identifiant : la fiche lue donne la liste de ses versions (balise VERSIONS) ; l'outil suit
la version en vigueur la plus récente et l'affiche aussi.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import tarfile
import urllib.request
from html import unescape
from pathlib import Path

BASE = "https://echanges.dila.gouv.fr/OPENDATA/LEGI/"
CACHE = Path(__file__).resolve().parent / "cache" / "legi"
UA = {"User-Agent": "simulons-notre-societe (lecture des données ouvertes LEGI)"}


def _liste() -> list[str]:
    with urllib.request.urlopen(urllib.request.Request(BASE, headers=UA), timeout=120) as r:
        page = r.read().decode("utf-8", "replace")
    return sorted(set(re.findall(r'href="((?:Freemium_legi_global|LEGI)_[0-9-]+\.tar\.gz)"', page)))


def _date(nom: str) -> str:
    return re.search(r"_(\d{8})-", nom).group(1)


def _parcourir(nom: str, ids: set[str], trouves: dict[str, tuple[str, str]], essais: int = 4) -> bool:
    """Lit une archive en flux ; garde la version la plus récente (date de l'archive) de chaque article cherché.
    Une connexion coupée (cela arrive sur les grosses archives) est reprise depuis le début de l'archive, jusqu'à
    `essais` fois ; renvoie False si l'archive n'a pas pu être lue en entier."""
    import time
    for essai in range(essais):
        lus: dict[str, tuple[str, str]] = {}
        try:
            req = urllib.request.Request(BASE + nom, headers=UA)
            with urllib.request.urlopen(req, timeout=600) as r, tarfile.open(fileobj=r, mode="r|gz") as tar:
                for m in tar:
                    if not m.isfile() or not m.name.endswith(".xml"):
                        continue
                    ident = m.name.rsplit("/", 1)[-1][:-4]
                    if ident in ids:
                        f = tar.extractfile(m)
                        if f is not None:
                            lus[ident] = (_date(nom), f.read().decode("utf-8", "replace"))
            trouves.update(lus)
            return True
        except (OSError, tarfile.TarError, EOFError) as e:
            print(f"  {nom} : lecture interrompue ({e}), essai {essai + 1}/{essais}", file=sys.stderr)
            time.sleep(5 * (essai + 1))
    return False


def _champ(xml: str, balise: str) -> str | None:
    m = re.search(rf"<{balise}[^>]*>(.*?)</{balise}>", xml, re.S)
    return unescape(re.sub(r"<[^>]+>", " ", m.group(1))).strip() if m else None


def _resume(ident: str, xml: str) -> dict:
    meta = {k: _champ(xml, k) for k in ("NUM", "ETAT", "DATE_DEBUT", "DATE_FIN")}
    texte = re.sub(r"\s+", " ", _champ(xml, "CONTENU") or "")
    versions = re.findall(r'<VERSION etat="([^"]*)">\s*<LIEN_ART [^>]*debut="([^"]*)"[^>]*fin="([^"]*)"[^>]*id="([^"]*)"', xml)
    return {"id": ident, **meta, "texte": texte,
            "versions": [{"etat": e, "debut": d, "fin": f, "id": i} for e, d, f, i in versions]}


def lire(ids: list[str], frais: bool = False) -> dict[str, dict]:
    CACHE.mkdir(parents=True, exist_ok=True)
    res: dict[str, dict] = {}
    manquants = []
    for i in ids:
        c = CACHE / f"{i}.json"
        if c.exists() and not frais:
            res[i] = json.loads(c.read_text())
        else:
            manquants.append(i)
    if manquants:
        archives = _liste()
        globale = [a for a in archives if a.startswith("Freemium")][-1]
        quotidiennes = [a for a in archives if a.startswith("LEGI_") and _date(a) > _date(globale)]
        # progression gardée archive par archive : une coupure ne fait pas tout relire (l'archive complète prend 15 min)
        prog_f = CACHE / ("_progression_" + "_".join(sorted(manquants))[:180] + ".json")
        prog = json.loads(prog_f.read_text()) if prog_f.exists() and not frais else {"faites": [], "trouves": {}, "ratees": []}
        trouves: dict[str, tuple[str, str]] = {k: tuple(v) for k, v in prog["trouves"].items()}
        for a in [globale] + quotidiennes:
            if a in prog["faites"]:
                continue
            print(f"Lecture de {a}{' (plus d’un Go, en flux)' if a == globale else ''}…", file=sys.stderr)
            if _parcourir(a, set(manquants), trouves):
                prog["faites"].append(a)
            else:
                prog["ratees"].append(a)
            prog["trouves"] = trouves
            prog_f.write_text(json.dumps(prog, ensure_ascii=False))
        for i in manquants:
            if i in trouves:
                res[i] = {**_resume(i, trouves[i][1]), "archive": trouves[i][0],
                          "archives_non_lues": prog["ratees"]}
                (CACHE / f"{i}.json").write_text(json.dumps(res[i], ensure_ascii=False, indent=1))
        if not prog["ratees"]:
            prog_f.unlink(missing_ok=True)
    return res


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--frais", action="store_true")
    a = ap.parse_args()
    res = lire(a.ids, a.frais)
    # suivre la version en vigueur, si l'article demandé n'est plus la version courante
    suivants = []
    for r in res.values():
        en_vigueur = [v["id"] for v in r.get("versions", []) if v["etat"] == "VIGUEUR" and v["id"] not in res]
        suivants += en_vigueur
    if suivants:
        res.update(lire(sorted(set(suivants)), a.frais))
    for i in a.ids + sorted(set(suivants)):
        r = res.get(i)
        if not r:
            print(f"{i} : introuvable dans les archives LEGI")
            continue
        print(f"\n=== Article {r.get('NUM')} ({i}) — {r.get('ETAT')}, du {r.get('DATE_DEBUT')} au {r.get('DATE_FIN')} "
              f"(archive du {r.get('archive')})\n{r['texte']}")
        if r.get("archives_non_lues"):
            print(f"Attention : {len(r['archives_non_lues'])} archive(s) n'ont pas pu être lues ; relancer l'outil les reprendra.")
        vig = [v for v in r.get("versions", []) if v["etat"] == "VIGUEUR"]
        if vig:
            print("Version en vigueur : " + ", ".join(f"{v['id']} (depuis le {v['debut']})" for v in vig))


if __name__ == "__main__":
    main()
