import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import type { Source } from '../lib/api'
import { nombre } from '../lib/format'
import { useFetch } from '../lib/state'
import { LIBELLE_TYPE_SOURCE, Loading, SourceItem } from '../components/ui'

export default function Sources() {
  const [p, setP] = useSearchParams()
  const [q, setQ] = useState(p.get('q') ?? '')
  const type = p.get('type') ?? ''
  const qs = new URLSearchParams({ ...(type ? { type } : {}), ...(p.get('q') ? { q: p.get('q')! } : {}), limit: '300' })
  const { data, loading } = useFetch<{ total: number; par_type: Record<string, number>; sources: Source[] }>(`/api/sources?${qs}`)
  return (
    <div className="container page">
      <h1>Le registre des sources</h1>
      <p className="lead ink2" style={{ maxWidth: 800 }}>Tout ce sur quoi repose la description de la loi actuelle : textes de loi, statistiques publiques, rapports, études. Chaque source indique qui la cite, pour remonter de n'importe quel chiffre jusqu'à son origine.</p>
      <div className="row" style={{ margin: '10px 0 16px' }}>
        <form className="input-suffix grow" style={{ maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); if (q) p.set('q', q); else p.delete('q'); setP(p) }}>
          <input type="search" placeholder="Titre, éditeur, auteur…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="suffix"><Search size={16} /></span>
        </form>
      </div>
      <div className="choices" style={{ marginBottom: 16 }}>
        <button className={`choice ${!type ? 'on' : ''}`} onClick={() => { p.delete('type'); setP(p) }}>Toutes</button>
        {Object.entries(LIBELLE_TYPE_SOURCE).filter(([k]) => data?.par_type?.[k]).map(([k, l]) => (
          <button key={k} className={`choice ${type === k ? 'on' : ''}`} onClick={() => { p.set('type', k); setP(p) }}>{l} <span className="badge">{nombre(data?.par_type?.[k] ?? 0, 0)}</span></button>
        ))}
      </div>
      {loading ? <Loading /> : (
        <div className="card">
          <div className="small muted" style={{ marginBottom: 8 }}>{nombre(data?.total ?? 0, 0)} sources{data && data.total > 300 ? ' (300 premières affichées)' : ''}</div>
          <ul className="list">{data?.sources.map((s) => <SourceItem key={s.id} s={s} />)}</ul>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>Les types de sources sont classés par fiabilité intrinsèque : <Link to="/methode#sources">en savoir plus</Link>.</p>
    </div>
  )
}
