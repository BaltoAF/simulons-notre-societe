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

/** 62,75 → « 62 ans et 9 mois » ; 64 → « 64 ans » (une décimale d'année ne veut rien dire pour la plupart des gens). */
export function anEtMois(v: number): string {
  const ans = Math.floor(v + 1e-9)
  const mois = Math.round((v - ans) * 12)
  if (mois === 12) return `${ans + 1} an${ans + 1 >= 2 ? 's' : ''}`
  if (ans === 0) return `${mois} mois` // « 3 mois », pas « 0 an et 3 mois »
  return `${ans} an${ans >= 2 ? 's' : ''}${mois ? ` et ${mois} mois` : ''}`
}

/** Écart entre deux valeurs d'une règle, dans l'unité la plus parlante : « −2 ans », « +0,5 point », « +15 % ». */
export function ecartLisible(avant: number, apres: number, u: string): string {
  const d = apres - avant
  const s = d > 0 ? '+' : '−'
  if (u === 'pourcent') return `${s}${nombre(Math.abs(d), 2)} point${Math.abs(d) >= 2 ? 's' : ''}`
  if (u === 'ans') return `${s}${anEtMois(Math.abs(d))}`
  if (u === 'mois' || u === 'jours' || u === 'heures' || u === 'trimestres' || u === 'semaines') return `${s}${nombre(Math.abs(d), 0)} ${uniteLisible(u)}`
  if (u === 'enfants' || u === 'personnes') return `${s}${nombre(Math.abs(d), 0)} ${Math.abs(d) >= 2 ? u : u.slice(0, -1)}`
  if (!avant) return `${s}${nombre(Math.abs(d), 2)}`
  return `${s}${nombre(Math.abs(d / avant * 100), 1)} %`
}

const UNITES: Record<string, (v: number) => string> = {
  euros: (v) => euros(v, Number.isInteger(v) ? 0 : 2),
  euros_mois: (v) => euros(v, 0) + ' / mois',
  milliards_euros: (v) => nombre(v, Math.abs(v) < 10 ? 2 : 1) + (Math.abs(v) >= 2 ? ' milliards €' : ' milliard €'),
  millions_euros: (v) => nombre(v, 0) + (Math.abs(v) >= 2 ? ' millions €' : ' million €'),
  pourcent: (v) => nombre(v, v !== 0 && Math.abs(v) < 0.1 ? 4 : 2) + ' %',
  pourcent_part: (v) => nombre(v, 1) + ' %',
  points: (v) => nombre(v, 2) + ' pt',
  points_pib: (v) => nombre(v, 2) + ' pt de PIB',
  ans: (v) => anEtMois(v),
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

/** Unité lisible : « km_h » → « km/h », « euros_par_hectolitre » → « € par hectolitre », « pourcent_pib » → « % du PIB ». */
export function uniteLisible(u: string): string {
  const map: Record<string, string> = { km_h: 'km/h', pourcent_pib: '% du PIB', mt_co2e: 'Mt CO₂e', twh_par_an: 'TWh par an', gw: 'GW', kg: 'kg', etpt: 'emplois à temps plein' }
  return map[u] ?? u.replace(/^euros_par_/, '€ par ').replace(/^euros$/, '€').replace(/_par_/g, ' par ').replace(/_/g, ' ')
    .replace(/\bmwh\b/g, 'MWh').replace(/\bkwh\b/g, 'kWh').replace(/\bco2e?\b/g, 'CO₂').replace(/\btco2e?\b/g, 'tonne de CO₂')
}

export function unite(u: string): string {
  const map: Record<string, string> = {
    euros: '€', euros_mois: '€/mois', milliards_euros: 'milliards €', pourcent: '%', ans: 'ans', mois: 'mois', jours: 'jours',
    heures: 'h', smic: 'SMIC', parts: 'parts', enfants: 'enfants',
  }
  return map[u] ?? uniteLisible(u)
}

export function valeur(v: Valeur | undefined, u = '', type?: string): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  if (Array.isArray(v)) return bareme(v)
  if (typeof v === 'number') {
    const f = UNITES[u]
    if (f) return f(v)
    // taxes sur les carburants : aussi en euros par litre, l'unité que chacun connaît
    if (u === 'euros_par_hectolitre') return `${nombre(v, 2)} € par hectolitre (environ ${nombre(v / 100, 2)} € par litre)`
    return nombre(v) + (u ? ' ' + uniteLisible(u) : '')
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
  const txt = dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  return dt.getDate() === 1 ? txt.replace(/^1 /, '1er ') : txt
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

/** Prévenir quand un lien de source télécharge un fichier au lieu d'ouvrir une page (« (fichier Excel) »). */
export function natureLien(url?: string | null): string {
  const ext = url?.toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1]
  return ext === 'xlsx' || ext === 'xls' ? ' (fichier Excel)' : ext === 'csv' ? ' (fichier CSV)' : ext === 'pdf' ? ' (PDF)' : ext === 'zip' ? ' (archive ZIP)' : ''
}

/** Espaces insécables dans les nombres et devant % et € : « 250 000 € » ou « 9 % » ne se coupent pas en fin de ligne. */
export function insecable(t: string): string {
  return t.replace(/(\d) (?=\d{3}\b)/g, '$1\u202f').replace(/ (%|€)/g, '\u00a0$1')
}
