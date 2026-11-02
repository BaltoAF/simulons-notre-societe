# Pistes d'amélioration

Tenu à jour par la routine quotidienne (charte, règle 6) : ce qu'il reste à faire, ce qui est en test, ce qui est fait.
Chaque piste dit d'où elle vient. Les pistes « à soumettre » relèvent du responsable du projet (charte, règle 5).

## À faire

- **Liens « Explorer les règles → » de l'accueil** (visite du 02/11/2026) : 20 px de haut sur téléphone ; agrandir leur zone à
  toucher comme pour le pied de page. Lexique : relier les mots foyer fiscal, tranche, quotient familial, RSA, APL, CAF aux
  textes de « Mes droits » avec le composant `Terme`.
- **Revue qualité du 02/11/2026, points restants** :
  1. Carburants, chauffage et tabac ne comptent pas dans les gagnants/perdants (la TVA, si) : les compter, ménage par ménage,
     avec la consommation par décile (Insee, Budget de famille).
  2. Répercussion de la TVA dans les prix : la synthèse (≈ 50 %) mêle taux réduits, baisses sectorielles et taux normal.
     Benedek et al. (2020) trouvent ≈ 100 % pour le taux normal, ≈ 30 % pour les taux réduits ; Benzarti et al. (2020),
     environ deux fois plus pour les hausses que pour les baisses. Piste : une synthèse par type de taux (à soumettre).
     Vérifié le 02/11 : « TVA à 21 % » = −5 € par ménage et par mois est cohérent avec la méthode (les ménages paient environ
     la moitié de la TVA, le reste par les administrations, le logement neuf… ; × 50 % répercutés) ; pauvreté et inégalités
     quasi inchangées car l'effet est presque proportionnel au revenu.

- **Emploi et RSA (vérifié le 01/11/2026)** : −268 000 emplois pour un RSA à 800 € = 0,25 (élasticité de participation,
  synthèse de la fiche offre_travail_marge_extensive, surtout des études américaines) × −22,7 % de gain à travailler au SMIC ×
  4,73 M de foyers de la prime d'activité (hypothèse haute écrite dans le code). Fourchette des études : de −751 000 à
  +43 000. Fait : le tableau de pilotage affiche la fourchette et « effet incertain » quand elle contient zéro. Reste :
  affiner la population (tous les foyers de la prime d'activité ne sont pas à la marge : chercher la répartition officielle
  des bénéficiaires par revenu d'activité, Cnaf ou DREES) et pondérer le gain par cette répartition plutôt que 30 % / 70 %.
- **Tableaux de bord partout : les chiffres d'abord, le texte sur demande** (demande du responsable, 01/11/2026 : « chaque
  visiteur est un futur président ; il a besoin de vraies informations de pilotage »). Fait sur « Les propositions » et la
  page d'une proposition (composant `TableauDeBord`, indicateurs gardés par `backend/app/indicateurs.py`). À généraliser,
  page par page (même composant, mêmes cinq indicateurs et mêmes unités quand il s'agit d'une réforme) :
  - *Accueil* (≈ 1 100 mots, 4 300 px) : en tête, « La France aujourd'hui » en cinq tuiles (solde public, pauvreté,
    chômage, émissions, dette ; `indicateurs.situation_actuelle`, sans simulation), puis les deux boutons. Replier le long
    paragraphe d'accroche en une phrase ; les trois cartes « 1. Réimaginez / 2. Équilibres / 3. Programme » en une ligne
    ou un « Comment ça marche ? » ; les propositions récentes affichées avec leurs tuiles plutôt qu'en texte.
  - *Atelier, résultats* : « Ses effets » commence par les cinq tuiles (mêmes que la liste, calculées par le même
    `indicateurs.extraire` sur le rapport déjà reçu), puis l'équilibre à atteindre (manque en Md€ et en Mt) ; « En bref »,
    les explications du foyer et les sections détaillées repliées sous « Voir le détail ». Le texte d'introduction
    (4 lignes) tient en une ligne.
  - *Comparer* : deux colonnes de tuiles alignées (A, B, écart B − A), avant la liste des règles différentes : c'est
    l'usage « cockpit » le plus direct, et les chiffres sont déjà en cache pour la branche principale.
  - *Mes droits, résultat* : une rangée « Ce qui vous reste par mois / aides / impôt / cotisations » en tuiles, puis le
    détail ligne à ligne replié ; les cartes de foyers types (texte long dans chaque carte, 5 cartes de hauteur inégale)
    réduites au titre, le descriptif au survol ou en petit.
  - *Le budget* (≈ 960 mots) : au-dessus de « Sur 100 € », quatre tuiles (dépenses publiques totales, recettes, solde,
    dette en % du PIB, avec leur année) ; « Et vous ? » et l'éditeur du budget de l'État restent dessous, les explications
    de méthode repliées.
  - *Comprendre* : chaque carte de question porte son chiffre clé en grand, tiré des métriques (dépenses publiques en
    % du PIB, taux de pauvreté, émissions en Mt CO₂…) et une seule phrase ; le texte de deux à quatre lignes passe dans la page de la question.
  - *Une règle* (`/regles/r/…`) : valeur actuelle, dernière évolution et fiabilité en tuiles, l'historique et les sources
    repliés.
  Vérifier à 390 px à chaque fois ; tuiles plates, sans bordure (règle « un même aspect, un même comportement »).
