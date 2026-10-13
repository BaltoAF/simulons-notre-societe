// « Vos droits au-delà de l'argent » : réponses personnalisées tirées des règles, comparables avec une autre société.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, GitCompare } from 'lucide-react'
import { api, type Societe } from '../lib/api'
import { useFetch } from '../lib/state'
import { Loading } from './ui'

type Reponse = { theme: string; question: string; reponse: string; regles: string[]; autre?: string | null; change?: boolean }

export function DroitsNonMonetaires({ age }: { age: number }) {
  const annee0 = new Date().getFullYear() - age
  const [annee, setAnnee] = useState(annee0)
  const [mois, setMois] = useState(1)
  const [societe, setSociete] = useState('')
  const [rep, setRep] = useState<Reponse[] | null>(null)
  const [nomSoc, setNomSoc] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { data: socs } = useFetch<{ societes: Societe[] }>('/api/societes?tri=populaire')

  useEffect(() => {
    setLoading(true)
    api<{ reponses: Reponse[]; societe?: { nom: string } }>('/api/droits', { body: { profil: { annee_naissance: annee, mois_naissance: mois }, societe: societe || null } })
      .then((r) => { setRep(r.reponses); setNomSoc(r.societe?.nom ?? null) })
      .finally(() => setLoading(false))
  }, [annee, mois, societe])

  const themes = Array.from(new Set((rep ?? []).map((r) => r.theme)))
  return (
    <div className="card">
      <h3>Vos droits au-delà de l'argent</h3>
      <p className="small muted">Retraite, chômage, travail, vote, route, santé : ce que prévoient les règles pour vous.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label className="small">Né(e) en <select value={mois} onChange={(e) => setMois(Number(e.target.value))} style={{ width: 'auto', marginLeft: 4 }}>
          {['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'].map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select></label>
        <input type="number" value={annee} min={1920} max={2025} onChange={(e) => setAnnee(Number(e.target.value))} style={{ width: 100 }} aria-label="Année de naissance" />
        <label className="small row" style={{ gap: 6 }}><GitCompare size={15} /> Comparer avec
          <select value={societe} onChange={(e) => setSociete(e.target.value)} style={{ width: 'auto' }}>
            <option value="">— aucune —</option>
            {(socs?.societes ?? []).filter((s) => !s.reference).map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
          </select>
        </label>
      </div>
      {loading && !rep ? <Loading /> : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {themes.map((t) => (
            <div key={t}>
              <div className="kpi-label" style={{ marginBottom: 6 }}>{t}</div>
              {(rep ?? []).filter((r) => r.theme === t).map((r) => (
                <div key={r.question} className="card flat" style={{ padding: 12, marginBottom: 8, borderColor: r.change ? 'var(--accent)' : undefined }}>
                  <div style={{ fontWeight: 650, marginBottom: 4 }}>{r.question}</div>
                  <div className="small">{r.reponse}</div>
                  {r.change && r.autre && (
                    <div className="small" style={{ marginTop: 6, padding: 8, background: 'var(--accent-soft)', borderRadius: 8 }}>
                      <ArrowRight size={13} /> <strong>Dans « {nomSoc} » :</strong> {r.autre}
                    </div>
                  )}
                  {r.regles.length > 0 && (
                    <div className="small muted" style={{ marginTop: 6 }}><BookOpen size={12} /> {r.regles.slice(0, 3).map((x, i) => <span key={x}>{i ? ' · ' : ''}<Link to={`/regles/r/${x}`}>règle</Link></span>)}</div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {nomSoc && rep && <p className="small muted">{rep.filter((r) => r.change).length} réponse(s) changent dans « {nomSoc} ».</p>}
    </div>
  )
}
