"""Impact des changements de crédits budgétaires (missions de l'État, objectifs de la Sécurité sociale)."""
from __future__ import annotations

from ..confidence import Confiance, Facteur
from .base import Indicateur, Section, fr
from .contexte import Contexte

# Leviers de dépense : crédits des missions de l'État, prélèvements sur recettes, objectifs de dépenses
# des branches de la Sécurité sociale et ONDAM. Les recettes et soldes sont des résultats, pas des leviers.
PREFIXES_DEPENSES = ("budget.etat.mission.", "budget.etat.prelevement", "budget.secu.objectif_depenses.")
DEPENSES_EXACTES = {"budget.secu.ondam.total"}


def est_depense(rid: str, rule: dict) -> bool:
    # un « .total » est la somme d'autres leviers : le modifier compterait deux fois la même dépense
    if rid.endswith(".total") and rid not in DEPENSES_EXACTES:
        return False
    return (rid.startswith(PREFIXES_DEPENSES) or rid in DEPENSES_EXACTES) and rule.get("unite") in ("milliards_euros", "md_euros", "milliards")


def indicateurs_dette(store, delta_solde_md: float) -> tuple[list[Indicateur], dict]:
    """Effet cumulé d'un changement permanent du solde public sur la dette (dynamique comptable simple)."""
    dette = store.find_metric("finances_publiques.dette_maastricht")
    charge = store.find_metric("finances_publiques.charge_interets_apu")
    pib = store.find_metric("finances_publiques.pib_valeur")
    r = 0.02
    sources = []
    if dette and charge:
        try:
            r = float(charge["derniere"]["valeur"]) / float(dette["derniere"]["valeur"])
            sources = [dette["derniere"].get("source"), charge["derniere"].get("source")]
        except (TypeError, ValueError, ZeroDivisionError):
            pass
    traj, d = [], 0.0
    for an in range(1, 11):
        d = d * (1 + r) - delta_solde_md
        traj.append({"annee": an, "delta_dette_md": round(d, 2)})
    pib_v = float(pib["derniere"]["valeur"]) if pib else None
    conf = Confiance(62, [
        Facteur("Comptabilité", 0.9, "Effet direct sur la dette d'un changement permanent du solde, intérêts compris."),
        Facteur("Hypothèses", 0.5, f"Taux d'intérêt apparent constant ({r * 100:.2f} %), sans effet en retour sur la croissance."),
    ], "Projection comptable de la dette")
    ind = [Indicateur("dette_10_ans", "Effet sur la dette publique après 10 ans", traj[-1]["delta_dette_md"], "milliards_euros",
                      confiance=conf, explication="Cumul des déficits (ou excédents) supplémentaires et des intérêts associés.",
                      calcul=[f"Dette(t) = Dette(t-1) × (1 + {r:.4f}) − Δsolde annuel"], sources=[s for s in sources if s],
                      sens="favorable" if traj[-1]["delta_dette_md"] < 0 else "defavorable")]
    if pib_v:
        ind.append(Indicateur("dette_10_ans_pib", "… en points de PIB actuel", traj[-1]["delta_dette_md"] / pib_v * 100,
                              "points_pib", confiance=conf, sources=[pib["derniere"].get("source")]))
    return ind, {"trajectoire_dette": traj, "taux_interet_apparent": r}


def section_budget_etat(ctx: Contexte) -> Section | None:
    lignes, total = [], 0.0
    for rid, v in ctx.overrides.items():
        r = ctx.store.regles[rid]
        if not est_depense(rid, r):
            continue
        try:
            d = float(v) - float(r["valeur"])
        except (TypeError, ValueError):
            continue
        total += d
        lignes.append({"regle": rid, "titre": r["titre"], "avant": r["valeur"], "apres": v, "delta": round(d, 3)})
    if not lignes:
        return None
    conf = Confiance(85, [Facteur("Comptabilité budgétaire", 0.95,
                                  "Un crédit voté en plus ou en moins modifie d'autant la dépense et le solde, à effets économiques exclus.")],
                     "Effet budgétaire direct")
    ind = [Indicateur("solde_public_credits", "Effet direct sur le solde public (par an)", -total, "milliards_euros",
                      confiance=conf,
                      explication="Hausse des crédits = dépense en plus = déficit en plus (et inversement).",
                      calcul=[f"Somme des variations de crédits : {total:+.2f} Md€"],
                      sources=sorted({s for l in lignes for s in ctx.store.regles[l['regle']].get('valeur_sources', [])}),
                      sens="favorable" if total < 0 else "defavorable")]
    ctx.cache.setdefault("soldes", {})["credits"] = (-total, conf)
    dette_ind, dette_data = indicateurs_dette(ctx.store, -total)
    ind += dette_ind
    return Section("budget_etat", "Budget de l'État et de la Sécurité sociale",
                   f"Dépenses de l'État : {'hausse' if total > 0 else 'baisse'} de {fr(abs(total))} milliard{'s' if round(abs(total), 1) >= 2 else ''} € par an",
                   ind, conf,
                   "Différence entre les crédits de votre société et ceux votés dans la loi de finances et la loi de "
                   "financement de la Sécurité sociale en vigueur.",
                   ["N'inclut pas les effets sur l'activité économique (voir « Effets économiques », multiplicateur budgétaire)."],
                   {"lignes": lignes, **dette_data, "regles_couvertes": [l["regle"] for l in lignes]}, ordre=35)
