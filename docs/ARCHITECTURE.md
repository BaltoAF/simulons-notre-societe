# Architecture

```
            ┌──────────────── Le Système ────────────────┐
 Agents de  │ sync_openfisca.py   build_population.py    │   Publication :
 recherche ─┤ (leviers + sources) (population calée)     ├─► commit sur la
 (textes,   │            mettre_a_jour.py                │   loi actuelle
 stats,     └───────────────────┬────────────────────────┘
 études)                        ▼
                         model/ (YAML)
          règles · sources · métriques · preuves · population
                                │ chargé et validé par
                                ▼
 backend/app ─ model_store.py ── index + contrôles + instantané (hash)
             ├ engine/        ── OpenFisca-France : ménage → droits et impôts, réformes paramétriques,
             │                   calcul vectorisé réparti sur plusieurs processus
             ├ impacts/       ── modules d'impact (foyer, ménages types, budget, inégalités,
             │                   crédits budgétaires, effets économiques, non-modélisé)
             ├ evidence.py    ── synthèse des études + indice de confiance
             ├ confidence.py  ── indice à 4 niveaux, « maillon faible »
             ├ vcs.py         ── sociétés, branches, commits, fusion à trois voies, propositions
             ├ auth.py        ── comptes (identification requise pour proposer)
             └ main.py        ── API REST + service du site compilé
                                │
 frontend/ (React) ── Mes droits · Atelier de réforme · Règles · Sociétés · Preuves · Sources · Système
```

## La loi actuelle

- Chaque **règle** a un identifiant stable (`domaine.theme.parametre`), un type (nombre, booléen, choix,
  texte, barème), une unité, un historique de valeurs datées et, pour chaque valeur, ses sources.
- Les règles socio-fiscales sont adossées à OpenFisca-France (`model/moteur/openfisca_leviers.yaml`) :
  le Système en extrait valeurs et références ; une règle définie par une fiche thématique (ex. SMIC)
  est rattachée au moteur sans doublon.
- Un **instantané** = les valeurs en vigueur de toutes les règles, identifié par son hash. Chaque
  changement du modèle produit un commit du Système sur la société `france`.

## Forks et versionnage

- Une société = un instantané de référence + des **surcharges** (règle → valeur). Chaque commit stocke
  l'état complet de ses surcharges et la liste des changements (avant / après / justification / sources).
- **Fusion à trois voies** au niveau de chaque règle (ancêtre commun, cible, source) ; les conflits
  sont présentés à l'utilisateur qui choisit règle par règle.
- **Synchronisation avec la loi** : quand la loi actuelle évolue, un fork intègre les nouvelles valeurs
  des règles qu'il n'a pas modifiées ; pour les autres, son propriétaire décide.
- La loi actuelle refuse commits et propositions (403) : elle n'est modifiée que par le Système.

## Impacts

| Module | Méthode | Confiance |
|---|---|---|
| Foyer, ménages types | OpenFisca, législation actuelle vs modifiée | Très élevée (calcul mécanique) |
| Budget | Microsimulation sur population synthétique pondérée, non-recours issu des études | Selon l'écart simulé / officiel de chaque poste |
| Inégalités | Déciles de niveau de vie, Gini, pauvreté | Selon le calage |
| Crédits budgétaires | Écart aux crédits votés (LFI, LFSS), dynamique de la dette | Élevée |
| Effets économiques | Règle × statistique publique × effet causal synthétisé | Maillon le plus faible |

La population synthétique (5 000 ménages) est calée par « raking » sur les marges INSEE (types de
ménages, âges, statut d'occupation, emploi, retraités, déciles de niveau de vie) et alignée sur les
effectifs de bénéficiaires CNAF/DREES corrigés du non-recours ; les montants versés et l'impôt servent
de contrôles (voir `docs/CALAGE-POPULATION.md`).

## Équilibres et bilan

- `impacts/equilibres.py` : finances publiques (règles `budget.regles.article_40_irrecevabilite_financiere`,
  `budget.regles.deficit_public_max_pct_pib` ; effet direct hors comportements) et budget carbone (règles
  `environnement_energie.budget_carbone.periode_*`, émissions observées). Statuts : respecté, à compenser,
  à surveiller (confiance < 25), assumé (règle désactivée dans le fork), information.
- `impacts/compensations.py` : rendements marginaux des leviers (missions, TVA, CSG, IR, IS, accises, vitesses),
  ajustement nécessaire, application en un clic puis vérification par une nouvelle simulation.
- `impacts/bilan.py` : bilan en quatre piliers (économie, social, écologie, bien-être), sans note agrégée.
- `impacts/planete_bien_etre.py` : émissions (carburants, vitesses, revenus, activité), satisfaction dans la vie,
  emploi, temps libre, santé (retraite), sécurité routière, tabac.
- `budget_vue.py` : du budget national (COFOG, recettes, déficit, dette) au budget d'un ménage.
- `droits.py` : droits non monétaires personnalisés (retraite, chômage, travail, vote, route, santé), comparables
  entre deux sociétés.

## Mise à jour invisible

- `system/maj_quotidienne.py` : moteur (avec retour arrière), leviers, population, contrôles, publication,
  synchronisation des forks, vérification de liens par rotation.
- `app/planificateur.py` : fil d'arrière-plan du serveur ; date de référence glissante (entrées en vigueur),
  détection des modifications du modèle (rechargement à chaud), passage nocturne (SOCIETE_MAJ_HEURE, SOCIETE_MAJ=0).
- `vcs.auto_sync_forks` : fusion silencieuse sans conflit ; conflits enregistrés pour le propriétaire.

## Indice de confiance

- Études : moyenne géométrique pondérée du volume (25 %), de la qualité (25 %), de l'accord (30 %) et
  de la pertinence pour la France (20 %). Une seule estimation ne peut dépasser « Faible ».
- Chaînes de calcul : maillon le plus faible, moins 3 points par maillon supplémentaire.
- Totaux (somme de composantes) : moyenne des confiances pondérée par l'ampleur de chaque composante.
- Agrégats simulés : score décroissant avec l'écart au chiffre officiel (95 − 300 × écart relatif).

## Limites connues (première itération)

- Pas de données individuelles ouvertes : population synthétique = ordres de grandeur.
- Les indépendants et les fonctionnaires sont simulés comme des salariés du privé.
- Calculs de 10 à 20 secondes par réforme (OpenFisca sur 5 000 ménages, 4 processus).
- Identification par pseudo et mot de passe ; FranceConnect à brancher pour les rôles exigeant une
  identité vérifiée.
- Légifrance bloque les robots : les agents ont prouvé les valeurs via les pages officielles qui citent
  les articles (service-public.fr, code.travail.gouv.fr, circulaires…). Une clé d'API PISTE (Légifrance)
  permettrait au Système de vérifier directement chaque article.
