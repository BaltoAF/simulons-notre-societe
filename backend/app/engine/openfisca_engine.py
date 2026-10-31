"""Moteur de calcul socio-fiscal, adossé à OpenFisca-France.

- traduit des `Menage` (format simplifié) en situation OpenFisca, en mode vectorisé ;
- applique une réforme décrite comme un ensemble de valeurs de leviers (rule_id -> valeur) ;
- renvoie, pour chaque ménage, le détail mensuel de ses revenus, impôts et prestations.

Conventions : les prestations et les revenus sont calculés pour le mois de référence (législation en
vigueur ce mois-là) ; l'impôt sur le revenu est calculé sur l'année et ramené au mois (÷ 12).
"""
from __future__ import annotations

import ast
import hashlib
import json
import operator
import threading
import time
import warnings
from collections import OrderedDict
from dataclasses import dataclass, field

import numpy as np

from .. import config
from .household import Menage

DEPCOM_PAR_ZONE = {1: "75056", 2: "69123", 3: "23096"}  # Paris, Lyon, Guéret

# Composantes calculées : (clé, variable OpenFisca, entité, période, signe dans le revenu disponible)
# Ordre important : OpenFisca résout certains cycles (CSG sur les pensions <-> revenu fiscal de référence)
# de façon dépendante de l'ordre de calcul ; on calcule donc les prélèvements avant les revenus nets.
COMPOSANTES_INDIVIDU = [
    ("salaire_brut", "salaire_de_base", "M"),
    ("csg_salaire", ("csg_deductible_salaire", "csg_imposable_salaire"), "M"),
    ("csg_remplacement", ("csg_deductible_chomage", "csg_imposable_chomage",
                          "csg_deductible_retraite", "csg_imposable_retraite"), "M"),
    ("crds", ("crds_salaire", "crds_chomage", "crds_retraite"), "M"),
    ("cotisations_salariales", "cotisations_salariales", "M"),
    ("cotisations_employeur", "cotisations_employeur", "M"),
    ("allegement_general", "allegement_general", "M"),
    ("salaire_net", "salaire_net", "M"),
    ("chomage_net", "chomage_net", "M"),
    ("retraite_nette", "retraite_nette", "M"),
    ("aah", "aah", "M"),
]
COMPOSANTES_FAMILLE = [
    ("rsa", "rsa", "M"),
    ("prime_activite", "ppa", "M"),
    ("aides_logement", "aide_logement", "M"),
    ("allocations_familiales", "af", "M"),
    ("complement_familial", "cf", "M"),
    ("asf", "asf", "M"),
    ("paje", "paje_base", "M"),
    ("aspa", "aspa", "M"),
    ("ars", "ars", "Y"),
    ("bourses", ("bourse_college", "bourse_lycee"), "M"),
]
COMPOSANTES_FOYER = [
    ("impot_revenu", "impot_revenu_restant_a_payer", "Y"),
    ("pfu", "prelevement_forfaitaire_unique_ir", "Y"),
    ("prelevements_sociaux_capital", "prelevements_sociaux_revenus_capital", "Y"),
    ("decote", "decote_gain_fiscal", "Y"),          # réduction d'impôt pour les petits impôts (sert à expliquer un impôt nul)
]

# micro-entrepreneurs : la case de la déclaration de revenus selon l'activité, et l'abattement forfaitaire pour frais (qui ne sert
# ici qu'à approcher le revenu fiscal des années anciennes ; l'impôt lui-même est calculé par le moteur)
MICRO_CA = {"vente": "mbic_impv", "services": "mbic_imps", "liberal": "mbnc_impo"}
MICRO_ABATTEMENT = {"vente": 0.71, "services": 0.50, "liberal": 0.34}

PRESTATIONS = ["rsa", "prime_activite", "aides_logement", "allocations_familiales", "complement_familial",
               "asf", "paje", "aspa", "aah", "ars", "bourses"]

