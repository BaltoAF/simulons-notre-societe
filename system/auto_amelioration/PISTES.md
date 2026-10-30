# Pistes d'amélioration

Tenu à jour par la routine quotidienne (charte, règle 6) : ce qu'il reste à faire, ce qui est en test, ce qui est fait.
Chaque piste dit d'où elle vient. Les pistes « à soumettre » relèvent du responsable du projet (charte, règle 5).

## À faire

- **Fiabilité du minimum vieillesse, suite** : avec le recours en montant (fait le 30/10), dépense simulée 3,6 Md€ contre
  4,6 Md€ versés (écart −22 %). Reste probablement la population synthétique : caler les retraités modestes sur les
  allocataires de la DREES (fin 2023 : 723 020, dont 77 % seuls, âge moyen 74 ans ; fiche 26 des « Retraités et les
  retraites », édition 2025) ; couples et 60-64 ans inaptes au travail sont peut-être sous-représentés.
- **Test Kevin** (24 ans, livreur auto-entrepreneur, téléphone seul ; notes 3 / 2 / 3 sur 5, 30/10/2026). Fait : le statut
  d'auto-entrepreneur, les aides annoncées en tête de « Mes droits », âge et salaire non pré-remplis, prime d'activité
  expliquée simplement, « Pourquoi ce montant ? » à 44 px ; « Le budget » commence par « Sur 100 € d'argent public » en
  mots courants (retraites, santé, école…) et met « Et vous ? » en premier, sans « cadenas » ni « COFOG ». Reste :
  2e passage (notes 4 / 3 / 4) : corrigé le
  détail des cotisations d'auto-entrepreneur (taux, titres des règles), le handicap dans le récapitulatif, des cases à
  cocher plus grandes, le vrai/faux sur les impôts (« C'est plus compliqué »), les mêmes mots dans tout « Le budget »,
  « salaire modeste » et « MSA » ; puis « moteur » retiré du message d'attente, et sur écran tactile, mots du
  lexique en couleur de lien et petits liens dans le texte avec une zone à toucher agrandie. (Fait aussi : « Intérêts de la dette de l'État » distingué
  des intérêts de toutes les administrations ; le vrai/faux sur les impôts donne la part des foyers qui paient l'impôt
  sur le revenu, 47,3 %.)
- **Test Samira** (34 ans, mère seule de 2 enfants, aide-soignante à temps partiel, HLM ; notes 4 / 2,5 / 4, 30/10/2026).
  Fait : l'idée « Allocations familiales dès le premier enfant » ne calculait rien (le montant ne commence qu'au 2e enfant),
  remplacée par « 10 % de plus » et la règle prévient ; plus de « −50 % » pour « 2 enfants → 1 » ; loyer « avant l'aide au
  logement » (en HLM l'aide est souvent versée au bailleur : saisie après aide, elle était comptée deux fois) ;
  allocations familiales et de rentrée « sans démarche en général » ; « Votre part » dans le budget. Reste :
  - Pension alimentaire : avec 150 € de pension, le foyer touche 188 € de moins qu'avec 0 €. C'est la règle appliquée par
    le moteur (OpenFisca, ppa_base_ressources_prestations_familiales : la pension compte en entier, l'ASF seulement pour
    son forfait « rsa_forfait_asf ») : expliqué dans « Pourquoi ce montant ? » de l'ASF, et la consigne ne pousse plus à
    déclarer 0 quand la pension est versée. Reste à citer l'article du code de la sécurité sociale qui fixe ce forfait.
  - **Garde d'enfants** : aucune question ni aide (complément de libre choix du mode de garde, crèche) alors que c'est
    souvent la première question d'un parent d'enfant de moins de 6 ans ; à ajouter (moteur ou « Avez-vous pensé à… »).
  - Complémentaire santé solidaire : n'afficher que le plafond du foyer (les plafonds génériques prêtent à confusion).
  - Arrondis (200,78 € × 2 ≠ 404 €, 429 € / 426,87 €).
  - Lexique : « CRDS », « part salariale », « cotisations patronales », « pensions de réversion », « BMAF »,
    « juge aux affaires familiales » ; « Et vous ? » en € par mois comme « Mes droits ».
- **Si la fréquentation augmente** (à soumettre au responsable) : la mémoire est déjà protégée, car un seul calcul de
  population tourne à la fois (`SOCIETE_WORKERS=1`) et les résultats identiques sont gardés en cache. Seule l'attente
  s'allonge : passer alors au VPS-2 avec `SOCIETE_WORKERS=3`, ou dire au visiteur combien de calculs passent avant le sien.

## En bêta

- **« Avez-vous pensé à… ? »**, les aides souvent oubliées dans « Mes droits » (depuis le 30/10/2026). Bilan possible à
  partir du 13/11/2026.

- **Taxe foncière (exonération, réduction de 100 €) et MaPrimeAdapt'** dans « Avez-vous pensé à… ? » (depuis le
  30/10/2026, test débutants : Bernard, 72 ans). Bilan possible à partir du 13/11/2026.

