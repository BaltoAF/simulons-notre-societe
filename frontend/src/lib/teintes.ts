// La « mosaïque » de couleurs (voir styles.css) : chaque thème et chaque grande question a sa teinte, de 1 à 8.
// Les teintes sont réparties pour que deux cartes voisines n'aient pas la même couleur et qu'aucune ne domine.
const DOMAINES: Record<string, number> = {
  fiscalite: 6, prestations: 4, travail: 5, retraites: 3, budget: 2, sante: 1, education: 7, logement: 3,
  environnement_energie: 8, transports: 2, justice_penale: 5, droit_civil: 4, institutions: 1, nationalite_immigration: 7,
}
const QUESTIONS: Record<string, number> = {
  'depenses-publiques': 2, 'qui-paie': 6, dette: 4, retraites: 3, inegalites: 5, climat: 8, travail: 5, ecole: 7, sante: 1,
}

/** Classe CSS de la teinte d'un thème (domaine des règles). */
export function teinteDomaine(id?: string): string {
  return `teinte-${(id && DOMAINES[id]) || 1}`
}

/** Classe CSS de la teinte d'une grande question. */
export function teinteQuestion(id: string): string {
  return `teinte-${QUESTIONS[id] ?? 1}`
}

/** Classe CSS de la n-ième teinte (pour des cartes en série : 0 → teinte 1, 1 → teinte 2…). */
export const teinte = (n: number) => `teinte-${(n % 8) + 1}`
