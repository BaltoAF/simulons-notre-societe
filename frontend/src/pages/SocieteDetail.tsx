import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Calculator, GitBranch, GitCommit, GitFork, GitMerge, GitPullRequest, MessageSquare, RefreshCw, ShieldCheck, Star } from 'lucide-react'
import { api, type Changement, type Commit, type Rapport, type SocieteDetail as SD } from '../lib/api'
import { DOMAINE_TITRE, relatif, valeur } from '../lib/format'
import { useApp, useFetch } from '../lib/state'
import { ReportView } from '../components/report'
import { Empty, ErrorBox, Loading, Modal, Notice } from '../components/ui'
import { DiffSociete, MisesAJourAuto, type Diff } from '../components/DiffSociete'

export function ListeChangements({ items, vide = 'Aucune différence.' }: { items: Changement[]; vide?: string }) {
  if (!items.length) return <div className="small muted">{vide}</div>
  return (
    <ul className="list">
      {items.map((c) => (
        <li key={c.regle} className="list-row" style={{ alignItems: 'flex-start' }}>
          <div className="grow">
            <Link to={`/regles/r/${c.regle}`} style={{ fontWeight: 650 }}>{c.titre ?? c.regle}</Link>
            <div className="small muted">{c.domaine ? DOMAINE_TITRE[c.domaine] ?? c.domaine : ''}{c.justification ? ` · « ${c.justification} »` : ''}</div>
          </div>
          <div className="small" style={{ textAlign: 'right' }}>
            <span className="muted" style={{ textDecoration: 'line-through' }}>{valeur(c.avant, c.unite, c.type)}</span><br />
            <strong>{valeur(c.apres, c.unite, c.type)}</strong>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Historique({ sid, branche }: { sid: string; branche: string }) {
  const { data, loading } = useFetch<{ commits: Commit[] }>(`/api/societes/${sid}/commits?branche=${branche}`)
  if (loading) return <Loading />
  return (
    <ul className="timeline">
      {(data?.commits ?? []).map((c, i) => (
        <li key={c.id} className={`${c.auteur_systeme ? 'system' : ''} ${i === 0 ? 'current' : ''}`}>
          <div className="row between"><strong>{c.message}</strong><code className="muted">{c.id.slice(0, 7)}</code></div>
          <div className="small muted">{c.auteur_systeme ? 'Le Système' : c.auteur} · {relatif(c.created_at)}{c.second_parent_id ? ' · fusion' : ''}</div>
          {c.changes.length > 0 && c.changes.length <= 12 && (
            <details className="explain" style={{ marginTop: 6, paddingTop: 6 }}>
              <summary>{c.changes.length} changement(s)</summary>
              <ListeChangements items={c.changes} />
            </details>
          )}
          {c.changes.length > 12 && <div className="small muted">{c.changes.length} règles mises à jour</div>}
        </li>
      ))}
    </ul>
  )
}

function Discussion({ sid }: { sid: string }) {
  const { user } = useApp()
  const { data, reload } = useFetch<{ commentaires: { id: number; auteur: string; corps: string; created_at: string }[] }>(`/api/commentaires?cible_type=societe&cible_id=${sid}`)
  const [txt, setTxt] = useState('')
  const envoyer = async () => { await api('/api/commentaires', { body: { cible_type: 'societe', cible_id: sid, corps: txt } }); setTxt(''); reload() }
  return (
    <div className="stack">
      {(data?.commentaires ?? []).map((c) => (
        <div key={c.id} className="card flat"><div className="small muted"><strong>{c.auteur}</strong> · {relatif(c.created_at)}</div><div style={{ whiteSpace: 'pre-wrap' }}>{c.corps}</div></div>
      ))}
      {!data?.commentaires.length && <div className="small muted">Pas encore de discussion.</div>}
      {user ? (
        <div><textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Votre avis, une question, une source à ajouter…" />
          <button className="btn primary" style={{ marginTop: 8 }} disabled={!txt.trim()} onClick={envoyer}>Publier</button></div>
      ) : <div className="small"><Link to="/connexion">Identifiez-vous</Link> pour participer à la discussion.</div>}
    </div>
  )
}

export default function SocieteDetail() {
  const { id } = useParams()
  const { user } = useApp()
  const nav = useNavigate()
  const [branche, setBranche] = useState('principale')
  const { data: s, loading, error, reload } = useFetch<SD>(`/api/societes/${id}?branche=${branche}`)
  const [tab, setTab] = useState<'apercu' | 'impacts' | 'historique' | 'propositions' | 'discussion'>('apercu')
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [calc, setCalc] = useState(false)
  const [modal, setModal] = useState<null | 'fork' | 'proposer' | 'branche' | 'sync'>(null)
  const [msg, setMsg] = useState<string | null>(null)

  if (loading) return <div className="container page"><Loading /></div>
  if (error || !s) return <div className="container page"><ErrorBox message={error ?? 'Introuvable'} /></div>

  const calculer = async () => {
    setTab('impacts'); setCalc(true)
    try { setRapport(await api<Rapport>('/api/simulation/reforme', { body: { societe: s.id, branche } })) } finally { setCalc(false) }
  }
  const etoile = async () => { if (!user) return nav('/connexion'); await api(`/api/societes/${s.id}/etoile`, { method: 'POST' }); reload() }

  return (
    <div className="container page">
      <div className="breadcrumb"><Link to="/societes">Les sociétés</Link> › {s.nom}</div>
      <div className="row between top">
        <div className="grow">
          <h1 style={{ marginBottom: 4 }}>{s.reference && <ShieldCheck size={26} color="var(--primary)" />} {s.nom}</h1>
          <div className="small muted">
            {s.reference ? 'Maintenue uniquement par le Système, à partir des textes officiels et des statistiques publiques.'
              : <>Créée par <strong>{s.owner_pseudo}</strong>{s.parent_id && <> · forkée depuis <Link to={`/societes/${s.parent_id}`}>{s.parent_nom}</Link></>} · mise à jour {relatif(s.updated_at)}</>}
          </div>
        </div>
        <div className="row">
          <button className={`btn ${s.etoile ? 'primary' : ''}`} onClick={etoile}><Star size={16} /> {s.etoiles}</button>
          <button className="btn" onClick={() => (user ? setModal('fork') : nav('/connexion'))}><GitFork size={16} /> Forker</button>
          <Link className="btn primary" to={`/atelier?societe=${s.id}&branche=${branche}`}><Calculator size={16} /> Modifier dans l'atelier</Link>
        </div>
      </div>
      {s.description && <p className="ink2" style={{ marginTop: 12, maxWidth: 820, whiteSpace: 'pre-wrap' }}>{s.description}</p>}
      {msg && <Notice kind="ok">{msg}</Notice>}
      {s.conflits_loi.length > 0 && (
        <div className="notice warn" style={{ margin: '12px 0' }}>
          <RefreshCw size={18} /> <div className="grow">La loi a changé sur {s.conflits_loi[0].conflits.length} règle(s) que cette société modifie aussi
            ({s.conflits_loi[0].conflits.map((c) => c.titre ?? c.regle).slice(0, 3).join(', ')}). Le Système n'impose rien : {s.proprietaire ? 'choisissez pour chacune.' : 'son auteur doit choisir.'}</div>
          {s.proprietaire && <button className="btn small" onClick={() => setModal('sync')}>Choisir</button>}
        </div>
      )}
      {!s.reference && !s.a_jour_reference && s.conflits_loi.length === 0 && (
        <div className="notice warn" style={{ margin: '12px 0' }}>
          <RefreshCw size={18} /> <div className="grow">La loi a évolué depuis la création de cette société (nouvelle version de la Société 1.0).
            {s.proprietaire ? ' Intégrez ces évolutions pour rester à jour.' : ''}</div>
          {s.proprietaire && <button className="btn small" onClick={() => setModal('sync')}>Mettre à jour</button>}
        </div>
      )}

      <div className="row" style={{ margin: '14px 0 4px' }}>
        <GitBranch size={16} />
        <select value={branche} onChange={(e) => { setBranche(e.target.value); setRapport(null) }} style={{ width: 'auto' }}>
          {s.branches.map((b) => <option key={b.nom} value={b.nom}>{b.nom}</option>)}
        </select>
        <span className="small muted">dernière version : « {s.head.message} » · <code>{s.head.id.slice(0, 7)}</code></span>
        {s.proprietaire && <button className="btn small ghost" onClick={() => setModal('branche')}>+ branche</button>}
        {!s.reference && user && <button className="btn small ghost" onClick={() => setModal('proposer')}><GitPullRequest size={14} /> Proposer à une autre société</button>}
      </div>

      <div className="tabs">
        {([['apercu', 'Aperçu', null], ['impacts', 'Impacts', Calculator], ['historique', 'Historique', GitCommit], ['propositions', `Propositions (${s.propositions.length})`, GitPullRequest], ['discussion', 'Discussion', MessageSquare]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k === 'impacts' && !rapport && !calc) calculer() }}>{l}</button>
        ))}
      </div>

      {tab === 'apercu' && (
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="row between"><h3 style={{ margin: 0 }}>Ce qui change par rapport à la loi actuelle</h3>
              {!s.reference && <span className="badge primary">{s.differences_reference.length} règle(s)</span>}</div>
            <p className="small muted">Chaque différence avec la Société 1.0, avec son ampleur, son auteur et sa justification.</p>
            <DiffSociete items={s.differences_reference as Diff[]} vide={s.reference ? 'C\'est la référence : la loi en vigueur.' : 'Aucune différence avec la Société 1.0 pour l\'instant.'} />
            {s.differences_reference.length > 0 && <button className="btn primary" style={{ marginTop: 12 }} onClick={calculer}><Calculator size={16} /> Mesurer les impacts de ces changements</button>}
          </div>
          <div className="stack">
          <MisesAJourAuto commits={s.mises_a_jour_auto} />
          {s.differences_parent && (
            <div className="card">
              <h3>… et par rapport à {s.parent_nom}</h3>
              <ListeChangements items={s.differences_parent} />
              <Link className="small" to={`/comparer?a=${s.parent_id}&b=${s.id}`}>Comparer en détail</Link>
            </div>
          )}
          </div>
        </div>
      )}
      {tab === 'impacts' && (calc ? <div className="card"><Loading label="Calcul des impacts…" /></div> : rapport ? <ReportView r={rapport} /> : <Empty>Aucun impact à calculer.</Empty>)}
      {tab === 'historique' && <div className="card"><Historique sid={s.id} branche={branche} /></div>}
      {tab === 'propositions' && (
        <div className="card">
          {s.propositions.length === 0 ? <div className="small muted">Aucune proposition. {s.reference ? 'La Société 1.0 ne reçoit pas de propositions : elle reflète la loi.' : ''}</div> : (
            <ul className="list">{s.propositions.map((p) => (
              <li key={p.id} className="list-row">
                <div><Link to={`/propositions/${p.id}`}><strong>{p.titre}</strong></Link>
                  <div className="small muted">n°{p.id} · {p.source_nom} → {p.target_nom} · par {p.auteur} · {relatif(p.created_at)}</div></div>
                <span className={`badge ${p.statut === 'fusionnee' ? 'gain' : p.statut === 'ouverte' ? 'primary' : ''}`}>{p.statut === 'fusionnee' ? <><GitMerge size={12} /> fusionnée</> : p.statut}</span>
              </li>
            ))}</ul>
          )}
        </div>
      )}
      {tab === 'discussion' && <Discussion sid={s.id} />}

      {modal === 'fork' && <ForkModal s={s} branche={branche} onClose={() => setModal(null)} />}
      {modal === 'proposer' && <ProposerModal s={s} branche={branche} onClose={() => setModal(null)} />}
      {modal === 'branche' && <BrancheModal s={s} onClose={() => setModal(null)} onDone={(b) => { setModal(null); setBranche(b) }} />}
      {modal === 'sync' && <SyncModal s={s} branche={branche} onClose={() => setModal(null)} onDone={(m) => { setModal(null); setMsg(m); reload() }} />}
    </div>
  )
}

function ForkModal({ s, branche, onClose }: { s: SD; branche: string; onClose: () => void }) {
  const [nom, setNom] = useState(`Ma version de « ${s.nom} »`)
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()
  const go = async () => {
    try { const r = await api<{ id: string }>('/api/societes', { body: { source: s.id, branche, nom } }); nav(`/societes/${r.id}`); onClose() } catch (e: any) { setErr(e.message) }
  }
  return (
    <Modal title="Forker cette société" onClose={onClose}>
      <p className="small ink2">Vous obtenez votre propre copie, que vous pourrez modifier librement. Vous pourrez ensuite proposer vos changements à l'original.</p>
      <label className="field"><span>Nom</span><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go}><GitFork size={15} /> Forker</button></div>
    </Modal>
  )
}

function ProposerModal({ s, branche, onClose }: { s: SD; branche: string; onClose: () => void }) {
  const { data } = useFetch<{ societes: { id: string; nom: string; reference: boolean; owner_pseudo: string }[] }>('/api/societes?tri=populaire')
  const [cible, setCible] = useState(s.parent_id && s.parent_id !== 'france' ? s.parent_id : '')
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const nav = useNavigate()
  const go = async () => {
    try {
      const p = await api<{ id: number }>('/api/propositions', { body: { source: s.id, source_branche: branche, cible, titre, description } })
      nav(`/propositions/${p.id}`)
    } catch (e: any) { setErr(e.message) }
  }
  return (
    <Modal title="Proposer vos changements" onClose={onClose}>
      <label className="field"><span>À quelle société ?</span>
        <select value={cible} onChange={(e) => setCible(e.target.value)}>
          <option value="">Choisir…</option>
          {(data?.societes ?? []).filter((x) => !x.reference && x.id !== s.id).map((x) => <option key={x.id} value={x.id}>{x.nom} (par {x.owner_pseudo})</option>)}
        </select>
        <span className="hint">La Société 1.0 ne reçoit pas de propositions : elle reflète la loi en vigueur.</span></label>
      <label className="field"><span>Titre</span><input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} /></label>
      <label className="field"><span>Pourquoi ? Avec quelles preuves ?</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!cible || !titre.trim()} onClick={go}><GitPullRequest size={15} /> Ouvrir la proposition</button></div>
    </Modal>
  )
}