LIBELLES = {
    "salaire_brut": "Salaire brut",
    "salaire_net": "Salaire net",
    "revenu_micro": "Revenu d'auto-entrepreneur (chiffre d'affaires moins cotisations)",
    "chomage_net": "Allocation chômage nette",
    "retraite_nette": "Pension de retraite nette",
    "revenus_capital": "Revenus de l'épargne",
    "pension_alimentaire": "Pension alimentaire reçue",
    "aah": "Allocation aux adultes handicapés (AAH)",
    "rsa": "RSA",
    "prime_activite": "Prime d'activité",
    "aides_logement": "Aides au logement",
    "allocations_familiales": "Allocations familiales",
    "complement_familial": "Complément familial",
    "asf": "Allocation de soutien familial",
    "paje": "Allocation de base PAJE (jeunes enfants)",
    "aspa": "Minimum vieillesse (ASPA)",
    "ars": "Allocation de rentrée scolaire",
    "bourses": "Bourses de collège et de lycée",
    "impot_revenu": "Impôt sur le revenu",
    "pfu": "Impôt sur les intérêts et dividendes",
    "prelevements_sociaux_capital": "Prélèvements sociaux sur l'épargne",
    "cotisations_salariales": "Cotisations sociales salariales",
    "cotisations_employeur": "Cotisations sociales patronales",
    "allegement_general": "Réduction générale de cotisations patronales",
    "csg_salaire": "CSG sur les salaires",
    "csg_remplacement": "CSG sur les revenus de remplacement",
    "crds": "CRDS",
    "revenu_universel": "Revenu universel",
}

# Ensemble de leviers (règles) que ce moteur sait appliquer : rempli par Engine.supported_rules().


def _safe_eval(formula: str, v: float, noms: dict | None = None) -> float:
    """Évalue une formule arithmétique simple en fonction de v (pas d'appel ; seuls noms permis : v, et ceux de
    `noms`, par exemple « base » et « v0 », les valeurs actuelles du paramètre écrit et du levier)."""
    ops = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul, ast.Div: operator.truediv,
           ast.USub: operator.neg, ast.UAdd: operator.pos}

    def ev(node):
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name) and node.id == "v":
            return float(v)
        if isinstance(node, ast.Name) and noms and node.id in noms:
            return float(noms[node.id])
        if isinstance(node, ast.BinOp) and type(node.op) in ops:
            return ops[type(node.op)](ev(node.left), ev(node.right))
        if isinstance(node, ast.UnaryOp) and type(node.op) in ops:
            return ops[type(node.op)](ev(node.operand))
        raise ValueError(f"Formule non autorisée : {formula}")

    return ev(ast.parse(formula, mode="eval"))


@dataclass
class ReformSpec:
    """Modifications de paramètres OpenFisca : chemin -> valeur (nombre) ou barème [{seuil, taux}]."""
    params: dict = field(default_factory=dict)

    @property
    def key(self) -> str:
        return hashlib.sha1(json.dumps(self.params, sort_keys=True).encode()).hexdigest()[:16]

    def __bool__(self):
        return bool(self.params)


