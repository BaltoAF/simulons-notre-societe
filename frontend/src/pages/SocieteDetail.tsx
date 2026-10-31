import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Calculator, GitBranch, GitCommit, GitFork, GitMerge, GitPullRequest, MessageSquare, RefreshCw, ShieldCheck, Star } from 'lucide-react'
import { api, type Changement, type Commit, type Rapport, type SocieteDetail as SD } from '../lib/api'
import { DOMAINE_TITRE, STATUT_SUGGESTION, relatif, valeur } from '../lib/format'
import { Terme } from '../components/Terme'
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
          <div className="row between"><strong>{c.message}</strong>{i === 0 && <span className="badge primary">version actuelle</span>}</div>
          <div className="small muted">{c.auteur_systeme ? 'Mise à jour automatique (la loi a changé)' : c.auteur} · {relatif(c.created_at)}{c.second_parent_id ? ' · reprend les changements suggérés par une autre proposition' : ''}</div>
          {c.changes.length > 0 && c.changes.length <= 12 && (
            <details className="explain" style={{ marginTop: 6, paddingTop: 6 }}>
              <summary>Voir {c.changes.length > 1 ? `les ${c.changes.length} changements` : 'le changement'}</summary>
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

// les domaines du budget de l'État modifiés ensemble comptent pour un seul changement (ils sont résumés en une ligne)
function nbChangements(diff: { regle: string }[]): number {
  const m = diff.filter((d) => d.regle.startsWith('budget.etat.mission.')).length
  return m >= 3 ? diff.length - m + 1 : diff.length
}

export default function SocieteDetail() {
  const { id } = useParams()
  const { user } = useApp()
  const nav = useNavigate()
  const [branche, setBranche] = useState('principale')
  const { data: s, loading, error, reload } = useFetch<SD>(`/api/societes/${id}?branche=${branche}`)
  // de retour après « Envoyer ma suggestion » : l'onglet des suggestions, avec un mot qui le confirme
  const [params] = useSearchParams()
  const envoyee = params.get('suggestion') === 'envoyee'
  const [tab, setTab] = useState<'apercu' | 'impacts' | 'historique' | 'propositions' | 'discussion'>(envoyee ? 'propositions' : 'apercu')
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
      <div className="breadcrumb"><Link to="/societes">Les propositions</Link> › {s.nom}</div>
      <div className="row between top">
        <div className="grow">
          <h1 style={{ marginBottom: 4 }}>{s.reference && <ShieldCheck size={26} color="var(--primary)" />} {s.nom}</h1>
          <div className="small muted">
            {s.reference ? 'La loi actuelle, tenue à jour automatiquement à partir des textes officiels et des statistiques publiques.'
              : <>Créée par <strong>{s.owner_pseudo}</strong>{s.parent_id && <> · inspirée de <Link to={`/societes/${s.parent_id}`}>{s.parent_nom}</Link></>} · mise à jour {relatif(s.updated_at)}</>}
          </div>
        </div>
        <div className="row">
          <button className={`btn ${s.etoile ? 'primary' : ''}`} onClick={etoile} title="J'aime cette proposition"><Star size={16} /> {s.etoiles}</button>
          <button className="btn" onClick={() => (user ? setModal('fork') : nav(`/connexion?retour=/societes/${s.id}`))} title="Une copie à vous, que vous pourrez modifier librement"><GitFork size={16} /> Partir de cette proposition</button>
          {/* l'expérience centrale : changer les règles ; sur la proposition de quelqu'un, c'est lui suggérer un changement */}
          <Link className="btn primary" to={`/atelier?societe=${s.id}&branche=${branche}${!s.proprietaire && !s.reference ? '&suggestion=1' : ''}`}>
            {s.proprietaire ? <><Calculator size={16} /> Modifier</> : s.reference ? <><Calculator size={16} /> Changer ces règles</> : <><GitPullRequest size={16} /> Proposer un changement</>}</Link>
        </div>
      </div>
      {!s.reference && !s.proprietaire && (
        <p className="small ink2" style={{ margin: '8px 0 0', maxWidth: 820 }}>Pas d'accord avec une règle ? <strong>Proposez un changement</strong> : vous la modifiez, vous voyez
          les effets, et vous l'envoyez à {s.owner_pseudo}, qui l'accepte ou non, comme un amendement. Ou bien <strong>partez de cette proposition</strong> pour faire la vôtre.</p>
      )}
      {envoyee && <Notice kind="ok">Votre suggestion est envoyée. Elle apparaît ci-dessous, dans « Suggestions reçues » : son auteur pourra en discuter avec vous, puis l'accepter ou non.</Notice>}
      {s.description && <p className="ink2" style={{ marginTop: 12, maxWidth: 820, whiteSpace: 'pre-wrap' }}>{s.description}</p>}
      {msg && <Notice kind="ok">{msg}</Notice>}
      {s.conflits_loi.length > 0 && (
        <div className="notice warn" style={{ margin: '12px 0' }}>
          <RefreshCw size={18} /> <div className="grow">La loi a changé sur {s.conflits_loi[0].conflits.length} règle(s) que cette proposition modifie aussi
            ({s.conflits_loi[0].conflits.map((c) => c.titre ?? c.regle).slice(0, 3).join(', ')}). Rien n'est imposé : {s.proprietaire ? 'à vous de choisir, règle par règle.' : 'son auteur doit choisir.'}</div>
          {s.proprietaire && <button className="btn small" onClick={() => setModal('sync')}>Choisir</button>}
        </div>
      )}
      {!s.reference && !s.a_jour_reference && s.conflits_loi.length === 0 && (
        <div className="notice warn" style={{ margin: '12px 0' }}>
          <RefreshCw size={18} /> <div className="grow">La loi a évolué depuis la création de cette société (nouvelle version de la loi actuelle).
            {s.proprietaire ? ' Intégrez ces évolutions pour rester à jour.' : ''}</div>
          {s.proprietaire && <button className="btn small" onClick={() => setModal('sync')}>Mettre à jour</button>}
        </div>
      )}

      <div className="row" style={{ margin: '14px 0 4px' }}>
        {s.branches.length > 1 && <>
          <GitBranch size={16} /><span className="small"><Terme id="variante">Variante</Terme> :</span>
          <select value={branche} onChange={(e) => { setBranche(e.target.value); setRapport(null) }} style={{ width: 'auto' }}>
            {s.branches.map((b) => <option key={b.nom} value={b.nom}>{b.nom === 'principale' ? 'principale' : b.nom}</option>)}
          </select>
        </>}
        {!/^(Mise à jour automatique|Équilibrer|Rééquilibrer)/.test(s.head.message) && <span className="small muted">Dernière modification : « {s.head.message} »</span>}
        {s.proprietaire && <button className="btn small ghost" onClick={() => setModal('branche')} title="Essayer une autre piste sans toucher à la version principale">Essayer une variante</button>}
        {!s.reference && user && <button className="btn small ghost" onClick={() => setModal('proposer')}><GitPullRequest size={14} /> Suggérer mes changements à une autre proposition</button>}
      </div>

      <div className="tabs">
        {([['apercu', 'Ce qui change', null], ['impacts', 'Ses effets', Calculator], ['historique', 'Versions', GitCommit], ['propositions', `Suggestions reçues (${s.propositions.length})`, GitPullRequest], ['discussion', 'Discussion', MessageSquare]] as const).map(([k, l]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => { setTab(k); if (k === 'impacts' && !rapport && !calc) calculer() }}>{l}</button>
        ))}
      </div>

      {tab === 'apercu' && (
        <div className="grid cols-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="row between"><h3 style={{ margin: 0 }}>Ce qui change par rapport à la loi actuelle</h3>
              {!s.reference && <span className="badge primary">{nbChangements(s.differences_reference)} changement{nbChangements(s.differences_reference) > 1 ? "s" : ""}</span>}</div>
            <p className="small muted">Chaque différence avec la <Terme id="societe_1_0">loi actuelle</Terme> : de combien, qui l'a décidée et pourquoi.</p>
            <DiffSociete items={s.differences_reference as Diff[]} vide={s.reference ? 'C\'est la référence : la loi en vigueur.' : 'Aucune différence avec la loi actuelle pour l\'instant.'} />
            {s.differences_reference.length > 0 && <button className="btn primary" style={{ marginTop: 12 }} onClick={calculer}><Calculator size={16} /> Voir les effets de ces changements</button>}
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
      {tab === 'impacts' && (calc ? <div className="card"><Loading label="Calcul des effets de cette proposition (10 à 30 secondes)…" /></div> : rapport ? <ReportView r={rapport} contexte="societe" /> : <Empty>Aucun impact à calculer.</Empty>)}
      {tab === 'historique' && <div className="card"><Historique sid={s.id} branche={branche} /></div>}
      {tab === 'propositions' && (
        <div className="card">
          {s.propositions.length === 0 ? <div className="small muted">{s.reference ? 'La loi actuelle ne reçoit pas de suggestions : elle reflète la loi en vigueur et se met à jour automatiquement.' : "Personne n'a encore suggéré de changement à cette société. Chacun peut créer sa version, puis la lui suggérer."}</div> : (
            <ul className="list">{s.propositions.map((p) => (
              <li key={p.id} className="list-row">
                <div><Link to={`/propositions/${p.id}`}><strong>{p.titre}</strong></Link>
                  <div className="small muted">De « {p.source_nom} » · par {p.auteur} · {relatif(p.created_at)}</div></div>
                <span className={`badge ${p.statut === 'fusionnee' ? 'gain' : p.statut === 'ouverte' ? 'primary' : ''}`}>{p.statut === 'fusionnee' && <GitMerge size={12} />} {STATUT_SUGGESTION[p.statut] ?? p.statut}</span>
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
    <Modal title="Partir de cette proposition" onClose={onClose}>
      <p className="small ink2">Vous obtenez votre propre copie, que vous pourrez modifier librement : l'original ne change pas. Si vos idées vous semblent bonnes, vous pourrez ensuite les suggérer à son auteur.</p>
      <p className="small muted">Les évolutions de la loi seront intégrées automatiquement à votre version, sauf sur les règles que vous aurez changées.</p>
      <label className="field"><span>Nom de votre version</span><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} /></label>
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go}><GitFork size={15} /> Créer ma proposition</button></div>
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
    <Modal title="Suggérer vos changements" onClose={onClose}>
      <p className="small ink2">Son auteur verra la liste de vos changements et leurs effets ; il pourra en discuter avec vous, puis les intégrer à sa proposition.</p>
      <label className="field"><span>À quelle proposition ?</span>
        <select value={cible} onChange={(e) => setCible(e.target.value)}>
          <option value="">Choisir…</option>
          {(data?.societes ?? []).filter((x) => !x.reference && x.id !== s.id).map((x) => <option key={x.id} value={x.id}>{x.nom} (par {x.owner_pseudo})</option>)}
        </select>
        <span className="hint">La loi actuelle ne reçoit pas de suggestions : elle reflète la loi en vigueur.</span></label>
      <label className="field"><span>En une phrase, que suggérez-vous ?</span><input type="text" value={titre} onChange={(e) => setTitre(e.target.value)} /></label>
      <label className="field"><span>Pourquoi ? (idéalement, avec des sources)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" disabled={!cible || !titre.trim()} onClick={go}><GitPullRequest size={15} /> Envoyer la suggestion</button></div>
    </Modal>
  )
}

function BrancheModal({ s, onClose, onDone }: { s: SD; onClose: () => void; onDone: (b: string) => void }) {
  const [nom, setNom] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const go = async () => { try { const r = await api<{ nom: string }>(`/api/societes/${s.id}/branches`, { body: { nom } }); onDone(r.nom) } catch (e: any) { setErr(e.message) } }
  return (
    <Modal title="Nouvelle variante" onClose={onClose}>
      <p className="small ink2">Une variante permet d'essayer une autre piste (par exemple, un autre financement) sans toucher à la version principale de votre proposition.</p>
      <label className="field"><span>Nom de la variante</span><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="ex. financement par la TVA" /></label>
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
      onDone(r.statut === 'a_jour' ? r.message! : `Proposition mise à jour selon la loi : ${r.changements?.length ?? 0} règle${(r.changements?.length ?? 0) > 1 ? 's' : ''} actualisée${(r.changements?.length ?? 0) > 1 ? 's' : ''}.`)
    } catch (e: any) {
      if (e.status === 409) setConflits(e.data?.conflits ?? []); else setErr(e.message)
    }
  }
  return (
    <Modal title="Intégrer les évolutions de la loi" onClose={onClose}>
      <p className="small ink2">La loi a changé depuis que vous avez créé votre proposition. Les règles que vous n'avez pas touchées prendront leur nouvelle valeur. Pour celles que vous aviez changées et que la loi a aussi modifiées, c'est à vous de choisir.</p>
      {conflits && conflits.map((c) => (
        <div key={c.regle} className="change-chip">
          <strong>{c.titre}</strong>
          <div className="choices" style={{ marginTop: 8 }}>
            <button className={`choice ${res[c.regle] === 'cible' ? 'on' : ''}`} aria-pressed={res[c.regle] === 'cible'} onClick={() => setRes({ ...res, [c.regle]: 'cible' })}>Garder ma valeur : {valeur(c.cible)}</button>
            <button className={`choice ${res[c.regle] === 'source' ? 'on' : ''}`} aria-pressed={res[c.regle] === 'source'} onClick={() => setRes({ ...res, [c.regle]: 'source' })}>Adopter la nouvelle loi : {valeur(c.source)}</button>
          </div>
        </div>
      ))}
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={go}><RefreshCw size={15} /> Mettre à jour</button></div>
    </Modal>
  )
}
