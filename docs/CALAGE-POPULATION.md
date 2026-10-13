# Calage de la population synthétique de ménages

Objectif : disposer d'un échantillon pondéré de ménages représentatif de la France pour chiffrer le coût et l'effet redistributif (par décile de niveau de vie) d'une réforme, sans accès à l'ERFS ni à POTE. Les agrégats sont dans `model/metriques/population.yaml` (196 métriques), leurs sources dans `model/sources/population.yaml`.

## Méthode en 4 étapes

1. **Échantillon de départ** : le fichier détail de l'enquête Emploi 2025 (individus pondérés, poids `EXTRIAN`) fournit des structures de ménages réalistes (âge, sexe, activité). À défaut, on génère les ménages à partir des marges ci-dessous.
2. **Imputation des revenus** : salaires tirés des centiles Insee (base Tous salariés), revenus d'indépendants par tranche (Insee Première n° 2114), pensions d'après la DREES ; puis calcul des impôts et prestations avec le moteur de règles (OpenFisca).
3. **Calage des poids** (raking / méthode du type Calmar, bornes de poids pour éviter les poids extrêmes), dans cet ordre :
   - **démographie** : population par tranche d'âge (7 tranches, `demographie.population_*`) ;
   - **ménages** : nombre total, type (personne seule, couples avec/sans enfant, monoparental, complexe), taille (1 à 6+), familles par nombre d'enfants mineurs (1, 2, 3+), statut d'occupation (propriétaire, parc social, parc privé, gratuit) ;
   - **activité** : personnes en emploi, chômeurs BIT, inactifs 15-64 ans, retraités résidant en France, salariés privés/publics, non-salariés ;
   - **revenus primaires** : masse salariale du privé, salaire moyen et déciles D1/D5/D9 en EQTP ; **fiscalité** : nombre de foyers et RFR total par tranche de RFR (IRCOM), déciles de RFR par part.
4. **Contrôles** (non utilisés pour caler, ils mesurent la qualité du modèle) : niveau de vie D1 à D9, moyenne par décile, Gini, taux et seuil de pauvreté ; impôt net total, par tranche de RFR et par taux marginal, foyers imposés ; foyers et montants de RSA, prime d'activité, aides au logement, allocations familiales, AAH, minimum vieillesse, bénéficiaires de la C2S ; recettes de CSG, CRDS et cotisations. Un écart sur ces cibles révèle une imputation de revenus ou une règle mal modélisée.

## Pièges à traiter explicitement

- **Unités différentes** : 31,3 millions de ménages mais 41,6 millions de foyers fiscaux (un couple non marié = deux foyers) ; les prestations se comptent en foyers allocataires Caf. Il faut construire les foyers fiscaux et allocataires à l'intérieur de chaque ménage avant de caler sur les marges DGFiP/CNAF.
- **Champs** : niveau de vie = France métropolitaine, logements ordinaires ; recensement = France hors Mayotte ; population, IR et prestations = France entière ; les 75 ans ou plus en institution sont hors champ « ménages ».
- **Millésimes** : RP 2023, ERFS 2024, revenus 2024 (IR 2025), prestations 2024-2025, loyers 2020. Vieillir l'échantillon vers une année commune (revalorisation des salaires, pensions, barèmes) et caler chaque marge à sa date.
- **Périmètres de prélèvements** : la CSG (157 Md€ en 2025) couvre tous ses attributaires ; les cotisations retenues ne concernent que les régimes de base et le FSV (hors Agirc-Arrco et Unédic).

## Fichiers ouverts utiles pour des distributions plus fines

- IRCOM (DGFiP) : foyers, RFR, impôt, salaires et pensions par tranche fine de RFR (jusqu'à plus de 9 M€), national, départemental, communal : https://www.data.gouv.fr/datasets/limpot-sur-le-revenu-par-collectivite-territoriale-ircom
- Tableaux DGFiP (déciles de RFR par part, taux marginal, revenus catégoriels imposés/non imposés, crédits et réductions par décile) : https://www.impots.gouv.fr/impot-sur-le-revenu — et montants déclarés case par case : https://data.economie.gouv.fr/explore/dataset/ir-declarations-2042-nat/information/
- Insee, niveaux de vie (séries longues) : https://www.insee.fr/fr/statistiques/2416808 et https://www.insee.fr/fr/statistiques/2417897 ; salaires par centile : https://www.insee.fr/fr/statistiques/fichier/8657156/ip2079.xlsx ; revenus des non-salariés par tranche : https://www.insee.fr/fr/statistiques/fichier/9013403/IP2114.xlsx
- Filosofi (revenus localisés, déciles par territoire et type de ménage ; Filosofi 2 à partir du millésime 2023, diffusion plus restreinte) : https://www.insee.fr/fr/metadonnees/source/serie/s1172
- Enquête Emploi 2025, fichier détail (microdonnées) : https://www.insee.fr/fr/statistiques/9034119
- DREES : décomposition du revenu et pauvreté avant/après redistribution par décile : https://data.drees.solidarites-sante.gouv.fr/explore/dataset/4230_indicateurs-de-pauvrete-avant-et-apres-redistribution-de-niveau-de-vie-et-d/information/ ; minima sociaux par configuration familiale : https://data.drees.solidarites-sante.gouv.fr/explore/dataset/336_minima-sociaux-rsa-et-prime-d-activite/information/
- CNAF (allocataires par prestation, situation familiale, quotient familial, revenus) : https://data.caf.fr/pages/accueil-ods/
- Urssaf (masse salariale et effectifs par secteur et région) : https://open.urssaf.fr/explore/dataset/masse-salariale-du-secteur-prive-france-entiere/information/
- La publication Insee « Revenus et patrimoine des ménages » croise revenus et patrimoine, mais n'a pas été consultée ici.

## Microsimulation ouverte réutilisable

- **OpenFisca-France** (moteur de calcul open source de la législation socio-fiscale) : https://github.com/openfisca/openfisca-france. Il calcule les impôts et prestations d'un ménage donné, mais ne fournit pas de population.
- **LexImpact** (Assemblée nationale), outils fondés sur OpenFisca : simulateur https://socio-fiscal.leximpact.an.fr/accueil, code https://git.leximpact.dev/leximpact. Le site public présente des « ménages types » et des « cas types », pas de population calée téléchargeable.
- **Cas types DREES** : fiche 04 du Panorama « Minima sociaux et prestations de solidarité » (édition 2025), « La combinaison des prestations et ses effets sur le niveau de vie ». Utiles pour tester les règles, pas pour caler. Aucun jeu de « cas types » de la DG Trésor n'a été localisé lors de cette collecte.
- Aucune base de microdonnées de ménages déjà calée et ouverte n'a été trouvée. L'ERFS et POTE ne sont accessibles qu'en accès sécurisé ; la population synthétique doit donc être construite à partir des marges ci-dessus.
