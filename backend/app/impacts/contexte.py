"""Contexte d'une simulation : la réforme (surcharges de règles), sa traduction pour le moteur, les caches."""
from __future__ import annotations

import threading
from concurrent.futures import Future
from dataclasses import dataclass, field, replace

import numpy as np

from ..engine.household import Menage
from ..engine.openfisca_engine import ENGINE, ReformSpec

# Leviers « virtuels » : dispositifs qui n'existent pas dans la loi actuelle mais qu'un fork peut créer.
RU_MONTANT = "prestations.revenu_universel.montant"
RU_AGE = "prestations.revenu_universel.age_minimum"
RU_IMPOSABLE = "prestations.revenu_universel.remplace_rsa_prime_activite"
LEVIERS_EXTENSION = {RU_MONTANT, RU_AGE, RU_IMPOSABLE}


# au-delà de ce multiple de l'ancien SMIC, une hausse du SMIC ne se diffuse plus aux salaires (voir ajuster_salaires)
PLAFOND_DIFFUSION = 1.8


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

    def ajuster_salaires(self, menages: list[Menage]) -> list[Menage]:
        """Une hausse (ou baisse) du SMIC s'applique aux salaires qui en dépendent : les salariés payés au SMIC (y compris
        à temps partiel, au prorata) suivent le nouveau taux, et ceux payés entre l'ancien et le nouveau SMIC y sont
        relevés. Au-dessus, la hausse se diffuse en partie dans la grille des salaires : presque entièrement juste
        au-dessus du SMIC, de moins en moins ensuite, plus du tout au-delà de 1,8 SMIC (Koubi et Lhommeau, Insee 2007 ;
        Goarant et Muller, Insee 2011 ; hypothèse de la DG Trésor citée par le groupe d'experts sur le SMIC, 2017)."""
        rid = "travail.smic.horaire_brut"
        if rid not in self.overrides:
            return menages
        ancien, nouveau = float(self.store.rule_value(rid) or 0), float(self.overrides[rid] or 0)
        if ancien <= 0 or nouveau <= 0 or abs(nouveau - ancien) < 1e-9:
            return menages
        m_ancien, m_nouveau = ancien * 151.67, nouveau * 151.67      # mensuel brut à temps plein
        out = []
        for m in menages:
            adultes = []
            change = False
            for a in m.adultes:
                b = a.salaire_brut_mensuel
                if b > 0 and a.activite == "salarie":
                    if b <= m_ancien * 1.001:            # payé au SMIC (temps plein ou partiel) : même nombre d'heures
                        b = b * nouveau / ancien
                    elif nouveau > ancien and b < m_ancien * PLAFOND_DIFFUSION:
                        # diffusion d'une hausse : part de la hausse retrouvée dans le salaire, de 1 au SMIC à 0 au plafond
                        # (une baisse du SMIC, elle, ne réduit pas les salaires déjà au-dessus)
                        part = 1 - (b / m_ancien - 1) / (PLAFOND_DIFFUSION - 1)
                        b = max(b * (1 + part * (nouveau / ancien - 1)), m_nouveau)
                if b != a.salaire_brut_mensuel:
                    change = True
                    a = replace(a, salaire_brut_mensuel=round(b, 2))
                adultes.append(a)
            out.append(replace(m, adultes=adultes) if change else m)
        return out

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
            menages = self.ajuster_salaires(menages)
            # mémorisé aussi : le calcul rapide (foyer, ménages types) puis le calcul complet demandent les mêmes résultats
            # (les deux appels arrivent ensemble : le second attend le résultat du premier au lieu de recalculer)
            key = _menages_key(menages) + "|" + self.spec.key
            with _BASE_LOCK:
                cache = _REFORME_CACHE.get(key)
                en_cours = _EN_COURS.get(key) if cache is None else None
                moi = cache is None and en_cours is None
                if moi:
                    en_cours = _EN_COURS[key] = Future()
            if cache is None and not moi:
                cache = en_cours.result()
            elif cache is None:
                try:
                    cache = ENGINE.compute(menages, self.spec)
                    en_cours.set_result(cache)
                except BaseException as e:
                    en_cours.set_exception(e)
                    raise
                finally:
                    with _BASE_LOCK:
                        _EN_COURS.pop(key, None)
                        if cache is not None:
                            _REFORME_CACHE[key] = cache
                            while len(_REFORME_CACHE) > 12:
                                _REFORME_CACHE.pop(next(iter(_REFORME_CACHE)))
            res = {k: v.copy() for k, v in cache.items()}
        if reforme:
            res = self.appliquer_extensions(res, menages)
        return res


_BASE_CACHE: dict[str, dict] = {}
_REFORME_CACHE: dict[str, dict] = {}
_EN_COURS: dict[str, Future] = {}
_BASE_LOCK = threading.Lock()


def _menages_key(menages: list[Menage]) -> str:
    import hashlib
    import json
    return hashlib.sha1(json.dumps([m.to_dict() for m in menages], sort_keys=True).encode()).hexdigest()


def _same(a, b) -> bool:
    import json
    return json.dumps(a, sort_keys=True, default=str) == json.dumps(b, sort_keys=True, default=str)
