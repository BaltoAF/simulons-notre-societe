// État partagé : utilisateur connecté, brouillon de réforme (atelier), situation du foyer (« Mes droits »).
// Le brouillon et la situation restent dans le navigateur : rien n'est stocké côté serveur sans action explicite.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, type Meta, type Utilisateur, type Valeur } from './api'
import { euros } from './format'

type Ctx = {
  user: Utilisateur | null
  setUser: (u: Utilisateur | null) => void
  meta: Meta | null
  draft: Brouillon
  setDraft: (d: Brouillon | ((d: Brouillon) => Brouillon)) => void
  situation: SituationSaisie | null
  setSituation: (s: SituationSaisie | null) => void
  parcours: Parcours
  marquer: (etape: EtapeParcours) => void
  setParcours: (p: Parcours | ((p: Parcours) => Parcours)) => void
}

// Parcours de découverte : quatre missions concrètes, cochées toutes seules quand le visiteur les fait.
// Gardé dans le navigateur (simple confort) : rien n'est envoyé au serveur.
export type EtapeParcours = 'droits' | 'question' | 'idee' | 'source'
export type Parcours = { bienvenue_vue: boolean; faites: EtapeParcours[]; masque: boolean }
export const PARCOURS_VIDE: Parcours = { bienvenue_vue: false, faites: [], masque: false }

export type Brouillon = {
  overrides: Record<string, Valeur>
  justifications: Record<string, string>
  societe: string | null   // société de départ (fork), null = Société 1.0
  branche: string
  nomSociete?: string
}

export type AdulteSaisie = {
  age: number
  activite: 'salarie' | 'chomeur' | 'retraite' | 'etudiant' | 'inactif'
  montant_net: number
  cadre: boolean
  handicap: boolean
}

export type SituationSaisie = {
  couple: 'seul' | 'marie' | 'pacse' | 'concubin'
  adultes: AdulteSaisie[]
  enfants: number[]
  logement: 'locataire_prive' | 'locataire_social' | 'proprietaire' | 'heberge'
  loyer_mensuel: number
  zone: 1 | 2 | 3
  revenus_capital_annuels: number
  mois_naissance?: number // du premier adulte (1 à 12) : sert à dater le départ à la retraite
}

export const BROUILLON_VIDE: Brouillon = { overrides: {}, justifications: {}, societe: null, branche: 'principale' }

function load<T>(key: string, def: T): T {
  try {
    const s = localStorage.getItem(key)
    return s ? (JSON.parse(s) as T) : def
  } catch {
    return def
  }
}
function save(key: string, v: unknown) {
  try {
    if (v === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(v))
  } catch { /* stockage indisponible : on continue sans */ }
}

const AppContext = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [meta, setMeta] = useState<Meta | null>(null)
  const [draft, setDraftState] = useState<Brouillon>(() => load('societe.brouillon', BROUILLON_VIDE))
  const [situation, setSituationState] = useState<SituationSaisie | null>(() => migrerSituation(load('societe.situation', null)))
  const [parcours, setParcoursState] = useState<Parcours>(() => ({ ...PARCOURS_VIDE, ...load('societe.parcours', PARCOURS_VIDE) }))

  useEffect(() => {
    api<{ utilisateur: Utilisateur | null }>('/api/auth/moi').then((r) => setUser(r.utilisateur)).catch(() => {})
    api<Meta>('/api/meta').then(setMeta).catch(() => {})
  }, [])

  const setDraft = useCallback((d: Brouillon | ((d: Brouillon) => Brouillon)) => {
    setDraftState((prev) => {
      const next = typeof d === 'function' ? (d as (x: Brouillon) => Brouillon)(prev) : d
      save('societe.brouillon', next)
      return next
    })
  }, [])
  const setSituation = useCallback((s: SituationSaisie | null) => {
    setSituationState(s)
    save('societe.situation', s)
  }, [])

  const setParcours = useCallback((p: Parcours | ((p: Parcours) => Parcours)) => {
    setParcoursState((prev) => {
      const next = typeof p === 'function' ? (p as (x: Parcours) => Parcours)(prev) : p
      save('societe.parcours', next)
      return next
    })
  }, [])
  const marquer = useCallback((etape: EtapeParcours) => {
    setParcours((p) => (p.faites.includes(etape) ? p : { ...p, faites: [...p.faites, etape] }))
  }, [setParcours])

  const value = useMemo(() => ({ user, setUser, meta, draft, setDraft, situation, setSituation, parcours, marquer, setParcours }),
    [user, meta, draft, setDraft, situation, setSituation, parcours, marquer, setParcours])
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): Ctx {
  const c = useContext(AppContext)
  if (!c) throw new Error('AppProvider manquant')
  return c
}

