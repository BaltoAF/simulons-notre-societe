"""Le Système — synchronisation des leviers adossés à OpenFisca-France.

Lit model/moteur/openfisca_leviers.yaml, extrait d'OpenFisca-France les valeurs, l'historique et
les références légales de chaque levier, puis génère :
  - model/regles/<domaine>/<fichier>.yaml   (uniquement pour les leviers non déjà définis ailleurs)
  - model/sources/openfisca.yaml            (références légales citées par OpenFisca)

Usage : backend/.venv/Scripts/python system/sync_openfisca.py
"""
from __future__ import annotations

import datetime as dt
import hashlib
import sys
from collections import defaultdict
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT / "model"
GENERATED_MARK = "system/sync_openfisca.py"
HISTORY_SINCE = "2010-01-01"
TODAY = dt.date.today().isoformat()


def load_yaml(path: Path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def dump_yaml(data, path: Path, header: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(header)
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False, width=120)


def rule_ids_defined_elsewhere() -> set[str]:
    """Ids de règles définies dans des fiches qui ne sont pas générées par ce script."""
    ids = set()
    for path in (MODEL / "regles").rglob("*.yaml"):
        data = load_yaml(path) or {}
        if data.get("genere_par") == GENERATED_MARK:
            continue
        for r in data.get("regles", []) or []:
            if isinstance(r, dict) and r.get("id"):
                ids.add(r["id"])
    return ids


def get_param(tbs, path: str):
    node = tbs.parameters
    for part in path.split("."):
        node = node.children[part] if hasattr(node, "children") else getattr(node, part)
    return node


def normalize_references(meta: dict) -> dict[str, list[dict]]:
    """OpenFisca stocke les références sous plusieurs formes ; on les ramène à {date: [{title, href}]}."""
    ref = (meta or {}).get("reference")
    out: dict[str, list[dict]] = defaultdict(list)
    if not ref:
        return out
    if isinstance(ref, dict):
        for date, items in ref.items():
            for item in items if isinstance(items, list) else [items]:
                if isinstance(item, dict):
                    out[str(date)].append({"title": item.get("title"), "href": item.get("href")})
                elif isinstance(item, str):
                    out[str(date)].append({"title": item, "href": item if item.startswith("http") else None})
    elif isinstance(ref, list):
        for item in ref:
            if isinstance(item, dict):
                out["*"].append({"title": item.get("title"), "href": item.get("href")})
            elif isinstance(item, str):
                out["*"].append({"title": item, "href": item if item.startswith("http") else None})
    elif isinstance(ref, str):
        out["*"].append({"title": ref, "href": ref if ref.startswith("http") else None})
    return out


class SourceRegistry:
    def __init__(self):
        self.sources: dict[str, dict] = {}

    def add_reference(self, title: str | None, href: str | None) -> str:
        key = (href or "") + "|" + (title or "")
        sid = "of-ref-" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:10]
        if sid not in self.sources:
            t = (title or href or "Référence légale").strip()
            official = bool(href and ("legifrance" in href or "journal-officiel" in href or "bofip" in href)) or \
                t.lower().startswith(("loi", "décret", "decret", "arrêté", "arrete", "ordonnance", "code", "article", "circulaire", "lfss", "lfi", "lf "))
            self.sources[sid] = {
                "id": sid,
                "type": "texte_officiel" if official else "rapport_institutionnel",
                "editeur": "Légifrance (DILA)" if href and "legifrance" in href else "Référence citée par OpenFisca-France",
                "titre": t,
                "url": href or "",
                "consulte_le": TODAY,
                "note": "Référence extraite automatiquement des métadonnées d'OpenFisca-France.",
            }
        return sid


def openfisca_source(version: str) -> dict:
    return {
        "id": "openfisca-france",
        "type": "modele_public",
        "editeur": "OpenFisca (communauté, DINUM/Etalab, IPP, LexImpact)",
        "titre": f"OpenFisca-France {version} — modèle de microsimulation du système socio-fiscal français",
        "url": "https://github.com/openfisca/openfisca-france",
        "consulte_le": TODAY,
        "note": "Moteur de calcul open source (AGPL) utilisé notamment par LexImpact (Assemblée nationale) et mes-aides. "
                "Chaque paramètre y est relié à ses textes de référence.",
    }


def history_of(param, factor: float) -> list[tuple[str, float | None]]:
    """Historique (date, valeur affichée), du plus ancien au plus récent, depuis HISTORY_SINCE."""
    items = []
    vals = sorted(param.values_list, key=lambda v: v.instant_str)
    for i, v in enumerate(vals):
        nxt = vals[i + 1].instant_str if i + 1 < len(vals) else None
        if nxt and nxt < HISTORY_SINCE:
            continue
        value = None if v.value is None else round(float(v.value) * factor, 6)
        items.append((v.instant_str, value))
    return items


