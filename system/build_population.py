"""Le Système — construction de la population synthétique de ménages.

Les données individuelles détaillées (ERFS, POTE) ne sont pas ouvertes. On construit donc un
échantillon de ménages fictifs mais plausibles, puis on calcule des POIDS pour que l'échantillon
reproduise les statistiques officielles ouvertes (calage par « raking ») :
  - nombre de ménages par type (INSEE, recensement),
  - population par tranche d'âge (INSEE, bilan démographique),
  - nombre d'actifs occupés, de chômeurs indemnisés, de retraités (INSEE, Unédic/France Travail, DREES),
  - statut d'occupation du logement (INSEE / SDES),
  - distribution des niveaux de vie : part des personnes sous chaque décile (INSEE, ERFS),
  - hauts revenus : nombre de foyers au revenu fiscal de référence (RFR) supérieur à 100 000 €, impôt
    qu'ils paient, foyers des tranches à 41 % et 45 % (DGFiP). Un tirage au hasard ne produit presque jamais
    de très hauts revenus : on ajoute donc des ménages construits à partir des 18 tranches fines de RFR
    publiées par la DGFiP (IRCOM), avec leur composition (salaires, pensions, autres revenus).
Les autres statistiques (impôt sur le revenu, prestations, CSG) servent de CONTRÔLE : l'écart entre
la simulation de la situation actuelle et le chiffre officiel détermine l'indice de confiance.

Sortie : model/population/population.json (ménages + poids + rapport de calage).
Usage  : backend/.venv/Scripts/python system/build_population.py [--n 6000] [--seed 2026]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.engine.household import Adulte, Menage  # noqa: E402
from app.engine.openfisca_engine import ENGINE  # noqa: E402
from app.model_store import ModelStore  # noqa: E402

OUT = ROOT / "model" / "population" / "population.json"


# ───────────────────────── hauts revenus ─────────────────────────
SEUIL_HAUTS_REVENUS = 100_000


def rfr_approche(m: Menage) -> float:
    """Revenu fiscal de référence approché d'un ménage (€/an) : salaires et pensions après cotisations et abattement
    de 10 %, plus les revenus de l'épargne. Sert seulement à repérer les foyers au-delà de 100 000 €."""
    act = sum(a.salaire_brut_mensuel * 0.70 + a.retraite_brute_mensuelle * 0.82 + a.chomage_brut_mensuel * 0.85 for a in m.adultes) * 12
    return act + m.revenus_capital_annuels


def tranche_marginale(m: Menage, seuils: dict[int, float]) -> int:
    """Taux marginal d'imposition approché du ménage (le plus élevé de ses foyers fiscaux) : revenus soumis au barème
    (hors épargne, taxée à part) divisés par le nombre de parts, comparés aux seuils du barème en vigueur."""
    def revenu(adultes):
        return sum(a.salaire_brut_mensuel * 0.70 + a.retraite_brute_mensuelle * 0.82 + a.chomage_brut_mensuel * 0.85 for a in adultes) * 12
    demi_parts = sum(0.5 if i < 2 else 1.0 for i in range(len(m.enfants)))
    if m.couple in ("marie", "pacse") and len(m.adultes) == 2:
        foyers = [(revenu(m.adultes), 2 + demi_parts)]
    else:  # chaque adulte déclare seul ; les enfants sont rattachés au premier
        foyers = [(revenu(m.adultes[:1]), 1 + demi_parts)] + [(revenu([a]), 1) for a in m.adultes[1:]]
    taux = 0
    for rev, parts in foyers:
        for t, seuil in seuils.items():
            if rev / parts > seuil:
                taux = max(taux, t)
    return taux


