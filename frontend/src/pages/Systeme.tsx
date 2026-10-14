import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Database, GitCommit, RefreshCw, ShieldAlert } from 'lucide-react'
import type { Commit } from '../lib/api'
import { DOMAINE_TITRE, nombre, relatif, valeur, date } from '../lib/format'
import { useApp, useFetch } from '../lib/state'
import { LineChart } from '../components/charts'
import { Loading } from '../components/ui'
import { ListeChangements } from './SocieteDetail'

type Metrique = { id: string; titre: string; unite: string; derniere: { date: string; valeur: number; source?: string; statut?: string } | null; nb_points: number }
type MetriqueDetail = Metrique & { serie: { date: string; valeur: number }[]; explication?: string; sources: { id: string; titre: string }[] }

function MetriqueView({ id }: { id: string }) {
  const { data } = useFetch<MetriqueDetail>(`/api/metriques/${id}`)
  if (!data) return <Loading />
  return (
    <div>
      {data.explication && <p className="small ink2">{data.explication}</p>}
      {data.serie.length > 1 && <LineChart points={data.serie.filter((p) => typeof p.valeur === 'number').map((p) => ({ x: p.date, y: p.valeur }))} format={(v) => nombre(v, 1)} />}
      <div className="small muted">Sources : {data.sources.map((s, i) => <span key={s.id}>{i ? ' · ' : ''}<Link to={`/sources/${encodeURIComponent(s.id)}`}>{s.titre}</Link></span>)}</div>
    </div>
  )
}