- **Tableau de bord, suite** : sur la liste, trier ou filtrer par indicateur (« les moins coûteuses », « celles qui
  réduisent la pauvreté ») ; afficher l'état d'équilibre (« financement à trouver : X Md€ ») quand `finances.statut`
  vaut `a_compenser` ; les variantes (branches) n'ont leurs chiffres que sur la page de la proposition.

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
  - Garde d'enfants : deux fiches ajoutées dans « Avez-vous pensé à… ? » (complément de mode de garde, réforme de 2025
    et parent seul jusqu'aux 12 ans ; crédit d'impôt de 50 %). Fait (31/10/2026) : carte « Faire garder votre enfant »
    (heures et coût, CMG réformé et crédit d'impôt ; voir test Lucie).
  - Complémentaire santé solidaire : fait (31/10/2026), la fiche donne les deux plafonds du foyer (gratuite, et à moins de
    1 € par jour) et plus ceux d'une personne seule.
  - Fait (31/10/2026) : arrondis (200,78 € × 2 ≠ 404 €, 429 € / 426,87 €). Le moteur comptait les prestations familiales
    avant la CRDS de 0,5 % ; elles sont désormais nettes, comme les montants publiés (voir test Mehdi).
  - Lexique fait (cotisations salariales et patronales, pension de réversion, BMAF, juge aux affaires familiales). « Et vous ? » donne aussi
    l'équivalent par mois.
- **Test Samira, 2e passage** (notes 4 / 3 / 4). Corrigé : « rien ne change » quand deux effets s'annulent (allocations
  +15 €, prime d'activité −15 €) dit maintenant ce qui bouge ; règles en % de la BMAF traduites en euros par mois ;
  loyer « hors charges, avant que l'aide en soit retirée » ; pension alimentaire mentionnée dans la prime d'activité ;
  Pajemploi et les 15 % expliqués ; « CSG et CRDS » et cotisations reliées au lexique. Fait ensuite : « Allocations
  familiales dès le premier enfant (77 € par mois) », dispositif proposé (règle virtuelle, coût simulé 9 Md€ par an ;
  limite : sans effet ici sur la prime d'activité et le RSA). CO₂ « à compenser » pour une hausse d'allocations : expliqué dans la carte « Le climat » (31/10/2026).
- **Test Gérard** (58 ans, ouvrier, méfiant envers les chiffres ; notes 4 / 3 / confiance 2 sur 5, 30/10/2026). Corrigé :
  une proposition affichait une TVA « changée automatiquement (la loi a changé) » alors que c'était le choix de son auteur
  (les mises à jour automatiques sont ignorées dans la provenance) ; « Nos chiffres sont-ils justes ? » dit pourquoi un
  verdict est « concordant » (fourchette officielle, ou moins de 0,2 Md€ d'écart) et l'écart en mots ; l'accord entre
  études se mesure sur un seuil d'effet négligeable quand la question en définit un (immigration et salaires : 4 % → 60 %) ;
  « grandes questions » de l'accueil renommées « sujets étudiés ». Fait ensuite (décisions du responsable, 31/10/2026) :
  grande question « L'immigration : que disent les chiffres ? » « avec prudence » (Insee, OCDE citée par la Cour des comptes,
  Sénat ; relue par deux lecteurs opposés ; absente de l'accueil) ; fiabilité « élevée » à partir de 65/100 ; « Qui fait ce
  site ? » reste anonyme, et l'IA n'y est nommée que dans le texte, pas en titre (le sujet clive) ; « Vrai ou faux » d'autres
  bords (impôt payé par les plus aisés, impôt sur les sociétés) ; idées de l'accueil et de l'atelier équilibrées (retraite à
  62 et à 65 ans, impôt en plus et en moins, une dépense sociale et une économie). Reste :
  - « Comprendre » : encadré « Ce qui fait débat » fait pour les dix questions (« Qui paie ? », dette, retraites, dépenses
    publiques, SMIC, climat, immigration, inégalités, école, santé ; 31/10/2026, chacun relu :
    deux positions de même longueur, une vraie alternative, l'argument le plus fort de chaque côté ; retraites : trois leviers, avec « augmenter moins les pensions »). Reste : la comparaison avec la
    Défense à sourcer.
  - Immigration, sans source vérifiée pour l'instant : le solde équivalent des personnes nées en France (OCDE), les enfants
    d'immigrés, l'immigration irrégulière, les motifs d'entrée.
- **Test Nadia** (47 ans, aide à domicile, téléphone seul, méfiante envers les sites « qui veulent vous faire penser
  quelque chose » ; notes 3 / neutralité 3,5 / téléphone 4 sur 5, 31/10/2026). Corrigé : « Votre réforme est
  équilibrée » lu comme une approbation (→ « Les comptes tiennent ») ; « rien ne change » au-dessus d'un départ à la
  retraite repoussé ; case Social muette sur ce que vivent les personnes concernées ; « ≈ » et parts de PIB avant les
  euros ; « voir l'effet à long terme » introuvable ; « En bref » immigration en euros et « Ce qui fait débat » ;
  « En bref » de la dette qui répondait au débat ; actions d'un seul camp ; exemples de la visite et de l'accueil d'un
  seul bord (nouvel exemple « Travailler plus longtemps, moins d'impôts ») ; « le site tranche » contredit par « le site ne
  tranche pas » ; espaces insécables (lib/typo.ts) ; zones à toucher. 2e passage (notes 4 / 4 / 4) : mots du lexique
  dans « À savoir » (« au sens du BIT »), guillemets compris dans le mot expliqué, liens du pied de page espacés, case
  Social neutre, même temps grammatical des deux côtés du débat immigration, attente au redémarrage annoncée (deux à
  trois minutes, et message après 20 s) et vrai temps d'attente affiché. Reste :
  - **Après chaque mise à jour, le premier calcul attend le chargement du moteur (environ 2 min 30 mesurées)** : seul un
    déploiement sans coupure (deux conteneurs, bascule quand le nouveau est prêt) l'éviterait. Réponse du responsable (01/11/2026) : un plus, pas une obligation ; à faire seulement si le reste est à jour.
  - Fait ensuite : « Ce que vous changez » au lieu de « Votre réforme », dernière étape « Partager, si vous le voulez »,
    âge affiché pour les foyers types, bouton flottant masqué pendant le calcul ; enregistrer dans une carte « Partager,
    si vous le voulez » après les résultats (2026-10-31 ; le cas « À surveiller » n'avait pas de bouton du tout).
  - Fait : « 8,2 tonnes » comparé à 1990 (premier point de la série SDES) ; « Légifrance, JO, BOFiP » en mots courants ;
    « A+ » nommé « Agrandir le texte » dans le menu du téléphone.
  - Pendant le calcul, le bouton flottant « Voir les effets » cache le choix du foyer type.
  - Climat : l'action « baisse de la taxe sur le gazole » ne correspond pas tout à fait à la position « innovation et aides ».
- **Test Inès** (20 ans, apprentie en BTS à 900 € nets, studio à 450 €, téléphone ; notes 3 / utilité 2 / téléphone 3,5
  sur 5, 31/10/2026). Corrigé : statut « Apprenti(e), en alternance » (le moteur applique le plancher de la prime
  d'activité des apprentis : le site lui annonçait 243 € comme salariée ; tests/test_apprenti.py), plus de bourse du
  Crous proposée, impôt à 0 expliqué par l'exonération des apprentis, salaire gardé quand on change de statut, seuil de
  la prime d'activité en euros, case « mes parents me comptent… » expliquée, 4 idées à tester puis « Voir les autres »,
  durée du calcul annoncée. Reste :
  - **Exonérations des apprentis** (service-public F2918) : contrats depuis le 1er mars 2025, cotisations salariales et
    CSG-CRDS exonérées jusqu'à 50 % du SMIC, impôt jusqu'au SMIC annuel ; avant, 79 % et CSG-CRDS exonérée. OpenFisca ne
    les modélise pas : le site le dit (Mes droits, Votre part), les cotisations affichées sont trop élevées.
  - Aide au logement : fait. « Seuls vos revenus d'apprentissage au-delà de 20 815 € par an sont pris en compte » (caf.fr,
    Caf de Paris) ; le moteur reçoit le salaire imposable d'un apprenti (part au-delà du SMIC) et le net saisi : impôt nul et
    aide au logement de 308 € pour Inès (156 € avant). Reste : exonération de cotisations et de CSG-CRDS jusqu'à 50 % du SMIC.
  - Fait : le minimum d'un apprenti de son âge est donné à côté du SMIC (de 16 à 25 ans, règles travail.apprentissage.*).
  - Formulaire : « Suivant » hors de l'écran sous les exemples ; « en 3 questions » (trois étapes) ; étiquettes des champs
    pour les lecteurs d'écran ; « Impôts rendus aux contribuables » (budget) ; recherche de règles serrée sur téléphone.
- **Test Karim** (46 ans, au chômage depuis 7 mois, marié, femme à temps partiel, 2 enfants, HLM ; notes 3 / utilité 2 /
  téléphone 3 sur 5, 31/10/2026). Corrigé : encadré « Et après le chômage ? » dans Mes droits (fin des droits, reprise
  d'un emploi à X €, calculés à la demande, avec la mention de l'ASS et du décalage de trois mois) ; allocation de
  rentrée annoncée « une fois par an, fin août » ; salaires d'un couple détaillés ; idées triées selon le foyer ;
  « ±0 € » expliqué ; tableau du foyer empilé sur téléphone ; aides sur « avis d'échéance » et « grande ville ». Reste :
  - Fait : ASS calculée par le moteur dans « Et après le chômage ? » quand la personne coche la condition (5 ans de travail
    au cours des 10 dernières années ; tests/test_ass.py). Fait aussi : reprise d'un emploi en gardant une partie de
    l'allocation (70 % du salaire brut déduit, règle travail.chomage.cumul_part_salaire_deduite ; plafond du salaire de
    référence non appliqué ; tests/test_cumul_chomage.py). CSP : examiné, à accepter avant le licenciement (délai de 21 jours, service-public F13819) ; sans objet pour une
    personne déjà au chômage, donc pas de fiche.
  - Fait : « Prime d'activité : 0 € » avec sa raison quand un membre du foyer travaille (allocation chômage du foyer,
    plancher des étudiants et apprentis, ou revenus au-dessus du plafond).
  - Lenteur : fait, revenir sur « Mes droits » avec la même situation affiche le résultat gardé (60 ms au lieu de 5 à 10 s).
    Fait aussi : dans l'atelier, l'ancien résultat reste visible, grisé, pendant un nouveau calcul.
- **Test Monique** (63 ans, veuve, retraitée depuis un an, propriétaire, tablette ; notes 3 / 3 / confiance 3 sur 5,
  31/10/2026). Corrigé : le gel des pensions expliqué (« un gel ne baisse pas la pension : elle n'augmente pas »), le
  « ±0 » d'une mesure de CSG dit le taux de la personne, « soumise à la CSG à le taux » → « au taux », taux fixé d'après le
  revenu fiscal d'il y a deux ans, réversion dans l'aide à la saisie, zone demandée aux seuls locataires, minimum
  vieillesse « en principe à 65 ans », questions de retraitée dans « Vos droits au-delà de l'argent » (revalorisation, plus
  d'âge de départ ni de chômage), paradoxe de la pauvreté expliqué dès que des ménages perdent, « 1,6 milliard »,
  écarts en euros ronds dans le tableau du foyer, « Tester le gel des pensions » sur la page retraites, marge du débat,
  « trois étapes » dans la visite. Reste :
  - Fait : demi-part des personnes seules qui ont élevé seules un enfant 5 ans (case L, OpenFisca caseL ; tests/test_case_l.py).
    Les veuves sans personne à charge n'ont pas de demi-part propre (sauf cas particuliers) : pas de case « veuve » ajoutée.
  - Calculs d'idées parfois longs (20 à 100 s mesurées) : cause trouvée le 31/10/2026. Avec SOCIETE_WORKERS=1, tous les
    calculs passent par le même verrou du moteur (Engine._lock) : un calcul d'un seul foyer (2 à 5 s) attend la fin d'un
    calcul de population (10 à 80 s). Remède : un processus à part pour les calculs de population (plus de mémoire) ;
    **à soumettre au responsable** avec la mise à jour sans coupure (même arbitrage mémoire / attente).
  - Fait : « 2 % des ménages y gagnent » expliqué (revenus qui passent sous un seuil : taux de CSG, aides) ; le mécanisme
    exact ménage par ménage reste à vérifier.
  - Taxe foncière : pistes selon l'âge et les revenus (exonération à 75 ans déjà dans « Avez-vous pensé à… ? »).
  - Taille des petits textes (jauge « Où vous situez-vous », aides des champs) même avec « A+ ».
- **Test Josiane** (55 ans, aide-soignante de nuit, divorcée, fils étudiant de 19 ans, téléphone seul, première visite ;
  notes prise en main 4 / compréhension 3 / téléphone 4 / confiance 3 sur 5, 31/10/2026). Corrigé : allocation de soutien
  familial annoncée « d'après la pension que vous avez indiquée » alors que le champ était vide (question oui / non
  désormais obligatoire pour un parent seul, « jusqu'aux 20 ans ») ; enfant majeur expliqué ; aides de saisie hors champ
  sans style ; « la dette explose ? » : repères Insee depuis 1980 (21,3 %, 65,5 % en 2007, bond du Covid) et intérêts en
  part du PIB (3,6 % en 1996, 1,5 % en 2019, 2,2 % aujourd'hui, Eurostat) ; « les retraites coûtent trop cher ? » :
  11,8 % du PIB en 2002 (COR) et comparaison Eurostat (France 15 %, UE 12,6 %, Allemagne, Espagne, Italie) ; « 7 cotisants
  pour 4 retraités » en tuile ; ton de la page dette (« ni l'école ni l'hôpital ») ; « il n'y a que trois leviers » ;
  « Et vous ? » vers ce que paie la personne ; 25 € / 26 € sur 100 € expliqué ; atelier : effet durable sur l'activité
  d'abord et sens contraire dit, financement « pas encore choisi » sous « rien ne change », case Social d'un âge de
  départ ; départs anticipés (nuit, pénibilité, catégorie active) ; découverte : la règle vérifiée suit le profil, compteur
  « missions » distinct des étapes de l'atelier ; mois de naissance : lien ; page du SMIC : montant mensuel brut et net
  d'un temps plein, « le moteur de calcul public OpenFisca » sans numéro de version. /budget sur téléphone : « Et vous ? »
  remonté juste après « Sur 100 € » (2e écran au lieu du dernier), cinq domaines du budget de l'État d'abord, cadenas
  repliés (7,4 → 6,7 écrans). Reste :
  deux exemples de propositions sur trois « solidaires ». Fait : chaque solution de financement a son avantage et son
  inconvénient (les économies n'en avaient pas). Reste : une solution « revenus du capital » (le taux de la flat tax,
  fiscalite.capital.pfu_taux_ir, est un levier du moteur), à ajouter quand son rendement sera calé sur une source
  officielle (la population simulée représente mal les revenus du capital).
- **Demandes du responsable (31/10/2026)** : avis « sur cette page » avec l'endroit montré (colonne `endroit`) ;
  « Changer les règles » au premier plan, message « Réimaginez les règles de la France. Faites-en votre programme »
  (accueil, menu, visite, missions, atelier) ; « Proposer un changement » à la proposition de quelqu'un en un parcours ;
  page des propositions expliquée (partir d'un modèle, comparer, suggérer ; exemple d'un parti et de ses adhérents).
  Climat : neuf solutions pour compenser au lieu de trois (gazole et essence ensemble ; leviers
  environnement_energie.leviers.* : rénovation 250 €/t, fin du fioul 140 €/t, voitures électriques 270 €/t
  — France Stratégie, coût payé par l'État et à financer — et engrais azotés, jusqu'à 5,3 Mt, Inra) ; « Et planter des
  arbres ? » expliqué (budget carbone hors forêts et sols, décret n° 2026-636). Taxe carbone sur le chauffage : faite le 01/11/2026 (voir « Fait »). Reste : ses
  recettes pour l'État et son coût foyer par foyer (volumes de fioul et de gaz des logements à sourcer) ; fret ferroviaire et aviation (pas de coût par tonne officiel trouvé) ; le nom « modèle de
  société » à l'écran (question posée au responsable).
- **Test Odette** (74 ans, veuve, retraitée à 1 280 €, propriétaire, tablette, très peu à l'aise ; notes prise en main 3 /
  compréhension 2,5 / confiance 3 / tablette 3 sur 5, 31/10/2026). Corrigé : « environ  % » sur la liste des grandes
  questions (chiffre calculé non pris en charge) ; page « Oups » après une mise à jour (fichier de l'ancienne version
  introuvable : rechargement automatique, une fois) ; « calcul… » sans fin dans les idées de Mes droits (message après
  20 s) ; gel des pensions lu comme une baisse (« 8 € de moins que prévu », sans rouge, et une phrase sous le tableau du
  foyer) ; « Ma retraite va-t-elle baisser ? Non… » au lieu de « revalorisées » ; sous le seuil de pauvreté, une note
  douce et à qui s'adresser (CCAS, France services, caisse de retraite ou CAF) ; « Je l'ai déjà » pour masquer une piste
  (réversion déjà touchée) ; « Agrandir le texte » dès le premier écran de la visite ; premier choix de « Par où
  commencer ? » dans ses mots ; mission suivante en vrai bouton ; « Votre pension » qui comptait l'épargne. Fait ensuite :
  sigles des fiches dits en clair (Anah, hors taxes, MSA, accompagnateur, revenu fiscal de référence) ; pour un
  retraité, la mission « Comprendre une grande question » mène aux retraites. 2e passage (notes 4 / 3,5 / 4 / 3) :
  corrigé ensuite le bloc du foyer d'un gel (« 8 € de moins que prévu », « Avec la hausse prévue / Sans la hausse », aussi
  dans le résultat partiel), boutons « small » à 44 px au doigt, « Ne plus afficher » écarté de la mission, règle sans
  sigles pour un retraité (la hausse des pensions), « Voir l'autre source », « Effacer » caché pendant le calcul,
  bouton « Agrandir le texte » qui dit son état. Reste : sigles dans le résumé de Mes droits (CSG, TVA) et sur la page
  retraites (PIB, DREES) ; « −0,9 point » dans l'atelier pour un gel. Fait (01/11/2026) : un gel s'affiche « gel (au lieu de
  +0,9 %) » et une autre revalorisation « +0,5 % au lieu de +0,9 % » ; DREES et COR expliqués au toucher dans « Comprendre »
  (PIB, CSG et TVA l'étaient déjà).
- **Relecture de neutralité, deux regards opposés** (31/10/2026 ; notes « Bernard », à droite, 3,5 / « Inès », à gauche, 4
  sur 5 ; débats tous à ±10 %). Corrigé : immigration (solde dans l'ordre croissant, « dépenses communes : défense,
  intérêts de la dette, administration », position « Oui » appuyée sur les chiffres de la page, ordre de grandeur des
  coûts, « même » retiré) ; inégalités (« revenus de l'épargne », coût des aides dans le « Non », un test de chaque bord) ;
  qui paie (capital taxé à taux fixe, cotisations patronales et impôts de production) ; dépenses (accroche neutre,
  « l'équivalent de 57 % du PIB » expliqué, réserve public/privé, « 8 points de plus que la moyenne européenne » dans le
  « Oui ») ; dette (intérêts entre 1,5 % et 3,6 % du PIB, « baisse d'impôt » aussi à financer). Fait ensuite : « qui paie
  selon le revenu » (47 % des foyers paient l'impôt sur le revenu, les 10 % les plus aisés près des trois quarts : DGFiP ;
  taux global de 46 % pour les 0,1 % les plus riches mais 26 % pour les 75 plus fortunés : IPP, 2016) ; patrimoine dans
  « Inégalités » (47,9 % aux 10 % les mieux dotés, 7,2 % à la moitié la moins dotée : Insee) ; Gini comparé à l'Europe
  (Eurostat ilc_di12). 2e passage (notes 3,5 / 4) : tout réglé ; corrigé ensuite : « Non, pas moins » avec un fait
  chiffré (autre convention de l'OCDE), « ordre de grandeur » relativisant retiré, emploi des hommes immigrés (sans
  source) retiré, « l'impôt sur le revenu en rapporte environ 8 % » (calculé : recettes de l'impôt sur le revenu ÷ impôts et cotisations), positions de « Qui paie ? » au même mode et à la
  même longueur, une seule réserve sur les comparaisons de dépenses, Défense « votée pour 2026 », solde et projections
  du COR sur la page retraites. Reste à sourcer : la TVA plus lourde, en proportion, pour les ménages modestes (Insee ou
  CPO) ; le détail du tableau « Sur 100 € » ; les études France Stratégie et Cepii citées (liste « études citées ») ; le
  niveau de vie des retraités « proche » de l'ensemble (Drees, COR). Fait : « D'où viennent ces chiffres ? » sous chaque
  grande question, avec la source exacte du point cité (une année ancienne peut venir d'une autre publication).
- **Comparaisons européennes** (31/10/2026) : chaque grande question chiffrée situe la France dans l'Union, avec la
  mesure commune d'Eurostat (dette et intérêts, retraites, impôts et cotisations, dépenses publiques, chômage, santé,
  enseignement public, émissions par habitant ; model/metriques/europe.yaml et sources/comparaisons.yaml). Pas de
  moyenne européenne des émissions par habitant : Eurostat ne la publie pas sur le même champ. Reste : PISA comparé à
  la moyenne de l'OCDE (le site de l'OCDE refuse les robots) ; mise à jour annuelle de ces séries.
- **Josiane, 2e passage** (notes compréhension 4 / confiance 4 / neutralité 4,5 / téléphone 4 sur 5, 31/10/2026).
  Réglés : pension alimentaire, allocation de soutien familial, enfant majeur, dette, retraites, financement. Corrigé
  ensuite : la case Économie ne comptait que l'effet à court terme (le filtre du bilan ne retenait que « pib » exact) ;
  compte de prévention réservé au privé, catégorie active « cinq ans avant l'âge légal, après 17 ans » ; message
  d'attente réaliste après 20 s dans Mes droits ; « missions » sur l'accueil ; fiche ASF selon la réponse et « s'arrête
  dans moins d'un an » à 19 ans ; bouton flottant de l'atelier qui couvrait « modifier » ; « payées surtout par les
  cotisations, et pour une part par des impôts ». Ajouté : comparaisons Eurostat des impôts et cotisations (France
  46,0 % en 2025, UE 40,7 %) et des dépenses publiques (57,3 %, 2e derrière la Finlande). Fait ensuite : thème de
  chaque règle générée (la prime d'activité affichait « RSA ») ; sources triées (textes de la valeur en vigueur
  d'abord, OpenFisca en dernier) et repliées au-delà de quatre ; historique sans « OpenFisca-France 176.1.10 ». Vérifié :
  « Défense (66 milliards €) » = crédits de paiement de la mission votés en LFI 2026 (66,475 Md€, dépenses de personnel
  comprises) ; la comparaison avec les intérêts tient sur ce périmètre.
- **Test Mehdi** (38 ans, père seul, enfants de 4 et 9 ans, 1 900 € nets, assistante maternelle 60 h pour 330 €, envisage
  les 80 % ; notes clarté 4 / confiance 3 / téléphone 4 sur 5, 31/10/2026). Ses deux questions trouvées sans effort.
  Corrigé : un calcul de l'ancien foyer, lancé à l'arrivée puis abandonné pour « Modifier ma situation », s'affichait sous
  la nouvelle situation et bloquait « Calcul… » (numéro de calcul dans MesDroits) ; garde : « Chaque mois, vous payez »
  puis le crédit d'impôt de l'année suivante (un seul reste à charge trompait sur la trésorerie), « avant l'aide de la
  CAF (même avec Pajemploi+) », revenus retenus expliqués, arrondis qui tombent juste ; carte 80 % : délais des seules
  aides du foyer et renvoi vers la garde ; totaux faits des lignes arrondies (« 857 € » pour 858) ; aide propre à
  chaque zone ; « en 3 étapes ». Prestations nettes de CRDS (0,5 % sur la prime d'activité et les prestations
  familiales, que le moteur comptait brutes) : l'ASF tombe sur les 200,78 € par enfant de service-public. Le
  « 275 € » de CMG recalculé par le testeur était une erreur de sa part (60 h × 5,50 € × (1 − 1 767 × 0,0516 % ÷ 4,91)
  = 269 €).
- **Test Lucie** (31 ans, pacsée, deux salaires, bébé de 8 mois chez une assistante maternelle, locataire ; notes 3 /
  utilité 2 / téléphone 4 sur 5, 31/10/2026). Corrigé : « Pourquoi aucune aide ? » donne la raison aide par aide (un seul
  enfant : pas d'allocations familiales, quel que soit le revenu) ; PAJE affichée à 0 € avec sa raison (revenus d'il y a
  deux ans) ; âge des enfants vide (un 5 prérempli passait inaperçu), « 0 pour un bébé », « moins d'un an » dans le résumé ;
  « il reste … hors frais de garde » et « non compté : aides à la garde » ; crédit d'impôt garde avec son plafond (1 750 €
  par enfant, après l'aide de la CAF) ; aide « Net à payer avant impôt » ; 0 € plus en vert ; écart d'une règle en bleu
  dans les deux sens (une hausse en rouge se lisait comme une perte) ; « depuis 1945 » retiré des dispositifs proposés. Reste :
  - ~~Coût de la garde et CMG~~ : fait (2026-10-31). Carte « Faire garder votre enfant » dans Mes droits : heures et
    somme versée à l'assistante maternelle → CMG réformé au 1er septembre 2025 (décret 2025-515, coût de référence et
    plafond horaire Urssaf avril 2026, plancher CAF 2026), crédit d'impôt et reste à charge ; règles dans
    `model/regles/prestations/garde_enfants.yaml`, calcul dans `frontend/src/lib/garde.ts` (retrouve l'exemple Urssaf :
    2 000 € de ressources, 160 h à 4,91 € → 587,52 €). Reste : la garde à domicile (taux d'effort doublés, 10,50 € de
    référence) et la crèche ; les ressources sont estimées d'après les revenus actuels (la CAF prend ceux d'il y a 2 ans).
    Un site tiers dit le plafond horaire resté à 8 € en avril 2026, l'Urssaf dit 8,09 € : à revérifier à la prochaine
    revalorisation.
  - ~~Comparer avant/après~~ : fait (2026-10-31), carte « Et si votre situation changeait ? » (un enfant de plus, temps
    partiel à 80 %) ; les écarts s'écrivent « 77 € de moins » (« Impôt +77 € » se lisait comme une hausse d'impôt).
    Prime à la naissance et PreParE citées avec leurs montants Service-public (`model/regles/prestations/naissance.yaml`),
    sans calcul (OpenFisca a `paje_naissance` et `paje_prepare`). L'écart apparent avec la BMAF venait de la CRDS :
    les montants publiés sont nets (171,42 € = 0,3603 × 478,16 € × 0,995).
- **Si la fréquentation augmente** (à soumettre au responsable) : la mémoire est déjà protégée, car un seul calcul de
  population tourne à la fois (`SOCIETE_WORKERS=1`) et les résultats identiques sont gardés en cache. Seule l'attente
  s'allonge : passer alors au VPS-2 avec `SOCIETE_WORKERS=3`, ou dire au visiteur combien de calculs passent avant le sien.
- **Laboratoires d'idées, ce qui n'a pas été trouvé** (recherche du 01/11/2026) : aucun chiffre utilisable de Terra
  Nova, de la Fondation Jean-Jaurès, de l'Institut Rousseau ni de Fondapol sur ces cinq fiches. Terra Nova et l'Institut
  Montaigne ne font que reprendre les 350 000 emplois des 35 heures ; l'Institut Montaigne reprend le CGDD sur le
  110 km/h (et cite 500 € par tonne de CO2 évitée, d'après Christian Gollier) ; Coe-Rexecode et l'iFRAP ne chiffrent pas
  l'emploi créé par les 35 heures ; I4CE et l'Ifrap ne chiffrent pas le CO2 des limitations de vitesse. Sur l'exil
  fiscal, les chiffrages viennent surtout de laboratoires libéraux ou proches des entreprises. Pistes restantes :
  retrouver les Revues de l'OFCE n° 64 (1998) et n° 74 (2000) sur les 35 heures (introuvables en ligne) et une étude
  de la Fondation Concorde de 2007 sur l'ISF (lien mort).
- **Catalogue de mesures chiffrées du Shift Project** (« Plan de transformation de l'économie française », PTEF ; relu
  le 01/11/2026, à ne pas intégrer au simulateur sans décision du responsable). Hors carburants, vitesse sur autoroute,
  rénovation, pompes à chaleur, voiture électrique et engrais. Les chiffres sont ceux du Shift Project (laboratoire
  d'idées) ; « objectif » signale une cible plutôt qu'un chiffrage de mesure.
  1. Santé, alimentation en restauration collective (moins de gaspillage, repas végétariens, moins d'emballages) :
     −48 % des émissions des achats alimentaires, −2,8 MtCO2e, horizon 2050. « Décarboner la santé pour soigner
     durablement », v2 avril 2023, tableau p. 20 du PDF :
     https://theshiftproject.org/app/uploads/2025/01/180423-TSP-PTEF-Rapport-final-Sante_v2.pdf
  2. Santé, gaz médicaux (interdire les gaz anesthésiants à fort effet de serre, inhalateurs à poudre sèche) : −75 %,
     −0,4 MtCO2e, 2050. Même rapport, p. 21.
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
