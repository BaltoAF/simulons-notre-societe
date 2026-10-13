// Les missions du budget de l'État, décrites en langage courant.
// « verrou » : dépenses qui découlent d'engagements ou de règles fiscales, et qu'on ne peut pas modifier par un
// simple choix de crédits (on agit sur elles autrement : en réduisant la dette, en changeant les impôts…).
export type InfoMission = { nom: string; description: string; mots?: string; verrou?: string }

export const MISSIONS: Record<string, InfoMission> = {
  remboursements_degrevements: { nom: 'Impôts rendus aux contribuables', description: 'Trop-perçus remboursés, crédits d\'impôt (emploi à domicile, garde d\'enfants…)', mots: 'remboursements crédit impôt',
    verrou: 'Ce montant découle des règles fiscales (taux, crédits d\'impôt) : il ne se décide pas comme une dépense. Pour le changer, modifiez les règles d\'impôt elles-mêmes.' },
  engagements_financiers_etat: { nom: 'Intérêts de la dette', description: 'Intérêts versés aux prêteurs de l\'État', mots: 'dette emprunt intérêts',
    verrou: 'Ce sont les intérêts de l\'argent déjà emprunté : l\'État doit les payer, sinon plus personne ne lui prêterait. Pour les réduire, il faut emprunter moins, donc réduire le déficit.' },
  enseignement_scolaire: { nom: 'École, collège, lycée', description: 'Enseignants, écoles, collèges et lycées publics et privés sous contrat', mots: 'éducation école professeurs élèves' },
  defense: { nom: 'Défense', description: 'Armées, équipements militaires, opérations extérieures', mots: 'armée militaire' },
  recherche_enseignement_superieur: { nom: 'Universités et recherche', description: 'Universités, grandes écoles, CNRS, bourses étudiantes', mots: 'université étudiants recherche science' },
  solidarite_insertion_egalite_chances: { nom: 'Solidarité', description: 'Prime d\'activité, allocation aux adultes handicapés, protection de l\'enfance', mots: 'aides handicap pauvreté' },
  securites: { nom: 'Police et gendarmerie', description: 'Police nationale, gendarmerie, sécurité routière, sécurité civile', mots: 'police gendarmes sécurité' },
  ecologie_mobilite_durables: { nom: 'Écologie et transports', description: 'Transition énergétique, transports, routes nationales, météo', mots: 'climat environnement train route énergie' },
  cohesion_territoires: { nom: 'Logement et territoires', description: 'Aides au logement, hébergement d\'urgence, politique de la ville', mots: 'logement APL quartiers' },
  travail_emploi: { nom: 'Travail et emploi', description: 'Aides à l\'embauche, apprentissage, formation, France Travail', mots: 'chômage apprentissage formation' },
  justice: { nom: 'Justice', description: 'Tribunaux, prisons, protection judiciaire de la jeunesse', mots: 'tribunaux prison juges' },
  gestion_finances_publiques: { nom: 'Impôts et douanes (fonctionnement)', description: 'Administration des impôts et des douanes', mots: 'impôts douane administration' },
  regimes_sociaux_retraite: { nom: 'Régimes spéciaux de retraite', description: 'Retraites de la SNCF, de la RATP, des marins, des mines…', mots: 'retraite SNCF' },
  administration_generale_territoriale: { nom: 'Préfectures', description: 'Préfectures, titres d\'identité, organisation des élections', mots: 'préfecture carte identité élections' },
  investir_france_2030: { nom: 'Investissements d\'avenir', description: 'Innovation, industrie, technologies de demain (France 2030)', mots: 'innovation industrie' },
  agriculture_alimentation_foret: { nom: 'Agriculture et forêt', description: 'Aides aux agriculteurs, sécurité sanitaire des aliments, forêts', mots: 'agriculteurs alimentation' },
  relations_collectivites_territoriales: { nom: 'Aides aux collectivités', description: 'Soutien aux communes, départements et régions', mots: 'communes mairies départements' },
  culture: { nom: 'Culture', description: 'Patrimoine, musées, spectacle vivant, création', mots: 'musées patrimoine théâtre' },
  aide_publique_developpement: { nom: 'Aide au développement', description: 'Aide aux pays les plus pauvres', mots: 'international pays pauvres' },
  economie: { nom: 'Économie et entreprises', description: 'Soutien aux entreprises, commerce extérieur, statistiques', mots: 'entreprises commerce' },
  action_exterieure_etat: { nom: 'Diplomatie', description: 'Ambassades, consulats, action culturelle à l\'étranger', mots: 'ambassades étranger' },
  outre_mer: { nom: 'Outre-mer', description: 'Soutien au développement des territoires d\'outre-mer', mots: 'DOM TOM' },
  immigration_asile_integration: { nom: 'Immigration et asile', description: 'Accueil des demandeurs d\'asile, intégration, éloignement', mots: 'migrants asile' },
  sante: { nom: 'Santé (État)', description: 'Prévention, aide médicale d\'État ; l\'essentiel de la santé relève de la Sécurité sociale', mots: 'hôpital prévention' },
  monde_combattant_memoire: { nom: 'Anciens combattants', description: 'Pensions des anciens combattants, mémoire', mots: 'anciens combattants' },
  sport_jeunesse_vie_associative: { nom: 'Sport, jeunesse et associations', description: 'Sport, service civique, vie associative', mots: 'sport associations jeunes' },
  pouvoirs_publics: { nom: 'Pouvoirs publics', description: 'Présidence, Assemblée nationale, Sénat, Conseil constitutionnel', mots: 'parlement président' },
  direction_action_gouvernement: { nom: 'Services du Premier ministre', description: 'Coordination du gouvernement, cybersécurité', mots: 'gouvernement' },
  conseil_controle_etat: { nom: 'Conseil d\'État et Cour des comptes', description: 'Juridictions administratives et financières', mots: 'contrôle' },
  medias_livre_industries_culturelles: { nom: 'Médias et livre', description: 'Aides à la presse, au livre, au cinéma', mots: 'presse livre' },
  transformation_fonction_publiques: { nom: 'Modernisation de l\'État', description: 'Transformation numérique et fonction publique', mots: 'numérique fonctionnaires' },
  credits_non_repartis: { nom: 'Réserve pour imprévus', description: 'Crédits mis de côté pour les dépenses imprévues', mots: 'réserve' },
}

export function infoMission(id: string, titre: string): InfoMission {
  const slug = id.split('.').pop() ?? id
  return MISSIONS[slug] ?? { nom: titre.replace(/ : crédits de paiement.*$/, '').replace(/^Mission /, '').replace(/[«»]/g, '').trim(), description: '' }
}
