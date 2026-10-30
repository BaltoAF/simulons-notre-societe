// « Les grandes questions » : comprendre la France en quelques chiffres officiels, expliqués simplement.
// Les chiffres ne sont pas écrits ici : chaque question cite des statistiques du modèle (model/metriques) ou des règles,
// lues au moment de l'affichage avec leur source. Le texte les reprend par leur clé : {dette}, {interets}…
import { anEtMois, euros, nombre } from './format'
import { milliards, tonnes } from './humain'

export type Format = 'md' | 'pct' | 'pct_pib' | 'eur' | 'eur_rond' | 'eur_mois' | 'personnes' | 'mt' | 't_hab' | 'ans' | 'ratio' | 'gini'

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
  chiffres: Chiffre[]
  texte: string[]
  aSavoir?: string
  actions: Action[]
}

export function formater(v: number, f: Format, absolu = false): string {
  const x = absolu ? Math.abs(v) : v
  switch (f) {
    case 'md': return milliards(x)
    case 'pct': return `${nombre(x, 1)} %`
    case 'pct_pib': return `${nombre(x, 1)} % du PIB`
    case 'eur': return euros(x, 0)
    case 'eur_rond': return euros(Math.round(x / 1000) * 1000, 0) // un ordre de grandeur, pas une précision à l'euro
    case 'eur_mois': return `${euros(x, 0)} par mois`
    case 'personnes': return x >= 1e6 ? `${nombre(x / 1e6, 1)} millions de personnes` : `${nombre(x, 0)} personnes`
    case 'mt': return tonnes(x)
    case 't_hab': return `${nombre(x, 1)} tonnes de CO₂`
    case 'ans': return anEtMois(x)
    case 'ratio': return nombre(x, 2)
    case 'gini': return nombre(x < 1 ? x * 100 : x, 0)
  }
}

export const QUESTIONS: Question[] = [
  {
    id: 'depenses-publiques',
    titre: "Où va l'argent public ?",
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
    icone: 'Coins',
    accroche: "Tout le monde paie : la TVA à chaque achat, les cotisations et la CSG sur les salaires et les pensions. L'impôt sur le revenu, le plus discuté, n'en rapporte qu'une petite part.",
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
    actions: [
      { libelle: 'Calculer vos impôts et vos aides', lien: '/mes-droits' },
      { libelle: 'Votre part du budget', lien: '/budget#et-vous' },
      { libelle: 'Tester une TVA à 21 %', preset: 'tva-21' },
    ],
  },
  {
    id: 'dette',
    titre: 'La dette publique, c\'est grave ?',
    icone: 'TrendingDown',
    accroche: "La France emprunte chaque année pour payer une partie de ses dépenses. La dette accumulée coûte des intérêts : de l'argent qui ne finance ni l'école ni l'hôpital.",
    chiffres: [
      { cle: 'dette', libelle: 'Dette publique', format: 'md', metrique: 'finances_publiques.dette_maastricht' },
      { cle: 'interets', libelle: 'Intérêts payés chaque année', format: 'md', metrique: 'finances_publiques.charge_interets_apu' },
      { cle: 'deficit', libelle: 'Déficit de la dernière année', format: 'md', metrique: 'finances_publiques.solde_public', absolu: true },
      { cle: 'dette_pct', libelle: 'Dette en part du PIB', format: 'pct_pib', metrique: 'finances_publiques.dette_maastricht_pct_pib', cache: true },
      { cle: 'deficit_pct', libelle: 'Déficit en part du PIB', format: 'pct_pib', metrique: 'finances_publiques.solde_public_pct_pib', absolu: true, cache: true },
      { cle: 'population', libelle: 'Population', format: 'personnes', metrique: 'demographie.population_totale', cache: true },
      { cle: 'dette_hab', libelle: 'Dette par habitant', format: 'eur_rond', calcul: (v) => (v.dette && v.population ? (v.dette * 1e9) / v.population : null), cache: true },
    ],
    texte: [
      "Chaque année, les administrations publiques dépensent plus qu'elles ne gagnent : le dernier déficit a atteint {deficit}, soit {deficit_pct}. Ce qui manque est emprunté.",
      "Les emprunts accumulés forment la dette : {dette}, soit {dette_pct}, ou environ {dette_hab} par habitant.",
      "Une dette ne se rembourse pas d'un coup : l'État emprunte à nouveau pour rembourser les anciens prêts. Le vrai coût, ce sont les intérêts : {interets} par an, et ils augmentent quand les taux montent.",
      "Les règles européennes demandent un déficit sous 3 % du PIB et une dette sous 60 % : la France est au-dessus des deux.",
    ],
    aSavoir: "Sur ce site, toute dépense nouvelle doit être financée (ou l'emprunt assumé clairement) : c'est la même règle que pour les députés (article 40 de la Constitution).",
    actions: [
      { libelle: 'Le budget et le déficit', lien: '/budget' },
      { libelle: 'Chercher des économies', lien: '/atelier?budget=1' },
    ],
  },
  {
    id: 'retraites',
    titre: 'Comment marchent les retraites ?',
    icone: 'Hourglass',
    accroche: "Les cotisations de ceux qui travaillent paient les pensions des retraités d'aujourd'hui. Avec moins de travailleurs par retraité, l'équilibre devient plus difficile.",
    chiffres: [
      { cle: 'nb', libelle: 'Retraités', format: 'personnes', metrique: 'retraites.nombre_retraites' },
      { cle: 'ratio', libelle: 'Cotisants pour un retraité', format: 'ratio', metrique: 'retraites.ratio_cotisants_retraites' },
      { cle: 'age', libelle: 'Âge moyen de départ', format: 'ans', metrique: 'retraites.age_moyen_depart' },
      { cle: 'depenses', libelle: 'Coût du système', format: 'md', metrique: 'retraites.depenses_totales_md', cache: true },
      { cle: 'depenses_pct', libelle: 'Part du PIB', format: 'pct_pib', metrique: 'retraites.depenses_pct_pib', cache: true },
      { cle: 'pension_h', libelle: 'Pension moyenne des hommes', format: 'eur', metrique: 'retraites.pension_dd_brute_moyenne_hommes', cache: true },
      { cle: 'pension_f', libelle: 'Pension moyenne des femmes', format: 'eur', metrique: 'retraites.pension_dd_brute_moyenne_femmes', cache: true },
    ],
    texte: [
      "La France compte {nb} à la retraite. Leurs pensions sont payées par les cotisations de ceux qui travaillent aujourd'hui : c'est la « retraite par répartition ».",
      "On compte {ratio} cotisants pour un retraité. Quand ce nombre baisse, il n'y a que trois leviers : cotiser plus, verser des pensions moins élevées, ou partir plus tard.",
      "Le système coûte {depenses} par an ({depenses_pct}). On part en moyenne à {age}.",
      "La pension moyenne avant prélèvements (hors pension de réversion) est de {pension_h} par mois pour les hommes et de {pension_f} pour les femmes, dont les carrières ont souvent été plus courtes ou moins payées.",
    ],
    actions: [
      { libelle: 'À quel âge pourrai-je partir ?', lien: '/mes-droits' },
      { libelle: 'Tester la retraite à 62 ans', preset: 'retraite-62' },
    ],
  },
  {
    id: 'inegalites',
    titre: 'Les inégalités en France',
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
      "Le niveau de vie « du milieu » (médian) est de {mediane} pour une personne seule : la moitié de la population a moins, l'autre moitié plus. Pour un foyer de plusieurs personnes, on divise le revenu en tenant compte de la taille du foyer.",
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
]
