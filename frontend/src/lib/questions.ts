// « Les grandes questions » : comprendre la France en quelques chiffres officiels, expliqués simplement.
// Les chiffres ne sont pas écrits ici : chaque question cite des statistiques du modèle (model/metriques) ou des règles,
// lues au moment de l'affichage avec leur source. Le texte les reprend par leur clé : {dette}, {interets}…
import { anEtMois, euros, nombre } from './format'
import { milliards, tonnes } from './humain'

export type Format = 'md' | 'pct' | 'pct_pib' | 'pct_pib_signe' | 'eur' | 'eur_rond' | 'eur_mois' | 'personnes' | 'mt' | 't_hab' | 'ans' | 'ratio' | 'gini' | 'heures' | 'entier'

/** Un chiffre : une statistique (metrique), une règle (regle), ou un calcul à partir des autres chiffres. */
export type Chiffre = {
  cle: string
  libelle: string
  format: Format
  metrique?: string
  regle?: string
  calcul?: (v: Record<string, number>) => number | null
  absolu?: boolean // afficher sans signe (un déficit de −152 Md€ se dit « 152 milliards € »)
  cache?: boolean // sert dans le texte mais n'est pas affiché en grand
}

export type Action = { libelle: string; lien?: string; preset?: string }

export type Question = {
  id: string
  titre: string
  icone: string
  accroche: string
  sousTitre?: string // une ligne pour la carte de l'accueil
  chiffres: Chiffre[]
  texte: string[]
  enBref?: string // la réponse directe à la question, en une ou deux phrases
  aSavoir?: string
  // « Ce qui fait débat » : les chiffres ne tranchent pas tout ; deux positions présentées à égalité, sans en choisir une
  debat?: { question: string; positions: { titre: string; texte: string }[] }
  actions: Action[]
  accueil?: false // absente des cartes de l'accueil (sujet sensible : on la trouve dans « Les grandes questions »)
}

export function formater(v: number, f: Format, absolu = false): string {
  const x = absolu ? Math.abs(v) : v
  switch (f) {
    case 'md': return milliards(x)
    case 'pct': return `${nombre(x, 1)} %`
    case 'pct_pib': return `${nombre(x, 1)} % du PIB`
    case 'pct_pib_signe': return `${x > 0 ? '+' : x < 0 ? '−' : ''}${nombre(Math.abs(x), 2)} % du PIB` // un solde, avec son signe
    case 'eur': return euros(x, 0)
    case 'eur_rond': return euros(Math.round(x / 1000) * 1000, 0) // un ordre de grandeur, pas une précision à l'euro
    case 'eur_mois': return `${euros(x, 0)} par mois`
    case 'personnes': return x >= 1e6 ? `${nombre(x / 1e6, 1)} millions de personnes` : `${nombre(x, 0)} personnes`
    case 'mt': return tonnes(x)
    case 't_hab': return `${nombre(x, 1)} tonnes de CO₂`
    case 'ans': return anEtMois(x)
    case 'ratio': return nombre(x, 2)
    case 'gini': return nombre(x < 1 ? x * 100 : x, 0)
    case 'heures': return `${nombre(x, 1)} heures`
    case 'entier': return nombre(x, 0)
  }
}

