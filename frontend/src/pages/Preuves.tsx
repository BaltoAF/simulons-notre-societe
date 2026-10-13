import { Link } from 'react-router-dom'
import { Scale } from 'lucide-react'
import type { PreuveResume } from '../lib/api'
import { nombre } from '../lib/format'
import { useFetch } from '../lib/state'
import { ConfidenceBadge, Empty, Loading } from '../components/ui'

export function fmtEffet(v: number | null, unite?: string) {
  if (v === null || v === undefined) return '—'
  if (unite === 'pourcent') return nombre(v, 1) + ' %'
  if (unite === 'emplois_par_milliard') return nombre(v, 0) + ' emplois / Md€'
  return nombre(v, Math.abs(v) < 1 ? 3 : 2) + (unite && !['elasticite', 'ratio'].includes(unite) ? ' ' + unite.replace(/_/g, ' ') : '')
}

export default function Preuves() {
  const { data, loading } = useFetch<{ preuves: PreuveResume[] }>('/api/preuves')
  return (
    <div className="container page">
      <h1><Scale size={28} /> Ce que disent les études</h1>
      <p className="lead ink2" style={{ maxWidth: 800 }}>Pour chiffrer les effets d'une réforme sur l'emploi, les prix ou la récidive, il faut des études. Ici, chaque question
        rassemble toutes les études crédibles, y compris celles qui se contredisent. Le Système en tire une <strong>valeur retenue</strong> et un <strong>indice de confiance</strong>, selon une <Link to="/methode#preuves">méthode publique</Link>.</p>
      {loading ? <Loading /> : data?.preuves.length ? (
        <div className="grid cols-2">
          {data.preuves.map((p) => (
            <Link key={p.id} to={`/preuves/${p.id}`} className="card link">
              <div className="row between top"><h3 style={{ margin: 0 }}>{p.titre}</h3><ConfidenceBadge c={p.confiance} compact align="right" /></div>
              {p.definition && <p className="small muted" style={{ margin: '6px 0' }}>{p.definition}</p>}
              <div className="row between small">
                <span>Valeur retenue : <strong>{fmtEffet(p.valeur_retenue, p.unite)}</strong>{p.fourchette && <span className="muted"> (de {fmtEffet(p.fourchette[0], p.unite)} à {fmtEffet(p.fourchette[1], p.unite)})</span>}</span>
                <span className="muted">{p.n_estimations} estimations</span>
              </div>
            </Link>
          ))}
        </div>
      ) : <Empty>Les fiches d'études sont en cours de constitution par le Système.</Empty>}
    </div>
  )
}
