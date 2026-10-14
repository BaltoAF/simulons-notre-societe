// Recherche de règles pensée pour le grand public : tous les mots importants, dans n'importe quel ordre, sans tenir
// compte des accents ni du pluriel ; les petits mots (« de », « la », « ans »…) et les nombres absents ne bloquent pas ;
// quelques mots courants renvoient au vocabulaire officiel (« hôpital » → ONDAM, « APL » → aides au logement).
import type { Regle } from './api'

export const norm = (t: string) => (t ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

// règles que le grand public cherche le plus (même liste que REGLES_CLES côté serveur)
export const REGLES_CLES = ['travail.smic.horaire_brut', 'prestations.rsa.montant_forfaitaire', 'prestations.prime_activite.montant_forfaitaire',
  'retraites.age_legal.generation_1969_et_apres', 'fiscalite.impot_revenu.bareme', 'fiscalite.tva.taux_normal',
  'fiscalite.csg.salaires_taux', 'travail.duree.legale_hebdomadaire', 'prestations.famille.af_nombre_enfants_minimum',
  'transports.vitesse_max.autoroute']

const PETITS_MOTS = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'pour', 'un', 'une',
  'sur', 'par', 'ans', 'an', 'mois', 'euros', 'euro', 'eur', 'quel', 'quelle', 'combien', 'mon', 'ma', 'mes'])
const SYNONYMES: Record<string, string[]> = {
  // clés sous la forme des mots cherchés, sans pluriel (voir racine())
  hopital: ['ondam', 'hopitaux', 'assurance maladie'], hopitau: ['ondam', 'hopital', 'assurance maladie'], apl: ['logement'], ecole: ['enseignement', 'scolaire'],
  police: ['securite'], pension: ['retraite'], depart: ['age legal'], chomage: ['assurance chomage', 'allocation'], salaire: ['smic'],
}

type Cherchable = Regle & { mots?: string }

const rangCle = (r: Regle) => { const i = REGLES_CLES.indexOf(r.id); return i < 0 ? REGLES_CLES.length : i }
const racine = (m: string) => (m.length > 4 ? m.replace(/(s|x)$/, '') : m)

/** Filtre et classe les règles pour une recherche ; sans recherche, les règles les plus demandées d'abord. */
export function chercherRegles<T extends Cherchable>(regles: T[], q: string): T[] {
  const tous = norm(q).split(/[\s'’,;:!?.()-]+/).filter(Boolean)
  if (!tous.length) return [...regles].sort((a, b) => rangCle(a) - rangCle(b) || norm(a.titre).localeCompare(norm(b.titre), 'fr'))
  const utiles = tous.filter((m) => !PETITS_MOTS.has(m))
  const mots = (utiles.length ? utiles : tous).map(racine)
  const requis = mots.filter((m) => !/^\d+([.,]\d+)?$/.test(m)) // un nombre absent ne bloque pas (« retraite 62 ans »)
  const trouve = (texte: string, m: string) => texte.includes(m) || (SYNONYMES[m] ?? []).some((s) => texte.includes(s))
  const scores = regles.map((r) => {
    const titre = norm(r.titre)
    const tout = norm(`${r.titre} ${r.theme} ${r.explication ?? ''} ${r.mots ?? ''}`)
    if (!requis.every((m) => trouve(tout, m))) return null
    if (!requis.length && !mots.some((m) => tout.includes(m))) return null
    let s = 0
    for (const m of mots) {
      if (titre.startsWith(m)) s += 6
      else if (new RegExp(`(^|[^a-z])${m}`).test(titre)) s += 4
      else if (titre.includes(m)) s += 2
      else if ((SYNONYMES[m] ?? []).some((x) => titre.includes(x))) s += 3
      else if (tout.includes(m)) s += 1
    }
    if (REGLES_CLES.includes(r.id)) s += 5
    return { r, s }
  }).filter((x): x is { r: T; s: number } => x !== null)
  return scores.sort((a, b) => b.s - a.s || norm(a.r.titre).localeCompare(norm(b.r.titre), 'fr')).map((x) => x.r)
}
