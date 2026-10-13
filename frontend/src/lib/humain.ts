// Traduire les chiffres en langage courant : montants lisibles, équivalences concrètes, phrases.
import { euros, nombre } from './format'

const MENAGES = 31.3e6
const HABITANTS = 69.1e6
const EMPREINTE_HAB_T = 8.2 // empreinte carbone moyenne d'un Français, en tonnes de CO₂e par an

export function milliards(md: number, signe = false): string {
  const a = Math.abs(md)
  const s = signe ? (md > 0 ? '+' : md < 0 ? '−' : '') : (md < 0 ? '−' : '')
  if (a >= 1) return `${s}${nombre(a, a >= 10 ? 0 : 1)} milliard${a >= 2 ? 's' : ''} €`
  return `${s}${nombre(a * 1000, 0)} millions €`
}

export function parMenageMois(md: number): string {
  return euros(Math.abs(md) * 1e9 / MENAGES / 12, 0)
}

export function tonnes(mt: number, signe = false): string {
  const a = Math.abs(mt)
  const s = signe ? (mt > 0 ? '+' : mt < 0 ? '−' : '') : ''
  if (a >= 1) return `${s}${nombre(a, 1)} million${a >= 2 ? 's' : ''} de tonnes de CO₂`
  return `${s}${nombre(a * 1000, 0)} milliers de tonnes de CO₂`
}

/** « ≈ l'empreinte carbone annuelle de 127 000 Français » */
export function equivalentCarbone(mt: number): string {
  const n = Math.abs(mt) * 1e6 / EMPREINTE_HAB_T
  const txt = n >= 1e6 ? `${nombre(n / 1e6, 1)} million${n >= 2e6 ? 's' : ''}` : nombre(Math.round(n / 1000) * 1000, 0)
  return `≈ l'empreinte carbone annuelle de ${txt} Français`
}

export function parHabitant(md: number): string {
  return euros(Math.abs(md) * 1e9 / HABITANTS, 0)
}

function qualif(v: number, faible: number, fort: number): string {
  const a = Math.abs(v)
  return a < faible ? 'très légèrement' : a < fort ? 'légèrement' : 'nettement'
}

/** Une phrase simple pour un indicateur clé du bilan. */
export function phrase(id: string, v: number, unite: string): string {
  if (id === 'equilibre_budget') {
    if (Math.abs(v) < 0.05) return 'Pas d\'effet notable sur les finances publiques.'
    return v < 0 ? `Coûte ${milliards(Math.abs(v))} par an aux finances publiques (≈ ${parMenageMois(v)} par mois et par ménage).`
      : `Rapporte ${milliards(v)} par an aux finances publiques.`
  }
  if (id === 'equilibre_carbone' || id.startsWith('emissions_')) {
    if (Math.abs(v) < 0.005) return 'Pas d\'effet notable sur les émissions.'
    return `${v > 0 ? 'Hausse' : 'Baisse'} des émissions : ${tonnes(v)} par an (${equivalentCarbone(v)}).`
  }
  if (id === 'impact_emissions_activite') return `Effet indirect via l'activité : ${tonnes(v, true)} par an (incertain).`
  if (id === 'pib') return Math.abs(v) < 0.01 ? 'Activité économique quasiment inchangée.' : `L'activité économique ${v > 0 ? 'progresse' : 'recule'} ${qualif(v, 0.05, 0.3)} (${v > 0 ? '+' : '−'}${nombre(Math.abs(v), 2)} % de PIB).`
  if (id.startsWith('emploi_')) return `≈ ${nombre(Math.abs(Math.round(v / 1000) * 1000), 0)} emplois ${v > 0 ? 'en plus' : 'en moins'}.`
  if (id === 'gini') return Math.abs(v) < 0.02 ? 'Inégalités inchangées.' : `Les inégalités ${v < 0 ? 'baissent' : 'augmentent'} ${qualif(v, 0.1, 0.5)}.`
  if (id === 'pauvrete') return Math.abs(v) < 0.02 ? 'Pauvreté inchangée.' : `La pauvreté ${v < 0 ? 'recule' : 'progresse'} ${qualif(v, 0.1, 0.5)} (${v > 0 ? '+' : '−'}${nombre(Math.abs(v), 1)} point).`
  if (id === 'gagnants') return `${nombre(v, 0)} % des ménages y gagnent.`
  if (id.startsWith('pouvoir_achat_tva_d1')) return `Pouvoir d'achat des plus modestes : ${v > 0 ? '+' : '−'}${nombre(Math.abs(v), 2)} %.`
  if (id === 'bien_etre_satisfaction') return Math.abs(v) < 0.002 ? 'Satisfaction dans la vie quasiment inchangée.' : `Satisfaction dans la vie : ${v > 0 ? 'légère hausse' : 'légère baisse'} en moyenne.`
  if (id === 'bien_etre_satisfaction_d1') return Math.abs(v) < 0.002 ? 'Rien ne change pour les plus modestes.' : `Pour les plus modestes : ${v > 0 ? 'mieux-être' : 'mal-être'} ${qualif(v, 0.02, 0.1)} ressenti.`
  if (id.startsWith('securite_routiere_tues')) return `≈ ${nombre(Math.abs(Math.round(v)), 0)} morts ${v < 0 ? 'de moins' : 'de plus'} sur les routes par an.`
  if (id === 'consommation_tabac') return `Consommation de cigarettes : ${v > 0 ? '+' : '−'}${nombre(Math.abs(v), 1)} %.`
  if (id === 'temps_libre') return `${nombre(Math.abs(v), 0)} heures de temps libre ${v > 0 ? 'en plus' : 'en moins'} par an pour un salarié.`
  if (id === 'bien_etre_emploi') return `${nombre(Math.abs(Math.round(v / 1000) * 1000), 0)} personnes ${v > 0 ? 'perdraient' : 'retrouveraient'} un emploi : un choc fort sur leur bien-être.`
  if (id === 'bien_etre_sante_retraite') return `Santé des personnes concernées par l'âge de la retraite : ${v > 0 ? 'plutôt meilleure' : 'plutôt moins bonne'} (études divergentes).`
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${nombre(Math.abs(v), 2)} ${unite.replace(/_/g, ' ')}`
}

export const CONFIANCE_FEMININ: Record<string, string> = {
  tres_eleve: 'très élevée', eleve: 'élevée', faible: 'faible', tres_faible: 'très faible',
}
