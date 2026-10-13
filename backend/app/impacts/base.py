"""Cadre commun des modules d'impact.

Une simulation de réforme produit un `Rapport` composé de `Section`s (pour votre foyer, ménages types,
budget, inégalités, effets économiques, effets non monétaires…). Chaque `Indicateur` porte sa valeur,
son explication, le détail du calcul, ses sources et son indice de confiance.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..confidence import Confiance


@dataclass
class Indicateur:
    id: str
    libelle: str
    valeur: float | None
    unite: str
    avant: float | None = None
    apres: float | None = None
    confiance: Confiance | None = None
    explication: str = ""
    calcul: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    preuves: list[str] = field(default_factory=list)
    sens: str = "neutre"  # favorable | defavorable | neutre (du point de vue de la personne concernée)
    fourchette: list[float] | None = None

    def to_dict(self):
        return {
            "id": self.id, "libelle": self.libelle, "valeur": _r(self.valeur), "unite": self.unite,
            "avant": _r(self.avant), "apres": _r(self.apres),
            "confiance": self.confiance.to_dict() if self.confiance else None,
            "explication": self.explication, "calcul": self.calcul, "sources": self.sources,
            "preuves": self.preuves, "sens": self.sens,
            "fourchette": [_r(x) for x in self.fourchette] if self.fourchette else None,
        }


def _r(x):
    if x is None:
        return None
    if isinstance(x, float):
        return round(x, 4) if abs(x) < 10 else round(x, 2)
    return x


@dataclass
class Section:
    id: str
    titre: str
    sous_titre: str = ""
    indicateurs: list[Indicateur] = field(default_factory=list)
    confiance: Confiance | None = None
    methode: str = ""
    limites: list[str] = field(default_factory=list)
    donnees: dict[str, Any] = field(default_factory=dict)  # données pour graphiques (déciles, cas types…)
    ordre: int = 50

    def to_dict(self):
        return {
            "id": self.id, "titre": self.titre, "sous_titre": self.sous_titre,
            "indicateurs": [i.to_dict() for i in self.indicateurs],
            "confiance": self.confiance.to_dict() if self.confiance else None,
            "methode": self.methode, "limites": self.limites, "donnees": self.donnees,
        }


def signe(delta: float, seuil: float = 0.5) -> str:
    if delta > seuil:
        return "favorable"
    if delta < -seuil:
        return "defavorable"
    return "neutre"