export const QUESTIONS: Question[] = [
  {
    id: 'depenses-publiques',
    titre: "Où va l'argent public ?",
    sousTitre: "Retraites, santé, école : à quoi sert l'argent public",
    icone: 'Landmark',
    accroche: "Plus de la moitié de la richesse produite chaque année passe par l'État, la Sécurité sociale et les collectivités. La plus grosse part revient aux ménages : retraites, santé, aides.",
    chiffres: [
      { cle: 'depenses', libelle: "Argent public dépensé en un an", format: 'md', metrique: 'finances_publiques.depenses_publiques' },
      { cle: 'depenses_pct', libelle: 'Part de la richesse produite (PIB)', format: 'pct_pib', metrique: 'finances_publiques.depenses_publiques_pct_pib' },
      { cle: 'retraites', libelle: 'Dont retraites, la première dépense', format: 'md', metrique: 'retraites.depenses_totales_md' },
      { cle: 'secu', libelle: 'Dépenses de la Sécurité sociale', format: 'md', metrique: 'finances_publiques.depenses_asso', cache: true },
      { cle: 'etat', libelle: "Dépenses de l'État", format: 'md', metrique: 'finances_publiques.depenses_etat', cache: true },
      { cle: 'local', libelle: 'Dépenses des collectivités', format: 'md', metrique: 'finances_publiques.depenses_apul', cache: true },
    ],
    texte: [
      "En une année, les administrations publiques dépensent {depenses}, soit {depenses_pct} : plus de la moitié de tout ce que la France produit.",
      "La Sécurité sociale en dépense la plus grosse part ({secu}) : retraites, assurance maladie, allocations familiales. Viennent ensuite l'État ({etat}), qui paie notamment l'école, la défense, la police et la justice, puis les communes, départements et régions ({local}).",
      "Les retraites sont la première dépense : {retraites} par an.",
    ],
    aSavoir: "Les dépenses des trois administrations se recoupent un peu (elles se versent de l'argent entre elles) : leur somme dépasse le total.",
    actions: [
      { libelle: 'Voir le budget en détail', lien: '/budget' },
      { libelle: 'Ce que votre foyer y met', lien: '/budget#et-vous' },
      { libelle: "Changer le budget de l'État", lien: '/atelier?budget=1' },
    ],
  },
  {
    id: 'qui-paie',
    titre: "D'où vient l'argent public ? Qui paie ?",
    sousTitre: "TVA, cotisations, impôt sur le revenu : qui paie quoi",
    icone: 'Coins',
    accroche: "Tout le monde paie : la TVA à chaque achat, les cotisations et la CSG sur les salaires et les pensions. L'impôt sur le revenu, le plus discuté, n'en rapporte qu'une petite part.",
    enBref: "Tout le monde paie, même sans impôt sur le revenu : la TVA ({tva}) rapporte deux fois plus que l'impôt sur le revenu ({ir}), et les cotisations sur les salaires encore davantage ({cotisations}).",
    chiffres: [
      { cle: 'po', libelle: 'Impôts et cotisations, par an', format: 'md', metrique: 'finances_publiques.prelevements_obligatoires' },
      { cle: 'tva', libelle: 'TVA (payée à chaque achat)', format: 'md', metrique: 'finances_publiques.recettes.tva' },
      { cle: 'ir', libelle: 'Impôt sur le revenu', format: 'md', metrique: 'finances_publiques.recettes.impot_revenu' },
      { cle: 'po_pct', libelle: 'Part de la richesse produite', format: 'pct_pib', metrique: 'finances_publiques.prelevements_obligatoires_pct_pib', cache: true },
      { cle: 'cotisations', libelle: 'Cotisations sociales', format: 'md', metrique: 'finances_publiques.recettes.cotisations_sociales_effectives', cache: true },
      { cle: 'csg', libelle: 'CSG', format: 'md', metrique: 'finances_publiques.recettes.csg', cache: true },
      { cle: 'is', libelle: 'Impôt sur les sociétés', format: 'md', metrique: 'finances_publiques.recettes.impot_societes', cache: true },
      { cle: 'fonciere', libelle: 'Taxe foncière', format: 'md', metrique: 'finances_publiques.recettes.taxe_fonciere', cache: true },
    ],
    texte: [
      "Les impôts et cotisations rapportent {po} par an, soit {po_pct}.",
      "Les cotisations sociales, prélevées sur les salaires, en sont la première source ({cotisations}). La TVA, payée par tous à chaque achat, rapporte {tva}, et la CSG, prélevée sur presque tous les revenus, {csg}.",
      "L'impôt sur le revenu rapporte {ir}, deux fois moins que la TVA. Il est progressif : plus le revenu est élevé, plus la part prélevée augmente. Les entreprises paient l'impôt sur les sociétés ({is}), et les propriétaires la taxe foncière ({fonciere}).",
    ],
    aSavoir: "La TVA pèse plus lourd, en proportion, pour les ménages modestes : ils dépensent presque tout ce qu'ils gagnent.",
    debat: {
      question: 'Faut-il faire payer davantage les plus aisés ?',
      positions: [
        { titre: 'Oui, davantage', texte: "Ceux qui ont le plus peuvent contribuer davantage sans se priver de l'essentiel, alors que la TVA pèse plus lourd, en proportion, sur les plus modestes. Un impôt plus progressif réduit les écarts et finance l'école et la santé." },
        { titre: 'Non, pas davantage', texte: "Les impôts et cotisations sont déjà élevés en France. Taxer davantage les plus aisés peut décourager le travail et l'investissement, ou les faire partir à l'étranger, et finalement rapporter moins que prévu." },
      ],
    },
    actions: [
      { libelle: 'Calculer vos impôts et vos aides', lien: '/mes-droits' },
      { libelle: 'Votre part du budget', lien: '/budget#et-vous' },
      { libelle: 'Tester une TVA à 21 %', preset: 'tva-21' },
    ],
  },
  {
    id: 'dette',
    titre: 'La dette publique, c\'est grave ?',
    sousTitre: "Ce que la France doit, et ce que coûtent les intérêts",
    icone: 'TrendingDown',
    accroche: "La France emprunte chaque année pour payer une partie de ses dépenses. La dette accumulée coûte des intérêts : de l'argent qui ne finance ni l'école ni l'hôpital.",
    chiffres: [
      { cle: 'dette', libelle: 'Dette publique', format: 'md', metrique: 'finances_publiques.dette_maastricht' },
      { cle: 'interets', libelle: 'Intérêts payés en un an par toutes les administrations publiques', format: 'md', metrique: 'finances_publiques.charge_interets_apu' },
      { cle: 'deficit', libelle: 'Déficit de la dernière année', format: 'md', metrique: 'finances_publiques.solde_public', absolu: true },
      { cle: 'dette_pct', libelle: 'Dette en part du PIB', format: 'pct_pib', metrique: 'finances_publiques.dette_maastricht_pct_pib', cache: true },
      { cle: 'deficit_pct', libelle: 'Déficit en part du PIB', format: 'pct_pib', metrique: 'finances_publiques.solde_public_pct_pib', absolu: true, cache: true },
      { cle: 'population', libelle: 'Population', format: 'personnes', metrique: 'demographie.population_totale', cache: true },
      { cle: 'dette_hab', libelle: 'Dette par habitant', format: 'eur_rond', calcul: (v) => (v.dette && v.population ? (v.dette * 1e9) / v.population : null), cache: true },
      { cle: 'defense', libelle: 'Budget de la Défense', format: 'md', regle: 'budget.etat.mission.defense', cache: true },
    ],
    enBref: "Pas de faillite en vue : la France emprunte sans difficulté et ne rembourse jamais sa dette d'un coup. Le vrai problème, ce sont les intérêts : {interets} par an, presque autant que tout le budget de la Défense ({defense}), et ils augmentent quand la dette et les taux montent.",
    texte: [
      "Chaque année, les administrations publiques dépensent plus qu'elles ne gagnent : le dernier déficit a atteint {deficit}, soit {deficit_pct}. Ce qui manque est emprunté.",
      "Les emprunts accumulés forment la dette : {dette}, soit {dette_pct}, ou environ {dette_hab} par habitant.",
      "Une dette ne se rembourse pas d'un coup : l'État emprunte à nouveau pour rembourser les anciens prêts. Le vrai coût, ce sont les intérêts : {interets} par an pour l'ensemble des administrations publiques (État, Sécurité sociale, collectivités), et ils augmentent quand les taux montent. Le budget de l'État n'en montre qu'une partie : les intérêts de sa propre dette.",
      "Les règles européennes demandent un déficit sous 3 % du PIB et une dette sous 60 % : la France est au-dessus des deux.",
    ],
    aSavoir: "Sur ce site, toute dépense nouvelle doit être financée par une économie ou une recette ailleurs, ou l'emprunt doit être assumé clairement.",
    debat: {
      question: 'Faut-il réduire vite le déficit ?',
      positions: [
        { titre: 'Oui, sans attendre', texte: "Les intérêts prennent la place d'autres dépenses, et plus on attend, plus l'effort sera lourd, pour nous et pour les générations suivantes. Un pays très endetté dépend de la confiance de ceux qui lui prêtent." },
        { titre: 'Non, progressivement', texte: "Couper vite dans les dépenses ou augmenter fortement les impôts peut ralentir l'économie et faire baisser les recettes. Mieux vaut réduire le déficit peu à peu et investir dans l'avenir : école, recherche, climat." },
      ],
    },
    actions: [
      { libelle: 'Le budget et le déficit', lien: '/budget' },
      { libelle: 'Chercher des économies', lien: '/atelier?budget=1' },
    ],
  },
  {
    id: 'retraites',
    titre: 'Comment marchent les retraites ?',
    sousTitre: "Qui paie les pensions, et pourquoi on en débat",
    icone: 'Hourglass',
    accroche: "Les cotisations de ceux qui travaillent paient les pensions des retraités d'aujourd'hui. Avec moins de travailleurs par retraité, l'équilibre devient plus difficile.",
    enBref: "Il y a aujourd'hui environ {cotisants_4} personnes qui travaillent et cotisent pour 4 retraités. Quand ce nombre baisse, il faut choisir : cotiser plus, verser moins, ou partir plus tard.",
    chiffres: [
      { cle: 'nb', libelle: 'Retraités', format: 'personnes', metrique: 'retraites.nombre_retraites' },
      { cle: 'ratio', libelle: 'Cotisants pour un retraité', format: 'ratio', metrique: 'retraites.ratio_cotisants_retraites' },
      { cle: 'cotisants_4', libelle: 'Cotisants pour 4 retraités', format: 'entier', calcul: (v) => (v.ratio ? v.ratio * 4 : null), cache: true },
      { cle: 'age', libelle: 'Âge moyen de départ', format: 'ans', metrique: 'retraites.age_moyen_depart' },
      { cle: 'depenses', libelle: 'Coût du système', format: 'md', metrique: 'retraites.depenses_totales_md', cache: true },
      { cle: 'depenses_pct', libelle: 'Part du PIB', format: 'pct_pib', metrique: 'retraites.depenses_pct_pib', cache: true },
      { cle: 'pension_h', libelle: 'Pension moyenne des hommes', format: 'eur', metrique: 'retraites.pension_dd_brute_moyenne_hommes', cache: true },
      { cle: 'pension_f', libelle: 'Pension moyenne des femmes', format: 'eur', metrique: 'retraites.pension_dd_brute_moyenne_femmes', cache: true },
    ],
    texte: [
      "La France compte {nb} à la retraite. Leurs pensions sont payées par les cotisations de ceux qui travaillent aujourd'hui : c'est la « retraite par répartition ».",
      "On compte environ {cotisants_4} cotisants pour 4 retraités ({ratio} pour un). Quand ce nombre baisse, il n'y a que trois leviers : cotiser plus, verser des pensions moins élevées, ou partir plus tard.",
      "Le système coûte {depenses} par an ({depenses_pct}). On part en moyenne à {age}.",
      "La pension moyenne avant prélèvements (hors pension de réversion) est de {pension_h} par mois pour les hommes et de {pension_f} pour les femmes, dont les carrières ont souvent été plus courtes ou moins payées.",
    ],
    debat: {
      question: 'Avec moins de cotisants par retraité, comment payer les pensions ?',
      positions: [
        { titre: 'Partir plus tard', texte: "On vit plus longtemps qu'avant, donc plus longtemps à la retraite. Partir un peu plus tard permet de payer les pensions sans les baisser ni augmenter les cotisations de ceux qui travaillent." },
        { titre: 'Augmenter les recettes', texte: "Tout le monde ne peut pas travailler plus longtemps, surtout dans les métiers usants. On peut plutôt augmenter un peu les cotisations ou faire contribuer les revenus du patrimoine, comme les dividendes." },
      ],
    },
    actions: [
      { libelle: 'À quel âge pourrai-je partir ?', lien: '/mes-droits' },
      { libelle: 'Déjà retraité(e) avec une petite pension ? Vérifiez le minimum vieillesse et vos aides', lien: '/mes-droits' },
      { libelle: 'Tester la retraite à 62 ans', preset: 'retraite-62' },
      { libelle: 'Tester la retraite à 65 ans', preset: 'retraite-65' },
    ],
  },
  {
    id: 'inegalites',
    titre: 'Les inégalités en France',
    sousTitre: "Écarts de revenus et pauvreté : où en est-on ?",
    icone: 'Users',
    accroche: "La moitié des Français vit avec moins de {mediane} (pour une personne seule). Les impôts et les aides réduisent les écarts, sans les supprimer.",
    chiffres: [
      { cle: 'mediane', libelle: 'Niveau de vie « du milieu »', format: 'eur_mois', metrique: 'revenus.niveau_vie.mediane_mensuelle' },
      { cle: 'seuil', libelle: 'Seuil de pauvreté', format: 'eur_mois', metrique: 'revenus.pauvrete.seuil_60_mensuel' },
      { cle: 'pauvres', libelle: 'Personnes sous ce seuil', format: 'personnes', metrique: 'revenus.pauvrete.nombre_personnes_seuil_60' },
      { cle: 'gini', libelle: 'Indice de Gini', format: 'gini', metrique: 'revenus.niveau_vie.indice_gini', cache: true },
      { cle: 'privation', libelle: 'Privation matérielle et sociale', format: 'pct', metrique: 'bien_etre.nir.pauvrete_conditions_vie', cache: true },
    ],
    texte: [
      "Le niveau de vie « du milieu » (médian) est de {mediane} pour une personne seule : la moitié de la population a moins, l'autre moitié plus. Pour un foyer de plusieurs personnes, on divise le revenu en tenant compte de la taille du foyer. Il peut dépasser le salaire « du milieu » : il compte aussi les pensions, les aides et l'épargne, après impôts, et à plusieurs on partage le logement et les dépenses.",
      "On est dit pauvre sous 60 % de ce niveau, soit {seuil} pour une personne seule : c'est le cas de {pauvres}. Et {privation} de la population ne peut pas faire face à certaines dépenses de base (chauffer son logement, remplacer un meuble abîmé…).",
      "L'indice de Gini mesure les écarts : 0 si tout le monde avait autant, 100 si une seule personne avait tout. La France est à {gini}.",
      "Les aides (RSA, prime d'activité, aides au logement…) et les impôts progressifs réduisent ces écarts : pour chaque réforme, le site calcule s'ils augmentent ou diminuent.",
    ],
    actions: [
      { libelle: 'Votre niveau de vie', lien: '/mes-droits' },
      { libelle: 'Tester un RSA à 800 €', preset: 'rsa-800' },
    ],
  },
  {
    id: 'climat',
    titre: 'Le climat : où en est la France ?',
    sousTitre: "Combien de gaz à effet de serre la France émet",
    icone: 'Leaf',
    accroche: "La France émet de moins en moins de gaz à effet de serre sur son sol. Mais en comptant ce que nous importons, notre empreinte reste bien plus lourde.",
    chiffres: [
      { cle: 'emissions', libelle: 'Émissions sur le territoire, par an', format: 'mt', metrique: 'ecologie.emissions_territoriales_totales' },
      { cle: 'budget', libelle: 'Plafond légal 2024-2028 (par an)', format: 'mt', regle: 'environnement_energie.budget_carbone.periode_2024_2028' },
      { cle: 'par_hab', libelle: 'Empreinte par habitant et par an', format: 't_hab', metrique: 'environnement_energie.empreinte_carbone_par_habitant' },
      { cle: 'empreinte', libelle: 'Empreinte carbone totale', format: 'mt', metrique: 'ecologie.empreinte_carbone_totale', cache: true },
      { cle: 'transports', libelle: 'Émissions des transports', format: 'mt', metrique: 'ecologie.emissions_par_secteur.transports', cache: true },
    ],
    texte: [
      "En un an, la France a émis {emissions} sur son territoire (tous les gaz à effet de serre, comptés en équivalent CO₂). Les transports en sont la première source ({transports}), devant l'agriculture, l'industrie et les bâtiments.",
      "Si l'on compte aussi ce que nous importons (vêtements, téléphones, voitures…), notre « empreinte carbone » atteint {empreinte}, soit {par_hab} par habitant.",
      "La loi fixe un plafond, le « budget carbone » : {budget} par an en moyenne sur 2024-2028. Sur ce site, une réforme qui ajoute des émissions doit être compensée pour rester sous ce plafond.",
    ],
    actions: [
      { libelle: 'Les règles sur le climat et l\'énergie', lien: '/regles/d/environnement_energie' },
      { libelle: 'Tester une limite à 110 km/h', lien: '/atelier?regle=transports.vitesse_max.autoroute' },
    ],
  },
  {
    id: 'travail',
    titre: 'Le travail : salaires et chômage',
    sousTitre: "Salaire du milieu, SMIC, chômage : les repères",
    icone: 'Briefcase',
    accroche: "La moitié des salariés du privé gagne moins de {median} nets par mois à temps plein, et {chomage} des actifs sont au chômage.",
    chiffres: [
      { cle: 'median', libelle: 'Salaire net « du milieu » (temps plein)', format: 'eur', metrique: 'revenus.salaires.net_mensuel_median_eqtp_prive' },
      { cle: 'chomage', libelle: 'Taux de chômage', format: 'pct', metrique: 'emploi.taux_chomage_bit' },
      { cle: 'emploi', libelle: 'Personnes en emploi', format: 'personnes', metrique: 'emploi.actifs_occupes' },
      { cle: 'd1', libelle: '10 % des salariés gagnent moins de', format: 'eur', metrique: 'revenus.salaires.net_mensuel_d1_eqtp_prive', cache: true },
      { cle: 'd9', libelle: '10 % des salariés gagnent plus de', format: 'eur', metrique: 'revenus.salaires.net_mensuel_d9_eqtp_prive', cache: true },
      { cle: 'moyen', libelle: 'Salaire net moyen', format: 'eur', metrique: 'revenus.salaires.net_mensuel_moyen_eqtp_prive', cache: true },
      { cle: 'chomeurs', libelle: 'Chômeurs', format: 'personnes', metrique: 'emploi.chomeurs_bit', cache: true },
      { cle: 'allocation', libelle: 'Allocation chômage moyenne', format: 'eur', metrique: 'travail.allocation_chomage_moyenne_nette', cache: true },
      { cle: 'partiel', libelle: 'Temps partiel', format: 'pct', metrique: 'emploi.part_temps_partiel', cache: true },
    ],
    texte: [
      "{emploi} ont un emploi. Dans le privé, le salaire net « du milieu » (médian) est de {median} par mois à temps plein : la moitié gagne moins, l'autre moitié plus. Le salaire moyen ({moyen}) est plus élevé, tiré vers le haut par les plus hauts salaires.",
      "Les écarts sont importants : 10 % des salariés gagnent moins de {d1}, et 10 % plus de {d9} (toujours à temps plein). {partiel} des personnes en emploi travaillent à temps partiel.",
      "{chomeurs} sont au chômage, soit {chomage} des actifs. L'allocation chômage moyenne est de {allocation} nets par mois.",
    ],
    aSavoir: "Le chômage « au sens du BIT » compte les personnes sans emploi qui en cherchent un activement : c'est la mesure de l'Insee, différente du nombre d'inscrits à France Travail.",
    actions: [
      { libelle: 'Vos aides et votre salaire net', lien: '/mes-droits' },
      { libelle: 'Tester une hausse du SMIC', lien: '/atelier?regle=travail.smic.horaire_brut' },
    ],
  },
  {
    id: 'ecole',
    titre: "L'école : combien ça coûte, est-ce que ça marche ?",
    sousTitre: "Ce que coûte un élève, et ce qu'il apprend",
    icone: 'GraduationCap',
    accroche: "La France consacre {depense} par an à l'éducation, soit environ {par_eleve} par élève ou étudiant.",
    chiffres: [
      { cle: 'depense', libelle: "Dépense d'éducation par an", format: 'md', metrique: 'education.depense_interieure_education' },
      { cle: 'par_eleve', libelle: 'Par élève ou étudiant', format: 'eur', metrique: 'education.depense_moyenne_par_eleve_etudiant' },
      { cle: 'bac', libelle: "Jeunes d'une génération qui ont le bac", format: 'pct', metrique: 'education.proportion_bacheliers_generation' },
      { cle: 'pct', libelle: 'Part du PIB', format: 'pct_pib', metrique: 'education.depense_interieure_education_part_pib', cache: true },
      { cle: 'eleves', libelle: 'Élèves et apprentis', format: 'personnes', metrique: 'education.eleves_apprentis_1er_2d_degres', cache: true },
      { cle: 'profs', libelle: 'Enseignants', format: 'personnes', metrique: 'education.enseignants_total', cache: true },
      { cle: 'pisa', libelle: 'Score PISA en mathématiques', format: 'ratio', metrique: 'education.pisa_culture_mathematique', cache: true },
    ],
    texte: [
      "L'État, les collectivités, les familles et les entreprises dépensent ensemble {depense} par an pour l'éducation ({pct}), soit {par_eleve} en moyenne par élève ou étudiant.",
      "{eleves} sont scolarisés de la maternelle au lycée, avec {profs} enseignants.",
      "Aujourd'hui, {bac} des jeunes d'une génération obtiennent le baccalauréat. Les évaluations internationales PISA, qui testent les élèves de 15 ans, donnent à la France {pisa} points en mathématiques.",
    ],
    actions: [
      { libelle: "Le budget de l'école", lien: '/regles/r/budget.etat.mission.enseignement_scolaire' },
      { libelle: "Dépenser plus (ou moins) pour l'école", lien: '/atelier?budget=1' },
    ],
  },
  {
    id: 'sante',
    titre: 'La santé : combien ça coûte ?',
    sousTitre: "Ce que coûtent les soins, et qui les rembourse",
    icone: 'HeartPulse',
    accroche: "Les soins coûtent cher, mais l'Assurance maladie et les complémentaires en paient l'essentiel : chacun paie lui-même en moyenne {reste} par an.",
    chiffres: [
      { cle: 'depense', libelle: 'Dépense de santé par an', format: 'md', metrique: 'sante.depense_courante_sante_internationale' },
      { cle: 'reste', libelle: 'Payé de sa poche, par habitant et par an', format: 'eur', metrique: 'sante.reste_a_charge_menages_par_habitant' },
      { cle: 'vie_f', libelle: 'Espérance de vie des femmes', format: 'ans', metrique: 'sante.esperance_vie_naissance_femmes' },
      { cle: 'pct', libelle: 'Part du PIB', format: 'pct_pib', metrique: 'sante.depense_courante_sante_internationale_part_pib', cache: true },
      { cle: 'vie_h', libelle: 'Espérance de vie des hommes', format: 'ans', metrique: 'sante.esperance_vie_naissance_hommes', cache: true },
      { cle: 'bonne_f', libelle: 'En bonne santé (femmes)', format: 'ans', metrique: 'bien_etre.nir.esperance_vie_bonne_sante_femmes', cache: true },
      { cle: 'bonne_h', libelle: 'En bonne santé (hommes)', format: 'ans', metrique: 'bien_etre.nir.esperance_vie_bonne_sante_hommes', cache: true },
      { cle: 'medecins', libelle: 'Médecins', format: 'personnes', metrique: 'sante.medecins_en_activite_et_internes', cache: true },
    ],
    texte: [
      "La France consacre {depense} par an à la santé ({pct}). L'essentiel est payé par l'Assurance maladie et les complémentaires : il reste en moyenne {reste} par habitant et par an à payer de sa poche.",
      "L'espérance de vie à la naissance est de {vie_f} pour les femmes et de {vie_h} pour les hommes. Mais on vit en bonne santé (sans être limité dans ses activités) jusqu'à {bonne_f} en moyenne pour les femmes et {bonne_h} pour les hommes.",
      "La France compte {medecins} médecins en activité ou en fin de formation.",
    ],
    actions: [
      { libelle: "Dépenser plus pour l'hôpital et les soins", lien: '/atelier?regle=budget.secu.ondam.total' },
      { libelle: 'Les règles de la santé', lien: '/regles/d/sante' },
    ],
  },
  {
    // Sujet sensible (choix du responsable : « oui, avec prudence ») : définitions d'abord, conventions de calcul dites,
    // limites des études affichées, aucun jugement. Chaque chiffre a été relu dans sa source (voir model/sources/immigration.yaml),
    // puis la page relue par deux lecteurs opposés (« ça coûte cher, l'officiel minimise » / « ça stigmatise »).
    id: 'immigration',
    titre: "L'immigration : que disent les chiffres ?",
    sousTitre: "Combien d'immigrés, leur emploi et l'effet sur les finances publiques",
    icone: 'Globe',
    accueil: false,
    accroche: "{nombre} immigrées vivent en France, soit {part} de la population. Voici ce que disent les chiffres publics sur leur emploi et sur les finances publiques, et ce que ces chiffres ne permettent pas de dire.",
    enBref: "Selon l'OCDE, le solde entre ce que les immigrés paient et ce qu'ils reçoivent allait, en moyenne de 2006 à 2018, de {ocde_moins} à {ocde_plus} par an : négatif si on leur compte une part des dépenses communes comme la défense, positif sinon. Côté emploi, {emploi_imm} des immigrés de 15 à 64 ans ont un emploi, contre {emploi_autres} des personnes qui ne sont ni immigrées ni enfants d'immigrés.",
    chiffres: [
      { cle: 'nombre', libelle: 'Immigrés vivant en France', format: 'personnes', metrique: 'demographie.immigres.nombre' },
      { cle: 'part', libelle: 'Part de la population', format: 'pct', metrique: 'demographie.immigres.part_population' },
      { cle: 'emploi_imm', libelle: 'Ont un emploi (immigrés de 15 à 64 ans)', format: 'pct', metrique: 'emploi.immigres.taux_emploi' },
      { cle: 'emploi_autres', libelle: "Ont un emploi (ni immigrés ni enfants d'immigrés)", format: 'pct', metrique: 'emploi.sans_ascendance_migratoire.taux_emploi', cache: true },
      { cle: 'chomage_imm', libelle: 'Chômage des immigrés', format: 'pct', metrique: 'emploi.immigres.taux_chomage', cache: true },
      { cle: 'chomage_autres', libelle: "Chômage (ni immigrés ni enfants d'immigrés)", format: 'pct', metrique: 'emploi.sans_ascendance_migratoire.taux_chomage', cache: true },
      { cle: 'emploi_f_imm', libelle: 'Femmes immigrées en emploi', format: 'pct', metrique: 'emploi.immigrees_femmes.taux_emploi', cache: true },
      { cle: 'emploi_f_autres', libelle: 'Femmes non immigrées en emploi', format: 'pct', metrique: 'emploi.non_immigrees_femmes.taux_emploi', cache: true },
      { cle: 'francais', libelle: 'Immigrés devenus français', format: 'personnes', metrique: 'demographie.immigres.devenus_francais', cache: true },
      { cle: 'etrangers', libelle: 'Part des étrangers', format: 'pct', metrique: 'demographie.etrangers.part_population', cache: true },
      { cle: 'entrees', libelle: "Immigrés arrivés dans l'année", format: 'entier', metrique: 'demographie.immigres.entrees_annuelles', cache: true },
      { cle: 'ocde_plus', libelle: 'Solde, sans les dépenses communes', format: 'pct_pib_signe', metrique: 'finances_publiques.immigration.contribution_nette_hors_biens_publics', cache: true },
      { cle: 'ocde_moins', libelle: 'Solde, dépenses communes réparties', format: 'pct_pib_signe', metrique: 'finances_publiques.immigration.contribution_nette_avec_biens_publics', cache: true },
      { cle: 'pib', libelle: 'Richesse produite (PIB)', format: 'md', metrique: 'finances_publiques.pib_valeur', cache: true },
      // un ordre de grandeur en euros (une part du PIB d'alors appliquée au PIB d'aujourd'hui), pas une mesure : le texte le dit
      { cle: 'ocde_plus_md', libelle: "Solde positif, en euros d'aujourd'hui", format: 'md', absolu: true, calcul: (v) => (v.ocde_plus != null && v.pib ? (v.ocde_plus * v.pib) / 100 : null), cache: true },
      { cle: 'ocde_moins_md', libelle: "Solde négatif, en euros d'aujourd'hui", format: 'md', absolu: true, calcul: (v) => (v.ocde_moins != null && v.pib ? (v.ocde_moins * v.pib) / 100 : null), cache: true },
      { cle: 'mission', libelle: 'Mission « Immigration, asile et intégration »', format: 'md', regle: 'budget.etat.mission.immigration_asile_integration', cache: true },
      { cle: 'asile', libelle: "Coût de l'asile", format: 'md', metrique: 'finances_publiques.immigration.cout_asile', cache: true },
      { cle: 'ame', libelle: "Aide médicale de l'État", format: 'md', metrique: 'sante.ame.depense', cache: true },
      { cle: 'ame_benef', libelle: "Bénéficiaires de l'AME", format: 'entier', metrique: 'sante.ame.beneficiaires', cache: true },
    ],
    texte: [
      "Un immigré est une personne née étrangère à l'étranger qui vit en France. On le reste après être devenu français : c'est le cas d'un tiers d'entre eux ({francais}). Les étrangers, eux, sont les personnes qui n'ont pas la nationalité française, qu'elles soient nées à l'étranger ou en France : ils représentent {etrangers} de la population.",
      "En 2024, environ {entrees} immigrés sont arrivés en France, toutes raisons confondues et y compris depuis l'Union européenne. C'est un nombre d'arrivées : les départs n'en sont pas déduits.",
      "{emploi_imm} des immigrés de 15 à 64 ans ont un emploi, contre {emploi_autres} des personnes qui ne sont ni immigrées ni enfants d'immigrés. Parmi ceux qui travaillent ou cherchent un emploi, {chomage_imm} des immigrés sont au chômage, contre {chomage_autres}. L'écart d'emploi se concentre chez les femmes : chez les hommes, la part qui a un emploi est presque la même, immigrés ou non, alors que {emploi_f_imm} des femmes immigrées ont un emploi, contre {emploi_f_autres} des femmes non immigrées.",
      "Pour les finances publiques, on compare ce que les immigrés paient (impôts, cotisations) à ce qu'ils reçoivent (retraites, soins, aides, école…). Le résultat dépend d'une convention : faut-il leur compter une part des dépenses communes à tous, comme la défense ? Selon l'OCDE, citée par la Cour des comptes, ce solde était en moyenne, de 2006 à 2018, de {ocde_plus} par an si on ne leur compte pas ces dépenses communes, et de {ocde_moins} si on les répartit à parts égales entre tous les habitants. À l'échelle de la richesse produite aujourd'hui, cela ferait de l'ordre de {ocde_plus_md} en plus, ou de {ocde_moins_md} en moins, chaque année. L'OCDE compte toutes les personnes nées à l'étranger : ce n'est pas tout à fait la même population que les immigrés au sens de l'Insee.",
      "Une étude plus ancienne du Cepii (1979-2011) trouvait un solde « globalement négatif mais relativement faible ». La Cour des comptes avance plusieurs explications : une insertion incomplète sur le marché du travail, un recours plus fréquent à certaines prestations, et des choix de méthode. Les moyennes cachent aussi de grands écarts : selon France Stratégie, si les immigrés paient en moyenne moins d'impôts et de cotisations que les autres habitants, c'est surtout le fait des moins diplômés ; selon l'OCDE, les plus qualifiés en paient même davantage.",
      "Certaines dépenses visent directement l'immigration. Pour 2026, la loi de finances prévoit {mission} pour la mission « Immigration, asile et intégration » du budget de l'État (asile, retours, intégration) ; d'autres dépenses liées figurent ailleurs dans le budget. La commission des finances du Sénat estime le coût de l'asile en 2025 à environ {asile}, toutes missions budgétaires confondues : c'est un minimum, car les soins, l'aide sociale, la scolarisation des enfants et la police des retours n'y sont pas comptés. Les dépenses d'aide médicale de l'État (AME), qui prend en charge les soins des étrangers en situation irrégulière aux ressources modestes, ont atteint environ {ame} en 2024, pour plus de {ame_benef} bénéficiaires. Ces montants se recoupent en partie : ils ne s'additionnent pas.",
    ],
    aSavoir: "Le site s'en tient aux chiffres publics, avec leurs limites. Les chiffres de population de 2025 sont provisoires, et l'Insee a changé sa méthode en 2024 : on ne peut pas les comparer directement aux années d'avant. Les études sur les finances publiques sont anciennes (données jusqu'en 2018) et regardent une année à la fois : elles ne suivent pas toute une vie (enfance, travail, retraite) ni les effets sur l'économie. Faute de source vérifiée, la page ne donne pas le solde équivalent des personnes nées en France. Or, sur ces années, les comptes publics de la France étaient en déficit chaque année, tous habitants confondus.",
    actions: [
      { libelle: 'Les règles du séjour et de la nationalité', lien: '/regles/d/nationalite_immigration' },
      { libelle: 'La mission « Immigration, asile et intégration »', lien: '/regles/r/budget.etat.mission.immigration_asile_integration' },
    ],
  },
]

