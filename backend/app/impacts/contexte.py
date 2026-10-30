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
AF_PREMIER_ENFANT = "prestations.famille.af_premier_enfant_montant"   # par famille ayant au moins un enfant de moins de 20 ans
LEVIERS_EXTENSION = {RU_MONTANT, RU_AGE, RU_IMPOSABLE, AF_PREMIER_ENFANT}


# au-delà de ce multiple de l'ancien SMIC, une hausse du SMIC ne se diffuse plus aux salaires (voir ajuster_salaires)
PLAFOND_DIFFUSION = 1.8

# revalorisation des pensions de base au 1er janvier : elle ne touche que la part « de base » des retraites (le reste vient
# des régimes complémentaires, revalorisés à part) ; cette part est une métrique sourcée (DREES)
REVALO_PENSIONS = "retraites.revalorisation.pensions_base"
PART_BASE = "retraites.part_regimes_base_masse_pensions"


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
        # on ne garde que les règles réellement modifiées par rapport à la loi actuelle
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
        return bool(self.spec) or bool(self.cache.get("extensions")) or REVALO_PENSIONS in self.overrides

    # ── extensions (dispositifs virtuels) ──
    def appliquer_extensions(self, res: dict, menages: list[Menage]) -> dict:
        res = self._allocation_premier_enfant(res, menages)
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

    def _allocation_premier_enfant(self, res: dict, menages: list[Menage]) -> dict:
        """Allocations familiales dès le premier enfant (dispositif proposé) : un montant par famille ayant au moins un
        enfant de moins de 20 ans, ajouté aux allocations familiales (sans effet ici sur les autres aides : voir la règle)."""
        montant = float(self.apres(AF_PREMIER_ENFANT, 0) or 0)
        if montant <= 0:
            return res
        af1 = np.array([montant if any(e < 20 for e in m.enfants) else 0.0 for m in menages])
        res = dict(res)
        for k in ("allocations_familiales", "prestations", "revenu_disponible"):
            res[k] = res[k] + af1
        res["niveau_de_vie"] = res["revenu_disponible"] / np.array([m.unites_consommation for m in menages])
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

    def ajuster_pensions(self, menages: list[Menage]) -> list[Menage]:
        """Une autre revalorisation des pensions de base change la part « de base » des retraites saisies (la retraite
        complémentaire, revalorisée par ses propres régimes, ne bouge pas) : pension × (1 + part de base × écart de
        revalorisation). La part de base est celle de la masse des pensions (DREES)."""
        if REVALO_PENSIONS not in self.overrides:
            return menages
        ancien, nouveau = float(self.store.rule_value(REVALO_PENSIONS) or 0), float(self.overrides[REVALO_PENSIONS] or 0)
        part = self.store.metric_value(PART_BASE)
        if part is None or abs(nouveau - ancien) < 1e-9:
            return menages
        part = part / 100 if part > 1 else part
        f = 1 + part * ((1 + nouveau / 100) / (1 + ancien / 100) - 1)
        out = []
        for m in menages:
            if any(a.retraite_brute_mensuelle > 0 for a in m.adultes):
                m = replace(m, adultes=[replace(a, retraite_brute_mensuelle=round(a.retraite_brute_mensuelle * f, 2))
                                        if a.retraite_brute_mensuelle > 0 else a for a in m.adultes])
            out.append(m)
        return out

    def calculer(self, menages: list[Menage], reforme: bool) -> dict:
        """Résultats du moteur pour des ménages, avec ou sans la réforme (dispositifs virtuels inclus).

        La situation de référence (sans réforme) ne dépend que des ménages : elle est mise en cache.
        """
        if not reforme or not (self.spec or REVALO_PENSIONS in self.overrides):
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
            menages = self.ajuster_pensions(self.ajuster_salaires(menages))
            # mémorisé aussi : le calcul rapide (foyer, ménages types) puis le calcul complet demandent les mêmes résultats
            # (les deux appels arrivent ensemble : le second attend le résultat du premier au lieu de recalculer)
            key = _menages_key(menages) + "|" + (self.spec.key if self.spec else "")
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
                    cache = ENGINE.compute(menages, self.spec if self.spec else None)
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