# Tranches fines de RFR au-delà de 100 000 € publiées par la DGFiP (IRCOM) : (borne basse, borne haute, clé de métrique)
TRANCHES_HAUTS_REVENUS = [
    (100_000, 200_000, "100001_200000"), (200_000, 300_000, "200001_300000"), (300_000, 400_000, "300001_400000"),
    (400_000, 500_000, "400001_500000"), (500_000, 600_000, "500001_600000"), (600_000, 700_000, "600001_700000"),
    (700_000, 800_000, "700001_800000"), (800_000, 900_000, "800001_900000"), (900_000, 1_000_000, "900001_1000000"),
    (1_000_000, 2_000_000, "1000001_2000000"), (2_000_000, 3_000_000, "2000001_3000000"), (3_000_000, 4_000_000, "3000001_4000000"),
    (4_000_000, 5_000_000, "4000001_5000000"), (5_000_000, 6_000_000, "5000001_6000000"), (6_000_000, 7_000_000, "6000001_7000000"),
    (7_000_000, 8_000_000, "7000001_8000000"), (8_000_000, 9_000_000, "8000001_9000000"), (9_000_000, None, "plus_9000000"),
]


# Trois configurations de foyer par tranche (le nombre de parts change le taux marginal à revenu égal)
FOYERS_HAUTS = ("couple_enfant", "couple", "seul")


def _menage_haut(rfr: float, bareme: float, foyer: str = "couple_enfant", age: int = 55) -> Menage:
    """Foyer à haut revenu : revenus soumis au barème (en salaires de cadres) et le reste en revenus de l'épargne."""
    brut = max(0.0, bareme) / 0.70                             # retour au brut annuel (cotisations et abattement)
    epargne = round(max(0.0, rfr - bareme), 0)
    if foyer == "seul":
        m = Menage(adultes=[Adulte(age=age, salaire_brut_mensuel=round(brut / 12, 2), cadre=True)],
                   couple="seul", logement="proprietaire", revenus_capital_annuels=epargne)
    else:
        m = Menage(adultes=[Adulte(age=age, salaire_brut_mensuel=round(brut * 0.65 / 12, 2), cadre=True),
                            Adulte(age=age - 2, salaire_brut_mensuel=round(brut * 0.35 / 12, 2), cadre=True)],
                   couple="marie", enfants=[12] if foyer == "couple_enfant" else [], logement="proprietaire",
                   revenus_capital_annuels=epargne)
    m.libelle = "hauts_revenus"
    return m


def part_bareme_calee(rfr: float, impot_cible: float, foyer: str = "couple_enfant") -> float:
    """Part du revenu soumise au barème telle que l'impôt calculé par le moteur égale l'impôt moyen publié par la DGFiP
    pour la tranche (le reste étant taxé à part, comme l'épargne). Recherche sur une grille, en un seul calcul."""
    grille = np.linspace(0.0, 1.0, 41)
    res = ENGINE.compute([_menage_haut(rfr, rfr * g, foyer) for g in grille])
    impots = res["impot_revenu"] * 12                           # barème seul, comme l'impôt net DGFiP
    if impot_cible <= impots[0]:
        return 0.0
    if impot_cible >= impots[-1]:
        return 1.0
    return float(np.interp(impot_cible, impots, grille))


