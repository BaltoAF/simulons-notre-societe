import type { Tranche, Valeur } from './api'

const nf = (d = 2) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: d })

export function nombre(x: number | null | undefined, d = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return nf(d).format(x)
}

export function euros(x: number | null | undefined, d = 0): string {
  if (x === null || x === undefined) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: d, minimumFractionDigits: d }).format(x)
}

export function signe(x: number, txt: string): string {
  if (x > 0) return '+' + txt
  return txt.replace('-', '−')
}

const UNITES: Record<string, (v: number) => string> = {
  euros: (v) => euros(v, Number.isInteger(v) ? 0 : 2),
  euros_mois: (v) => euros(v, 0) + ' / mois',
  milliards_euros: (v) => nombre(v, Math.abs(v) < 10 ? 2 : 1) + ' Md€',
  millions_euros: (v) => nombre(v, 0) + ' M€',
  pourcent: (v) => nombre(v, 2) + ' %',
  pourcent_part: (v) => nombre(v, 1) + ' %',
  points: (v) => nombre(v, 2) + ' pt',
  points_pib: (v) => nombre(v, 2) + ' pt de PIB',
  ans: (v) => nombre(v, 1) + (v >= 2 ? ' ans' : ' an'),
  mois: (v) => nombre(v, 1) + ' mois',
  jours: (v) => nombre(v, 0) + (v >= 2 ? ' jours' : ' jour'),
  heures: (v) => nombre(v, 0) + ' h',
  personnes: (v) => nombre(v, 0) + ' pers.',
  emplois: (v) => nombre(v, 0) + ' emplois',
  menages: (v) => nombre(v, 0),
  regles: (v) => nombre(v, 0),
  enfants: (v) => nombre(v, 0) + (v >= 2 ? ' enfants' : ' enfant'),
  parts: (v) => nombre(v, 2) + (v >= 2 ? ' parts' : ' part'),
  smic: (v) => nombre(v, 2) + ' SMIC',
  sieges: (v) => nombre(v, 0) + ' sièges',
  ratio: (v) => nombre(v, 3),
  mt_co2e: (v) => nombre(v, Math.abs(v) < 1 ? 2 : 1) + ' Mt CO₂e',
  points_sur_10: (v) => nombre(v, 3) + ' pt sur 10',
  ecart_type: (v) => nombre(v, 3) + ' écart-type',
  heures_an: (v) => nombre(v, 0) + ' h/an',
  elasticite: (v) => nombre(v, 3),
}

export function unite(u: string): string {
  const map: Record<string, string> = {
    euros: '€', euros_mois: '€/mois', milliards_euros: 'Md€', pourcent: '%', ans: 'ans', mois: 'mois', jours: 'jours',
    heures: 'h', smic: 'SMIC', parts: 'parts', enfants: 'enfants',
  }
  return map[u] ?? u
}

export function valeur(v: Valeur | undefined, u = '', type?: string): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return bareme(v)
  if (typeof v === 'number') {
    const f = UNITES[u]
    if (f) return f(v)
    return nombre(v) + (u ? ' ' + u.replace(/_/g, ' ') : '')
  }
  if (type === 'choix') return String(v).replace(/_/g, ' ')
  return String(v)
}

export function bareme(t: Tranche[]): string {
  const tr = t.filter((b) => b.taux > 0)
  return `${tr.length} tranches (${tr.map((b) => nombre(b.taux, 1) + ' %').join(', ')})`
}

export function delta(x: number | null | undefined, u = 'euros'): { txt: string; cls: string } {
  if (x === null || x === undefined) return { txt: '—', cls: 'zero' }
  const abs = Math.abs(x)
  if (abs < 0.005) return { txt: '±0', cls: 'zero' }
  const base = valeur(abs, u)
  return { txt: (x > 0 ? '+' : '−') + base, cls: x > 0 ? 'pos' : 'neg' }
}

export function date(d?: string | null): string {
  if (!d) return '—'
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + (d.includes('T') || d.length === 10 ? '' : 'Z'))
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function dateCourte(d?: string | null): string {
  if (!d) return '—'
  const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d.replace(' ', 'T') + 'Z')
  if (Number.isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function relatif(d?: string | null): string {
  if (!d) return ''
  const dt = new Date(d.replace(' ', 'T') + (d.includes('T') ? '' : 'Z'))
  const s = (Date.now() - dt.getTime()) / 1000
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  if (s < 86400 * 30) return `il y a ${Math.floor(s / 86400)} j`
  return dateCourte(d)
}

export const STATUT_SUGGESTION: Record<string, string> = { ouverte: 'en discussion', fusionnee: 'intégrée', fermee: 'refusée' }

export const DOMAINE_TITRE: Record<string, string> = {
  fiscalite: 'Impôts et taxes', prestations: 'Aides et prestations', travail: 'Travail et emploi', retraites: 'Retraites',
  budget: 'Budget public', sante: 'Santé', education: 'Éducation', logement: 'Logement',
  environnement_energie: 'Environnement et énergie', justice_penale: 'Justice pénale', droit_civil: 'Famille et droit civil',
  institutions: 'Institutions', nationalite_immigration: 'Nationalité et immigration', transports: 'Transports et route',
}
