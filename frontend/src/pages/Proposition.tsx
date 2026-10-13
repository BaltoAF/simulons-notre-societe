import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { GitMerge, GitPullRequest, XCircle } from 'lucide-react'
import { api, type Changement } from '../lib/api'
import { relatif, valeur } from '../lib/format'
import { useApp, useFetch } from '../lib/state'
import { ErrorBox, Loading, Notice } from '../components/ui'
import { ListeChangements } from './SocieteDetail'

type P = {
  id: number; titre: string; description: string; statut: string; auteur: string; author_id: number; created_at: string
  source_society: string; source_branch: string; target_society: string; target_branch: string; source_nom: string; target_nom: string
  changements?: Changement[]; conflits?: { regle: string; base: any; cible: any; source: any }[]; merge_commit?: string
  commentaires: { id: number; auteur: string; corps: string; created_at: string }[]
}

export default function Proposition() {
  const { id } = useParams()
  const { user } = useApp()
  const { data: p, loading, error, reload } = useFetch<P>(`/api/propositions/${id}`)
  const { data: cible } = useFetch<{ owner_id: number }>(p ? `/api/societes/${p.target_society}` : null, [p?.target_society])
  const [res, setRes] = useState<Record<string, string>>({})
  const [err, setErr] = useState<string | null>(null)
  const [txt, setTxt] = useState('')
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !p) return <div className="container page"><ErrorBox message={error ?? 'Introuvable'} /></div>
  const peutFusionner = !!(user && cible && cible.owner_id === user.id && p.statut === 'ouverte')
  const fusionner = async () => { try { await api(`/api/propositions/${p.id}/fusionner`, { body: { resolutions: res } }); reload() } catch (e: any) { setErr(e.message) } }
  const fermer = async () => { try { await api(`/api/propositions/${p.id}/fermer`, { method: 'POST' }); reload() } catch (e: any) { setErr(e.message) } }
  const commenter = async () => { await api('/api/commentaires', { body: { cible_type: 'proposition', cible_id: String(p.id), corps: txt } }); setTxt(''); reload() }
  return (
    <div className="container page" style={{ maxWidth: 920 }}>
      <div className="breadcrumb"><Link to={`/societes/${p.target_society}`}>{p.target_nom}</Link> › Proposition n°{p.id}</div>
      <h1><GitPullRequest size={26} /> {p.titre}</h1>
      <div className="row small muted" style={{ marginBottom: 14 }}>
        <span className={`badge ${p.statut === 'fusionnee' ? 'gain' : p.statut === 'ouverte' ? 'primary' : ''}`}>{p.statut}</span>
        <span><strong>{p.auteur}</strong> propose d'intégrer <Link to={`/societes/${p.source_society}`}>{p.source_nom}</Link> ({p.source_branch}) dans <Link to={`/societes/${p.target_society}`}>{p.target_nom}</Link> ({p.target_branch}) · {relatif(p.created_at)}</span>
      </div>
      {p.description && <div className="card" style={{ whiteSpace: 'pre-wrap', marginBottom: 16 }}>{p.description}</div>}
      {p.statut === 'ouverte' && (
        <div className="card stack">
          <h3>Changements proposés</h3>
          <ListeChangements items={p.changements ?? []} vide="Cette proposition n'apporte aucun changement." />
          {(p.conflits?.length ?? 0) > 0 && (
            <div>
              <Notice kind="warn">Conflits : ces règles ont été modifiées différemment des deux côtés. Le propriétaire choisit.</Notice>
              {p.conflits!.map((c) => (
                <div key={c.regle} className="change-chip">
                  <Link to={`/regles/r/${c.regle}`}><strong>{c.regle}</strong></Link>
                  <div className="choices" style={{ marginTop: 8 }}>
                    <button className={`choice ${res[c.regle] === 'cible' ? 'on' : ''}`} disabled={!peutFusionner} onClick={() => setRes({ ...res, [c.regle]: 'cible' })}>Garder : {valeur(c.cible)}</button>
                    <button className={`choice ${res[c.regle] === 'source' ? 'on' : ''}`} disabled={!peutFusionner} onClick={() => setRes({ ...res, [c.regle]: 'source' })}>Adopter : {valeur(c.source)}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {err && <ErrorBox message={err} />}
          <div className="row">
            {peutFusionner && <button className="btn primary" onClick={fusionner}><GitMerge size={16} /> Fusionner</button>}
            {user && (user.id === p.author_id || peutFusionner) && <button className="btn" onClick={fermer}><XCircle size={16} /> Fermer</button>}
            <Link className="btn ghost" to={`/comparer?a=${p.target_society}&b=${p.source_society}&branche_a=${p.target_branch}&branche_b=${p.source_branch}`}>Comparer les deux sociétés</Link>
          </div>
        </div>
      )}
      {p.statut === 'fusionnee' && <Notice kind="ok">Proposition fusionnée dans {p.target_nom}.</Notice>}
      <h3 style={{ marginTop: 24 }}>Discussion</h3>
      <div className="stack">
        {p.commentaires.map((c) => <div key={c.id} className="card flat"><div className="small muted"><strong>{c.auteur}</strong> · {relatif(c.created_at)}</div><div style={{ whiteSpace: 'pre-wrap' }}>{c.corps}</div></div>)}
        {user ? <div><textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Votre commentaire" /><button className="btn primary" style={{ marginTop: 8 }} disabled={!txt.trim()} onClick={commenter}>Publier</button></div>
          : <div className="small"><Link to="/connexion">Identifiez-vous</Link> pour commenter.</div>}
      </div>
    </div>
  )
}