def menages_hauts_revenus(store: ModelStore, rng: np.random.Generator) -> list[tuple[Menage, float]]:
    """Ménages à hauts revenus construits à partir des tranches fines de RFR de la DGFiP (IRCOM), avec la masse de foyers
    que chacun représente.

    Pour chaque tranche, la DGFiP publie le nombre de foyers, leur RFR total et leur impôt net. On en déduit le niveau
    de revenu, puis la part de ce revenu soumise au barème : celle qui fait payer au foyer l'impôt moyen de sa tranche
    (le reste est taxé à part, comme les intérêts, dividendes et plus-values au prélèvement forfaitaire). La composition
    des revenus découle donc des données. Trois configurations par tranche (couple avec un enfant, couple, personne
    seule), dont le calage fixe le dosage ; le revenu au barème est représenté par des salaires de cadres.
    """
    m = store.metric_value
    out = []
    for lo, hi, cle in TRANCHES_HAUTS_REVENUS:
        n = m(f"impot.ir.tranche_rfr_{cle}.nombre_foyers")
        rfr_tot = m(f"impot.ir.tranche_rfr_{cle}.rfr_total")
        impot = m(f"impot.ir.tranche_rfr_{cle}.impot_net")
        if not n or not rfr_tot or impot is None:
            continue
        rfr_moyen = rfr_tot / n
        parts = {}
        # deux niveaux de revenu dans la tranche (même composition), pour que le revenu y soit étalé comme en réalité
        niveaux = [rfr_moyen * f for f in (0.8, 1.25)]
        if hi is not None:
            niveaux = [min(max(r, lo * 1.02), hi * 0.98) for r in niveaux]
        for foyer in FOYERS_HAUTS:  # chaque configuration paie l'impôt moyen de la tranche ; le calage choisit leur dosage
            parts[foyer] = part_bareme_calee(rfr_moyen, impot / n, foyer)
            for rfr in niveaux:
                out.append((_menage_haut(rfr, rfr * parts[foyer], foyer, age=int(rng.integers(45, 65))),
                            float(n / (len(FOYERS_HAUTS) * len(niveaux)))))
        print(f"   tranche {lo:>9,} € : {n:>9,.0f} foyers, RFR moyen {rfr_moyen:>12,.0f} €, impôt moyen {impot / n:>10,.0f} €, part au barème "
              + " / ".join(f"{parts[f]:.0%}" for f in FOYERS_HAUTS))
    n_tot = sum(w for _, w in out)
    print(f"Hauts revenus : {n_tot:,.0f} foyers au-delà de 100 000 € répartis en {len(TRANCHES_HAUTS_REVENUS)} tranches (DGFiP), {len(out)} ménages ajoutés")
    return out


