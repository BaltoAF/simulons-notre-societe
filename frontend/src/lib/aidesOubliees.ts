// « Avez-vous pensé à… ? » : quelles aides souvent oubliées proposer à un foyer (fiches dans model/aides/oubliees.yaml).
// Ce sont des indices tirés du profil, pas un calcul de droits : les plafonds sont comparés à des revenus estimés.
import type { AdulteSaisie, SituationSaisie } from './state'

export type SourceCourte = { id: string; titre: string; editeur: string; url?: string; date_publication?: string | null; consulte_le?: string }

export type Criteres = {
  calculee?: string
  activite?: AdulteSaisie['activite'][]
  age_min?: number
  age_max?: number
  salaire_max?: number
  seul?: boolean
  enfant_age?: [number, number]
  logement?: SituationSaisie['logement'][]
  ressources_c2s_max?: number
  rfr_par_uc_max?: number
  hors_rattaches?: boolean
  ou?: Criteres[]
}

export type AideOubliee = {
  id: string
  nom: string
  en_bref: string
  pourquoi_vous: string
  pour_qui?: string
  ce_que_ca_apporte: string
  ou_la_demander: string
  url_officielle: string
  non_recours?: string
  versement?: 'annuel'
  criteres: Criteres
  rappel?: { criteres: Criteres; texte: string; ton?: 'rassurant' }
  source: SourceCourte | null
  non_recours_source: SourceCourte | null
  sources_complementaires: SourceCourte[]
}

type Ligne = { id: string; montant: number; nature: string; libelle?: string }

/** Étudiant compté dans la déclaration d'impôt de ses parents (par défaut oui avant 25 ans) : ses propres revenus ne disent rien du foyer. */
export function estRattache(a: AdulteSaisie): boolean {
  return a.activite === 'etudiant' && (a.rattache ?? a.age < 25)
}

/** Plafond de la C2S selon la taille du foyer : +50 % pour la 2e personne, +30 % pour la 3e et la 4e, +40 % au-delà (barème ameli). */
function coefC2s(n: number): number {
  return 1 + (n >= 2 ? 0.5 : 0) + 0.3 * Math.min(Math.max(n - 2, 0), 2) + 0.4 * Math.max(n - 4, 0)
}

/** Unités de consommation du chèque énergie : 1 pour la première personne, 0,5 pour la deuxième, 0,3 pour chacune des suivantes. */
function ucChequeEnergie(n: number): number {
  return 1 + (n >= 2 ? 0.5 : 0) + 0.3 * Math.max(n - 2, 0)
}

/** Revenu fiscal de référence estimé : revenus nets + environ 3 % (CSG et CRDS non déductibles) − 10 % d'abattement, soit × 0,93. */
function rfrEstime(s: SituationSaisie): number {
  const nets = s.adultes.reduce((a, x) => a + (x.activite === 'inactif' ? 0 : x.montant_net), 0)
  return nets * 12 * 0.93 + s.revenus_capital_annuels
}

function correspond(c: Criteres, s: SituationSaisie, lignes: Ligne[]): boolean {
  if (c.ou && !c.ou.some((x) => correspond(x, s, lignes))) return false
  if (c.calculee && !lignes.some((l) => l.id === c.calculee && l.montant > 0.5)) return false
  if (c.seul && s.adultes.length !== 1) return false
  if (c.hors_rattaches && s.adultes.length === 1 && estRattache(s.adultes[0])) return false
  if (c.logement && !c.logement.includes(s.logement)) return false
  if (c.enfant_age && !s.enfants.some((a) => a >= c.enfant_age![0] && a <= c.enfant_age![1])) return false
  const parAdulte = c.activite || c.age_min != null || c.age_max != null || c.salaire_max != null
  if (parAdulte && !s.adultes.some((a) => (!c.activite || c.activite.includes(a.activite)) && (c.age_min == null || a.age >= c.age_min)
    && (c.age_max == null || a.age < c.age_max) && (c.salaire_max == null || a.montant_net <= c.salaire_max))) return false
  const n = s.adultes.length + s.enfants.length
  if (c.ressources_c2s_max != null) {
    // ressources du foyer : revenus nets et prestations, sauf l'aide au logement (la C2S n'en retient qu'un forfait)
    const ressources = lignes.filter((l) => l.nature === 'revenu' || (l.nature === 'prestation' && l.id !== 'aides_logement')).reduce((a, l) => a + l.montant, 0)
    if (ressources > c.ressources_c2s_max * coefC2s(n)) return false
  }
  if (c.rfr_par_uc_max != null && rfrEstime(s) / ucChequeEnergie(n) >= c.rfr_par_uc_max) return false
  return true
}

export type AideProposee = AideOubliee & { montant: number | null; libelle: string; rappelVisible: boolean }

/** Les textes des fiches peuvent citer les plafonds du foyer : {plafond_c2s} et {plafond_c2s_gratuite} (par mois), {plafond_cheque} (par an). */
function personnaliser(texte: string, c: Criteres, s: SituationSaisie): string {
  const n = s.adultes.length + s.enfants.length
  const euros = (x: number) => `${Math.round(x).toLocaleString('fr-FR')} €`
  const c2s = c.ressources_c2s_max ?? c.ou?.find((x) => x.ressources_c2s_max)?.ressources_c2s_max
  const cheque = c.rfr_par_uc_max ?? c.ou?.find((x) => x.rfr_par_uc_max)?.rfr_par_uc_max
  return texte
    .replace('{plafond_c2s}', c2s ? euros(c2s * coefC2s(n)) : '')
    // le plafond de la C2S payante est celui de la C2S gratuite majoré de 35 % (code de la sécurité sociale, art. L861-1)
    .replace('{plafond_c2s_gratuite}', c2s ? euros(c2s * coefC2s(n) / 1.35) : '')
    .replace('{plafond_cheque}', cheque ? euros(cheque * ucChequeEnergie(n)) : '')
}

/** Les aides à proposer : d'abord celles que le site a calculées (du plus gros montant au plus petit), puis les pistes à vérifier. */
export function aidesPourVous(aides: AideOubliee[], s: SituationSaisie, lignes: Ligne[]): AideProposee[] {
  const out = aides.filter((a) => correspond(a.criteres, s, lignes)).map((a) => {
    const l = a.criteres.calculee ? lignes.find((x) => x.id === a.criteres.calculee) : undefined
    // une aide déjà calculée porte le même nom que dans le résultat, pour ne pas croire à deux aides
    return { ...a, pourquoi_vous: personnaliser(a.pourquoi_vous, a.criteres, s), montant: l ? l.montant * (a.versement === 'annuel' ? 12 : 1) : null, libelle: l?.libelle ?? a.nom,
      rappelVisible: !!a.rappel && correspond(a.rappel.criteres, s, lignes) }
  })
  const calculees = out.filter((a) => a.montant != null).sort((x, y) => y.montant! / (y.versement === 'annuel' ? 12 : 1) - x.montant! / (x.versement === 'annuel' ? 12 : 1))
  return [...calculees, ...out.filter((a) => a.montant == null)]
}
