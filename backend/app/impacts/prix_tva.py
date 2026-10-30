"""La TVA dans le pouvoir d'achat des ménages.

OpenFisca calcule les impôts et les prestations, pas la TVA payée à chaque achat. Quand une réforme change un taux de TVA,
on ajoute son effet au revenu disponible « réel » de chaque ménage (son foyer, les ménages types, la population simulée) :
part de son revenu payée en TVA (selon sa place dans l'échelle des niveaux de vie, INSEE) × variation relative de la TVA
payée × part répercutée dans les prix. Les recettes publiques correspondantes sont comptées à part (module TVA).
"""
from __future__ import annotations

import numpy as np

from ..budget_vue import _part_tva
from ..confidence import Confiance
from .comportements import variation_tva
from .contexte import Contexte


def facteurs_tva(ctx: Contexte, niveau_vie_mensuel) -> tuple[np.ndarray, Confiance] | None:
    """Pour chaque ménage, le facteur qui transforme son revenu disponible en revenu « réel » après le changement de TVA."""
    v = variation_tva(ctx)
    if v is None:
        return None
    rel, p, conf = v
    cache: dict[int, float] = {}

    def part(nv_annuel: float) -> float:
        cle = int(nv_annuel // 500)  # même décile à 500 € près : le calcul ne se refait pas pour 6 000 ménages
        if cle not in cache:
            cache[cle] = _part_tva(ctx.store, nv_annuel)[0] or 0.0
        return cache[cle]
    parts = np.array([part(float(x) * 12) for x in np.atleast_1d(niveau_vie_mensuel)])
    return 1 - parts * rel * p / 100, conf


def appliquer(ctx: Contexte, base: dict, ref: dict) -> tuple[dict, Confiance | None]:
    """Résultats « après réforme » corrigés de l'effet de la TVA sur les prix (copie ; `ref` n'est pas modifié)."""
    f = facteurs_tva(ctx, base["niveau_de_vie"])
    if f is None:
        return ref, None
    facteurs, conf = f
    out = dict(ref)
    out["revenu_disponible"] = np.asarray(ref["revenu_disponible"], dtype=float) * facteurs
    out["niveau_de_vie"] = np.asarray(ref["niveau_de_vie"], dtype=float) * facteurs
    out["tva_prix"] = np.asarray(ref["revenu_disponible"], dtype=float) * (facteurs - 1)
    return out, conf