# ───────────────────────── génération ─────────────────────────
class Generateur:
    def __init__(self, store: ModelStore, rng: np.random.Generator):
        self.s = store
        self.rng = rng
        m = store.metric_value
        # salaires nets EQTP du privé : médiane, D1, D9 (INSEE)
        self.sal_med = m("revenus.salaires.net_mensuel_median_eqtp_prive", 2190)
        self.sal_d1 = m("revenus.salaires.net_mensuel_d1_eqtp_prive", 1492)
        self.sal_d9 = m("revenus.salaires.net_mensuel_d9_eqtp_prive", 4334)
        self.sig_g = np.log(self.sal_med / self.sal_d1) / 1.2816
        self.sig_d = np.log(self.sal_d9 / self.sal_med) / 1.2816
        self.part_temps_partiel = m("emploi.part_temps_partiel", 17.7) / 100
        self.pension_moy = m("retraites.pension_moyenne_nette", 1541)
        self.loyer_prive = m("logement.loyer_mensuel_moyen_parc_prive", 594)
        self.loyer_social = m("logement.loyer_mensuel_moyen_parc_social", 403)
        smic = Menage(adultes=[Adulte(age=40, salaire_brut_mensuel=ENGINE._smic_mensuel())], logement="heberge")
        self.smic_net = float(ENGINE.compute([smic])["salaire_net"][0])

    def salaire_net(self, age: int) -> float:
        z = self.rng.standard_normal()
        sig = self.sig_g if z < 0 else self.sig_d
        eqtp = self.sal_med * np.exp(sig * z)
        facteur_age = 0.72 if age < 25 else 0.93 if age < 35 else 1.05 if age < 50 else 1.1
        eqtp = max(self.smic_net, eqtp * facteur_age)
        if self.rng.random() < self.part_temps_partiel:
            eqtp *= self.rng.choice([0.5, 0.6, 0.8], p=[0.4, 0.2, 0.4])
        return float(eqtp)

    def pension_nette(self, age: int, femme: bool) -> float:
        # écart femmes-hommes des pensions de droit direct (DREES) ; dispersion modérée, plancher proche du minimum contributif
        med = self.pension_moy * (0.82 if femme else 1.2) * (0.94 if age >= 80 else 1.0)
        p = med * np.exp(0.30 * self.rng.standard_normal())
        if femme and age >= 75 and self.rng.random() < 0.45:
            p += 380  # pension de réversion (veuves), ordre de grandeur DREES
        if self.rng.random() < 0.05:  # carrières très incomplètes : petites pensions, souvent complétées par l'ASPA
            return float(self.rng.uniform(250, 850))
        return float(max(900.0, p))

    def chomage_net(self) -> float:
        return float(max(650.0, 1220 * np.exp(0.33 * self.rng.standard_normal())))

    def activite(self, age: int) -> str:
        r = self.rng.random()
        if age < 25:
            return "salarie" if r < 0.42 else "chomeur" if r < 0.50 else "sans_revenu" if r < 0.54 else "etudiant" if r < 0.94 else "inactif"
        if age < 55:
            return "salarie" if r < 0.78 else "chomeur" if r < 0.84 else "sans_revenu" if r < 0.89 else "inactif"
        if age < 62:
            return "salarie" if r < 0.62 else "chomeur" if r < 0.68 else "retraite" if r < 0.86 else "inactif"
        if age < 67:
            return "salarie" if r < 0.22 else "retraite" if r < 0.95 else "inactif"
        return "retraite" if r < 0.97 else "inactif"

    def adulte(self, age: int, femme: bool) -> Adulte:
        act = self.activite(age)
        if act == "sans_revenu":  # chômeur non indemnisé (fin de droits) ou inactif sans ressource propre
            return Adulte(age=int(age), activite="chomeur" if self.rng.random() < 0.5 else "inactif")
        a = Adulte(age=int(age), activite=act)
        if act == "salarie":
            net = self.salaire_net(age)
            a.salaire_brut_mensuel = ENGINE.net_to_brut("salaire", net)
            a.cadre = net > 3300
            if net < 1300 and 20 <= age < 65 and self.rng.random() < 0.08:
                a.handicap = True  # travailleurs handicapés à temps partiel (AAH partielle)
        elif act == "chomeur":
            a.chomage_brut_mensuel = ENGINE.net_to_brut("chomage", self.chomage_net())
        elif act == "retraite":
            a.retraite_brute_mensuelle = ENGINE.net_to_brut("retraite", self.pension_nette(age, femme))
        elif act == "inactif" and 20 <= age < 65 and self.rng.random() < 0.40:
            a.handicap = True
        return a

    def age_tranche(self, bornes: list[tuple[int, int]], probas: list[float]) -> int:
        i = self.rng.choice(len(bornes), p=np.array(probas) / sum(probas))
        lo, hi = bornes[i]
        return int(self.rng.integers(lo, hi + 1))

    def enfants(self, n: int, age_parent: int) -> list[int]:
        max_age = max(0, min(20, age_parent - 18))
        return sorted(int(self.rng.integers(0, max_age + 1)) for _ in range(n))

    def logement(self, m: Menage, revenu_proxy: float) -> None:
        age = m.adultes[0].age
        p_proprio = 0.25 if age < 30 else 0.45 if age < 45 else 0.62 if age < 60 else 0.74
        p_social = 0.12 + (0.26 if revenu_proxy < 1600 else 0.06 if revenu_proxy < 2600 else -0.06)
        p_gratuit = 0.06 if age < 25 else 0.02
        p_proprio *= 1.15 if revenu_proxy > 3500 else 0.55 if revenu_proxy < 1500 else 1.0
        p_prive = max(0.05, 1 - p_proprio - p_social - p_gratuit)
        p = np.array([p_proprio, p_social, p_prive, p_gratuit])
        p = np.clip(p, 0.01, None)
        p = p / p.sum()
        statut = self.rng.choice(["proprietaire", "locataire_social", "locataire_prive", "heberge"], p=p)
        m.logement = str(statut)
        m.zone = int(self.rng.choice([1, 2, 3], p=[0.18, 0.40, 0.42]))
        if statut in ("locataire_prive", "locataire_social"):
            base = self.loyer_prive if statut == "locataire_prive" else self.loyer_social
            base *= 1.13  # revalorisation 2020 -> 2026 (indice de référence des loyers, ordre de grandeur)
            base *= {1: 1.35, 2: 1.0, 3: 0.8}[m.zone] * (0.85 + 0.12 * min(m.taille, 5))
            m.loyer_mensuel = float(round(base * np.exp(0.2 * self.rng.standard_normal()), 0))

    def revenus_capital(self, m: Menage, revenu_proxy: float) -> None:
        p = 0.08 if revenu_proxy < 2500 else 0.22 if revenu_proxy < 5000 else 0.55
        if self.rng.random() < p:
            echelle = 400 if revenu_proxy < 2500 else 1500 if revenu_proxy < 5000 else 8000
            m.revenus_capital_annuels = float(round(echelle * np.exp(1.0 * self.rng.standard_normal()), 0))

    def menage(self) -> Menage:
        t = self.rng.choice(["seul", "couple_sans", "couple_avec", "mono"], p=[0.40, 0.27, 0.235, 0.095])
        if t == "seul":
            age = self.age_tranche([(18, 29), (30, 44), (45, 59), (60, 74), (75, 95)], [0.19, 0.17, 0.20, 0.22, 0.22])
            m = Menage(adultes=[self.adulte(age, self.rng.random() < 0.55)], couple="seul")
        elif t == "couple_sans":
            age = self.age_tranche([(20, 34), (35, 54), (55, 69), (70, 92)], [0.2, 0.15, 0.35, 0.30])
            age2 = int(np.clip(age + self.rng.integers(-5, 4), 18, 95))
            m = Menage(adultes=[self.adulte(age, False), self.adulte(age2, True)],
                       couple=str(self.rng.choice(["marie", "pacse", "concubin"], p=[0.62, 0.12, 0.26])))
        elif t == "couple_avec":
            age = self.age_tranche([(22, 34), (35, 44), (45, 59)], [0.3, 0.4, 0.3])
            age2 = int(np.clip(age + self.rng.integers(-5, 4), 18, 70))
            n = int(self.rng.choice([1, 2, 3, 4], p=[0.42, 0.40, 0.14, 0.04]))
            m = Menage(adultes=[self.adulte(age, False), self.adulte(age2, True)],
                       couple=str(self.rng.choice(["marie", "pacse", "concubin"], p=[0.6, 0.14, 0.26])),
                       enfants=self.enfants(n, min(age, age2)))
        else:
            age = self.age_tranche([(20, 34), (35, 44), (45, 60)], [0.3, 0.4, 0.3])
            n = int(self.rng.choice([1, 2, 3], p=[0.55, 0.32, 0.13]))
            m = Menage(adultes=[self.adulte(age, True)], couple="seul", enfants=self.enfants(n, age))
        proxy = sum(a.salaire_brut_mensuel * 0.78 + a.retraite_brute_mensuelle * 0.9 + a.chomage_brut_mensuel * 0.9
                    for a in m.adultes)
        self.logement(m, proxy)
        self.revenus_capital(m, proxy)
        m.libelle = str(t)
        return m


