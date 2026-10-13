"""Chargement et validation de la Société 1.0 (dossier model/).

Le modèle est un ensemble de fichiers YAML produits par le Système. Ce module les charge, les
normalise, vérifie leur cohérence (sources citées existantes, ids uniques…) et expose un index
interrogeable, ainsi qu'un « instantané » (snapshot) des valeurs en vigueur identifié par un hash.
"""
from __future__ import annotations

import copy
import fnmatch
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from .config import MODEL_DIR, TODAY

DOMAINES_VALIDES = {
    "fiscalite", "prestations", "retraites", "travail", "justice_penale", "droit_civil", "institutions",
    "education", "sante", "logement", "environnement_energie", "nationalite_immigration", "budget",
}
TYPES_SOURCE = {
    "texte_officiel": "Texte officiel",
    "statistique_publique": "Statistique publique",
    "modele_public": "Modèle de calcul public",
    "rapport_institutionnel": "Rapport institutionnel",
    "etude_academique": "Étude académique",
    "document_de_travail": "Document de travail",
    "think_tank": "Think tank",
    "presse": "Presse",
}
# Fiabilité intrinsèque d'une source selon son type (0-1), utilisée par l'indice de confiance.
FIABILITE_TYPE = {
    "texte_officiel": 1.0, "statistique_publique": 0.95, "modele_public": 0.9, "rapport_institutionnel": 0.85,
    "etude_academique": 0.8, "document_de_travail": 0.6, "think_tank": 0.45, "presse": 0.3,
}


_HEADER_CACHE: dict[str, bool] = {}


@dataclass
class Issue:
    niveau: str  # erreur | avertissement
    fichier: str
    message: str
    ref: str | None = None

    def to_dict(self):
        return {"niveau": self.niveau, "fichier": self.fichier, "message": self.message, "ref": self.ref}


