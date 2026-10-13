"""Orchestration d'une simulation de réforme : exécute les modules d'impact pertinents et assemble le rapport."""
from __future__ import annotations

import hashlib
import json
import threading
import time
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor

from ..confidence import Confiance, Facteur
from ..evidence import synthese
from .base import Indicateur, Section
from .contexte import Contexte
from .menages import section_cas_types, section_menage

_CACHE: OrderedDict[str, dict] = OrderedDict()
_LOCK = threading.Lock()
_EXECUTOR = ThreadPoolExecutor(max_workers=2)


def _modules():
    # imports tardifs : ces modules dépendent de données (population, preuves) chargées à la demande
    from . import comportements, microsim, budget_etat, planete_bien_etre
    return [section_menage, section_cas_types, microsim.section_budget, microsim.section_redistribution,
            budget_etat.section_budget_etat, *comportements.MODULES, *planete_bien_etre.MODULES]


def regles_modifiees(ctx: Contexte) -> list[dict]:
    out = []
    for rid, v in ctx.overrides.items():
        r = ctx.store.regles[rid]
        out.append({"regle": rid, "titre": r["titre"], "domaine": r["domaine"], "unite": r["unite"],
                    "type": r["type"], "avant": r["valeur"], "apres": v})
    return out


def section_non_monetaire(ctx: Contexte, couvertes: set[str]) -> Section | None:
    restantes = [rid for rid in ctx.overrides if rid not in couvertes]
    if not restantes:
        return None
    items = []
    for rid in restantes:
        r = ctx.store.regles[rid]
        liees = []
        for qid, q in ctx.store.preuves.items():
            if rid in (q.get("regles_liees") or []):
                syn = synthese(q, ctx.store)
                liees.append({"id": qid, "titre": q.get("titre"), "valeur_retenue": syn.get("valeur_retenue"),
                              "unite": q.get("unite"), "confiance": syn.get("confiance")})
        items.append({"regle": rid, "titre": r["titre"], "domaine": r["domaine"], "avant": r["valeur"],
                      "apres": ctx.overrides[rid], "unite": r["unite"], "preuves_liees": liees})
    conf = Confiance(10, [Facteur("Modèle d'impact", 0.0,
                                  "Aucun modèle quantitatif n'est encore disponible pour ces règles.")],
                     "Pas de modèle quantitatif")
    return Section("non_modelise", "Changements sans chiffrage", "Ce que le Système ne sait pas encore mesurer",
                   [Indicateur("nb_non_modelise", "Règles modifiées sans chiffrage", len(items), "regles", confiance=conf)],
                   conf,
                   "Pour ces règles, le Système affiche les études disponibles mais ne calcule pas encore d'impact chiffré. "
                   "Chaque nouveau modèle d'impact enrichit automatiquement les simulations.",
                   [], {"regles": items}, ordre=90)


def simuler(store, overrides: dict, menage=None, approximations: list[str] | None = None,
            modules: list[str] | None = None) -> dict:
    key = hashlib.sha1(json.dumps({"o": overrides, "m": menage.to_dict() if menage else None, "mod": modules},
                                  sort_keys=True, default=str).encode()).hexdigest()
    with _LOCK:
        if key in _CACHE:
            _CACHE.move_to_end(key)
            return _CACHE[key]
    t0 = time.time()
    ctx = Contexte.creer(store, overrides, menage)
    ctx.cache["approximations_menage"] = approximations or []
    # Lance le calcul de la population (le plus long, réparti sur plusieurs processus) pendant que les
    # autres modules calculent le foyer et les ménages types.
    if ctx.touche_moteur and (not modules or {"budget", "redistribution", "comportements"} & set(modules)):
        from .microsim import charger_population
        pop = charger_population()
        if pop is not None:
            ctx.cache["pop_future"] = _EXECUTOR.submit(ctx.calculer, pop[0], True)
    sections, erreurs = [], []
    # les règles traduites pour le moteur sont chiffrées par les modules mécaniques (foyer, cas types, budget)
    couvertes = {rid for rid in ctx.overrides if rid not in ctx.hors_moteur}
    # règles qui encadrent les équilibres (article 40, limite de déficit, budgets carbone) : traitées par les équilibres
    couvertes |= {rid for rid in ctx.overrides if rid.startswith(("budget.regles.", "environnement_energie.budget_carbone."))}
    for mod in _modules():
        if modules and getattr(mod, "SECTION_ID", mod.__name__.replace("section_", "")) not in modules:
            continue
        try:
            out = mod(ctx)
        except Exception as e:  # un module défaillant ne doit pas faire échouer tout le rapport
            erreurs.append({"module": getattr(mod, "__name__", str(mod)), "erreur": f"{type(e).__name__}: {e}"})
            continue
        if out is None:
            continue
        for sec in out if isinstance(out, list) else [out]:
            sections.append(sec)
            couvertes |= set(sec.donnees.get("regles_couvertes", []))
    nm = section_non_monetaire(ctx, couvertes) if not modules or "non_modelise" in modules else None
    if nm:
        sections.append(nm)
    sections.sort(key=lambda s: s.ordre)
    from . import bilan as bilan_mod
    from . import equilibres as eq_mod
    equilibres = eq_mod.calculer(ctx, sections)
    rapport = {
        "regles_modifiees": regles_modifiees(ctx),
        "sections": [s.to_dict() for s in sections],
        "synthese": synthese_globale(sections),
        "equilibres": equilibres,
        "bilan": bilan_mod.construire(sections, equilibres),
        "pour_vous": _pour_vous(sections),
        "erreurs": erreurs,
        "avertissements": _avertissements(ctx),
        "duree_secondes": round(time.time() - t0, 2),
    }
    with _LOCK:
        _CACHE[key] = rapport
        while len(_CACHE) > 64:
            _CACHE.popitem(last=False)
    return rapport


def _avertissements(ctx) -> list[str]:
    from .microsim import avertissements_couverture
    try:
        return avertissements_couverture(ctx)
    except Exception:  # un avertissement ne doit jamais faire échouer le rapport
        return []


def _pour_vous(sections: list[Section]) -> dict | None:
    s = next((x for x in sections if x.id == "menage"), None)
    if not s or not s.indicateurs:
        return None
    i = s.indicateurs[0]
    return {"delta_mois": i.valeur, "avant": i.avant, "apres": i.apres, "confiance": i.confiance.to_dict() if i.confiance else None}


def synthese_globale(sections: list[Section]) -> dict:
    """Résumé : effet total sur les finances publiques et messages clés, chacun avec sa confiance."""
    solde, parts = 0.0, []
    for s in sections:
        for i in s.indicateurs:
            if i.id.startswith("solde_public") and i.valeur is not None:
                solde += i.valeur
                parts.append({"section": s.titre, "libelle": i.libelle, "valeur": i.valeur,
                              "confiance": i.confiance.to_dict() if i.confiance else None})
    from ..confidence import moyenne_ponderee
    comp = [(i.valeur, i.confiance) for s in sections for i in s.indicateurs
            if i.id.startswith("solde_public") and i.valeur is not None and i.confiance is not None]
    conf = moyenne_ponderee(comp, "Effet total sur les comptes publics (moyenne pondérée par l'ampleur de chaque composante)") if comp else None
    return {
        "solde_public_annuel_md": round(solde, 2) if parts else None,
        "composantes_solde": parts,
        "confiance_solde": conf.to_dict() if conf else None,
        "messages": [{"section": s.titre, "texte": s.sous_titre} for s in sections],
    }