# ───────────────────────── calage ─────────────────────────
def raking(d: np.ndarray, X: np.ndarray, totals: np.ndarray, lo=0.1, hi=10.0, iters=300, tol=1e-7):
    """Calage par la méthode « raking » (exponentielle) avec bornes : w = d · exp(X λ), Σ w X = totaux."""
    lam = np.zeros(X.shape[1])
    scale = np.maximum(np.abs(totals), 1.0)
    Xs, ts = X / scale, totals / scale
    for _ in range(iters):
        g = np.clip(np.exp(Xs @ lam), lo, hi)
        w = d * g
        resid = ts - Xs.T @ w
        if np.max(np.abs(resid)) < tol:
            break
        active = ((g > lo) & (g < hi)).astype(float)
        H = (Xs * (w * active)[:, None]).T @ Xs + 1e-9 * np.eye(X.shape[1])
        lam += np.linalg.solve(H, resid)
    w = d * np.clip(np.exp(Xs @ lam), lo, hi)
    return w


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=6000)
    ap.add_argument("--seed", type=int, default=2026)
    ap.add_argument("--hash-calage", default=None, help="empreinte des statistiques de calage (renseignée par le Système)")
    ap.add_argument("--sortie", default=None, help="fichier de sortie (par défaut : model/population/population.json)")
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    store = ModelStore.load()
    m = store.metric_value
    ENGINE.load()
    gen = Generateur(store, rng)
    menages = [gen.menage() for _ in range(args.n)]
    hauts = menages_hauts_revenus(store, rng)
    if hauts:
        # au-delà de 100 000 € de RFR, les ménages construits à partir des tranches DGFiP représentent seuls les foyers :
        # les quelques ménages tirés au hasard à ce niveau feraient double emploi (et dégraderaient le calage)
        avant = len(menages)
        menages = [x for x in menages if rfr_approche(x) <= SEUIL_HAUTS_REVENUS]
        print(f"{avant - len(menages)} ménages tirés au hasard au-delà de 100 000 € remplacés par les ménages des tranches DGFiP")
    menages += [mh for mh, _ in hauts]
    print(f"{len(menages)} ménages générés, {sum(x.taille for x in menages)} personnes")

    # niveau de vie de chaque ménage, législation actuelle (sert au calage sur les déciles)
    res = ENGINE.compute(menages)
    nv_annuel = res["niveau_de_vie"] * 12

    # ── marges de calage ──
    n_men = m("menages.nombre_total")
    pop_ordinaire = n_men * m("menages.taille_moyenne")
    ratio = pop_ordinaire / m("demographie.population_totale")
    ages = [("demographie.population_0_17", 0, 17), ("demographie.population_18_24", 18, 24),
            ("demographie.population_25_39", 25, 39), ("demographie.population_40_54", 40, 54),
            ("demographie.population_55_64", 55, 64), ("demographie.population_65_74", 65, 74),
            ("demographie.population_75_plus", 75, 200)]
    types = {"seul": m("menages.type.personne_seule"),
             "couple_sans": m("menages.type.couple_sans_enfant") + m("menages.type.menage_complexe"),
             "couple_avec": m("menages.type.couple_avec_enfants"),
             "mono": m("menages.type.famille_monoparentale")}
    tot_types = sum(types.values())
    statuts = {"proprietaire": m("logement.statut.proprietaires"), "locataire_social": m("logement.statut.locataires_parc_social"),
               "locataire_prive": m("logement.statut.locataires_parc_prive"), "heberge": m("logement.statut.loges_gratuitement")}
    tot_statut = sum(statuts.values())

    cols, totals, noms = [], [], []

    def add(nom, vec, total):
        cols.append(np.asarray(vec, dtype=float))
        totals.append(float(total))
        noms.append(nom)

    for t, v in types.items():
        add(f"menages_{t}", [1.0 if x.libelle == t else 0.0 for x in menages], n_men * v / tot_types)
    for mid, lo_, hi_ in ages:
        add(f"personnes_{lo_}_{hi_}", [sum(1 for a in x.adultes if lo_ <= a.age <= hi_) + sum(1 for e in x.enfants if lo_ <= e <= hi_)
                                       for x in menages], m(mid) * ratio)
    for st, v in list(statuts.items())[:-1]:  # le dernier est déduit (somme = total des ménages)
        add(f"logement_{st}", [1.0 if x.logement == st else 0.0 for x in menages], n_men * v / tot_statut)
    add("actifs_occupes", [sum(1 for a in x.adultes if a.activite == "salarie") for x in menages], m("emploi.actifs_occupes"))
    add("retraites", [sum(1 for a in x.adultes if a.activite == "retraite") for x in menages],
        m("emploi.retraites_droit_direct_residant_france"))
    # Alignement sur les bénéficiaires de prestations : effectifs CNAF/DREES divisés par le taux de recours
    # (les montants versés restent des contrôles indépendants de la qualité de la simulation).
    from app.impacts.microsim import taux_recours
    recours = taux_recours(store)
    for cle, var, metric in [("rsa", "rsa", "prestations.rsa.foyers_allocataires"),
                             ("prime_activite", "prime_activite", "prestations.prime_activite.foyers_allocataires"),
                             ("aides_logement", "aides_logement", "prestations.aides_logement.foyers_allocataires"),
                             ("aah", "aah", "prestations.aah.allocataires"),
                             ("aspa", "aspa", "prestations.minimum_vieillesse.allocataires")]:
        if metric in store.metriques:
            tr = recours.get(cle, (1.0, ""))[0]
            add(f"eligibles_{cle}", (res[var] > 0).astype(float), m(metric) / tr)
    taille = np.array([x.taille for x in menages], dtype=float)
    for k in range(1, 10):
        seuil = m(f"revenus.niveau_vie.d{k}")
        add(f"personnes_sous_D{k}", taille * (nv_annuel <= seuil), pop_ordinaire * k / 10)
    # hauts revenus : nombre de foyers au-delà de 100 000 € de RFR et impôt sur le revenu qu'ils paient (barème + 12,8 % sur l'épargne)
    rfr = np.array([rfr_approche(x) for x in menages])
    au_dela = (rfr > SEUIL_HAUTS_REVENUS).astype(float)
    if hauts and "impot.ir.tranche_rfr_plus_100000.impot_net" in store.metriques:
        add("foyers_rfr_plus_100000", au_dela, m("impot.ir.tranche_rfr_plus_100000.nombre_foyers"))
        # impôt du barème seulement : l'impôt net DGFiP exclut le prélèvement forfaitaire retenu à la source sur l'épargne
        add("impot_rfr_plus_100000", au_dela * res["impot_revenu"] * 12, m("impot.ir.tranche_rfr_plus_100000.impot_net"))
        # et l'impôt total : sans lui, les revenus moyens-supérieurs compensaient l'absence des très hauts revenus
        add("impot_revenu_total", res["impot_revenu"] * 12, m("impot.ir.impot_net_total"))
        # les foyers des deux tranches les plus hautes (41 % et 45 %) : nombre et impôt payé (DGFiP) ; ce sont eux
        # que touche une réforme du haut du barème
        bareme = sorted(store.rule_value("fiscalite.impot_revenu.bareme") or [], key=lambda t: t["seuil"])
        seuils = {int(t["taux"]): float(t["seuil"]) for t in bareme if int(t["taux"]) in (41, 45)}
        tmi = np.array([tranche_marginale(x, seuils) for x in menages])
        ir_men = res["impot_revenu"] * 12
        controle_tmi = {t: ((tmi == t).astype(float), (tmi == t) * ir_men) for t in (41, 45) if t in seuils}
        # tranche à 45 % imposée comme marge : sans elle, le calage écrase les très hauts revenus (quelques centaines de
        # foyers au lieu de 61 000). La tranche à 41 % en plus rend le calage instable (foyers et ménages ne se recouvrent
        # pas) : elle reste un contrôle.
        if 45 in controle_tmi and "impot.ir.taux_marginal_45.nombre_foyers" in store.metriques:
            add("foyers_tmi_45", controle_tmi[45][0], m("impot.ir.taux_marginal_45.nombre_foyers"))
            add("impot_tmi_45", controle_tmi[45][1], m("impot.ir.taux_marginal_45.impot_net"))
        if 41 in controle_tmi and "impot.ir.taux_marginal_41.nombre_foyers" in store.metriques:
            add("foyers_tmi_41", controle_tmi[41][0], m("impot.ir.taux_marginal_41.nombre_foyers"))
            add("impot_tmi_41", controle_tmi[41][1], m("impot.ir.taux_marginal_41.impot_net"))

    X = np.column_stack(cols)
    T = np.array(totals)
    # poids de départ : uniformes pour l'échantillon tiré au hasard ; masse de la strate de Pareto pour les hauts revenus
    n_hauts = len(hauts)
    masse_hauts = sum(w for _, w in hauts)
    d = np.full(len(menages), (n_men - masse_hauts) / (len(menages) - n_hauts))
    for i, (_, w) in enumerate(hauts):
        d[len(menages) - n_hauts + i] = w
    # bornes plus larges pour les hauts revenus : leur poids de départ (loi de Pareto) est plus incertain.
    # (Des bornes étroites, qui gardent la forme de Pareto, empêchent le calage de converger : la répartition salaires /
    # capital des très hauts revenus n'est pas connue en données ouvertes. Limite signalée dans les rapports.)
    est_haut = np.arange(len(menages)) >= len(menages) - n_hauts
    w = raking(d, X, T, lo=np.where(est_haut, 0.01, 0.1), hi=np.where(est_haut, 100.0, 10.0))
    atteint = X.T @ w
    rapport = [{"marge": n, "cible": round(t), "obtenu": round(a), "ecart_pct": round((a - t) / t * 100, 2) if t else None}
               for n, t, a in zip(noms, T, atteint)]
    print("Marges de calage (écart %) :", ", ".join(f"{r['marge']} {r['ecart_pct']}" for r in rapport))
    ir_total = float((res["impot_revenu"] * 12 * w).sum())
    print(f"Contrôle : impôt sur le revenu (barème) simulé {ir_total / 1e9:.1f} Md€ (officiel DGFiP : {m('impot.ir.impot_net_total') / 1e9:.1f} Md€) ; "
          f"prélèvement forfaitaire sur l'épargne {float((res['pfu'] * 12 * w).sum()) / 1e9:.1f} Md€")
    if hauts:
        for t, (nb, ir_t) in controle_tmi.items():
            print(f"Contrôle tranche {t} % : {float(nb @ w):,.0f} foyers (officiel {m(f'impot.ir.taux_marginal_{t}.nombre_foyers'):,.0f}), "
                  f"impôt {float(ir_t @ w) / 1e9:.1f} Md€ (officiel {m(f'impot.ir.taux_marginal_{t}.impot_net') / 1e9:.1f} Md€)")

    out = {
        "genere_par": "system/build_population.py",
        "genere_le": dt.date.today().isoformat(),
        "graine": args.seed,
        "hash_calage": args.hash_calage,
        "n_menages": len(menages),
        "menages_representes": round(float(w.sum())),
        "personnes_representees": round(float((w * taille).sum())),
        "calage": rapport,
        "sources_calage": sorted({store.metriques[mid]["derniere"].get("source") for mid in
                                  [a[0] for a in ages] + ["menages.nombre_total", "emploi.actifs_occupes",
                                                          "emploi.retraites_droit_direct_residant_france",
                                                          "revenus.niveau_vie.d5", "logement.statut.proprietaires"]
                                  if mid in store.metriques} - {None}),
        "menages": [{**x.to_dict(), "poids": round(float(wi), 3)} for x, wi in zip(menages, w)],
    }
    sortie = Path(args.sortie) if args.sortie else OUT
    sortie.parent.mkdir(parents=True, exist_ok=True)
    sortie.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    poids = w / d
    print(f"Écrit {sortie} — poids relatifs min {poids.min():.2f}, max {poids.max():.2f}, "
          f"taille effective {w.sum() ** 2 / (w ** 2).sum():.0f}")


if __name__ == "__main__":
    main()
