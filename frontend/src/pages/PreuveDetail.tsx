import { Link, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { Confiance } from '../lib/api'
import { nombre } from '../lib/format'
import { useFetch } from '../lib/state'
import { ForestPlot } from '../components/charts'
import { ConfidenceBadge, ErrorBox, Loading } from '../components/ui'
import { fmtEffet } from './Preuves'

type Est = {
  source: string; titre_source?: string; auteurs: string[]; url?: string; valeur: number | null; intervalle_95: [number, number] | null
  methode?: string; champ?: string; pays?: string; annee_donnees?: number; type_etude_libelle: string; revue_par_les_pairs: boolean
  note?: string; poids: number; qualite: number; pertinence: number; fraicheur: number
}
type Detail = {
  id: string; titre: string; definition: string; unite: string; note_synthese?: string; regles_liees: { id: string; titre: string }[]
  fichier: string
  synthese: { valeur_retenue: number | null; fourchette: [number, number] | null; quartiles?: [number, number]; n_estimations: number; estimations: Est[]; confiance: Confiance }
}

function court(e: Est) {
  const a = e.auteurs?.length ? (e.auteurs.length > 2 ? `${e.auteurs[0].split(' ').slice(-1)[0]} et al.` : e.auteurs.map((x) => x.split(' ').slice(-1)[0]).join(' & ')) : (e.titre_source ?? e.source)
  return `${a}${e.annee_donnees ? ` (${e.annee_donnees})` : ''}`
}

export default function PreuveDetail() {
  const { id } = useParams()
  const { data: q, loading, error } = useFetch<Detail>(`/api/preuves/${id}`)
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !q) return <div className="container page"><ErrorBox message={error ?? 'Introuvable'} /></div>
  const s = q.synthese
  const est = [...s.estimations].sort((a, b) => b.poids - a.poids)
  return (
    <div className="container page">
      <div className="breadcrumb"><Link to="/preuves">Les preuves</Link> › {q.titre}</div>
      <h1 style={{ fontSize: '1.9rem' }}>{q.titre}</h1>
      <p className="ink2">{q.definition}</p>
      <div className="grid cols-3">
        <div className="card"><div className="kpi-label">Valeur retenue par le Système</div><div className="kpi">{fmtEffet(s.valeur_retenue, q.unite)}</div>
          {s.fourchette && <div className="small muted">Fourchette plausible : {fmtEffet(s.fourchette[0], q.unite)} à {fmtEffet(s.fourchette[1], q.unite)}</div>}</div>
        <div className="card"><div className="kpi-label">Indice de confiance</div><div style={{ margin: '8px 0' }}><ConfidenceBadge c={s.confiance} /></div><div className="small muted">{s.confiance.description}</div></div>
        <div className="card"><div className="kpi-label">Études prises en compte</div><div className="kpi">{s.n_estimations}</div><div className="small muted">dont {est.filter((e) => e.valeur !== null).length} chiffrées</div></div>
      </div>
      {q.note_synthese && <div className="card" style={{ marginTop: 16 }}><h3>En résumé</h3><p className="ink2" style={{ margin: 0 }}>{q.note_synthese}</p></div>}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Toutes les estimations</h3>
        <p className="small muted">Chaque carré est une étude (sa taille reflète son poids dans la synthèse), le trait son intervalle de confiance à 95 % quand il est publié. Le losange est la valeur retenue ; la bande colorée, la fourchette plausible.</p>
        <ForestPlot items={est.map((e) => ({ label: court(e), value: e.valeur, ci: e.intervalle_95, weight: e.poids }))} synthese={s.valeur_retenue} fourchette={s.fourchette} format={(v) => nombre(v, Math.abs(v) < 1 ? 2 : 1)} />
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>Détail des études et de leur poids</h3>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Étude</th><th>Méthode et champ</th><th className="num">Estimation</th><th className="num">Poids</th></tr></thead>
            <tbody>{est.map((e, i) => (
              <tr key={i}>
                <td style={{ minWidth: 200 }}>
                  <Link to={`/sources/${encodeURIComponent(e.source)}`} style={{ fontWeight: 650 }}>{court(e)}</Link>
                  {e.url && <a href={e.url} target="_blank" rel="noreferrer noopener" className="icon-btn" style={{ padding: 2 }}><ExternalLink size={13} /></a>}
                  <div className="small muted">{e.titre_source}</div>
                  <div className="pill-list" style={{ marginTop: 4 }}><span className="badge">{e.type_etude_libelle}</span>{e.revue_par_les_pairs && <span className="badge gain">relue par des pairs</span>}{e.pays && <span className="badge">{e.pays}</span>}</div>
                </td>
                <td className="small">{e.methode}<div className="muted">{e.champ}</div>{e.note && <div className="muted" style={{ marginTop: 4 }}>{e.note}</div>}</td>
                <td className="num"><strong>{fmtEffet(e.valeur, q.unite)}</strong>{e.intervalle_95 && <div className="small muted">[{nombre(e.intervalle_95[0], 2)} ; {nombre(e.intervalle_95[1], 2)}]</div>}</td>
                <td className="num">{nombre(e.poids * 100, 1)} %<div className="small muted" title="qualité × pertinence × fraîcheur">Q {nombre(e.qualite, 2)} · P {nombre(e.pertinence, 2)} · F {nombre(e.fraicheur, 2)}</div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
      {q.regles_liees.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}><h3>Règles concernées</h3>
          <div className="pill-list">{q.regles_liees.map((r) => <Link key={r.id} to={`/regles/r/${r.id}`} className="badge primary">{r.titre}</Link>)}</div></div>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>Fiche : <code>{q.fichier}</code> · <Link to="/methode#preuves">Comment les études sont pondérées</Link></p>
    </div>
  )
}