@dataclass
class ModelStore:
    domaines: list[dict] = field(default_factory=list)
    regles: dict[str, dict] = field(default_factory=dict)
    sources: dict[str, dict] = field(default_factory=dict)
    metriques: dict[str, dict] = field(default_factory=dict)
    preuves: dict[str, dict] = field(default_factory=dict)
    leviers_moteur: dict[str, dict] = field(default_factory=dict)
    correspondances: dict[str, dict] = field(default_factory=dict)
    issues: list[Issue] = field(default_factory=list)
    citations: dict[str, list[dict]] = field(default_factory=dict)  # source_id -> qui la cite
    controles: list[dict] = field(default_factory=list)  # contrôles croisés entre sources indépendantes

    # ───────────────────────── chargement ─────────────────────────
    @classmethod
    def load(cls, model_dir: Path = MODEL_DIR) -> "ModelStore":
        store = cls()
        store._load_domaines(model_dir)
        store._load_sources(model_dir)
        store._load_regles(model_dir)
        store._load_moteur(model_dir)
        store._load_metriques(model_dir)
        store._load_preuves(model_dir)
        store._check_references()
        store._controles_croises(model_dir)
        return store

    def _controles_croises(self, d: Path):
        """Compare des valeurs établies par des sources indépendantes (fiches thématiques, OpenFisca, lois de finances)."""
        def egal(a, b):
            try:
                return abs(float(a) - float(b)) < 1e-6 * max(1.0, abs(float(a)))
            except (TypeError, ValueError):
                return a == b
        vm_path = d / "moteur" / "valeurs_moteur.yaml"
        if vm_path.exists():
            vm = (self._read(vm_path) or {})
            for rid, v in (vm.get("valeurs") or {}).items():
                r = self.regles.get(rid)
                if r is None:
                    continue
                ok = egal(r["valeur"], v)
                self.controles.append({"regle": rid, "titre": r["titre"], "valeur": r["valeur"], "autre_valeur": v,
                                       "autre_source": f"OpenFisca-France {vm.get('version_openfisca', '')}".strip(), "concordant": ok})
        cc_path = d / "moteur" / "controles_croises.yaml"
        if cc_path.exists():
            for a, b in (self._read(cc_path) or {}).get("paires", []) or []:
                ra, rb = self.regles.get(a), self.regles.get(b)
                if not ra or not rb:
                    continue
                ok = egal(ra["valeur"], rb["valeur"])
                self.controles.append({"regle": b, "titre": rb["titre"], "valeur": rb["valeur"], "autre_valeur": ra["valeur"],
                                       "autre_source": "règle de contrôle " + a, "autre_regle": a, "concordant": ok})
        for c in self.controles:
            r = self.regles[c["regle"]]
            r.setdefault("controles", []).append(c)
            if not c["concordant"]:
                self.issues.append(Issue("avertissement", r["fichier"],
                                         f"Contrôle croisé discordant pour « {c['regle']} » : {c['valeur']} contre {c['autre_valeur']} ({c['autre_source']})",
                                         c["regle"]))

    def _read(self, path: Path) -> Any:
        try:
            with open(path, encoding="utf-8") as f:
                return yaml.safe_load(f)
        except Exception as e:  # YAML invalide : on le signale sans bloquer le reste du modèle
            self.issues.append(Issue("erreur", self._rel(path), f"YAML illisible : {e}"))
            return None

    @staticmethod
    def _rel(path: Path) -> str:
        try:
            return str(path.relative_to(MODEL_DIR.parent)).replace("\\", "/")
        except ValueError:
            return str(path)

    def _load_domaines(self, d: Path):
        data = self._read(d / "domaines.yaml") or {}
        self.domaines = data.get("domaines", [])

    def _load_sources(self, d: Path):
        for path in sorted((d / "sources").glob("*.yaml")):
            data = self._read(path) or {}
            for s in data.get("sources", []) or []:
                if not isinstance(s, dict) or not s.get("id"):
                    self.issues.append(Issue("erreur", self._rel(path), "Source sans id"))
                    continue
                sid = str(s["id"])
                if sid in self.sources:
                    prev = self.sources[sid]
                    if (prev.get("url") or "") != (s.get("url") or ""):
                        self.issues.append(Issue("avertissement", self._rel(path),
                                                 f"Source « {sid} » définie deux fois avec des URL différentes", sid))
                    continue
                s = dict(s)
                s["fichier"] = self._rel(path)
                if s.get("type") not in TYPES_SOURCE:
                    self.issues.append(Issue("avertissement", self._rel(path), f"Type de source inconnu : {s.get('type')}", sid))
                s["fiabilite"] = FIABILITE_TYPE.get(s.get("type"), 0.3)
                self.sources[sid] = s

    def _load_regles(self, d: Path):
        for path in sorted((d / "regles").rglob("*.yaml")):
            data = self._read(path) or {}
            domaine = data.get("domaine") or path.parent.name
            if domaine not in DOMAINES_VALIDES:
                self.issues.append(Issue("erreur", self._rel(path), f"Domaine inconnu : {domaine}"))
            theme = data.get("theme") or path.stem.replace("_", " ").capitalize()
            for r in data.get("regles", []) or []:
                if not isinstance(r, dict) or not r.get("id"):
                    self.issues.append(Issue("erreur", self._rel(path), "Règle sans id"))
                    continue
                rid = str(r["id"])
                if rid in self.regles:
                    self.issues.append(Issue("erreur", self._rel(path), f"Règle « {rid} » définie deux fois", rid))
                    continue
                rule = self._normalize_rule(r, domaine, theme, path)
                self.regles[rid] = rule

    def _normalize_rule(self, r: dict, domaine: str, theme: str, path: Path) -> dict:
        rule = dict(r)
        rule["id"] = str(r["id"])
        rule["domaine"] = domaine
        rule["theme"] = theme
        rule["fichier"] = self._rel(path)
        rule.setdefault("type", "nombre")
        rule.setdefault("unite", "")
        rule.setdefault("tags", [])
        rule["genere"] = bool(path and (self._read_header_flag(path)))
        valeurs = []
        for v in r.get("valeurs", []) or []:
            if not isinstance(v, dict):
                continue
            entry = dict(v)
            entry["depuis"] = str(v.get("depuis", "")) if v.get("depuis") is not None else ""
            srcs = v.get("sources") or ([v["source"]] if v.get("source") else [])
            entry["sources"] = [str(s) for s in srcs]
            valeurs.append(entry)
        valeurs.sort(key=lambda e: e["depuis"])
        rule["valeurs"] = valeurs
        today = TODAY.isoformat()
        en_vigueur = [v for v in valeurs if not v["depuis"] or v["depuis"] <= today]
        a_venir = [v for v in valeurs if v["depuis"] and v["depuis"] > today]
        courante = en_vigueur[-1] if en_vigueur else None
        rule["valeur"] = courante["valeur"] if courante else None
        rule["valeur_depuis"] = courante["depuis"] if courante else None
        rule["valeur_sources"] = courante["sources"] if courante else []
        rule["prochaine_valeur"] = a_venir[0] if a_venir else None
        if not valeurs and not r.get("virtuel"):
            self.issues.append(Issue("avertissement", rule["fichier"], f"Règle « {rule['id']} » sans valeur", rule["id"]))
        if courante and not courante["sources"] and not r.get("virtuel"):
            self.issues.append(Issue("erreur", rule["fichier"], f"Valeur en vigueur de « {rule['id']} » sans source", rule["id"]))
        return rule

    def _read_header_flag(self, path: Path) -> bool:
        key = str(path)
        if key not in _HEADER_CACHE:
            with open(path, encoding="utf-8") as f:
                _HEADER_CACHE[key] = f.read(200).startswith("# FICHIER GÉNÉRÉ")
        return _HEADER_CACHE[key]

    def _load_moteur(self, d: Path):
        data = self._read(d / "moteur" / "openfisca_leviers.yaml") or {}
        for lev in data.get("leviers", []) or []:
            self.leviers_moteur[lev["id"]] = lev
            rule = self.regles.get(lev["id"])
            if rule is not None:
                rule["moteur"] = {"openfisca": lev["lecture"], "facteur": lev.get("facteur", 1),
                                  "ecriture": lev.get("ecriture") or [{"chemin": lev["lecture"], "formule": "v"}]}
        liens_path = d / "moteur" / "preuves_liens.yaml"
        self._liens_preuves = (self._read(liens_path) or {}).get("liens", {}) if liens_path.exists() else {}
        corr = self._read(d / "moteur" / "correspondances.yaml") or {}
        for c in corr.get("correspondances", []) or []:
            self.correspondances[c["regle"]] = c

    def _load_metriques(self, d: Path):
        for path in sorted((d / "metriques").glob("*.yaml")):
            data = self._read(path) or {}
            for m in data.get("metriques", []) or []:
                if not isinstance(m, dict) or not m.get("id"):
                    continue
                mid = str(m["id"])
                if mid in self.metriques:
                    self.issues.append(Issue("avertissement", self._rel(path), f"Métrique « {mid} » définie deux fois", mid))
                    continue
                m = dict(m)
                m["fichier"] = self._rel(path)
                serie = [dict(p) for p in (m.get("serie") or []) if isinstance(p, dict)]
                for p in serie:
                    p["date"] = str(p.get("date", ""))
                serie.sort(key=lambda p: p["date"])
                m["serie"] = serie
                observed = [p for p in serie if p.get("statut") not in ("prevision",)]
                last = observed[-1] if observed else (serie[-1] if serie else None)
                m["derniere"] = last
                self.metriques[mid] = m

    def _load_preuves(self, d: Path):
        for path in sorted((d / "preuves").glob("*.yaml")):
            data = self._read(path) or {}
            q = data.get("question") if isinstance(data, dict) else None
            if not isinstance(q, dict) or not q.get("id"):
                self.issues.append(Issue("erreur", self._rel(path), "Fiche de preuves sans question/id"))
                continue
            q = copy.deepcopy(q)
            q["fichier"] = self._rel(path)
            q["estimations"] = [e for e in (q.get("estimations") or []) if isinstance(e, dict)]
            liees = list(q.get("regles_liees") or [])
            for motif in getattr(self, "_liens_preuves", {}).get(str(q["id"]), []):
                liees += [rid for rid in self.regles if fnmatch.fnmatchcase(rid, motif)]
            q["regles_liees"] = [r for r in dict.fromkeys(liees) if r in self.regles]
            self.preuves[str(q["id"])] = q

    def _cite(self, sid: str, kind: str, ref: str, fichier: str):
        if sid not in self.sources:
            self.issues.append(Issue("erreur", fichier, f"Source inconnue « {sid} » citée par {kind} « {ref} »", ref))
            return
        self.citations.setdefault(sid, []).append({"type": kind, "id": ref})

    def _check_references(self):
        for rid, r in self.regles.items():
            seen = set()
            for v in r["valeurs"]:
                for sid in v["sources"]:
                    if sid not in seen:
                        seen.add(sid)
                        self._cite(sid, "regle", rid, r["fichier"])
        for mid, m in self.metriques.items():
            seen = set()
            for p in m["serie"]:
                sid = p.get("source")
                if sid and sid not in seen:
                    seen.add(sid)
                    self._cite(str(sid), "metrique", mid, m["fichier"])
        for qid, q in self.preuves.items():
            for e in q["estimations"]:
                sid = e.get("source")
                if sid:
                    self._cite(str(sid), "preuve", qid, q["fichier"])

    # ───────────────────────── accès ─────────────────────────
    def snapshot(self) -> dict[str, Any]:
        """Valeurs en vigueur de toutes les règles (l'état de la Société 1.0)."""
        return {rid: r["valeur"] for rid, r in sorted(self.regles.items())}

    def snapshot_hash(self) -> str:
        payload = json.dumps(self.snapshot(), sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

    def stats(self) -> dict:
        regles = list(self.regles.values())
        n = len(regles)
        sourcees = sum(1 for r in regles if r["valeur_sources"])
        officielles = sum(
            1 for r in regles
            if any(self.sources.get(s, {}).get("type") == "texte_officiel" for s in r["valeur_sources"])
        )
        a_verifier = sum(1 for r in regles if r.get("a_verifier"))
        par_domaine = {}
        for r in regles:
            par_domaine[r["domaine"]] = par_domaine.get(r["domaine"], 0) + 1
        return {
            "regles": n,
            "regles_sourcees": sourcees,
            "regles_texte_officiel": officielles,
            "regles_a_verifier": a_verifier,
            "sources": len(self.sources),
            "metriques": len(self.metriques),
            "preuves": len(self.preuves),
            "estimations": sum(len(q["estimations"]) for q in self.preuves.values()),
            "par_domaine": par_domaine,
            "erreurs": sum(1 for i in self.issues if i.niveau == "erreur"),
            "avertissements": sum(1 for i in self.issues if i.niveau == "avertissement"),
        }

    def metric_value(self, mid: str, default=None):
        m = self.metriques.get(mid)
        if not m or not m.get("derniere"):
            return default
        return m["derniere"].get("valeur", default)

    def find_metric(self, *candidates: str):
        """Renvoie la première métrique existante parmi plusieurs ids possibles."""
        for c in candidates:
            if c in self.metriques and self.metriques[c].get("derniere"):
                return self.metriques[c]
        return None

    def rule_value(self, rid: str, default=None):
        r = self.regles.get(rid)
        return default if r is None or r["valeur"] is None else r["valeur"]


_STORE: ModelStore | None = None


def get_store(reload: bool = False) -> ModelStore:
    global _STORE
    if _STORE is None or reload:
        _STORE = ModelStore.load()
    return _STORE
