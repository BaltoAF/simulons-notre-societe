# Format des données de la « Société 1.0 »

Toutes les données du modèle de référence vivent dans `model/` sous forme de fichiers YAML (UTF-8).
Elles sont produites et maintenues **uniquement par le Système** (pipelines automatisés + agents de recherche),
jamais éditées à la main par les utilisateurs. Chaque valeur doit être **prouvée** par au moins une source.

```
model/
  regles/<domaine>/<theme>.yaml   # les règles (paramètres) de la société
  sources/<theme>.yaml            # le registre des sources (textes, statistiques, études)
  metriques/<theme>.yaml          # les mesures observées (statistiques fiables)
  preuves/<question>.yaml         # les études quantifiant un effet (élasticités, impacts…)
```

## Domaines (liste fermée)

`fiscalite`, `prestations`, `retraites`, `travail`, `justice_penale`, `droit_civil`, `institutions`,
`education`, `sante`, `logement`, `environnement_energie`, `nationalite_immigration`, `budget`, `transports`.

## 1. Règles — `model/regles/<domaine>/<theme>.yaml`

```yaml
domaine: justice_penale
theme: "Atteintes aux biens"          # libellé lisible du fichier
regles:
  - id: justice_penale.vol_simple.prison_max      # unique, minuscules, snake_case, segments séparés par des points, commence par le domaine
    titre: "Vol simple : peine de prison maximale"
    explication: "Une ou deux phrases compréhensibles par tout le monde, sans jargon."
    type: nombre          # nombre | booleen | choix | texte
    unite: ans            # ans | mois | jours | heures | euros | pourcent | personnes | sieges | ratio | ...
    choix: []             # uniquement si type = choix : liste des valeurs possibles
    bornes: [0, 30]       # optionnel : plage plausible pour un curseur dans un fork
    valeurs:              # historique, du plus ancien au plus récent ; la dernière entrée = valeur en vigueur
      - depuis: "1994-03-01"
        valeur: 3
        sources: [legi-cp-311-3]          # ids du registre des sources (au moins une)
        article: "Code pénal, art. 311-3"  # optionnel, référence précise
    tags: [peine, biens]
    a_verifier: false     # true si la valeur n'a pas pu être confirmée sur une source officielle
    note: ""              # optionnel : précision, exception importante
```

Règles d'or :
- La valeur en vigueur est celle **au 13 octobre 2026**. Ajouter l'historique récent quand il est facile à établir.
- Une valeur sans source n'existe pas. Si une valeur ne peut pas être confirmée : `a_verifier: true` et une `note`.
- Les montants en euros : nombre brut (`11.88`), unité `euros` (préciser brut/net, mensuel/horaire dans le titre).
- Les pourcentages : unité `pourcent`, valeur en points (`20` pour 20 %).

## 2. Sources — `model/sources/<theme>.yaml`

```yaml
sources:
  - id: legi-cp-311-3              # unique, minuscules, tirets
    type: texte_officiel           # texte_officiel | statistique_publique | rapport_institutionnel | etude_academique | document_de_travail | think_tank | presse
    editeur: "Légifrance (DILA)"
    titre: "Code pénal – Article 311-3"
    url: "https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006418132"
    auteurs: []                    # pour les études
    date_publication: "2016-06-04" # si connue
    consulte_le: "2026-10-13"
    note: ""
```

Fiabilité intrinsèque (déduite du `type`, utilisée par l'indice de confiance) :
`texte_officiel` > `statistique_publique` > `rapport_institutionnel` (Cour des comptes, DG Trésor, CBO, OCDE, Banque de France, conseils d'analyse) >
`etude_academique` (revue à comité de lecture) > `document_de_travail` > `think_tank` > `presse`.

## 3. Métriques — `model/metriques/<theme>.yaml`

```yaml
metriques:
  - id: demographie.population_totale
    titre: "Population totale (France entière, au 1er janvier)"
    explication: "…"
    unite: personnes
    serie:
      - date: "2025-01-01"
        valeur: 68606000
        source: insee-bilan-demo-2025
        statut: provisoire        # definitif | provisoire | estimation | prevision
```

## 4. Preuves (études) — `model/preuves/<question>.yaml`

Une « question » = un effet causal qu'on cherche à quantifier. On y liste **toutes** les estimations
trouvées, y compris contradictoires. Le Système en tire une synthèse et un indice de confiance.

```yaml
question:
  id: emploi_smic_elasticite
  titre: "Effet d'une hausse du SMIC sur l'emploi des salariés peu qualifiés"
  definition: "Variation en % de l'emploi au voisinage du SMIC pour une hausse de 1 % du coût du travail à ce niveau."
  unite: elasticite
  regles_liees: [travail.smic.horaire_brut]
  sens_attendu: negatif            # positif | negatif | ambigu
  estimations:
    - source: kramarz-philippon-2001
      valeur: -1.5                 # estimation centrale, dans l'unité de la question
      intervalle_95: [-2.5, -0.5]  # null si non publié
      methode: "Panel, transitions individuelles autour des hausses du coût du travail"
      champ: "France, 1990-1998, travailleurs proches du salaire minimum"
      pays: FR
      annee_donnees: 1998
      type_etude: quasi_experimental   # meta_analyse | experimental | quasi_experimental | structurel | descriptif | simulation_institutionnelle
      revue_par_les_pairs: true
      note: ""
  note_synthese: "Résumé honnête : où est le consensus, où sont les désaccords."
```
