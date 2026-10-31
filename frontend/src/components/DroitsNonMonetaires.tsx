// « Vos droits au-delà de l'argent » : réponses personnalisées tirées des règles, comparables avec une autre société.
// Présentées en accordéon, un thème à la fois, pour ne pas noyer le lecteur.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, GitCompare } from 'lucide-react'
import { api, type Regle, type Societe } from '../lib/api'
import { useFetch } from '../lib/state'
import { nomCourt } from './DiffSociete'
import { Loading } from './ui'

type Reponse = { theme: string; question: string; reponse: string; regles: string[]; autre?: string | null; change?: boolean }

export function DroitsNonMonetaires({ age, mois: mois0 = 1, onMois, retraite = false }: { age: number; mois?: number; onMois?: (m: number) => void; retraite?: boolean }) {
  const annee0 = new Date().getFullYear() - age
  const [annee, setAnnee] = useState(annee0)
  const [mois, setMoisLocal] = useState(mois0)
  const setMois = (m: number) => { setMoisLocal(m); onMois?.(m) } // mémorisé avec la situation du foyer
  const [societe, setSociete] = useState('')
  const [rep, setRep] = useState<Reponse[] | null>(null)
  const [nomSoc, setNomSoc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { data: socs } = useFetch<{ societes: Societe[] }>('/api/societes?tri=populaire')
  const { data: titres } = useFetch<{ regles: Regle[] }>('/api/regles?limit=5000')

  useEffect(() => {
    setLoading(true)
    api<{ reponses: Reponse[]; societe?: { nom: string } }>('/api/droits', { body: { profil: { annee_naissance: annee, mois_naissance: mois, retraite }, societe: societe || null } })
      .then((r) => { setRep(r.reponses); setNomSoc(r.societe?.nom ?? null) })
      .finally(() => setLoading(false))
  }, [annee, mois, societe, retraite])

  // les liens vers les règles portent leur nom (« l'âge légal », « la durée de cotisation »), pas un numéro
  const nomRegle = (id: string) => {
    const t = titres?.regles.find((x) => x.id === id)?.titre
    return t ? nomCourt(t).replace(/^./, (c) => c.toLowerCase()) : id.split('.').slice(-1)[0].replace(/_/g, ' ')
  }
  const themes = Array.from(new Set((rep ?? []).map((r) => r.theme)))
  const nbChange = (rep ?? []).filter((r) => r.change).length
  return (
    <div className="card" id="au-dela-de-l-argent" style={{ scrollMarginTop: 80 }}>
      <h3>Vos droits au-delà de l'argent</h3>
      <p className="small muted">Retraite, chômage, travail, vote, route, santé : ce que prévoient les règles pour vous. Cliquez sur un thème pour l'ouvrir.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="small">Né(e) en <select value={mois} onChange={(e) => setMois(Number(e.target.value))} style={{ width: 'auto', marginLeft: 4 }}>
          {['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select></label>
        <input type="number" value={annee} min={1920} max={2025} onChange={(e) => setAnnee(Number(e.target.value))} style={{ width: 100 }} aria-label="Année de naissance" />
        <label className="small" style={{ display: 'block', width: '100%' }}><GitCompare size={15} /> Comparer avec une proposition
          <select value={societe} onChange={(e) => setSociete(e.target.value)} style={{ display: 'block', width: '100%', maxWidth: 420, marginTop: 4 }}>
            <option value="">— aucune —</option>
            {(socs?.societes ?? []).filter((s) => !s.reference).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
      </div>
      {nomSoc && rep && (
        <p className="small" style={{ marginTop: 0 }}>{nbChange ? <><strong>{nbChange} réponse{nbChange > 1 ? 's changent' : ' change'}</strong> dans « {nomSoc} » : {nbChange > 1 ? 'elles sont signalées' : 'elle est signalée'} en couleur.</> : <>Rien ne change pour vous dans « {nomSoc} ».</>}</p>
      )}
      {loading && !rep ? <Loading /> : (
        <div className="accordeon">
          {themes.map((t, k) => {
            const items = (rep ?? []).filter((r) => r.theme === t)
            const changes = items.filter((r) => r.change).length
            return (
              <details key={`${t}-${nomSoc ?? ''}`} open={k === 0 || changes > 0}>
                <summary>
                  <ChevronDown size={16} className="chevron" />
                  <span className="grow">{t}</span>
                  {changes > 0 && <span className="badge accent">{changes} changement{changes > 1 ? 's' : ''}</span>}
                  <span className="small muted">{items.length} question{items.length > 1 ? 's' : ''}</span>
                </summary>
                <div className="stack" style={{ gap: 8, paddingBottom: 10 }}>
                  {items.map((r) => (
                    <div key={r.question} className="card flat" style={{ padding: 12, borderColor: r.change ? 'var(--accent)' : undefined }}>
                      <div style={{ fontWeight: 650, marginBottom: 4 }}>{r.question}</div>
                      <div className="small">{r.reponse}</div>
                      {r.change && r.autre && (
                        <div className="small" style={{ marginTop: 6, padding: 8, background: 'var(--accent-soft)', borderRadius: 8 }}>
                          <ArrowRight size={13} /> <strong>Dans « {nomSoc} » :</strong> {r.autre}
                        </div>
                      )}
                      {r.regles.length > 0 && (
                        <div className="small muted" style={{ marginTop: 6 }}><BookOpen size={12} />{' '}
                          {r.regles.length === 1 ? <Link to={`/regles/r/${r.regles[0]}`}>Voir la règle</Link>
                            : <>Voir les règles : {r.regles.slice(0, 3).map((x, i) => <span key={x}>{i ? ' · ' : ''}<Link to={`/regles/r/${x}`}>{nomRegle(x)}</Link></span>)}</>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </div>
      )}
    </div>
  )
}