def scale_history(scale) -> list[tuple[str, list[dict]]]:
    """Historique d'un barème : à chaque date où un seuil ou un taux change, le barème complet."""
    instants = set()
    for b in scale.brackets:
        for v in b.threshold.values_list + b.rate.values_list:
            instants.add(v.instant_str)
    instants = sorted(i for i in instants if i >= HISTORY_SINCE)
    # garder l'état en vigueur à HISTORY_SINCE
    out = []
    for inst in [HISTORY_SINCE] + instants:
        brackets = []
        for b in scale.brackets:
            th = _value_at(b.threshold.values_list, inst)
            rt = _value_at(b.rate.values_list, inst)
            if th is None or rt is None:
                continue
            brackets.append({"seuil": round(float(th), 2), "taux": round(float(rt) * 100, 4)})
        brackets.sort(key=lambda x: x["seuil"])
        if not out or out[-1][1] != brackets:
            out.append((inst, brackets))
    return out


def _value_at(values_list, instant: str):
    best = None
    for v in sorted(values_list, key=lambda v: v.instant_str):
        if v.instant_str <= instant:
            best = v.value
    return best


def main():
    from openfisca_france import FranceTaxBenefitSystem
    import openfisca_france

    version = getattr(openfisca_france, "__version__", None)
    if not version:
        from importlib.metadata import version as pkg_version
        version = pkg_version("openfisca-france")

    tbs = FranceTaxBenefitSystem()
    leviers = load_yaml(MODEL / "moteur" / "openfisca_leviers.yaml")["leviers"]
    elsewhere = rule_ids_defined_elsewhere()
    registry = SourceRegistry()
    files: dict[tuple[str, str], dict] = {}
    skipped = []
    valeurs_moteur: dict[str, float] = {}

    for lev in leviers:
        param = get_param(tbs, lev["lecture"])
        meta = getattr(param, "metadata", {}) or {}
        refs = normalize_references(meta)
        if lev["id"] in elsewhere:
            skipped.append(lev["id"])
            if lev["type"] != "bareme":
                cur = history_of(param, float(lev.get("facteur", 1)))
                cur = [v for d, v in cur if d <= TODAY and v is not None]
                if cur:
                    valeurs_moteur[lev["id"]] = cur[-1]
            continue
        factor = float(lev.get("facteur", 1))
        if lev["type"] == "bareme":
            hist = scale_history(param)
        else:
            hist = history_of(param, factor)

        valeurs = []
        for date, value in hist:
            if value is None:
                continue
            srcs = ["openfisca-france"]
            ref_items = refs.get(date) or []
            if not ref_items:
                # référence la plus récente antérieure ou égale à la date
                dated = sorted(k for k in refs if k != "*" and k <= date)
                if dated:
                    ref_items = refs[dated[-1]]
                ref_items = ref_items or refs.get("*", [])
            for item in ref_items[:3]:
                srcs.insert(0, registry.add_reference(item.get("title"), item.get("href")))
            valeurs.append({"depuis": date, "valeur": value, "sources": srcs})

        rule = {
            "id": lev["id"],
            "titre": lev["titre"],
            "explication": lev["explication"],
            "type": lev["type"],
            "unite": lev["unite"],
        }
        if lev.get("bornes"):
            rule["bornes"] = lev["bornes"]
        rule["valeurs"] = valeurs
        if lev.get("tags"):
            rule["tags"] = lev["tags"]
        rule["verifie_le"] = meta.get("last_value_still_valid_on")
        rule["moteur"] = {"openfisca": lev["lecture"]}
        rule["a_verifier"] = not valeurs
        key = (lev["domaine"], lev["fichier"])
        files.setdefault(key, {"genere_par": GENERATED_MARK, "domaine": lev["domaine"],
                               "theme": lev.get("theme", ""), "regles": []})
        files[key]["regles"].append(rule)

    # supprimer les anciens fichiers générés qui ne sont plus produits
    for path in (MODEL / "regles").rglob("*.yaml"):
        data = load_yaml(path) or {}
        if data.get("genere_par") == GENERATED_MARK:
            key = (path.parent.name, path.stem)
            if key not in files:
                path.unlink()

    header = (f"# FICHIER GÉNÉRÉ par {GENERATED_MARK} le {TODAY} à partir d'OpenFisca-France {version}.\n"
              "# Ne pas modifier à la main : modifier model/moteur/openfisca_leviers.yaml puis relancer le Système.\n")
    for (domaine, fichier), data in files.items():
        dump_yaml(data, MODEL / "regles" / domaine / f"{fichier}.yaml", header)

    dump_yaml({"genere_par": GENERATED_MARK, "version_openfisca": version, "valeurs": valeurs_moteur},
              MODEL / "moteur" / "valeurs_moteur.yaml", header)
    sources = [openfisca_source(version)] + sorted(registry.sources.values(), key=lambda s: s["id"])
    dump_yaml({"sources": sources}, MODEL / "sources" / "openfisca.yaml", header)

    n_rules = sum(len(d["regles"]) for d in files.values())
    print(f"OpenFisca-France {version} : {n_rules} règles générées dans {len(files)} fichiers, "
          f"{len(sources)} sources, {len(skipped)} leviers rattachés à des règles existantes ({', '.join(skipped) or '—'}).")


if __name__ == "__main__":
    sys.exit(main())
