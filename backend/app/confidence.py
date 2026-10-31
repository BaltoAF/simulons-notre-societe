"""Indice de confiance à 4 niveaux, commun à tous les résultats du site.

Chaque résultat chiffré porte un score de 0 à 100, converti en niveau :
  < 25  Très faible   ·   25-64  Faible   ·   65-74  Élevé   ·   ≥ 75  Très élevé
(« Élevé » commençait à 50 : un score de 50/100 affiché « élevé » étonnait les lecteurs ; seuil relevé le 31/10/2026.)
Le score est toujours accompagné des facteurs qui l'expliquent, pour que chacun puisse le contester.
"""
from __future__ import annotations

from dataclasses import dataclass, field

NIVEAUX = [
    (75, "tres_eleve", "Très élevé"),
    (65, "eleve", "Élevé"),
    (25, "faible", "Faible"),
    (0, "tres_faible", "Très faible"),
]

DESCRIPTIONS = {
    "tres_eleve": "Résultat solide : sources officielles ou études nombreuses, de qualité et concordantes.",
    "eleve": "Résultat fiable dans ses grandes lignes, avec une marge d'incertitude.",
    "faible": "Ordre de grandeur indicatif : peu d'études, ou des études qui divergent.",
    "tres_faible": "Hypothèse fragile : à prendre comme une piste, pas comme une prévision.",
}


def niveau(score: float) -> tuple[str, str]:
    for seuil, code, libelle in NIVEAUX:
        if score >= seuil:
            return code, libelle
    return "tres_faible", "Très faible"


@dataclass
class Facteur:
    nom: str
    valeur: float  # 0-1
    explication: str

    def to_dict(self):
        return {"nom": self.nom, "valeur": round(self.valeur, 3), "explication": self.explication}


@dataclass
class Confiance:
    score: float
    facteurs: list[Facteur] = field(default_factory=list)
    resume: str = ""

    @property
    def code(self):
        return niveau(self.score)[0]

    @property
    def libelle(self):
        return niveau(self.score)[1]

    def to_dict(self):
        return {
            "score": round(self.score),
            "niveau": self.code,
            "libelle": self.libelle,
            "description": DESCRIPTIONS[self.code],
            "facteurs": [f.to_dict() for f in self.facteurs],
            "resume": self.resume,
        }

    @staticmethod
    def maillon_faible(*items: "Confiance", resume: str = "") -> "Confiance":
        """Confiance d'un résultat obtenu en enchaînant plusieurs éléments : celle du maillon le plus faible,
        légèrement réduite quand la chaîne est longue."""
        items = [c for c in items if c is not None]
        if not items:
            return Confiance(0, [], resume or "Aucun élément")
        weakest = min(items, key=lambda c: c.score)
        penalty = 3 * (len(items) - 1)
        facteurs = [Facteur(f"Maillon : {c.resume or c.libelle}", c.score / 100, f"Score {round(c.score)}/100") for c in items]
        return Confiance(max(0.0, weakest.score - penalty), facteurs,
                         resume or f"Limité par : {weakest.resume or weakest.libelle}")


def moyenne_ponderee(items: list[tuple[float, "Confiance"]], resume: str) -> "Confiance":
    """Confiance d'une SOMME de composantes : moyenne des scores pondérée par l'ampleur de chaque composante."""
    items = [(abs(w), c) for w, c in items if c is not None and abs(w) > 1e-9]
    if not items:
        return Confiance(0, [], resume)
    tot = sum(w for w, _ in items)
    score = sum(w * c.score for w, c in items) / tot
    facteurs = [Facteur(c.resume or c.libelle, c.score / 100, f"Pèse {w / tot:.0%} du total ; score {round(c.score)}/100") for w, c in
                sorted(items, key=lambda x: -x[0])[:6]]
    return Confiance(score, facteurs, resume)


def confiance_fixe(score: float, resume: str, *facteurs: tuple[str, float, str]) -> Confiance:
    return Confiance(score, [Facteur(n, v, e) for n, v, e in facteurs], resume)


def confiance_calage(ecart_relatif: float | None, resume: str) -> Confiance:
    """Confiance d'un agrégat simulé, selon l'écart entre la simulation de la situation actuelle et le chiffre officiel."""
    if ecart_relatif is None:
        return Confiance(30, [Facteur("Calage", 0.3, "Pas de chiffre officiel de comparaison disponible.")], resume)
    e = abs(ecart_relatif)
    score = max(5.0, min(92.0, 95 - 300 * e))
    return Confiance(score, [Facteur(
        "Écart au chiffre officiel", max(0.0, 1 - 3 * e),
        f"Pour la situation actuelle, la simulation s'écarte de {e * 100:.1f} % du montant officiel observé.")], resume)