function BrancheModal({ s, onClose, onDone }: { s: SD; onClose: () => void; onDone: (b: string) => void }) {
  const [nom, setNom] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const go = async () => { try { const r = await api<{ nom: string }>(`/api/societes/${s.id}/branches`, { body: { nom } }); onDone(r.nom) } catch (e: any) { setErr(e.message) } }
  return (
    <Modal title="Nouvelle branche" onClose={onClose}>
      <p className="small ink2">Une branche permet d'explorer une variante sans toucher à la version principale.</p>
      <label className="field"><span>Nom de la branche</span><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. variante-tva" /></label>
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!nom.trim()} onClick={go}>Créer</button></div>
    </Modal>
  )
}

function SyncModal({ s, branche, onClose, onDone }: { s: SD; branche: string; onClose: () => void; onDone: (m: string) => void }) {
  const [conflits, setConflits] = useState<any[] | null>(null)
  const [res, setRes] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const go = async () => {
    try {
      const r = await api<{ statut: string; message?: string; changements?: any[] }>(`/api/societes/${s.id}/synchroniser`, { body: { branche, resolutions: res } })
      onDone(r.statut === 'a_jour' ? r.message! : `Société mise à jour : ${r.changements?.length ?? 0} règle(s) actualisée(s) selon la loi.`)
    } catch (e: any) {
      if (e.status === 409) setConflits(e.data?.conflits ?? []); else setErr(e.message)
    }
  }
  return (
    <Modal title="Intégrer les évolutions de la loi" onClose={onClose}>
      <p className="small ink2">Les règles que vous n'avez pas modifiées prendront leur nouvelle valeur légale. Pour celles que vous avez modifiées et que la loi a aussi changées, vous choisissez.</p>
      {conflits && conflits.map((c) => (
        <div key={c.regle} className="change-chip">
          <strong>{c.titre}</strong>
          <div className="choices" style={{ marginTop: 8 }}>
            <button className={`choice ${res[c.regle] === 'cible' ? 'on' : ''}`} onClick={() => setRes({ ...res, [c.regle]: 'cible' })}>Garder ma valeur : {valeur(c.cible)}</button>
            <button className={`choice ${res[c.regle] === 'source' ? 'on' : ''}`} onClick={() => setRes({ ...res, [c.regle]: 'source' })}>Adopter la nouvelle loi : {valeur(c.source)}</button>
          </div>
        </div>
      ))}
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go}><RefreshCw size={15} /> Mettre à jour</button></div>
    </Modal>
  )
}
