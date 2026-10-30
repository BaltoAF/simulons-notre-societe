import { Link, useParams } from 'react-router-dom'
import type { Regle } from '../lib/api'
import { valeur, date } from '../lib/format'
import { useFetch } from '../lib/state'
import { teinteDomaine } from '../lib/teintes'
import { DomainIcon, ErrorBox, Loading } from '../components/ui'
import { RegleLigne } from './Regles'

type DomaineDetail = {
  id: string; titre: string; question: string; icone: string
  themes: { titre: string; regles: Regle[] }[]
  metriques: { id: string; titre: string; unite: string; derniere: { date: string; valeur: number } | null }[]
}

export default function Domaine() {
  const { domaine } = useParams()
  const { data, loading, error } = useFetch<DomaineDetail>(`/api/domaines/${domaine}`)
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !data) return <div className="container page"><ErrorBox message={error ?? 'Introuvable'} /></div>
  return (
    <div className="container page">
      <div className="breadcrumb"><Link to="/regles">Les règles</Link> › {data.titre}</div>
      <div className={`row ${teinteDomaine(domaine)}`} style={{ alignItems: 'center', marginBottom: 18 }}>
        <DomainIcon name={data.icone} size={26} />
        <div><h1 style={{ margin: 0 }}>{data.titre}</h1><div className="muted">{data.question}</div></div>
      </div>
      <div className="split aside-340">
        <div className="stack">
          {data.themes.length === 0 && <div className="card muted">Ce domaine est en cours de numérisation.</div>}
          {data.themes.map((t) => (
            <div key={t.titre} className="card">
              <h3>{t.titre}</h3>
              <ul className="list">{t.regles.map((r) => <RegleLigne key={r.id} r={r} />)}</ul>
            </div>
          ))}
        </div>
        <div className="stack sticky">
          <div className="card">
            <h3>Les chiffres mesurés</h3>
            <p className="small muted">Statistiques publiques utilisées pour évaluer les impacts dans ce domaine.</p>
            {data.metriques.length === 0 ? <div className="small muted">Aucune métrique pour l'instant.</div> : (
              <ul className="list">
                {data.metriques.slice(0, 15).map((m) => (
                  <li key={m.id}>
                    <div className="small" style={{ fontWeight: 600 }}>{m.titre}</div>
                    <div className="row between small"><span className="muted">{m.derniere?.date ? date(m.derniere.date) : ''}</span><strong>{m.derniere ? valeur(m.derniere.valeur, m.unite) : '—'}</strong></div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
