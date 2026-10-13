import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Calculator, GitBranch, GitFork, Lightbulb, Plus, Save, Trash2, Undo2, User } from 'lucide-react'
import { api, type Rapport, type Regle, type SocieteDetail, type Valeur } from '../lib/api'
import { DOMAINE_TITRE, valeur } from '../lib/format'
import { PRESETS, resoudrePreset } from '../lib/presets'
import { BROUILLON_VIDE, situationVersMenage, useApp, useFetch } from '../lib/state'
import { RulePicker, ValueEditor } from '../components/editors'
import { ReportView } from '../components/report'
import { ErrorBox, Loading, Modal, Notice } from '../components/ui'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export default function Atelier() {
  const { draft, setDraft, situation, user } = useApp()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { data: rdata } = useFetch<{ regles: Regle[] }>('/api/regles?limit=5000')
  const regles = useMemo(() => Object.fromEntries((rdata?.regles ?? []).map((r) => [r.id, r])), [rdata])
  const [picker, setPicker] = useState(false)
  const [presets, setPresets] = useState(false)
  const [avecFoyer, setAvecFoyer] = useState(!!situation)
  const [rapport, setRapport] = useState<Rapport | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [base, setBase] = useState<{ societe: SocieteDetail; overrides: Record<string, Valeur> } | null>(null)
  const [saving, setSaving] = useState(false)
  const lance = useRef(false)

  // Charger une société existante comme point de départ (?societe=…&branche=…)
  useEffect(() => {
    const sid = params.get('societe')
    const br = params.get('branche') || 'principale'
    if (!sid) {
      if (draft.societe) {
        api<SocieteDetail>(`/api/societes/${draft.societe}?branche=${draft.branche}`)
          .then(async (soc) => { const e = await api<{ overrides: Record<string, Valeur> }>(`/api/societes/${soc.id}/etat?branche=${draft.branche}`); setBase({ societe: soc, overrides: e.overrides }) })
          .catch(() => setDraft((d) => ({ ...d, societe: null })))
      }
      return
    }
    Promise.all([api<SocieteDetail>(`/api/societes/${sid}?branche=${br}`), api<{ overrides: Record<string, Valeur> }>(`/api/societes/${sid}/etat?branche=${br}`)])
      .then(([soc, e]) => {
        setBase({ societe: soc, overrides: e.overrides })
        setDraft({ overrides: { ...e.overrides }, justifications: {}, societe: soc.reference ? null : sid, branche: br, nomSociete: soc.nom })
        setRapport(null)
        params.delete('societe'); params.delete('branche'); params.set('lancer', '1'); setParams(params, { replace: true })
      })
      .catch((e) => setErr(e.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ids = Object.keys(draft.overrides)
  const changes = ids.filter((id) => regles[id] && !same(draft.overrides[id], regles[id].valeur))

  const simuler = async () => {
    setLoading(true); setErr(null)
    try {
      const r = await api<Rapport>('/api/simulation/reforme', {
        body: { overrides: draft.overrides, menage: avecFoyer && situation ? situationVersMenage(situation) : null, montants: 'net' },
      })
      setRapport(r)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  useEffect(() => {
    if (params.get('lancer') && !lance.current && rdata && Object.keys(draft.overrides).length) {
      lance.current = true
      params.delete('lancer'); setParams(params, { replace: true })
      simuler()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdata, params])

  const setVal = (id: string, v: Valeur) => setDraft((d) => ({ ...d, overrides: { ...d.overrides, [id]: v } }))
  const retirer = (id: string) => setDraft((d) => { const o = { ...d.overrides }; delete o[id]; return { ...d, overrides: o } })
  const ajouter = (r: Regle) => { setVal(r.id, r.valeur); setPicker(false) }
  const appliquerPreset = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!
    const actuelles = Object.fromEntries((rdata?.regles ?? []).map((r) => [r.id, r.valeur]))
    setDraft((d) => ({ ...d, overrides: { ...d.overrides, ...resoudrePreset(p, actuelles) } }))
    setPresets(false)
  }

  // Changements à enregistrer par rapport à la société de départ
  const aCommitter = () => {
    const ref = base?.overrides ?? {}
    const out: any[] = []
    for (const id of changes) {
      if (!same(draft.overrides[id], ref[id])) out.push({ regle: id, valeur: draft.overrides[id], justification: draft.justifications[id] || '' })
    }
    for (const id of Object.keys(ref)) {
      if (!changes.includes(id)) out.push({ regle: id, retablir: true })
    }
    return out
  }
  const proprietaire = !!(base && user && base.societe.owner_id === user.id && !base.societe.reference)

  return (
    <div className="container page">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Atelier de réforme</h1>
        {changes.length > 0 && <button className="btn ghost small" onClick={() => { setDraft(BROUILLON_VIDE); setBase(null); setRapport(null) }}><Undo2 size={15} /> Tout effacer</button>}
      </div>
      <p className="ink2" style={{ maxWidth: 760 }}>Modifiez les règles de votre choix, puis mesurez les effets. Tester est libre et anonyme ; pour enregistrer et partager votre société, il suffit de s'identifier.</p>

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="small muted" style={{ marginBottom: 4 }}>Point de départ</div>
            <div className="row between">
              <strong><GitBranch size={15} /> {base && !base.societe.reference ? base.societe.nom : 'Société 1.0 (la loi actuelle)'}</strong>
              {base && !base.societe.reference && <Link className="small" to={`/societes/${base.societe.id}`}>voir</Link>}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 style={{ margin: 0 }}>Vos changements</h3><span className="badge primary">{changes.length}</span></div>
            {ids.length === 0 && <p className="small muted">Aucune règle modifiée pour l'instant. Ajoutez une règle ou partez d'une idée.</p>}
            {ids.map((id) => {
              const r = regles[id]
              if (!r) return <div key={id} className="small muted">Chargement de {id}…</div>
              const modifie = !same(draft.overrides[id], r.valeur)
              return (
                <div key={id} className="change-chip">
                  <div className="row between top" style={{ flexWrap: 'nowrap' }}>
                    <div className="grow">
                      <Link to={`/regles/r/${id}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.titre}</Link>
                      <div className="small muted">{DOMAINE_TITRE[r.domaine] ?? r.domaine} · actuellement {valeur(r.valeur, r.unite, r.type)}</div>
                    </div>
                    <button className="icon-btn" onClick={() => retirer(id)} aria-label="Retirer ce changement"><Trash2 size={16} /></button>
                  </div>
                  <div style={{ marginTop: 10 }}><ValueEditor rule={r} value={draft.overrides[id]} onChange={(v) => setVal(id, v)} /></div>
                  {modifie && (
                    <input type="text" placeholder="Pourquoi ce changement ? (facultatif)" style={{ marginTop: 8, fontSize: '.88rem' }}
                      value={draft.justifications[id] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, justifications: { ...d.justifications, [id]: e.target.value } }))} />
                  )}
                </div>
              )
            })}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setPicker(true)}><Plus size={16} /> Ajouter une règle</button>
              <button className="btn ghost" onClick={() => setPresets(true)}><Lightbulb size={16} /> Idées</button>
            </div>
          </div>

          <div className="card">
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={avecFoyer && !!situation} disabled={!situation} onChange={(e) => setAvecFoyer(e.target.checked)} />
              <span><User size={15} /> Inclure mon foyer</span>
            </label>
            {!situation && <div className="small muted" style={{ marginTop: 6 }}>Renseignez d'abord votre situation dans <Link to="/mes-droits">Mes droits</Link> pour voir l'effet sur votre budget.</div>}
            <button className="btn primary large" style={{ width: '100%', marginTop: 14 }} disabled={!changes.length || loading} onClick={simuler}>
              <Calculator size={18} /> {loading ? 'Calcul en cours…' : 'Mesurer les impacts'}
            </button>
          </div>

          {changes.length > 0 && (
            <div className="card">
              <h3><Save size={17} /> Enregistrer</h3>
              {!user ? (
                <p className="small">Pour enregistrer votre société, la partager et recevoir des propositions, <Link to="/connexion?retour=/atelier">identifiez-vous</Link>. Votre brouillon est conservé.</p>
              ) : (
                <div className="stack">
                  {proprietaire && <button className="btn primary" style={{ width: '100%' }} onClick={() => setSaving(true)}><GitBranch size={16} /> Enregistrer dans « {base!.societe.nom} »</button>}
                  <button className={`btn ${proprietaire ? '' : 'primary'}`} style={{ width: '100%' }} onClick={() => setSaving(true)}><GitFork size={16} /> Créer une nouvelle société</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          {err && <ErrorBox message={err} />}
          {loading && <div className="card"><Loading label="Le Système calcule les impacts : moteur socio-fiscal, ménages types, études…" /></div>}
          {!loading && rapport && <ReportView r={rapport} />}
          {!loading && !rapport && (
            <div className="card soft" style={{ textAlign: 'center', padding: 40 }}>
              <Calculator size={36} color="var(--primary)" />
              <h3 style={{ marginTop: 10 }}>Les impacts s'afficheront ici</h3>
              <p className="muted small" style={{ maxWidth: 460, margin: '0 auto 14px' }}>Pour votre foyer, des ménages types, le budget public, les inégalités et l'économie — chaque chiffre avec ses sources et son indice de confiance.</p>
              <div className="grid cols-2" style={{ textAlign: 'left', maxWidth: 620, margin: '0 auto' }}>
                {PRESETS.slice(0, 4).map((p) => <button key={p.id} className="preset" onClick={() => appliquerPreset(p.id)}><strong>{p.titre}</strong><span className="small muted">{p.description}</span></button>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {picker && <RulePicker onPick={ajouter} onClose={() => setPicker(false)} exclude={ids} />}
      {presets && (
        <Modal title="Idées de réformes" onClose={() => setPresets(false)}>
          <div className="grid cols-2">{PRESETS.map((p) => <button key={p.id} className="preset" onClick={() => appliquerPreset(p.id)}><strong>{p.titre}</strong><span className="small muted">{p.description}</span></button>)}</div>
        </Modal>
      )}
      {saving && <SaveModal proprietaire={proprietaire} base={base} changements={aCommitter()} nomDefaut={draft.nomSociete}
        onClose={() => setSaving(false)} onDone={(sid) => { setSaving(false); setDraft((d) => ({ ...d, societe: sid })); nav(`/societes/${sid}`) }} />}
    </div>
  )
}

function SaveModal({ proprietaire, base, changements, nomDefaut, onClose, onDone }: {
  proprietaire: boolean; base: { societe: SocieteDetail } | null; changements: any[]; nomDefaut?: string
  onClose: () => void; onDone: (sid: string) => void
}) {
  const [mode, setMode] = useState<'commit' | 'fork'>(proprietaire ? 'commit' : 'fork')
  const [nom, setNom] = useState(nomDefaut && !proprietaire ? nomDefaut : '')
  const [description, setDescription] = useState('')
  const [message, setMessage] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setErr(null)
    try {
      if (mode === 'commit' && base) {
        await api(`/api/societes/${base.societe.id}/commits`, { body: { branche: base.societe.branche, changements, message } })
        onDone(base.societe.id)
      } else {
        const source = base?.societe.id ?? 'france'
        const s = await api<{ id: string }>('/api/societes', { body: { source, branche: base?.societe.branche ?? 'principale', nom, description, changements, message } })
        onDone(s.id)
      }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title="Enregistrer votre société" onClose={onClose}>
      {proprietaire && (
        <div className="choices" style={{ marginBottom: 14 }}>
          <button className={`choice ${mode === 'commit' ? 'on' : ''}`} onClick={() => setMode('commit')}>Nouvelle version de « {base!.societe.nom} »</button>
          <button className={`choice ${mode === 'fork' ? 'on' : ''}`} onClick={() => setMode('fork')}>Nouvelle société</button>
        </div>
      )}
      {mode === 'fork' && (
        <>
          <label className="field"><span>Nom de votre société</span><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Société du travail mieux payé" /></label>
          <label className="field"><span>Présentation (facultatif)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quelle est votre vision ? Qu'est-ce qui motive ces changements ?" /></label>
        </>
      )}
      <label className="field"><span>Message de version</span><input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : Hausse du RSA financée par une tranche à 50 %" /></label>
      <div className="small muted" style={{ marginBottom: 12 }}>{changements.length} changement(s) seront enregistrés. Votre société sera publique ; chacun pourra la forker et vous proposer des améliorations.</div>
      {changements.length === 0 && <Notice kind="warn">Aucune différence avec le point de départ.</Notice>}
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={busy || changements.length === 0 || (mode === 'fork' && !nom.trim())} onClick={go}>{busy ? 'Enregistrement…' : 'Enregistrer'} <ArrowRight size={15} /></button>
      </div>
    </Modal>
  )
}