/** Convertit la saisie grand public en ménage pour l'API (montants nets). */
/** L'ancien profil « Couple, 2 enfants, revenus médians » (2 100 € + 1 850 €) devient le foyer type des rapports. */
function migrerSituation(s: SituationSaisie | null): SituationSaisie | null {
  if (!s || s.adultes.length !== 2) return s
  const [a, b] = s.adultes
  if (a.montant_net === 2100 && b.montant_net === 1850 && s.revenus_capital_annuels === 300 && s.enfants.join() === '8,12') {
    return { ...s, adultes: [{ ...a, montant_net: 2137 }, { ...b, montant_net: 1900 }], revenus_capital_annuels: 0 }
  }
  return s
}

export function situationVersMenage(s: SituationSaisie) {
  return {
    couple: s.adultes.length > 1 ? s.couple : 'seul',
    enfants: s.enfants,
    logement: s.logement,
    loyer_mensuel: s.logement.startsWith('locataire') ? s.loyer_mensuel : 0,
    zone: s.zone,
    revenus_capital_annuels: s.revenus_capital_annuels,
    adultes: s.adultes.map((a) => ({
      age: a.age,
      activite: a.activite,
      cadre: a.cadre,
      handicap: a.handicap,
      // un petit boulot d'étudiant est un salaire (le statut d'étudiant reste transmis : il conditionne la prime d'activité)
      salaire_net_mensuel: a.activite === 'salarie' || a.activite === 'etudiant' ? a.montant_net : 0,
      chomage_net_mensuel: a.activite === 'chomeur' ? a.montant_net : 0,
      retraite_nette_mensuelle: a.activite === 'retraite' ? a.montant_net : 0,
    })),
  }
}

/** Petit hook de chargement de données. */
export function useFetch<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!path)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (!path) { setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    api<T>(path, { signal: ctrl.signal })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false) } })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps])
  return { data, error, loading, reload: () => setTick((t) => t + 1), setData }
}

/** « couple marié, 2 enfants (8 et 12 ans), salaires 2 100 € + 1 850 € nets/mois, propriétaire » */
export function resumeSituation(s: SituationSaisie): string {
  const foyer = s.adultes.length > 1 ? `couple ${s.couple === 'marie' ? 'marié' : s.couple === 'pacse' ? 'pacsé' : 'en union libre'}` : 'personne seule'
  const enfants = s.enfants.length ? `, ${s.enfants.length} enfant${s.enfants.length > 1 ? 's' : ''} (${s.enfants.join(' et ')} ans)` : ''
  const nature: Record<string, string> = { salarie: 'salaire', chomeur: 'chômage', retraite: 'retraite', etudiant: 'étudiant', inactif: 'sans activité' }
  const revenus = s.adultes.map((a) => (['salarie', 'chomeur', 'retraite'].includes(a.activite) ? `${nature[a.activite]} ${euros(a.montant_net)} nets/mois`
    : a.activite === 'etudiant' && a.montant_net > 0 ? `étudiant avec un petit boulot de ${euros(a.montant_net)} nets/mois` : nature[a.activite])).join(' + ')
  const logement: Record<string, string> = { locataire_prive: 'locataire', locataire_social: 'locataire HLM', proprietaire: 'propriétaire', heberge: 'hébergé' }
  const epargne = s.revenus_capital_annuels > 0 ? `, épargne rapportant ${euros(s.revenus_capital_annuels)} par an` : ''
  return `${foyer}${enfants}, ${revenus}${epargne}, ${logement[s.logement] ?? ''}`
}
