// Recherche de règles pensée pour le grand public : tous les mots, dans n'importe quel ordre, sans tenir compte des
// accents ; les correspondances dans le titre d'abord, puis les règles les plus recherchées.
import type { Regle } from './api'

export const norm = (t: string) => (t ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// règles que le grand public cherche le plus (même liste que REGLES_CLES côté serveur)
export const REGLES_CLES = ['travail.smic.horaire_brut', 'prestations.rsa.montant_forfaitaire', 'prestations.prime_activite.montant_forfaitaire',
  'retraites.age_legal.generation_1969_et_apres', 'fiscalite.impot_revenu.bareme', 'fiscalite.tva.taux_normal',
  'fiscalite.csg.salaires_taux', 'travail.duree.legale_hebdomadaire', 'prestations.famille.af_nombre_enfants_minimum',
  'transports.vitesse_max.autoroute']

const rangCle = (r: Regle) => { const i = REGLES_CLES.indexOf(r.id); return i < 0 ? REGLES_CLES.length : i }

/** Filtre et classe les règles pour une recherche ; sans recherche, les règles les plus demandées d'abord. */
export function chercherRegles(regles: Regle[], q: string): Regle[] {
  const mots = norm(q).split(/\s+/).filter(Boolean)
  if (!mots.length) return [...regles].sort((a, b) => rangCle(a) - rangCle(b) || norm(a.titre).localeCompare(norm(b.titre), 'fr'))
  const scores = regles.map((r) => {
    const titre = norm(r.titre)
    const tout = norm(`${r.titre} ${r.theme} ${r.explication ?? ''}`)
    if (!mots.every((m) => tout.includes(m))) return null
    let s = 0
    for (const m of mots) {
      if (titre.startsWith(m)) s += 6
      else if (new RegExp(`(^|[^a-z])${m}`).test(titre)) s += 4
      else if (titre.includes(m)) s += 2
    }
    if (REGLES_CLES.includes(r.id)) s += 3
    return { r, s }
  }).filter((x): x is { r: Regle; s: number } => x !== null)
  return scores.sort((a, b) => b.s - a.s || norm(a.r.titre).localeCompare(norm(b.r.titre), 'fr')).map((x) => x.r)
}
