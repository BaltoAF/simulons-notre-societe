"""Contexte d'une simulation : la réforme (surcharges de règles), sa traduction pour le moteur, les caches."""
from __future__ import annotations

import threading
from dataclasses import dataclass, field

import numpy as np

from ..engine.household import Menage
from ..engine.openfisca_engine import ENGINE, ReformSpec

# Leviers « virtuels » : dispositifs qui n'existent pas dans la loi actuelle mais qu'un fork peut créer.
RU_MONTANT = "prestations.revenu_universel.montant"
RU_AGE = "prestations.revenu_universel.age_minimum"
RU_IMPOSABLE = "prestations.revenu_universel.remplace_rsa_prime_activite"
LEVIERS_EXTENSION = {RU_MONTANT, RU_AGE, RU_IMPOSABLE}


@dataclass
class Contexte:
    store: object
    overrides: dict
    menage: Menage | None = None
    spec: ReformSpec = field(default_factory=ReformSpec)
    hors_moteur: list[str] = field(default_factory=list)
    cache: dict = field(default_factory=dict)

    @classmethod
    def creer(cls, store, overrides: dict, menage: Menage | None = None) -> "Contexte":
        # on ne garde que les règles réellement modifiées par rapport à la Société 1.0
        effectives = {}
        for rid, v in (overrides or {}).items():
            r = store.regles.get(rid)
            if r is None:
                continue
            if _same(v, r["valeur"]):
                continue
            effectives[rid] = v
        ctx = cls(store=store, overrides=effectives, menage=menage)
        moteur = {k: v for k, v in effectives.items() if k not in LEVIERS_EXTENSION}
        ctx.spec, ctx.hors_moteur = ENGINE.reform_spec_from_overrides(moteur, store)
        ext = [k for k in effectives if k in LEVIERS_EXTENSION]
        ctx.cache["extensions"] = ext
        return ctx

    # ── accès pratiques ──
    def modifie(self, *rule_ids: str) -> bool:
        return any(r in self.overrides for r in rule_ids)

    def avant(self, rid: str, defaut=None):
        return self.store.rule_value(rid, defaut)

    def apres(self, rid: str, defaut=None):
        return self.overrides.get(rid, self.avant(rid, defaut))

    @property
    def touche_moteur(self) -> bool:
        return bool(self.spec) or bool(self.cache.get("extensions"))

    # ── extensions (dispositifs virtuels) ──
    def appliquer_extensions(self, res: dict, menages: list[Menage]) -> dict:
        montant = float(self.apres(RU_MONTANT, 0) or 0)
        if montant <= 0:
            res["revenu_universel"] = np.zeros(len(menages))
            return res
        age_min = float(self.apres(RU_AGE, 18) or 18)
        remplace = bool(self.apres(RU_IMPOSABLE, False))
        ru = np.array([montant * sum(1 for a in m.adultes if a.age >= age_min)
                       + montant * sum(1 for e in m.enfants if e >= age_min) for m in menages], dtype=float)
        res = dict(res)
        res["revenu_universel"] = ru
        if remplace:
            retire = res["rsa"] + res["prime_activite"]
            res["rsa"] = np.zeros(len(menages))
            res["prime_activite"] = np.zeros(len(menages))
            res["prestations"] = res["prestations"] - retire
            res["revenu_disponible"] = res["revenu_disponible"] - retire
        res["prestations"] = res["prestations"] + ru
        res["revenu_disponible"] = res["revenu_disponible"] + ru
        uc = np.array([m.unites_consommation for m in menages])
        res["niveau_de_vie"] = res["revenu_disponible"] / uc
        return res

    def calculer(self, menages: list[Menage], reforme: bool) -> dict:
        """Résultats du moteur pour des ménages, avec ou sans la réforme (dispositifs virtuels inclus).

        La situation de référence (sans réforme) ne dépend que des ménages : elle est mise en cache.
        """
        if not reforme or not self.spec:
            key = _menages_key(menages)
            with _BASE_LOCK:
                base = _BASE_CACHE.get(key)
            if base is None:
                base = ENGINE.compute(menages, None)
                base["revenu_universel"] = np.zeros(len(menages))
                with _BASE_LOCK:
                    _BASE_CACHE[key] = base
                    while len(_BASE_CACHE) > 32:
                        _BASE_CACHE.pop(next(iter(_BASE_CACHE)))
            res = {k: v.copy() for k, v in base.items()}
        else:
            res = ENGINE.compute(menages, self.spec)
        if reforme:
            res = self.appliquer_extensions(res, menages)
        return res


_BASE_CACHE: dict[str, dict] = {}
_BASE_LOCK = threading.Lock()


def _menages_key(menages: list[Menage]) -> str:
    import hashlib
    import json
    return hashlib.sha1(json.dumps([m.to_dict() for m in menages], sort_keys=True).encode()).hexdigest()


def _same(a, b) -> bool:
    import json
    return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)
