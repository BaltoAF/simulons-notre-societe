// Client de l'API Société 2.0 et types partagés.

export type Valeur = number | boolean | string | Tranche[] | null
export type Tranche = { seuil: number; taux: number }

export type Confiance = {
  score: number
  niveau: 'tres_eleve' | 'eleve' | 'faible' | 'tres_faible'
  libelle: string
  description: string
  facteurs: { nom: string; valeur: number; explication: string }[]
  resume: string
}

export type Regle = {
  id: string
  titre: string
  domaine: string
  theme: string
  type: 'nombre' | 'booleen' | 'choix' | 'texte' | 'bareme'
  unite: string
  valeur: Valeur
  valeur_depuis: string | null
  nb_sources: number
  meilleure_source: string | null
  a_verifier: boolean
  simulable: boolean
  levier: boolean
  virtuel: boolean
  bornes?: [number, number] | null
  choix?: string[] | null
  explication: string
  prochaine_valeur?: { depuis: string; valeur: Valeur; sources: string[] } | null
}

export type Source = {
  id: string
  type: string
  editeur?: string
  titre?: string
  url?: string
  date_publication?: string
  consulte_le?: string
  auteurs?: string[]
  fiabilite?: number
  nb_citations?: number
  note?: string
}

export type PreuveResume = {
  id: string
  titre: string
  unite: string
  definition?: string
  valeur_retenue: number | null
  fourchette: [number, number] | null
  confiance: Confiance
  n_estimations: number
  regles_liees?: string[]
}

export type RegleDetail = Regle & {
  valeurs: { depuis: string; valeur: Valeur; sources: string[]; article?: string }[]
  sources: Source[]
  note?: string
  tags: string[]
  fichier: string
  genere?: boolean
  verifie_le?: string
  moteur?: { openfisca: string } | null
  preuves: PreuveResume[]
  article?: string | null
  controles?: { regle: string; valeur: Valeur; autre_valeur: Valeur; autre_source: string; concordant: boolean }[]
}

export type Indicateur = {
  id: string
  libelle: string
  valeur: number | null
  unite: string
  avant: number | null
  apres: number | null
  confiance: Confiance | null
  explication: string
  calcul: string[]
  sources: string[]
  preuves: string[]
  sens: 'favorable' | 'defavorable' | 'neutre'
  fourchette: [number, number] | null
}

export type Section = {
  id: string
  titre: string
  sous_titre: string
  indicateurs: Indicateur[]
  confiance: Confiance | null
  methode: string
  limites: string[]
  donnees: Record<string, any>
}

export type Rapport = {
  regles_modifiees: { regle: string; titre: string; domaine: string; unite: string; type: string; avant: Valeur; apres: Valeur }[]
  sections: Section[]
  synthese: {
    solde_public_annuel_md: number | null
    composantes_solde: { section: string; libelle: string; valeur: number; confiance: Confiance | null }[]
    confiance_solde: Confiance | null
    messages: { section: string; texte: string }[]
  }
  erreurs: { module: string; erreur: string }[]
  duree_secondes: number
}

export type Domaine = { id: string; titre: string; question: string; icone: string; nb_regles: number }

export type Meta = {
  date_reference: string
  mois_reference: string
  annee_reference: string
  stats: {
    regles: number; regles_sourcees: number; regles_texte_officiel: number; regles_a_verifier: number
    sources: number; metriques: number; preuves: number; estimations: number
    par_domaine: Record<string, number>; erreurs: number; avertissements: number
  }
  domaines: Domaine[]
  version_societe: string
  dernier_commit_systeme: Commit
  moteur: { nom: string; version: string | null; pret: boolean }
  types_sources: Record<string, string>
}

export type Changement = {
  regle: string; titre?: string; unite?: string; domaine?: string; type?: string
  avant: Valeur; apres: Valeur; justification?: string; sources?: string[]
}

export type Commit = {
  id: string; society_id: string; parent_id: string | null; second_parent_id: string | null
  auteur: string | null; auteur_systeme: boolean; message: string; created_at: string
  base_snapshot: string; changes: Changement[]; nb_surcharges: number
}

export type Societe = {
  id: string; nom: string; description: string; owner_id: number | null; owner_pseudo: string | null
  parent_id: string | null; parent_nom?: string | null; parent_commit: string | null; visibilite: string
  reference: boolean; created_at: string; updated_at: string; etoiles: number
  nb_differences?: number | null; propositions_ouvertes?: number
}

export type SocieteDetail = Societe & {
  branche: string; head: Commit; branches: { nom: string; head: string; message: string; commit_date: string }[]
  differences_reference: Changement[]; differences_parent: Changement[] | null; a_jour_reference: boolean
  etoile: boolean; proprietaire: boolean; propositions: PropositionResume[]
}

export type PropositionResume = {
  id: number; titre: string; statut: string; created_at: string; source_society: string; source_branch: string
  target_society: string; target_branch: string; auteur: string; source_nom: string; target_nom: string
}

export type Utilisateur = { id: number; pseudo: string; identite_verifiee: boolean; created_at: string }

export class ApiError extends Error {
  status: number
  data: any
  constructor(status: number, message: string, data: any) {
    super(message)
    this.status = status
    this.data = data
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any; signal?: AbortSignal } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
    signal: opts.signal,
  })
  const text = await res.text()
  let data: any = null
  try { data = text ? JSON.parse(text) : null } catch { data = { message: text } }
  if (!res.ok) {
    const err = data?.erreur ?? data?.detail ?? data
    const msg = typeof err === 'string' ? err : err?.message || `Erreur ${res.status}`
    throw new ApiError(res.status, msg, err)
  }
  return data as T
}