## Fait

- 30/10/2026 (soir) : la revalorisation des pensions de base est chiffrée : appliquée à la part des retraites versée par
  des régimes qui la suivent (74 %, DREES fiche 10, 2024 ; les complémentaires de salariés, 26 %, ont leur propre
  revalorisation), pour les ménages et la population ; nouveau poste « Retraites versées » dans le budget simulé
  (−1,7 % du chiffre officiel) ; idée toute prête « Geler les pensions de base » (projet de loi 2026, retiré).
- 30/10/2026 (soir, test Kevin) : « Mes droits » accepte les auto-entrepreneurs (micro-entreprise : vente, services,
  libéral) : cotisations aux taux de Service Public Entreprendre (12,3 %, 21,2 %, 25,6 % du chiffre d'affaires, règles
  travail.micro_entreprise.*), impôt et aides calculés par le moteur sur le chiffre d'affaires déclaré.
- 30/10/2026 (soir) : minimum vieillesse, le taux de recours appliqué à la dépense est compté en montant (DREES, Dossier
  n° 97 : environ 38 % des sommes dues non versées, contre 50 % des personnes) ; écart au chiffre officiel de −32 % à −22 %.
- 30/10/2026 (routine du jour, avis n° 1) : sur téléphone, menu « En savoir plus » lisible dans le menu ouvert ; bouton « A+ »
  rangé dans le menu avec le compte.
- 30/10/2026 (soir) : atelier en une seule carte, un changement par ligne ; trois idées pour les retraités actuels
  (minimum vieillesse, CSG des pensions dans un sens ou dans l'autre) ; « Se connecter (facultatif) » dans le menu, avec
  une infobulle sur ordinateur ; « décote » expliquée (et son explication corrigée : le montant indiqué n'était pas un
  plafond d'impôt) ; « cerfa » remplacé par « formulaire officiel » ; en-tête qui tient sur un portable de 1 280 px.
- 30/10/2026 (soir, test Jacqueline) : un changement ne se replie plus au premier réglage ; « Supprimer ce changement »
  avec « Rétablir », et « Fermer » ; bouton « Voir les effets » toujours visible ; montants annuels aussi par mois ;
  « Revenir à ma réforme » depuis « Mes droits » ; « rien ne change » expliqué (CSG des retraités) ; CSG des pensions :
  les quatre taux ; émissions en millions de tonnes, taxe carburant en € par litre, « 8e dixième » en mots courants.
- 30/10/2026 (soir, suite) : idées toutes prêtes en tête de chaque thème, minimum vieillesse dans « Les retraites » ;
  « ménages types » présentés comme des exemples ; « plutôt négatif » sur le plan social expliqué quand personne n'y perd ;
  fiabilité écrite en toutes lettres sur les cartes des équilibres ; émissions dues au pouvoir d'achat expliquées.
- 30/10/2026 (soir, 2e passage du test Jacqueline : 4 / 3,5 / 4 sur 5) : la réforme reste à côté des résultats sur
  ordinateur ; le bouton flottant s'efface pendant qu'on règle un changement ; « revenus déclarés aux impôts » au lieu de
  « revenu fiscal de référence » ; « Mes droits » : « Ce que le foyer touche chaque mois » (avant les dépenses) et impôt
  avant et après décote.

- 30/10/2026 : la TVA compte dans le pouvoir d'achat des ménages ; la pension alimentaire est demandée aux parents seuls ;
  « Pourquoi aucune aide ? » ; allocation de rentrée scolaire présentée comme annuelle ; bouton « A+ » ; bouton d'avis discret
  (test première visite, Nadia et Bernard).
- 30/10/2026 (suite) : retraite à 62 ans, effets de court et de long terme expliqués sans contradiction ; plafonds du chèque
  énergie et de la C2S calculés pour le foyer ; mise en garde « forfait logement » pour la C2S d'un propriétaire ; foyer exemple
  « Parent seul » ; bouton « Effacer mes réponses » ; message « Encore une étape » plus répété ; « Aides au logement » sans
  sigles.
- 30/10/2026 (suite) : page « Le budget » : déficit expliqué (dépenses moins recettes, à l'arrondi près), ligne « Autres
  dépenses » pour que le détail d'un domaine fasse son total, rubrique « Pourquoi plusieurs totaux sur cette page ? ».