class Engine:
    def __init__(self):
        self._tbs = None
        self._lock = threading.RLock()
        self._ready = threading.Event()
        self._reforms: OrderedDict[str, object] = OrderedDict()
        self._net_grid = None
        self.load_seconds = None
        self.version = None
        self.error = None

    # ───────────── chargement ─────────────
    def load(self):
        with self._lock:
            if self._tbs is not None:
                return
            t = time.time()
            # avertissement numérique connu d'OpenFisca-France (division par un effectif d'entreprise nul), sans effet sur nos résultats
            warnings.filterwarnings("ignore", category=RuntimeWarning, module=r"openfisca_france\..*")
            try:
                from openfisca_france import FranceTaxBenefitSystem
                from importlib.metadata import version
                self._tbs = FranceTaxBenefitSystem()
                self.version = version("openfisca-france")
                self.load_seconds = round(time.time() - t, 1)
            except Exception as e:  # pragma: no cover - dépend de l'installation
                self.error = f"{type(e).__name__}: {e}"
                raise
            finally:
                self._ready.set()

    def load_async(self):
        threading.Thread(target=self.load, daemon=True).start()

    @property
    def ready(self) -> bool:
        return self._tbs is not None

    @property
    def tbs(self):
        if self._tbs is None:
            self.load()
        return self._tbs

    # ───────────── réformes ─────────────
    def reform_spec_from_overrides(self, overrides: dict, store) -> tuple[ReformSpec, list[str]]:
        """Traduit des valeurs de règles (unité d'affichage) en modifications de paramètres OpenFisca.

        Renvoie aussi la liste des règles qui n'ont pas d'équivalent dans le moteur (traitées ailleurs).
        """
        params, unsupported = {}, []
        for rid, value in overrides.items():
            rule = store.regles.get(rid)
            moteur = (rule or {}).get("moteur") or store.correspondances.get(rid)
            if not moteur:
                unsupported.append(rid)
                continue
            facteur = float(moteur.get("facteur", 1) or 1)
            ecritures = moteur.get("ecriture") or [{"chemin": moteur["openfisca"], "formule": "v"}]
            if isinstance(value, list):  # barème
                params[moteur["openfisca"]] = [{"seuil": float(b["seuil"]), "taux": float(b["taux"]) / 100.0}
                                               for b in sorted(value, key=lambda b: float(b["seuil"]))]
                continue
            if isinstance(value, bool):
                value = 1.0 if value else 0.0
            v = float(value) / facteur
            for e in ecritures:
                f = e.get("formule", "v")
                # « base » / « v0 » : un paramètre lié suit le levier en proportion (ex. le SMIC de référence des
                # allègements suit le SMIC, en gardant l'écart fixé par la loi)
                noms = {"base": self.valeur_parametre(e["chemin"]), "v0": self.valeur_parametre(moteur.get("lecture") or moteur["openfisca"])}                     if ("base" in f or "v0" in f) else None
                params[e["chemin"]] = round(_safe_eval(f, v, noms), 10)
        return ReformSpec(params), unsupported

    def valeur_parametre(self, chemin: str) -> float:
        """Valeur actuelle (législation de l'année de référence) d'un paramètre OpenFisca."""
        node = self.tbs.parameters
        for part in chemin.split("."):
            node = node.children[part]
        return float(node(f"{int(config.ANNEE_REFERENCE)}-{config.TODAY.month:02d}-01"))

    def _reform(self, spec: ReformSpec):
        if not spec:
            return self.tbs
        with self._lock:
            if spec.key in self._reforms:
                self._reforms.move_to_end(spec.key)
                return self._reforms[spec.key]
            from openfisca_core.reforms import Reform
            from openfisca_core.parameters import ParameterScaleBracket

            start = f"{int(config.ANNEE_REFERENCE) - 2}-01-01"
            params = spec.params

            def modifier(parameters):
                for path, value in params.items():
                    node = parameters
                    for part in path.split("."):
                        node = node.children[part]
                    if isinstance(value, list):
                        brackets = node.brackets
                        for i, b in enumerate(value):
                            if i < len(brackets):
                                brackets[i].threshold.update(start=start, value=b["seuil"])
                                brackets[i].rate.update(start=start, value=b["taux"])
                            else:
                                nb = ParameterScaleBracket(
                                    name=f"{node.name}.brackets[{i}]",
                                    data={"threshold": {start: {"value": b["seuil"]}},
                                          "rate": {start: {"value": b["taux"]}}})
                                brackets.append(nb)
                        for j in range(len(value), len(brackets)):
                            brackets[j].threshold.update(start=start, value=None)
                            brackets[j].rate.update(start=start, value=None)
                    else:
                        node.update(start=start, value=value)
                return parameters

            class _R(Reform):
                name = "Réforme simulée"

                def apply(self):
                    self.modify_parameters(modifier_function=modifier)

            reform = _R(self.tbs)
            self._reforms[spec.key] = reform
            while len(self._reforms) > 6:
                self._reforms.popitem(last=False)
            return reform

    # ───────────── situation ─────────────
    def _situation(self, menages: list[Menage]) -> dict:
        year = int(config.ANNEE_REFERENCE)
        years = [str(year - 2), str(year - 1), str(year)]
        mois = [f"{y}-{m:02d}" for y in (year - 1, year) for m in range(1, 13)]
        individus, familles, foyers, menages_of = {}, {}, {}, {}
        for i, m in enumerate(menages):
            ids = []
            statut = {"marie": "marie", "pacse": "pacse"}.get(m.couple, "celibataire")
            for j, a in enumerate(m.adultes):
                pid = f"m{i}a{j}"
                ids.append(pid)
                ind = {
                    "date_naissance": {"ETERNITY": f"{config.TODAY.year - a.age}-{config.TODAY.month:02d}-01"},
                    "statut_marital": {config.MOIS_REFERENCE: statut} if len(m.adultes) == 2 else {config.MOIS_REFERENCE: "celibataire"},
                }
                act = {"salarie": "actif", "apprenti": "actif", "independant": "actif", "chomeur": "chomeur", "retraite": "retraite",
                       "etudiant": "etudiant", "inactif": "inactif"}[a.activite]
                # la situation vaut pour tous les mois simulés : le RSA et la prime d'activité se calculent sur les ressources
                # des trois mois précédents (une AAH limitée au mois courant n'était pas comptée dans le RSA)
                ind["activite"] = {mo: act for mo in mois}
                if a.activite == "apprenti":
                    # la prime d'activité ne s'ouvre aux apprentis qu'au-delà d'un plancher de revenus (ppa_eligibilite_apprenants).
                    # Les exonérations de cotisations, de CSG-CRDS et d'impôt des apprentis ne sont pas modélisées par OpenFisca :
                    # le salaire net saisi est converti comme celui d'un salarié, et le site le dit à la personne.
                    ind["apprenti"] = {mo: True for mo in mois}
                if a.salaire_brut_mensuel > 0:
                    ind["salaire_de_base"] = {y: round(a.salaire_brut_mensuel * 12, 2) for y in years}
                    ind["categorie_salarie"] = {mo: "prive_cadre" if a.cadre else "prive_non_cadre" for mo in mois}
                    # entreprise de 50 salariés ou plus ; réduction générale calculée mois par mois (mode anticipé)
                    ind["effectif_entreprise"] = {y: 60 for y in years}
                    ind["allegement_general_mode_recouvrement"] = {y: "anticipe" for y in years}
                    smic = self._smic_mensuel()
                    if a.salaire_brut_mensuel < smic * 0.98:
                        ind["contrat_de_travail"] = {mo: "temps_partiel" for mo in mois}
                        ind["heures_remunerees_volume"] = {mo: round(151.67 * a.salaire_brut_mensuel / smic, 2) for mo in mois}
                if a.ca_micro_mensuel > 0:
                    # chiffre d'affaires déclaré au régime micro (sans versement libératoire, le cas le plus courant) : le moteur
                    # en tire l'impôt (après abattement forfaitaire), la prime d'activité et les aides au logement
                    ind[MICRO_CA[a.activite_micro]] = {y: round(a.ca_micro_mensuel * 12, 2) for y in years}
                if a.chomage_brut_mensuel > 0:
                    ind["chomage_brut"] = {y: round(a.chomage_brut_mensuel * 12, 2) for y in years}
                if a.retraite_brute_mensuelle > 0:
                    ind["retraite_brute"] = {y: round(a.retraite_brute_mensuelle * 12, 2) for y in years}
                if a.handicap:
                    ind["handicap"] = {mo: True for mo in mois}
                    ind["taux_incapacite"] = {mo: 0.8 for mo in mois}
                if j == 0 and m.pension_alimentaire_mensuelle > 0:
                    # l'ASF ne complète que ce qui manque ; la pension compte aussi pour le RSA, la prime d'activité, l'impôt
                    ind["pensions_alimentaires_percues"] = {mo: round(m.pension_alimentaire_mensuelle, 2) for mo in mois}
                individus[pid] = ind
            kids = []
            for k, age in enumerate(m.enfants):
                kid = f"m{i}e{k}"
                kids.append(kid)
                individus[kid] = {"date_naissance": {"ETERNITY": f"{config.TODAY.year - age}-{config.TODAY.month:02d}-01"}}
            familles[f"f{i}"] = {"parents": ids, "enfants": kids}
            # Rompt le cycle CSG des revenus de remplacement <-> revenu fiscal de référence (RFR N-2) :
            # on fournit un RFR approché pour N-4 et N-3, ce qui laisse le moteur calculer exactement N-2 et N-1.
            def rfr_approx(adults):
                brut_annuel = sum(a.salaire_brut_mensuel * 0.78 + a.chomage_brut_mensuel * 0.93
                                  + a.retraite_brute_mensuelle * 0.93
                                  + a.ca_micro_mensuel * (1 - MICRO_ABATTEMENT[a.activite_micro]) / 0.9 for a in adults) * 12
                return round(brut_annuel * 0.9, 0)
            rfr_inputs = lambda adults: {str(year - 4): rfr_approx(adults), str(year - 3): rfr_approx(adults)}
            if m.couple in ("marie", "pacse") or len(ids) == 1:
                foyers[f"ff{i}"] = {"declarants": ids, "personnes_a_charge": kids, "rfr": rfr_inputs(m.adultes)}
                if m.revenus_capital_annuels > 0:
                    foyers[f"ff{i}"]["revenus_capitaux_prelevement_forfaitaire_unique_ir"] = {
                        y: round(m.revenus_capital_annuels, 2) for y in years}
            else:  # concubins : deux déclarations séparées, enfants rattachés au premier adulte
                foyers[f"ff{i}"] = {"declarants": [ids[0]], "personnes_a_charge": kids, "rfr": rfr_inputs(m.adultes[:1])}
                foyers[f"ff{i}b"] = {"declarants": [ids[1]], "rfr": rfr_inputs(m.adultes[1:])}
            statut_log = {"locataire_prive": "locataire_vide", "locataire_social": "locataire_hlm",
                          "proprietaire": "proprietaire", "heberge": "loge_gratuitement"}[m.logement]
            men = {"personne_de_reference": [ids[0]], "enfants": kids,
                   "statut_occupation_logement": {mo: statut_log for mo in mois},
                   "depcom": {mo: DEPCOM_PAR_ZONE[m.zone] for mo in mois}}
            if len(ids) > 1:
                men["conjoint"] = [ids[1]]
            if m.logement in ("locataire_prive", "locataire_social") and m.loyer_mensuel > 0:
                men["loyer"] = {mo: round(m.loyer_mensuel, 2) for mo in mois}
            menages_of[f"m{i}"] = men
        return {"individus": individus, "familles": familles, "foyers_fiscaux": foyers, "menages": menages_of}

    def _smic_mensuel(self) -> float:
        cache = getattr(self, "_smic_cache", None)
        if not cache or cache[0] != config.MOIS_REFERENCE:
            p = self.tbs.parameters(f"{config.MOIS_REFERENCE}-01")
            self._smic_cache = (config.MOIS_REFERENCE, float(p.marche_travail.salaire_minimum.smic.smic_b_mensuel))
        return self._smic_cache[1]

    def vider_caches(self):
        """À appeler quand la date de référence ou le modèle change."""
        with self._lock:
            self._reforms.clear()
            self._net_grid = None
            self._smic_cache = None

    # ───────────── calcul ─────────────
    def compute(self, menages: list[Menage], spec: ReformSpec | None = None) -> dict:
        """Calcule les composantes pour chaque ménage. Renvoie des tableaux numpy par composante (niveau ménage, €/mois).

        Les grands échantillons (population synthétique) sont répartis entre plusieurs processus.
        """
        if len(menages) >= PARALLEL_MIN and WORKERS > 1 and not _IN_WORKER:
            try:
                return _compute_parallel(menages, spec)
            except Exception:  # repli séquentiel si le pool de processus est indisponible
                pass
        return self._compute_local(menages, spec)

    def _compute_local(self, menages: list[Menage], spec: ReformSpec | None = None) -> dict:
        from openfisca_core.simulation_builder import SimulationBuilder

        system = self._reform(spec) if spec else self.tbs
        situation = self._situation(menages)
        with self._lock:
            sim = SimulationBuilder().build_from_entities(system, situation)
            out = {}
            n = len(menages)
            pop_ind = sim.populations["individu"]
            pop_fam = sim.populations["famille"]
            pop_ff = sim.populations["foyer_fiscal"]
            # index ménage de chaque individu / famille / foyer (ordre des ids = ordre d'insertion)
            ind_men = np.array([int(pid[1:].split("a")[0].split("e")[0]) for pid in pop_ind.ids])
            fam_men = np.array([int(fid[1:]) for fid in pop_fam.ids])
            ff_men = np.array([int(fid[2:].rstrip("b")) for fid in pop_ff.ids])

            def calc(var, period):
                p = config.MOIS_REFERENCE if period == "M" else config.ANNEE_REFERENCE
                if isinstance(var, tuple):
                    return sum(sim.calculate(v, p) for v in var)
                return sim.calculate(var, p)

            any_handicap = any(a.handicap for m in menages for a in m.adultes)
            for key, var, period in COMPOSANTES_INDIVIDU:
                if key == "aah" and not any_handicap:  # calcul coûteux, inutile sans handicap déclaré
                    out[key] = np.zeros(n)
                    continue
                vals = calc(var, period) / (12 if period == "Y" else 1)
                out[key] = np.bincount(ind_men, weights=vals, minlength=n)
            for key, var, period in COMPOSANTES_FAMILLE:
                vals = calc(var, period) / (12 if period == "Y" else 1)
                out[key] = np.bincount(fam_men, weights=vals, minlength=n)
            for key, var, period in COMPOSANTES_FOYER:
                vals = calc(var, period) / (12 if period == "Y" else 1)
                out[key] = np.bincount(ff_men, weights=vals, minlength=n)
        # conventions de signe : impôts et cotisations exprimés en montants positifs payés
        out["impot_revenu"] = -out["impot_revenu"]
        out["pfu"] = np.abs(out["pfu"])
        # « impot_revenu_restant_a_payer » d'OpenFisca inclut déjà le prélèvement forfaitaire unique (et la contribution
        # sur les hauts revenus) : on en retire le PFU, compté à part, pour ne pas le soustraire deux fois du revenu
        # disponible ni le compter deux fois dans les recettes. « impot_revenu » = barème (+ CEHR, − crédits d'impôt).
        out["impot_revenu"] = out["impot_revenu"] - out["pfu"]
        out["prelevements_sociaux_capital"] = np.abs(out["prelevements_sociaux_capital"])
        for k in ("cotisations_salariales", "cotisations_employeur", "csg_salaire", "csg_remplacement", "crds"):
            out[k] = -out[k]
        out["revenus_capital"] = np.array([m.revenus_capital_annuels / 12 for m in menages])
        out["pension_alimentaire"] = np.array([m.pension_alimentaire_mensuelle for m in menages])
        out["retraite_brute"] = np.array([sum(a.retraite_brute_mensuelle for a in m.adultes) for m in menages])   # dépense des caisses
        # micro-entrepreneurs : ce qui reste du chiffre d'affaires après les cotisations sociales (avant les frais réels)
        out["cotisations_micro"] = np.array([sum(a.ca_micro_mensuel * a.taux_cotisations_micro for a in m.adultes) for m in menages])
        out["revenu_micro"] = np.array([sum(a.ca_micro_mensuel for a in m.adultes) for m in menages]) - out["cotisations_micro"]
        out["prestations"] = sum(out[k] for k in PRESTATIONS)
        out["revenu_disponible"] = (out["salaire_net"] + out["revenu_micro"] + out["chomage_net"] + out["retraite_nette"]
                                    + out["revenus_capital"] + out["pension_alimentaire"] + out["prestations"]
                                    - out["impot_revenu"] - out["pfu"] - out["prelevements_sociaux_capital"])
        uc = np.array([m.unites_consommation for m in menages])
        out["niveau_de_vie"] = out["revenu_disponible"] / uc
        return out

    # ───────────── conversions net -> brut ─────────────
    def net_to_brut(self, kind: str, net: float) -> float:
        """Convertit un montant mensuel net en brut, par interpolation sur une grille calculée par le moteur."""
        if net <= 0:
            return 0.0
        grid = self._grid()
        xs, ys = grid[kind]  # xs = nets, ys = bruts
        if net > xs[-1]:
            return float(ys[-1] * net / xs[-1])
        return float(np.interp(net, xs, ys))

    def _grid(self):
        if self._net_grid is not None:
            return self._net_grid
        from .household import Adulte
        bruts = np.concatenate([np.linspace(50, 5000, 100), np.linspace(5100, 30000, 60)])
        menages_sal = [Menage(adultes=[Adulte(age=40, salaire_brut_mensuel=float(b))], logement="heberge") for b in bruts]
        menages_ret = [Menage(adultes=[Adulte(age=70, activite="retraite", retraite_brute_mensuelle=float(b))], logement="heberge") for b in bruts]
        menages_cho = [Menage(adultes=[Adulte(age=40, activite="chomeur", chomage_brut_mensuel=float(b))], logement="heberge") for b in bruts]
        r_sal = self.compute(menages_sal)
        r_ret = self.compute(menages_ret)
        r_cho = self.compute(menages_cho)
        self._net_grid = {
            "salaire": (np.maximum.accumulate(r_sal["salaire_net"]), bruts),
            "retraite": (np.maximum.accumulate(r_ret["retraite_nette"]), bruts),
            "chomage": (np.maximum.accumulate(r_cho["chomage_net"]), bruts),
        }
        return self._net_grid


