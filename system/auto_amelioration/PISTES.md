# Pistes d'amélioration

Tenu à jour par la routine quotidienne (charte, règle 6) : ce qu'il reste à faire, ce qui est en test, ce qui est fait.
Chaque piste dit d'où elle vient. Les pistes « à soumettre » relèvent du responsable du projet (charte, règle 5).

## À faire

- **Fiabilité du minimum vieillesse** (vu en testant l'idée « Minimum vieillesse : +100 € ») : la population synthétique
  reproduit mal la dépense d'Aspa (calage 0,05), d'où une confiance « très faible » sur son coût. Caler les retraités
  modestes sur les effectifs officiels d'allocataires (DREES).
- **« Revaloriser les pensions »** : la règle `retraites.revalorisation.pensions_base` n'est reliée à aucun calcul. La
  changer dans l'atelier ne change donc rien ; la relier (montant des pensions des ménages et de la population) ou le dire.
- **À soumettre au responsable** : limiter le nombre de simulations de réforme simultanées si la fréquentation augmente
  (le serveur de 4 Go met jusqu'à une minute et demie pour la première simulation).

## En bêta

- **« Avez-vous pensé à… ? »**, les aides souvent oubliées dans « Mes droits » (depuis le 30/10/2026). Bilan possible à
  partir du 13/11/2026.

- **Taxe foncière (exonération, réduction de 100 €) et MaPrimeAdapt'** dans « Avez-vous pensé à… ? » (depuis le
  30/10/2026, test débutants : Bernard, 72 ans). Bilan possible à partir du 13/11/2026.

## Fait

- 30/10/2026 (soir) : atelier en une seule carte, un changement par ligne ; trois idées pour les retraités actuels
  (minimum vieillesse, CSG des pensions dans un sens ou dans l'autre) ; « Se connecter (facultatif) » dans le menu, avec
  une infobulle sur ordinateur ; « décote » expliquée (et son explication corrigée : le montant indiqué n'était pas un
  plafond d'impôt) ; « cerfa » remplacé par « formulaire officiel » ; en-tête qui tient sur un portable de 1 280 px.

- 30/10/2026 : la TVA compte dans le pouvoir d'achat des ménages ; la pension alimentaire est demandée aux parents seuls ;
  « Pourquoi aucune aide ? » ; allocation de rentrée scolaire présentée comme annuelle ; bouton « A+ » ; bouton d'avis discret
  (test première visite, Nadia et Bernard).
- 30/10/2026 (suite) : retraite à 62 ans, effets de court et de long terme expliqués sans contradiction ; plafonds du chèque
  énergie et de la C2S calculés pour le foyer ; mise en garde « forfait logement » pour la C2S d'un propriétaire ; foyer exemple
  « Parent seul » ; bouton « Effacer mes réponses » ; message « Encore une étape » plus répété ; « Aides au logement » sans
  sigles.
- 30/10/2026 (suite) : page « Le budget » : déficit expliqué (dépenses moins recettes, à l'arrondi près), ligne « Autres
  dépenses » pour que le détail d'un domaine fasse son total, rubrique « Pourquoi plusieurs totaux sur cette page ? ».
