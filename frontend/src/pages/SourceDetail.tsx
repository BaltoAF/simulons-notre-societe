import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { Source } from '../lib/api'
import { date, natureLien, nombre } from '../lib/format'
import { useApp, useFetch } from '../lib/state'
import { ErrorBox, Loading, SourceType } from '../components/ui'

type D = Source & { citee_par: { type: string; id: string; titre: string }[]; fichier: string }

const LIENS: Record<string, (id: string) => string> = {
  regle: (id) => `/regles/r/${id}`, preuve: (id) => `/preuves/${id}`, metrique: () => '/systeme#metriques',
  aide: () => '/mes-droits#avez-vous-pense',
}
const LIB: Record<string, string> = { regle: 'Règle', preuve: 'Fiche d\'études', metrique: 'Métrique', aide: 'Aide à demander' }

export default function SourceDetail() {
  const { id } = useParams()
  const { data: s, loading, error } = useFetch<D>(`/api/sources/${encodeURIComponent(id ?? '')}`)
  const { marquer } = useApp()
  useEffect(() => { marquer('source') }, [marquer])
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !s) return <div className="container page"><ErrorBox message={error ?? 'Introuvable'} /></div>
  return (
    <div className="container page" style={{ maxWidth: 900 }}>
      <div className="breadcrumb"><Link to="/sources">Les sources</Link> › {s.id}</div>
      <SourceType type={s.type} />
      <h1 style={{ fontSize: '1.7rem', marginTop: 8 }}>{s.titre}</h1>
      <div className="ink2">{s.editeur}{s.auteurs?.length ? ' · ' + s.auteurs.join(', ') : ''}</div>
      <div className="small muted" style={{ marginTop: 6 }}>{s.date_publication ? `Publiée le ${date(s.date_publication)} · ` : ''}Consultée le {date(s.consulte_le)} · fiabilité intrinsèque {nombre((s.fiabilite ?? 0) * 100, 0)} %</div>
      {s.url && <a className="btn" href={s.url} target="_blank" rel="noreferrer noopener" style={{ marginTop: 14 }}><ExternalLink size={16} /> Consulter la source originale{natureLien(s.url)}</a>}
      {s.note && <p className="small muted" style={{ marginTop: 12 }}>{s.note}</p>}
      <div className="card" style={{ marginTop: 18 }}>
        <h3>Utilisée par</h3>
        {s.citee_par.length === 0 ? <div className="small muted">Aucun élément ne cite encore cette source.</div> : (
          <ul className="list">{s.citee_par.map((c) => (
            <li key={c.type + c.id} className="list-row"><Link to={LIENS[c.type]?.(c.id) ?? '#'}>{c.titre ?? c.id}</Link><span className="badge">{LIB[c.type] ?? c.type}</span></li>
          ))}</ul>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>Identifiant : <code>{s.id}</code> · fichier : <code>{s.fichier}</code></p>
    </div>
  )
}
