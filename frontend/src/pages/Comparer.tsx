import { Link, useSearchParams } from 'react-router-dom'
import type { Changement } from '../lib/api'
import { DOMAINE_TITRE, valeur } from '../lib/format'
import { useFetch } from '../lib/state'
import { ErrorBox, Loading } from '../components/ui'

export default function Comparer() {
  const [p] = useSearchParams()
  const qs = p.toString()
  const { data, loading, error } = useFetch<{ a: { id: string; nom: string }; b: { id: string; nom: string }; differences: Changement[] }>(p.get('a') && p.get('b') ? `/api/comparer?${qs}` : null)
  if (!p.get('a') || !p.get('b')) return <div className="container page"><ErrorBox message="Indiquez deux sociétés à comparer." /></div>
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !data) return <div className="container page"><ErrorBox message={error ?? 'Erreur'} /></div>
  return (
    <div className="container page">
      <h1>Comparer deux sociétés</h1>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Règle</th><th><Link to={`/societes/${data.a.id}`}>{data.a.nom}</Link></th><th><Link to={`/societes/${data.b.id}`}>{data.b.nom}</Link></th></tr></thead>
            <tbody>
              {data.differences.map((d) => (
                <tr key={d.regle}>
                  <td><Link to={`/regles/r/${d.regle}`}>{d.titre ?? d.regle}</Link><div className="small muted">{d.domaine ? DOMAINE_TITRE[d.domaine] : ''}</div></td>
                  <td>{valeur(d.avant, d.unite, d.type)}</td>
                  <td><strong>{valeur(d.apres, d.unite, d.type)}</strong></td>
                </tr>
              ))}
              {data.differences.length === 0 && <tr><td colSpan={3} className="muted">Ces deux sociétés sont identiques.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