export default function Systeme() {
  const { meta } = useApp()
  const { data: j, loading } = useFetch<{ commits: Commit[] }>('/api/systeme/journal')
  const { data: q } = useFetch<{ problemes: { niveau: string; fichier: string; message: string; ref: string | null }[]; controles: { regle: string; titre: string; concordant: boolean; autre_source: string }[];
    liens?: { verifies: number; total: number; bilan: Record<string, number>; introuvables: { id: string; titre: string }[] } }>('/api/qualite')
  const { data: m } = useFetch<{ metriques: Metrique[] }>('/api/metriques')
  const { data: ex } = useFetch<{ executions: { id: number; debut: string; fin: string | null; statut: string; declencheur: string; resume: any }[];
    planificateur: { actif: boolean; heure_planifiee: string; prochaine_maj: string | null; dernier_rechargement: string | null; en_cours: boolean } }>('/api/systeme/executions')
  const [mq, setMq] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const s = meta?.stats
  const metriques = (m?.metriques ?? []).filter((x) => !mq || (x.titre + x.id).toLowerCase().includes(mq.toLowerCase()))
  return (
    <div className="container page">
      <h1><Bot size={28} /> Le Système</h1>
      <p className="lead ink2" style={{ maxWidth: 820 }}>La Société 1.0 n'est modifiée par personne d'autre que le Système : des programmes et des agents qui collectent les textes officiels,
        les statistiques publiques et les études, vérifient leur cohérence, puis publient une nouvelle version. Chaque mise à jour est datée et consultable par tous.</p>

      {s && (
        <div className="grid cols-4" style={{ marginBottom: 20 }}>
          <div className="card"><div className="kpi">{nombre(s.regles, 0)}</div><div className="kpi-label">règles</div><div className="small muted">{Object.entries(s.par_domaine).length} domaines</div></div>
          <div className="card"><div className="kpi">{s.regles ? nombre(Math.floor(s.regles_sourcees / s.regles * 1000) / 10, 1) : 0} %</div><div className="kpi-label">règles sourcées</div><div className="small muted">dont {nombre(s.regles_texte_officiel, 0)} par un texte officiel</div></div>
          <div className="card"><div className="kpi">{nombre(s.metriques, 0)}</div><div className="kpi-label">métriques mesurées</div><div className="small muted">statistiques publiques</div></div>
          <div className="card"><div className="kpi">{nombre(s.estimations, 0)}</div><div className="kpi-label">estimations d'études</div><div className="small muted">{s.preuves} questions</div></div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h3><RefreshCw size={18} /> Mise à jour automatique</h3>
        {ex && (
          <p className="small ink2">{ex.planificateur.actif
            ? <>Chaque nuit à {ex.planificateur.heure_planifiee}, le Système vérifie le moteur de calcul, les données et les sources, publie une nouvelle version si la loi a changé et met à jour les propositions des utilisateurs (sauf sur les règles qu'ils ont eux-mêmes changées). Les règles dont la date d'entrée en vigueur arrive s'appliquent d'elles-mêmes à minuit.
              {ex.planificateur.prochaine_maj && <> Prochain passage : <strong>{new Date(ex.planificateur.prochaine_maj).toLocaleString('fr-FR')}</strong>.</>}
              {ex.planificateur.en_cours && <> <span className="badge primary">mise à jour en cours</span></>}</>
            : 'La mise à jour automatique est désactivée sur ce serveur.'}</p>
        )}
        {q?.liens && <p className="small muted">Liens des sources vérifiés : {q.liens.verifies} sur {q.liens.total}
          {Object.entries(q.liens.bilan).map(([k, v]) => ` · ${v} ${k === 'ok' ? 'accessibles' : k === 'bloque' ? 'protégés contre les robots' : k === 'introuvable' ? 'introuvables' : 'injoignables'}`).join('')}.</p>}
        {ex && ex.executions.length > 0 ? (
          <ul className="list small">
            {ex.executions.slice(0, 8).map((e) => (
              <li key={e.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <span><span className={`badge ${e.statut === 'succes' ? 'gain' : e.statut === 'echec' ? 'loss' : 'primary'}`}>{e.statut === 'succes' ? 'réussie' : e.statut === 'echec' ? 'échec' : 'en cours'}</span>{' '}
                  {new Date(e.debut).toLocaleString('fr-FR')} <span className="muted">({e.declencheur})</span></span>
                <span className="muted" style={{ textAlign: 'right' }}>{e.resume?.publication ?? e.resume?.erreur?.slice(0, 80) ?? ''}{e.resume?.forks ? ` · propositions mises à jour : ${e.resume.forks.mises_a_jour}` : ''}</span>
              </li>
            ))}
          </ul>
        ) : <p className="small muted">Aucune exécution enregistrée pour l'instant.</p>}
      </div>

      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3><GitCommit size={18} /> Journal des versions de la Société 1.0</h3>
          {loading ? <Loading /> : (
            <ul className="timeline">
              {(j?.commits ?? []).map((c, i) => (
                <li key={c.id} className={`system ${i === 0 ? 'current' : ''}`}>
                  <div className="row between"><strong>{c.message}</strong><code className="muted">{c.id.slice(0, 7)}</code></div>
                  <div className="small muted">{relatif(c.created_at)} · instantané <code>{c.base_snapshot}</code></div>
                  {c.changes.length > 0 && (
                    <details className="explain" style={{ marginTop: 6, paddingTop: 6 }}>
                      <summary>Voir les {c.changes.length} changement(s)</summary>
                      <ListeChangements items={c.changes.slice(0, 60)} />
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>Couverture par domaine</h3>
            {s && Object.entries(DOMAINE_TITRE).map(([k, l]) => {
              const n = s.par_domaine[k] ?? 0
              const max = Math.max(...Object.values(s.par_domaine), 1)
              return (
                <div key={k} style={{ marginBottom: 8 }}>
                  <div className="row between small"><Link to={`/regles/d/${k}`}>{l}</Link><span className="muted">{n}</span></div>
                  <div className="bar-track"><div className="bar-fill" style={{ width: `${(n / max) * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
          <div className="card">
            <h3><ShieldAlert size={18} /> Contrôles de qualité</h3>
            <p className="small muted">Le Système vérifie que chaque valeur cite une source existante, que les identifiants sont uniques, et signale les valeurs non confirmées.</p>
            {s && <div className="row small" style={{ marginBottom: 8 }}>
              <span className={`badge ${s.erreurs ? 'loss' : 'gain'}`}>{s.erreurs} erreur(s)</span>
              <span className="badge warn">{s.avertissements} avertissement(s)</span>
              <span className="badge warn">{s.regles_a_verifier} valeur(s) à vérifier</span>
            </div>}
            {q && q.controles.length > 0 && (
              <div className="small" style={{ marginBottom: 8 }}>
                <strong>Contrôles croisés</strong> (même règle établie par deux sources indépendantes) : {q.controles.filter((c) => c.concordant).length} concordant(s) sur {q.controles.length}.
                <ul className="list">{q.controles.map((c) => <li key={c.regle + c.autre_source}><span className={`badge ${c.concordant ? 'gain' : 'loss'}`}>{c.concordant ? 'concordant' : 'discordant'}</span> <Link to={`/regles/r/${c.regle}`}>{c.titre}</Link> <span className="muted">— {c.autre_source}</span></li>)}</ul>
              </div>
            )}
            <ul className="list small" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {(q?.problemes ?? []).slice(0, 80).map((p, i) => <li key={i}><span className={`badge ${p.niveau === 'erreur' ? 'loss' : 'warn'}`}>{p.niveau}</span> {p.message} <span className="muted">({p.fichier})</span></li>)}
              {q && q.problemes.length === 0 && <li className="muted">Aucun problème détecté.</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }} id="metriques">
        <div className="row between"><h3 style={{ margin: 0 }}><Database size={18} /> Les métriques mesurées</h3>
          <input type="search" placeholder="Filtrer…" value={mq} onChange={(e) => setMq(e.target.value)} style={{ maxWidth: 260 }} /></div>
        <p className="small muted">Les chiffres observés (INSEE, DREES, DARES, Cour des comptes…) servent à caler les simulations et à mesurer leur fiabilité.</p>
        <ul className="list">
          {metriques.slice(0, 150).map((x) => (
            <li key={x.id}>
              <button className="preset" style={{ border: 0, padding: '2px 0', background: 'transparent' }} onClick={() => setOpen(open === x.id ? null : x.id)}>
                <div className="row between"><span style={{ fontWeight: 600 }}>{x.titre}</span>
                  <span><strong>{x.derniere ? valeur(x.derniere.valeur, x.unite) : '—'}</strong> <span className="small muted">{x.derniere?.date ? date(x.derniere.date) : ''}{x.derniere?.statut && x.derniere.statut !== 'definitif' ? ` · ${x.derniere.statut}` : ''}</span></span></div>
              </button>
              {open === x.id && <MetriqueView id={x.id} />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