ENGINE = Engine()

# ───────────── calcul parallèle ─────────────
import multiprocessing  # noqa: E402
import os  # noqa: E402
from concurrent.futures import ProcessPoolExecutor  # noqa: E402

WORKERS = int(os.environ.get("SOCIETE_WORKERS", max(1, min(4, (os.cpu_count() or 2) - 2))))
PARALLEL_MIN = 400
_IN_WORKER = False
_POOL: ProcessPoolExecutor | None = None
_POOL_LOCK = threading.Lock()


def _init_worker():
    global _IN_WORKER
    _IN_WORKER = True
    ENGINE.load()


def _worker_compute(menage_dicts: list[dict], params: dict) -> dict:
    menages = [Menage.from_dict(d) for d in menage_dicts]
    return ENGINE._compute_local(menages, ReformSpec(params) if params else None)


def get_pool() -> ProcessPoolExecutor:
    global _POOL
    with _POOL_LOCK:
        if _POOL is None:
            # « spawn » : chaque processus démarre à neuf (comme sous Windows). Sous Linux, le « fork » par défaut copie le
            # serveur avec les verrous tenus par ses autres fils (planificateur, préchauffage) : les calculs pouvaient se figer.
            _POOL = ProcessPoolExecutor(max_workers=WORKERS, initializer=_init_worker, mp_context=multiprocessing.get_context("spawn"))
        return _POOL


def reset_pool():
    """Arrête les processus de calcul (ils seront relancés à la demande avec la date et le modèle à jour)."""
    global _POOL
    with _POOL_LOCK:
        if _POOL is not None:
            _POOL.shutdown(wait=False, cancel_futures=True)
            _POOL = None


def warm_pool():
    """Démarre les processus de calcul (chargement d'OpenFisca dans chacun) pour que le premier calcul soit rapide."""
    if WORKERS <= 1:
        return
    pool = get_pool()
    futs = [pool.submit(_worker_compute, [Menage().to_dict()], {}) for _ in range(WORKERS)]
    for f in futs:
        f.result()


def _compute_parallel(menages: list[Menage], spec: ReformSpec | None) -> dict:
    pool = get_pool()
    n = len(menages)
    k = WORKERS
    bornes = [round(i * n / k) for i in range(k + 1)]
    params = spec.params if spec else {}
    futs = [pool.submit(_worker_compute, [m.to_dict() for m in menages[bornes[i]:bornes[i + 1]]], params) for i in range(k)]
    parts = [f.result() for f in futs]
    return {key: np.concatenate([p[key] for p in parts]) for key in parts[0]}
