"""Description simplifiée d'un ménage, compréhensible par le grand public.

C'est le format échangé entre le site et le moteur : le questionnaire « Mes droits » produit un
`Menage`, et la population synthétique est une liste de `Menage` pondérés.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Literal

Activite = Literal["salarie", "independant", "chomeur", "retraite", "etudiant", "inactif"]
Couple = Literal["seul", "marie", "pacse", "concubin"]
Logement = Literal["locataire_prive", "locataire_social", "proprietaire", "heberge"]


@dataclass
class Adulte:
    age: int = 35
    activite: Activite = "salarie"
    salaire_brut_mensuel: float = 0.0      # salaire de base brut
    cadre: bool = False
    chomage_brut_mensuel: float = 0.0
    retraite_brute_mensuelle: float = 0.0
    handicap: bool = False                 # taux d'incapacité ≥ 80 %

    @classmethod
    def from_dict(cls, d: dict) -> "Adulte":
        return cls(**{k: d[k] for k in cls.__dataclass_fields__ if k in d})


@dataclass
class Menage:
    adultes: list[Adulte] = field(default_factory=lambda: [Adulte()])
    couple: Couple = "seul"
    enfants: list[int] = field(default_factory=list)  # âges des enfants à charge
    logement: Logement = "locataire_prive"
    loyer_mensuel: float = 0.0
    zone: int = 2                                     # zone des aides au logement (1 = Paris… 3 = rural)
    revenus_capital_annuels: float = 0.0              # intérêts et dividendes soumis au PFU
    poids: float = 1.0                                # pondération (population synthétique)
    libelle: str = ""

    @classmethod
    def from_dict(cls, d: dict) -> "Menage":
        adultes = [Adulte.from_dict(a) for a in d.get("adultes", [])] or [Adulte()]
        kw = {k: d[k] for k in cls.__dataclass_fields__ if k in d and k != "adultes"}
        m = cls(adultes=adultes[:2], **kw)
        if len(m.adultes) == 1:
            m.couple = "seul"
        elif m.couple == "seul":
            m.couple = "concubin"
        m.enfants = [max(0, min(int(a), 25)) for a in m.enfants][:8]
        m.zone = m.zone if m.zone in (1, 2, 3) else 2
        return m

    def to_dict(self) -> dict:
        return asdict(self)

    @property
    def taille(self) -> int:
        return len(self.adultes) + len(self.enfants)

    @property
    def unites_consommation(self) -> float:
        """Échelle d'équivalence de l'OCDE modifiée (INSEE) : 1 + 0,5 par personne de 14 ans ou plus + 0,3 par enfant de moins de 14 ans."""
        uc = 1.0 + 0.5 * (len(self.adultes) - 1)
        for age in self.enfants:
            uc += 0.5 if age >= 14 else 0.3
        return uc