/** « Vrai ou faux ? » : des idées reçues, tranchées avec les chiffres officiels du modèle (lus à l'affichage). */
export type VraiFaux = { id: string; affirmation: string; verdict: 'vrai' | 'faux' | 'nuance'; explication: string; chiffres: Chiffre[]; lien?: Action }

const md = (v: number | undefined) => (v != null ? v / 1e9 : null) // montant annuel publié en euros → milliards

export const VRAI_FAUX: VraiFaux[] = [
  {
    id: 'impots',
    affirmation: 'La moitié des Français ne paie pas d\'impôts.',
    verdict: 'nuance',
    explication: "Pour l'impôt sur le revenu, c'est à peu près vrai : seules {part_imposes} des déclarations de revenus donnent un impôt à payer. Mais tout le monde paie la TVA à chaque achat ({tva} par an au total), et la CSG est prélevée sur presque tous les salaires, pensions et allocations ({csg}).",
    chiffres: [
      { cle: 'foyers', libelle: 'Foyers fiscaux', format: 'entier', metrique: 'impot.ir.nombre_foyers_fiscaux', cache: true },
      { cle: 'imposes', libelle: "Foyers qui paient l'impôt sur le revenu", format: 'entier', metrique: 'impot.ir.nombre_foyers_imposes', cache: true },
      { cle: 'part_imposes', libelle: "Part des foyers qui paient l'impôt sur le revenu", format: 'pct', calcul: (v) => (v.foyers ? (v.imposes / v.foyers) * 100 : null) },
      { cle: 'tva', libelle: 'TVA', format: 'md', metrique: 'finances_publiques.recettes.tva' },
      { cle: 'csg', libelle: 'CSG', format: 'md', metrique: 'finances_publiques.recettes.csg' },
    ],
    lien: { libelle: 'Qui paie quoi ?', lien: '/comprendre/qui-paie' },
  },
  {
    id: 'retraites-premiere',
    affirmation: 'Les retraites sont la première dépense publique.',
    verdict: 'vrai',
    explication: "Sur les {depenses} d'argent public dépensés en un an, {retraites} vont aux retraites : environ {sur100} € sur 100 €.",
    chiffres: [
      { cle: 'depenses', libelle: 'Dépenses publiques', format: 'md', metrique: 'finances_publiques.depenses_publiques' },
      { cle: 'retraites', libelle: 'Retraites', format: 'md', metrique: 'retraites.depenses_totales_md' },
      { cle: 'sur100', libelle: 'Sur 100 €', format: 'entier', calcul: (v) => (v.depenses ? Math.round((v.retraites / v.depenses) * 100) : null) },
    ],
    lien: { libelle: 'Où va l\'argent public ?', lien: '/comprendre/depenses-publiques' },
  },
  {
    id: 'rsa-dette',
    affirmation: 'Le RSA coûte plus cher que les intérêts de la dette.',
    verdict: 'faux',
    explication: "Le RSA coûte {rsa} par an. Les intérêts de la dette publique coûtent {interets} : environ {rapport} fois plus.",
    chiffres: [
      { cle: 'rsa_e', libelle: 'RSA (euros)', format: 'md', metrique: 'prestations.rsa.montant_annuel', cache: true },
      { cle: 'rsa', libelle: 'RSA', format: 'md', calcul: (v) => md(v.rsa_e) },
      { cle: 'interets', libelle: 'Intérêts de la dette', format: 'md', metrique: 'finances_publiques.charge_interets_apu' },
      { cle: 'rapport', libelle: 'Rapport', format: 'entier', calcul: (v) => (v.rsa_e ? v.interets / (v.rsa_e / 1e9) : null) },
    ],
    lien: { libelle: 'La dette, c\'est grave ?', lien: '/comprendre/dette' },
  },
  {
    id: '35-heures',
    affirmation: 'En France, on travaille 35 heures par semaine.',
    verdict: 'nuance',
    explication: "35 heures, c'est la durée légale : au-delà, les heures sont des heures supplémentaires, mieux payées. Mais les salariés à temps complet travaillent en moyenne {duree} par semaine (heures supplémentaires, cadres au forfait…).",
    chiffres: [{ cle: 'duree_h', libelle: 'Durée habituelle', format: 'ratio', metrique: 'travail.duree_hebdomadaire_habituelle', cache: true },
      { cle: 'duree', libelle: 'Durée', format: 'heures', calcul: (v) => v.duree_h }],
    lien: { libelle: 'Tester une autre durée légale', lien: '/atelier?regle=travail.duree.legale_hebdomadaire' },
  },
  {
    id: 'aides-retraites',
    affirmation: 'Les aides sociales coûtent plus cher que les retraites.',
    verdict: 'faux',
    explication: "Le RSA, la prime d'activité et l'allocation aux adultes handicapés coûtent ensemble {minima} par an. Les retraites coûtent {retraites} : environ {rapport} fois plus. Même en ajoutant les allocations familiales, le chômage et les aides au logement, on reste loin des retraites (voir « Sur 100 € d'argent public » dans « Le budget »).",
    chiffres: [
      { cle: 'rsa_e', libelle: 'RSA', format: 'md', metrique: 'prestations.rsa.montant_annuel', cache: true },
      { cle: 'pa_e', libelle: "Prime d'activité", format: 'md', metrique: 'prestations.prime_activite.montant_annuel', cache: true },
      { cle: 'aah_e', libelle: 'AAH', format: 'md', metrique: 'prestations.aah.montant_annuel', cache: true },
      { cle: 'minima', libelle: 'Les trois aides', format: 'md', calcul: (v) => (v.rsa_e && v.pa_e && v.aah_e ? (v.rsa_e + v.pa_e + v.aah_e) / 1e9 : null) },
      { cle: 'retraites', libelle: 'Retraites', format: 'md', metrique: 'retraites.depenses_totales_md' },
      { cle: 'rapport', libelle: 'Rapport', format: 'entier', calcul: (v) => (v.minima ? v.retraites / v.minima : null) },
    ],
    lien: { libelle: 'Comment marchent les retraites ?', lien: '/comprendre/retraites' },
  },
  // des idées reçues de tous les bords (test Gérard : les premières démontaient surtout des idées sur « l'assistanat »)
  {
    id: 'riches-ir',
    affirmation: "Les plus aisés paient peu d'impôt sur le revenu.",
    verdict: 'faux',
    explication: "Les foyers qui déclarent plus de 100 000 € par an ne sont que {part_foyers} des foyers, mais ils paient {part_impot} de l'impôt sur le revenu ({impot_haut} sur {impot_total}), car il est progressif. La TVA, elle, pèse plus lourd, en proportion, sur les revenus modestes.",
    chiffres: [
      { cle: 'foyers_haut', libelle: 'Foyers au-delà de 100 000 €', format: 'entier', metrique: 'impot.ir.tranche_rfr_plus_100000.nombre_foyers', cache: true },
      { cle: 'foyers', libelle: 'Foyers fiscaux', format: 'entier', metrique: 'impot.ir.nombre_foyers_fiscaux', cache: true },
      { cle: 'impot_haut_e', libelle: 'Impôt payé au-delà de 100 000 €', format: 'entier', metrique: 'impot.ir.tranche_rfr_plus_100000.impot_net', cache: true },
      { cle: 'impot_total_e', libelle: 'Impôt sur le revenu total', format: 'entier', metrique: 'impot.ir.impot_net_total', cache: true },
      { cle: 'impot_haut', libelle: 'Impôt payé par ces foyers', format: 'md', calcul: (v) => (v.impot_haut_e ? v.impot_haut_e / 1e9 : null) },
      { cle: 'impot_total', libelle: 'Impôt sur le revenu, au total', format: 'md', calcul: (v) => (v.impot_total_e ? v.impot_total_e / 1e9 : null) },
      { cle: 'part_foyers', libelle: 'Part des foyers', format: 'pct', calcul: (v) => (v.foyers ? (v.foyers_haut / v.foyers) * 100 : null) },
      { cle: 'part_impot', libelle: "Part de l'impôt sur le revenu", format: 'pct', calcul: (v) => (v.impot_total_e ? (v.impot_haut_e / v.impot_total_e) * 100 : null) },
    ],
    lien: { libelle: 'Qui paie quoi ?', lien: '/comprendre/qui-paie' },
  },
  {
    id: 'entreprises-is',
    affirmation: "Les entreprises ne paient presque pas d'impôt.",
    verdict: 'faux',
    explication: "L'impôt sur les sociétés, payé sur leurs bénéfices, a rapporté {is} en un an. Elles paient aussi la part « patronale » des cotisations sur les salaires, et des impôts locaux. Les montants varient beaucoup d'une entreprise à l'autre : certaines paient peu, notamment grâce à des crédits d'impôt.",
    chiffres: [
      { cle: 'is', libelle: 'Impôt sur les sociétés', format: 'md', metrique: 'finances_publiques.recettes.impot_societes' },
    ],
    lien: { libelle: "Où va l'argent public, et d'où il vient", lien: '/budget' },
  },
]
