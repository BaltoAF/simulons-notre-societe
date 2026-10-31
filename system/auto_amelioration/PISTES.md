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
  - Garde d'enfants : deux fiches ajoutées dans « Avez-vous pensé à… ? » (complément de mode de garde, réforme de 2025
    et parent seul jusqu'aux 12 ans ; crédit d'impôt de 50 %). Reste : le calcul par le moteur (heures, coût horaire).
  - Complémentaire santé solidaire : fait (31/10/2026), la fiche donne les deux plafonds du foyer (gratuite, et à moins de
    1 € par jour) et plus ceux d'une personne seule.
  - Arrondis (200,78 € × 2 ≠ 404 €, 429 € / 426,87 €).
  - Lexique fait (cotisations salariales et patronales, pension de réversion, BMAF, juge aux affaires familiales). « Et vous ? » donne aussi
    l'équivalent par mois.
- **Test Samira, 2e passage** (notes 4 / 3 / 4). Corrigé : « rien ne change » quand deux effets s'annulent (allocations
  +15 €, prime d'activité −15 €) dit maintenant ce qui bouge ; règles en % de la BMAF traduites en euros par mois ;
  loyer « hors charges, avant que l'aide en soit retirée » ; pension alimentaire mentionnée dans la prime d'activité ;
  Pajemploi et les 15 % expliqués ; « CSG et CRDS » et cotisations reliées au lexique. Fait ensuite : « Allocations
  familiales dès le premier enfant (77 € par mois) », dispositif proposé (règle virtuelle, coût simulé 9 Md€ par an ;
  limite : sans effet ici sur la prime d'activité et le RSA). Reste : CO₂ « à compenser » pour une hausse d'allocations, à expliquer.
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
    déploiement sans coupure (deux conteneurs, bascule quand le nouveau est prêt) l'éviterait. À soumettre au responsable.
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
