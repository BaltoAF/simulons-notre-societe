# Pistes d'amélioration

Tenu à jour par la routine quotidienne (charte, règle 6) : ce qu'il reste à faire, ce qui est en test, ce qui est fait.
Chaque piste dit d'où elle vient. Les pistes « à soumettre » relèvent du responsable du projet (charte, règle 5).

## À faire

- **Lexique dans « Mes droits »** (visite du 02/11/2026) : fait pour « foyer » (3 explications de l'impôt) et « CAF »
  (3 encadrés), « RSA » et « APL » (explications des aides). « Tranche » et « quotient familial » n'apparaissent pas
  encore dans les textes de Mes droits. Zone à toucher des liens
  « Explorer les règles → » de l'accueil : faite.
- **Revue qualité du 02/11/2026, points restants** :
  1. Fait le 02/11 : carburants, fioul et gaz comptés ménage par ménage (impacts/prix_energie.py : dépense par décile,
     Insee Budget de famille 2017, ÷ prix de 2017 = quantités ; × hausse de taxe TVA comprise), puis l'électricité
     (dépense de 2017 ramenée aux prix de 2025 par l'indice des prix de l'Insee). Le tabac n'est volontairement pas compté
     ménage par ménage (seule une minorité fume : une moyenne ferait de chacun un perdant) ; piste : répartir la hausse
     sur une part de fumeurs par décile, si une source publique la donne (Santé publique France, Baromètre). Limites : consommation inchangée (effet immédiat), même répartition gazole/essence pour tous, dépense
     moyenne du décile (un ménage rural roule plus qu'un Parisien : Insee, 650 à 1 550 € par an selon le lieu).
  2. Fait le 02/11 (décision du responsable : « les études les plus justes et fiables ») : la répercussion de la TVA
     suit maintenant les études qui portent sur le même cas. Fiche tva_repercussion_prix_taux_normal (Benedek et al.
     2020, zone euro, taux normal, 100 % ; Carare et Danninger 2008, hausse allemande de 2007, 73 %) : 92 % ; fiche
     tva_repercussion_prix_taux_reduits (taux réduits et changements sectoriels) : 50 %. TVA à 21 % : environ −9 € par
     ménage et par mois (contre −5 € avant). La fiche générale tva_repercussion_prix reste la référence d'ensemble.
  3. Santé, déchets (dispositifs réutilisables, recyclage, tri des déchets de soins) : −14 %, −0,07 MtCO2e, 2050.
     Même rapport, p. 21.
  4. Santé, médicaments (autorisation de mise sur le marché tenant compte du carbone, achats, moins de gaspillage) :
     objectif −63 %, −9,6 MtCO2e, 2050. Même rapport, p. 22.
  5. Santé, dispositifs médicaux (marquage CE tenant compte du carbone, réutilisation) : objectif −67 %, −7,2 MtCO2e,
     2050. Même rapport, p. 22.
  6. Industrie, captage et stockage du CO2 : 1 MtCO2/an (ciment) + 2 (chimie) + 4 (sidérurgie), « capacité totale de
     7 MtCO2/an », 2050. « Décarboner l'industrie sans la saborder », rapport final (2021-2022), p. 79 du PDF :
     https://theshiftproject.org/app/uploads/2025/01/PTEF-Decarboner-lindustrie_-Rapport-final.pdf
  7. Industrie, sidérurgie : 20,8 MtCO2e (2016) → 14,1 (2030) → 1,7 (2050), −92 %. Même rapport, tableau 7, p. 39 du PDF.
  8. Industrie, béton moins carboné (ciments pauvres en clinker, normes, critère CO2 dans les marchés publics) : béton
     armé moyen de 251 à 177 (2030) puis 117 kgCO2e/m³ (2050), −53 % ; pas de total en Mt. Même rapport, tableau 9, p. 42.
  9. Aviation, programmes de fidélité : « les émissions d'Air France peuvent être réduites de 0,34 MtCO2 par an en
     baissant de 85 % les Miles » ; pas d'horizon. « Pouvoir voyager en 2050 », avril 2022, p. 81 du PDF :
     https://theshiftproject.org/app/uploads/2025/02/Voyager-Bas-Carbone-RAPPORT-FINAL.pdf
  10. Aviation, emport de carburant pour le vol retour (« tankering ») : la pratique rejette 0,9 MtCO2/an pour toute
      l'Europe (Shift Project et SupAéro Décarbo, 2021), donc un gain possible à l'échelle européenne et non française.
      Même rapport, note 58.
  Vérifié à part (thème « vitesse », donc hors liste) : poids lourds bridés à 80 km/h, « de l'ordre de 1 210 000
  tonnes » de GES évitées par an (390 millions de litres × 3,1 kg), mesure « autofinancée » ; le rapport DGITM cité
  par la même fiche n'en attendait que 580 000. « 80 km/h pour les poids lourds », novembre 2023, p. 5 :
  https://theshiftproject.org/app/uploads/2025/01/TSP_Fiche-fret-V4_PDF.pdf (la piste de 1,21 Mt est donc confirmée).
  Écartés : santé, déplacements (−6,5 MtCO2e, mais le chiffre compte l'électrification des véhicules) et bâtiments
  (rénovation) ; culture, cinémas (unités visiblement fausses dans le rapport) ; administration publique (chiffres en
  images, illisibles). En réserve, des totaux de secteur : fret 41 → 31 MtCO2/an en 2027 puis 1 en 2050 ; secteur
  de l'autonomie −70 % d'ici 2050 (2,9 MtCO2e restantes, rapport d'avril 2024).

## En bêta

- **Garde d'enfants dans « Avez-vous pensé à… ? »** (complément de mode de garde, crédit d'impôt ; depuis le 30/10/2026,
  test Samira). Bilan possible à partir du 13/11/2026.

- **Page « Tester le site en 10 minutes »** (/tester, depuis le 30/10/2026), à envoyer à de vrais testeurs. Bilan possible
  à partir du 13/11/2026 : combien de visites, combien d'avis.

- **« Avez-vous pensé à… ? »**, les aides souvent oubliées dans « Mes droits » (depuis le 30/10/2026). Bilan possible à
  partir du 13/11/2026.

- **Taxe foncière (exonération, réduction de 100 €) et MaPrimeAdapt'** dans « Avez-vous pensé à… ? » (depuis le
  30/10/2026, test débutants : Bernard, 72 ans). Bilan possible à partir du 13/11/2026.

## Fait

- 01/11/2026 (anomalie signalée par le responsable) : « RSA à 800 € » avec ou sans un point de TVA affichaient les
  mêmes « ménages gagnants » (9 %). Pas une erreur de calcul (la TVA était comptée : les perdants passent de 59 % à 91 %),
  mais une tuile trompeuse. La tuile devient « Pouvoir d'achat » : effet moyen par ménage et par mois, TVA comprise
  (+3,6 € contre −1,4 €), avec gagnants et perdants dessous. Un point de TVA coûte environ 6 € par mois à un ménage moyen
  car la fiche tva_repercussion_prix retient une répercussion de 50 % dans les prix.
- 01/11/2026 : taxe carbone sur le chauffage. Nouvelle règle « Accise sur le fioul domestique » (16,66 €/hl depuis
  août 2026, guide 2026 du ministère) ; l'accise sur le gaz de chauffage existait. Effet sur les émissions des logements
  (Citepa : fioul 7,9 Mt, gaz 19,6 Mt) avec les élasticités de long terme de l'Insee (G 2009/08 : fioul −0,20, énergie
  domestique −0,17 appliquée au gaz) et les prix moyens 2025 (fioul 1,1325 €/l TTC, moyenne annuelle publiée par le
  ministère ; gaz 141,4 €/MWh, SDES). Nouvelle solution « pour compenser » : la même hausse par MWh sur le fioul et le
  gaz (environ +27 € par MWh TTC pour 1 Mt). Pas encore chiffré : recettes et coût par foyer.
- 01/11/2026 (demande du responsable) : mise en ligne automatique élargie. Toute branche `claude/…` ou `main-…` du
  dépôt est testée puis fusionnée dans main si les tests passent (mêmes garde-fous : fichiers protégés, pas d'environnement
  ni de dépendances, 200 fichiers au plus) ; le serveur la reprend ensuite.
- 01/11/2026 (demande du responsable) : l'accueil ne pousse plus seulement à « faire son programme » : titre « Réimaginez
  les règles de la France. Voyez la France que ça donne. », bouton « Changer les règles », 3e étape « Une idée ou un
  programme » ; même esprit dans la visite « Découvrir le site en 1 minute ».
- 01/11/2026 : chiffrages de laboratoires d'idées ajoutés à cinq fiches de preuves (documents lus en entier, sources
  `think_tank` sauf mention contraire) :
  - SMIC : OFCE (élasticité de −0,9 retenue dans son modèle, 2012), Institut Montaigne (environ −2 sur le
    « zéro charges » de 2009, 2014), Fondation iFRAP (−0,5 en moyenne pour tous les salaires, valeur laissée vide, 2024).
  - ISF et exil fiscal : départs de redevables selon Coe-Rexecode (2017), Fondation iFRAP (2019), Institut Montaigne
    (2007), Fondation Concorde (2013) et Économistes atterrés (2019) ; ce sont des nombres de départs, sans réaction au
    taux, donc valeurs laissées vides.
  - Vitesse et CO2 : Shift Project, −15 % pour le 110 km/h (−7,5 % pour 10 km/h, en supposant que la vitesse moyenne
    baisse autant que la limite) et −5 % pour des poids lourds bridés à 80 km/h.
  - 35 heures : OFCE, 320 000 emplois (audition de 2014) et Fondation Concorde, 50 000 emplois nets (2003) ; les
    pourcentages (2,5 % et 0,4 %) sont recalculés avec le dénominateur déjà utilisé par la fiche, et la note le dit.
  - Retraite et emploi des seniors : aucun laboratoire d'idées ne publie d'estimation propre ; l'OFCE et l'iFRAP
    reprennent l'Insee. Ajoutés à la place : Insee Analyses n° 30 (+16 à +17 points à 60 ans, statistique publique) et
    rapport n° 61 de l'Institut des politiques publiques (+20 à +25 points entre 60 et 62 ans, document de travail).

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
