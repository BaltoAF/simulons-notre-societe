import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Calculator, CheckCircle2, GitBranch, GitFork, Landmark, Lightbulb, Plus, Save, Trash2, Undo2, User } from 'lucide-react'
import { api, type Rapport, type Regle, type SocieteDetail, type Valeur } from '../lib/api'
import { ecartLisible, euros, valeur } from '../lib/format'
import { milliards, tonnes } from '../lib/humain'
import { infoMission } from '../lib/missions'
import { PRESETS, resoudrePreset } from '../lib/presets'
import { AGE_TERME, agesPourTous, estAgeLegal, GENERATIONS, nomGeneration } from '../lib/retraite'
import { BROUILLON_VIDE, resumeSituation, situationVersMenage, useApp, useFetch } from '../lib/state'
import { RulePicker, ValueEditor } from '../components/editors'
import { BudgetEditor } from '../components/BudgetEditor'
import { PROFILS } from '../lib/profils'
import { ReportView } from '../components/report'
import { Terme } from '../components/Terme'
import { ErrorBox, Modal, Notice } from '../components/ui'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const estMission = (id: string) => id.startsWith('budget.etat.mission.')

export default function Atelier() {
  const { draft, setDraft, situation, setSituation, user } = useApp()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { data: rdata } = useFetch<{ regles: Regle[] }>('/api/regles?limit=5000')
  const regles = useMemo(() => Object.fromEntries((rdata?.regles ?? []).map((r) => [r.id, r])), [rdata])
  const [picker, setPicker] = useState<false | string>(false)
  const [budgetEd, setBudgetEd] = useState(false)
  const [presets, setPresets] = useState(false)
  const [avecFoyer, setAvecFoyer] = useState(!!situation)
  const [rapport, setRapport] = useState<Rapport | null>(() => lireSession<Rapport>('atelier.rapport'))
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

  const [rapportPour, setRapportPour] = useState<string | null>(() => lireSession<string>('atelier.rapportPour'))
  useEffect(() => { if (!rapport?.partiel) ecrireSession('atelier.rapport', rapport); ecrireSession('atelier.rapportPour', rapportPour) }, [rapport, rapportPour])
  const [annulable, setAnnulable] = useState<typeof draft | null>(null) // « Tout recommencer » peut être annulé
  const [demarrage, setDemarrage] = useState(false) // le Système vient de redémarrer : premier calcul plus long
  const [phase, setPhase] = useState(0) // 0 : rien en cours ; 1 : foyer et ménages types ; 2 : effets nationaux
  const resultats = useRef<HTMLDivElement>(null)
  const simuler = async (ov: Record<string, Valeur> = draft.overrides) => {
    setLoading(true); setErr(null); setPhase(1); setDemarrage(false)
    api<{ pret: boolean }>('/api/pret').then((p) => setDemarrage(!p.pret)).catch(() => {})
    // amener le lecteur au début des résultats s'il ne les voit pas (sur téléphone, ils sont sous la réforme)
    setTimeout(() => {
      const top = resultats.current?.getBoundingClientRect().top ?? 0
      if (top < 0 || top > window.innerHeight * 0.5) resultats.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    const body = { overrides: ov, menage: avecFoyer && situation ? situationVersMenage(situation) : null, montants: 'net' }
    try {
      // Les deux calculs partent ensemble : le rapide (votre foyer, les ménages types) s'affiche dès qu'il arrive,
      // pendant que le complet (finances publiques, inégalités, emploi, climat, bien-être) continue.
      let complet = false
      api<Rapport>('/api/simulation/reforme', { body: { ...body, modules: ['menage', 'cas_types'] } })
        .then((rapide) => { if (!complet) { setRapport({ ...rapide, partiel: true }); setPhase(2) } })
        .catch(() => { /* le calcul complet suffit */ })
      const total = api<Rapport>('/api/simulation/reforme', { body }).then((r) => { complet = true; return r })
      const r = await total
      setRapport(r)
      setRapportPour(JSON.stringify(ov))
    } catch (e: any) { setErr(e.message) } finally { setLoading(false); setPhase(0) }
  }
  const appliquerCompensation = (o: Record<string, Valeur>) => {
    const ov = { ...draft.overrides, ...o }
    setDraft((d) => ({ ...d, overrides: ov }))
    simuler(ov)
  }
  const aJour = rapport !== null && !rapport.partiel && rapportPour === JSON.stringify(draft.overrides)
  const desequilibres = aJour ? (rapport?.equilibres ?? []).filter((e) => e.statut === 'a_compenser') : []
  const aSurveiller = aJour ? (rapport?.equilibres ?? []).filter((e) => e.statut === 'a_surveiller') : []
  const etape = changes.length === 0 ? 1 : !aJour ? (rapport || loading ? 3 : 2) : desequilibres.length ? 4 : 5

  useEffect(() => {
    if (params.get('budget') && rdata) { setBudgetEd(true); params.delete('budget'); setParams(params, { replace: true }) }
    // ?regle=… : arriver directement sur le réglage d'une règle (ex. « Dépenser plus pour l'hôpital » depuis le budget)
    const rid = params.get('regle')
    if (rid && rdata) {
      if (regles[rid]) ajouter(regles[rid])
      params.delete('regle'); setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdata])

  // plus aucun changement : les anciens résultats n'ont plus de sens, on revient à l'écran de départ
  useEffect(() => {
    if (rdata && changes.length === 0 && !loading && (rapport || rapportPour)) { setRapport(null); setRapportPour(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rdata, changes.length])

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
  const retirerMissions = () => setDraft((d) => { const o = { ...d.overrides }; for (const k of Object.keys(o)) if (estMission(k)) delete o[k]; return { ...d, overrides: o } })
  // une génération de l'âge légal choisie dans la liste : on ouvre le réglage commun à toutes les générations
  const ajouter = (r: Regle) => {
    if (estAgeLegal(r.id)) { if (!(AGE_TERME in draft.overrides) && regles[AGE_TERME]) setVal(AGE_TERME, regles[AGE_TERME].valeur) }
    else setVal(r.id, r.valeur)
    setPicker(false)
  }
  const actuelles = useMemo(() => Object.fromEntries((rdata?.regles ?? []).map((r) => [r.id, r.valeur])), [rdata])
  const setAges = (x: number) => setDraft((d) => {
    const o = Object.fromEntries(Object.entries(d.overrides).filter(([k]) => !estAgeLegal(k)))
    return { ...d, overrides: { ...o, ...agesPourTous(x, actuelles) } }
  })
  const retirerAges = () => setDraft((d) => ({ ...d, overrides: Object.fromEntries(Object.entries(d.overrides).filter(([k]) => !estAgeLegal(k))) }))
  const appliquerPreset = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!
    setDraft((d) => ({ ...d, overrides: { ...d.overrides, ...resoudrePreset(p, actuelles) } }))
    setPresets(false)
  }

  // Changements à enregistrer par rapport à la société de départ
  const aCommitter = () => {
    const ref = base?.overrides ?? {}
    const out: any[] = []
    for (const id of changes) {
      // les générations de l'âge légal partagent la raison donnée pour l'âge à terme
      const justif = draft.justifications[id] || (estAgeLegal(id) ? draft.justifications[AGE_TERME] : '') || ''
      if (!same(draft.overrides[id], ref[id])) out.push({ regle: id, valeur: draft.overrides[id], justification: justif })
    }
    for (const id of Object.keys(ref)) {
      if (!changes.includes(id)) out.push({ regle: id, retablir: true })
    }
    return out
  }
  const proprietaire = !!(base && user && base.societe.owner_id === user.id && !base.societe.reference)

  // Les missions du budget sont regroupées en une seule carte : elles se règlent ensemble, dans l'éditeur du budget
  const missionsModifiees = changes.filter(estMission)
  const deltaMissions = missionsModifiees.reduce((a, id) => a + (Number(draft.overrides[id]) - Number(regles[id].valeur)), 0)
  // de même pour l'âge légal de départ, fixé génération par génération : une seule carte, réglée par l'âge à terme
  const agesIds = ids.filter(estAgeLegal)
  const agesModifies = changes.filter(estAgeLegal)
  const nbChangements = changes.length - missionsModifiees.length + (missionsModifiees.length ? 1 : 0) - agesModifies.length + (agesModifies.length ? 1 : 0)
  // les 3 plus grands mouvements (≥ 0,5 Md€), le reste résumé en « petits ajustements » (compensation automatique)
  const mouvements = missionsModifiees.map((id) => ({ nom: infoMission(id, regles[id].titre).nom, d: Number(draft.overrides[id]) - Number(regles[id].valeur) }))
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  const principaux = mouvements.filter((m) => Math.abs(m.d) >= 0.5).slice(0, 3)
  const autres = mouvements.length - principaux.length

  return (
    <div className="container page">
      <div className="row between" style={{ marginBottom: 4 }}>
        <h1 style={{ margin: 0 }}>Changer les règles</h1>
        {changes.length > 0 && <button className="btn ghost small" onClick={() => { setAnnulable(draft); setDraft(BROUILLON_VIDE); setBase(null); setRapport(null); setRapportPour(null) }}><Undo2 size={15} /> Tout recommencer</button>}
      </div>
      {annulable && changes.length === 0 && (
        <div className="notice small" style={{ margin: '6px 0' }}><div>Votre réforme a été effacée.{' '}
          <button className="lien" onClick={() => { setDraft(annulable); setAnnulable(null) }}>Annuler</button></div></div>
      )}
      <p className="ink2" style={{ maxWidth: 760, marginBottom: 8 }}>Imaginez une autre règle et découvrez ce qu'elle changerait, pour vous et pour le pays. C'est libre et anonyme ; un compte n'est utile que pour enregistrer et partager.</p>
      <Etapes etape={etape} />

      <div className="split">
        <div className="stack">
          <div className="card">
            <div className="small muted" style={{ marginBottom: 4 }}>Vous partez de</div>
            <div className="row between">
              <strong><GitBranch size={15} /> {base && !base.societe.reference ? base.societe.nom : <>la France d'aujourd'hui (<Terme id="societe_1_0">Société 1.0</Terme>)</>}</strong>
              {base && !base.societe.reference && <Link className="small" to={`/societes/${base.societe.id}`}>voir</Link>}
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3 style={{ margin: 0 }}>Votre réforme</h3><span className="badge primary">{nbChangements} changement{nbChangements > 1 ? 's' : ''}</span></div>
            {changes.length === 0 && ids.length === 0 && <p className="small muted">Rien n'est encore changé. Choisissez un thème, partez d'une idée, ou changez une règle précise.</p>}
            {missionsModifiees.length > 0 && (
              <div className="change-chip">
                <div className="row between top" style={{ flexWrap: 'nowrap' }}>
                  <div className="grow"><strong><Landmark size={15} /> Budget de l'État</strong>
                    <div className="small">{principaux.map((p) => `${p.nom} ${milliards(p.d, true)}`).join(' · ')}{autres > 0 ? ` · petits ajustements sur ${autres} autre${autres > 1 ? 's' : ''} domaine${autres > 1 ? 's' : ''}` : ''}</div>
                    <div className="small muted">{Math.abs(deltaMissions) < 0.05 ? 'Même total : répartition différente' : deltaMissions > 0 ? `Au total : ${milliards(deltaMissions)} de dépenses en plus par an` : `Au total : ${milliards(Math.abs(deltaMissions))} d'économies par an`}</div></div>
                  <button className="btn small" onClick={() => setBudgetEd(true)}>Modifier</button>
                </div>
                <button className="btn ghost small" style={{ marginTop: 6, paddingLeft: 0 }} onClick={retirerMissions}><Trash2 size={14} /> Revenir au budget voté</button>
              </div>
            )}
            {agesIds.length > 0 && regles[AGE_TERME] && (() => {
              const r = regles[AGE_TERME]
              const v = Number(draft.overrides[AGE_TERME] ?? r.valeur)
              const avant = Number(r.valeur)
              const detail = GENERATIONS.filter((id) => agesModifies.includes(id) && regles[id])
              return (
                <div className="change-chip">
                  <Link to={`/regles/r/${AGE_TERME}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>Âge légal de départ à la retraite</Link>
                  <div className="row small" style={{ gap: 6, marginTop: 4 }}>
                    <span className="muted">Aujourd'hui : {valeur(avant, r.unite, r.type)} (à terme)</span>
                    {v !== avant && <>
                      <ArrowRight size={13} />
                      <strong>Votre choix : {valeur(v, r.unite, r.type)}</strong>
                      <span className={`badge ${v > avant ? 'accent' : 'primary'}`}>{ecartLisible(avant, v, r.unite)}</span>
                    </>}
                  </div>
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {v < avant ? `Personne ne partira plus tard que ${valeur(v, r.unite, r.type)}, quelle que soit sa date de naissance.`
                      : v > avant ? `Pour les personnes nées à partir de 1969 ; les générations précédentes gardent leur âge actuel.`
                        : `L'âge choisi vaudra pour toutes les générations : personne ne partira plus tard.`}
                  </div>
                  <div style={{ marginTop: 10 }}><ValueEditor rule={r} value={v} onChange={(x) => setAges(Number(x))} /></div>
                  {detail.length > 0 && (
                    <details className="curieux small" style={{ marginTop: 6 }}>
                      <summary>Le détail par génération ({detail.length})</summary>
                      <ul className="list small">{detail.map((id) => (
                        <li key={id} className="list-row"><span>{nomGeneration(regles[id].titre)}</span>
                          <span>{valeur(regles[id].valeur, 'ans')} → <strong>{valeur(draft.overrides[id], 'ans')}</strong></span></li>
                      ))}</ul>
                    </details>
                  )}
                  {v === avant && <div className="small muted" style={{ marginTop: 6 }}>Changez la valeur ci-dessus.</div>}
                  {v !== avant && (
                    <input type="text" placeholder="Pourquoi ? (facultatif)" style={{ marginTop: 8, fontSize: '.88rem' }}
                      value={draft.justifications[AGE_TERME] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, justifications: { ...d.justifications, [AGE_TERME]: e.target.value } }))} />
                  )}
                  <button className="btn ghost small" style={{ marginTop: 6, paddingLeft: 0 }} onClick={retirerAges}><Trash2 size={14} /> {agesModifies.length ? 'Annuler ce changement' : 'Retirer'}</button>
                </div>
              )
            })()}
            {ids.filter((id) => !estMission(id) && !estAgeLegal(id)).map((id) => {
              const r = regles[id]
              if (!r) return <div key={id} className="small muted">Chargement…</div>
              const v = draft.overrides[id]
              const modifie = !same(v, r.valeur)
              const pct = typeof v === 'number' && typeof r.valeur === 'number' && r.valeur !== 0 ? (v / r.valeur - 1) * 100 : null
              return (
                <div key={id} className="change-chip">
                  <Link to={`/regles/r/${id}`} style={{ fontWeight: 700, color: 'var(--ink)' }}>{r.titre}</Link>
                  <div className="row small" style={{ gap: 6, marginTop: 4 }}>
                    <span className="muted">Aujourd'hui : {valeur(r.valeur, r.unite, r.type)}</span>
                    {modifie && <>
                      <ArrowRight size={13} />
                      <strong>Votre choix : {valeur(v, r.unite, r.type)}</strong>
                      {typeof v === 'number' && typeof r.valeur === 'number' && (pct === null || Math.abs(pct) >= 0.05) && v !== r.valeur
                        && <span className={`badge ${v > r.valeur ? 'accent' : 'primary'}`}>{ecartLisible(r.valeur, v, r.unite)}</span>}
                    </>}
                  </div>
                  {id === 'travail.smic.horaire_brut' && typeof v === 'number' && (
                    <div className="small muted" style={{ marginTop: 4 }}>Soit environ {euros(v * 151.67, 0)} brut, ≈ {euros(v * 151.67 * 0.79, 0)} net par mois à temps plein.</div>
                  )}
                  <div style={{ marginTop: 10 }}><ValueEditor rule={r} value={v} onChange={(x) => setVal(id, x)} /></div>
                  {!modifie && <div className="small muted" style={{ marginTop: 6 }}>Changez la valeur ci-dessus.</div>}
                  {modifie && (
                    <input type="text" placeholder="Pourquoi ? (facultatif)" style={{ marginTop: 8, fontSize: '.88rem' }}
                      value={draft.justifications[id] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, justifications: { ...d.justifications, [id]: e.target.value } }))} />
                  )}
                  <button className="btn ghost small" style={{ marginTop: 6, paddingLeft: 0 }} onClick={() => retirer(id)}><Trash2 size={14} /> {modifie ? 'Annuler ce changement' : 'Retirer'}</button>
                </div>
              )
            })}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setPicker('')}><Plus size={16} /> Changer une règle</button>
              <button className="btn ghost" onClick={() => setPresets(true)}><Lightbulb size={16} /> Des idées</button>
              <button className="btn ghost" onClick={() => setBudgetEd(true)}><Landmark size={16} /> Le budget de l'État</button>
            </div>
          </div>

          <div className="card">
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={avecFoyer && !!situation} disabled={!situation} onChange={(e) => setAvecFoyer(e.target.checked)} />
              <span><User size={15} /> Voir aussi l'effet sur mon foyer</span>
            </label>
            {situation && avecFoyer && <div className="small muted" style={{ marginTop: 4, marginLeft: 26 }}>{resumeSituation(situation)} · <Link to="/mes-droits">modifier</Link></div>}
            {!situation && (
              <div className="small muted" style={{ marginTop: 6 }}>Décrivez votre situation dans <Link to="/mes-droits">Mes droits</Link>, ou choisissez un foyer qui vous ressemble :
                <div className="pill-list" style={{ marginTop: 6 }}>{PROFILS.map((p) => <button key={p.titre} className="badge" style={{ cursor: 'pointer' }} onClick={() => { setSituation(p.s); setAvecFoyer(true) }}>{p.titre}</button>)}</div>
              </div>
            )}
            <button className="btn primary large" style={{ width: '100%', marginTop: 14 }} disabled={!changes.length || loading} onClick={() => simuler()}>
              <Calculator size={18} /> {loading ? 'Calcul en cours…' : rapportPour && !aJour ? 'Recalculer les effets' : 'Voir les effets'}
            </button>
            {!changes.length && <div className="small muted" style={{ marginTop: 6, textAlign: 'center' }}>Changez au moins une règle pour voir ses effets.</div>}
          </div>

          {changes.length > 0 && !(aJour && desequilibres.length === 0) && (
            <div className="card">
              <h3><Save size={17} /> Enregistrer et partager</h3>
              {!aJour ? (
                <p className="small">D'abord, cliquez sur « Voir les effets » : on n'enregistre une réforme qu'après avoir vérifié ce qu'elle coûte.</p>
              ) : desequilibres.length > 0 ? (
                <div className="notice warn small"><div><strong>Encore une étape :</strong>{' '}
                  {desequilibres.map((e) => e.id === 'budget' ? `il manque ${milliards(e.manque)} par an pour financer votre réforme` : `votre réforme émet ${tonnes(e.manque)} de trop par an`).join(', et ')}.
                  Choisissez une solution dans « Les équilibres à respecter », à droite.</div></div>
              ) : !user ? (
                <p className="small"><CheckCircle2 size={15} color="var(--gain)" /> Votre réforme est équilibrée. Pour l'enregistrer et la partager, <Link to="/connexion?retour=/atelier">créez un compte ou connectez-vous</Link> (votre travail est conservé).</p>
              ) : (
                <div className="stack">
                  <p className="small" style={{ margin: 0 }}><CheckCircle2 size={15} color="var(--gain)" /> Votre réforme est équilibrée : vous pouvez l'enregistrer.</p>
                  {proprietaire && <button className="btn primary" style={{ width: '100%' }} onClick={() => setSaving(true)}><GitBranch size={16} /> Mettre à jour « {base!.societe.nom} »</button>}
                  <button className={`btn ${proprietaire ? '' : 'primary'}`} style={{ width: '100%' }} onClick={() => setSaving(true)}><GitFork size={16} /> Enregistrer ma proposition</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div ref={resultats} style={{ scrollMarginTop: 80 }}>
          {err && <ErrorBox message={err} />}
          {loading && <Progression phase={phase} demarrage={demarrage} />}
          {rapport && !loading && !aJour && rapportPour !== null && (
            <div className="notice warn" style={{ marginBottom: 12 }}><div>Vous avez modifié votre réforme depuis le dernier calcul : les résultats ci-dessous ne sont plus à jour.{' '}
              <button className="btn small" onClick={() => simuler()}>Recalculer les effets</button></div></div>
          )}
          {aJour && !loading && desequilibres.length === 0 && aSurveiller.length > 0 && (
            <div className="notice warn" style={{ marginBottom: 12 }}><div>
              <strong>À surveiller :</strong> {aSurveiller.map((e) => e.id === 'budget' ? `cette réforme coûterait environ ${milliards(Math.abs(e.effet))} par an` : `elle augmenterait les émissions d'environ ${tonnes(Math.abs(e.effet))} par an`).join(', et ')}.
              {' '}L'estimation est trop incertaine pour être exigée : vous pouvez enregistrer, mais il est conseillé de {aSurveiller[0].id === 'budget' ? 'la financer' : 'compenser'}. <a href="#equilibres">Voir les solutions ↓</a></div></div>
          )}
          {aJour && !loading && changes.length > 0 && desequilibres.length === 0 && aSurveiller.length === 0 && (
            <div className="notice ok" style={{ marginBottom: 12 }}><CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <div className="grow"><strong>Votre réforme est équilibrée.</strong> Vous pouvez l'enregistrer pour la partager.</div>
              {!user ? <Link className="btn primary small" to="/connexion?retour=/atelier">Se connecter pour enregistrer</Link>
                : proprietaire ? <div className="row"><button className="btn primary small" onClick={() => setSaving(true)}><GitBranch size={15} /> Mettre à jour « {base!.societe.nom} »</button>
                  <button className="btn small" onClick={() => setSaving(true)}><GitFork size={15} /> Nouvelle proposition</button></div>
                : <button className="btn primary small" onClick={() => setSaving(true)}><GitFork size={15} /> Enregistrer ma proposition</button>}
            </div>
          )}
          {aJour && !loading && desequilibres.length > 0 && (
            <div className="notice warn" style={{ marginBottom: 12 }}><div><strong>Encore une étape :</strong>{' '}
              {desequilibres.map((e) => e.id === 'budget' ? `il manque ${milliards(e.manque)} par an pour financer votre réforme` : `votre réforme émet ${tonnes(e.manque)} de trop par an`).join(', et ')}.
              {' '}<a href="#equilibres">Choisir une solution ↓</a></div></div>
          )}
          {rapport && (!loading || rapport.partiel) && <ReportView r={rapport} overrides={draft.overrides} onAppliquer={appliquerCompensation} />}
          {!loading && !rapport && changes.length > 0 && (
            <div className="card soft" style={{ textAlign: 'center', padding: 32 }}>
              <Calculator size={36} color="var(--primary)" />
              <h3 style={{ marginTop: 10 }}>Votre réforme est prête</h3>
              <p className="muted small" style={{ maxWidth: 480, margin: '0 auto 14px' }}>Le site va calculer ce qu'elle change pour vous et pour le pays : argent public, inégalités, climat et bien-être.</p>
              <button className="btn primary large" onClick={() => simuler()}><Calculator size={18} /> Voir les effets</button>
            </div>
          )}
          {!loading && !rapport && changes.length === 0 && (
            <div className="card soft" style={{ textAlign: 'center', padding: 32 }}>
              <Calculator size={36} color="var(--primary)" />
              <h3 style={{ marginTop: 10 }}>Par où commencer ?</h3>
              <p className="muted small" style={{ maxWidth: 520, margin: '0 auto 14px' }}>Choisissez un thème, puis la règle à changer. Le site calculera ce qu'elle change pour vous et pour le pays : argent, inégalités, climat et bien-être.</p>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', textAlign: 'left', marginBottom: 18 }}>
                {[['fiscalite', 'Les impôts'], ['prestations', 'Les aides'], ['travail', 'Le travail'], ['retraites', 'Les retraites'],
                  ['budget', "Le budget de l'État"], ['environnement_energie', 'Climat et énergie'], ['transports', 'La route'], ['sante', 'La santé']].map(([d, t]) => (
                  <button key={d} className="preset" onClick={() => (d === 'budget' ? setBudgetEd(true) : setPicker(d))}><strong>{t}</strong></button>
                ))}
              </div>
              <div className="kpi-label" style={{ marginBottom: 8 }}>… ou partez d'une idée</div>
              <div className="grid cols-2" style={{ textAlign: 'left', maxWidth: 620, margin: '0 auto' }}>
                {PRESETS.slice(0, 4).map((p) => <button key={p.id} className="preset" onClick={() => appliquerPreset(p.id)}><strong>{p.titre}</strong><span className="small muted">{p.description}</span></button>)}
              </div>
            </div>
          )}
        </div>
      </div>

      {picker !== false && <RulePicker onPick={ajouter} onClose={() => setPicker(false)} exclude={ids} domaine={picker} />}
      {budgetEd && rdata && <BudgetEditor regles={rdata.regles} overrides={draft.overrides} onClose={() => setBudgetEd(false)}
        onApply={(o) => { setDraft((d) => { const ov = { ...d.overrides }; for (const k of Object.keys(ov)) if (estMission(k)) delete ov[k]; return { ...d, overrides: { ...ov, ...o } } }); setBudgetEd(false) }} />}
      {presets && (
        <Modal title="Des idées de réformes" onClose={() => setPresets(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>Cliquez sur une idée : elle s'ajoute à votre réforme, et vous pourrez ensuite ajuster chaque valeur.</p>
          <div className="grid cols-2">{PRESETS.map((p) => <button key={p.id} className="preset" onClick={() => appliquerPreset(p.id)}><strong>{p.titre}</strong><span className="small muted">{p.description}</span></button>)}</div>
        </Modal>
      )}
      {saving && <SaveModal proprietaire={proprietaire} base={base} changements={aCommitter()} nomDefaut={draft.nomSociete}
        onClose={() => setSaving(false)} onDone={(sid) => { setSaving(false); setDraft((d) => ({ ...d, societe: sid })); nav(`/societes/${sid}`) }} />}
    </div>
  )
}

// Conserver les résultats le temps de la visite (le navigateur peut refuser : on fait alors sans)
function lireSession<T>(cle: string): T | null {
  try { const v = sessionStorage.getItem(cle); return v ? JSON.parse(v) as T : null } catch { return null }
}
function ecrireSession(cle: string, v: unknown) {
  try { if (v === null || v === undefined) sessionStorage.removeItem(cle); else sessionStorage.setItem(cle, JSON.stringify(v)) } catch { /* espace plein ou stockage bloqué */ }
}

function Etapes({ etape }: { etape: number }) {
  const noms = ['Choisir ce qui change', 'Régler', 'Voir les effets', 'Équilibrer', 'Enregistrer et partager']
  return (
    <>
      <ol className="etapes" aria-label="Les étapes">
        {noms.map((n, i) => (
          <li key={n} className={i + 1 < etape ? 'fait' : i + 1 === etape ? 'actif' : ''} aria-current={i + 1 === etape ? 'step' : undefined}>
            <span className="n">{i + 1 < etape ? '✓' : i + 1}</span><span className="lib">{n}</span>
          </li>
        ))}
      </ol>
      <div className="etape-mobile" aria-hidden="true">Étape {etape} sur {noms.length} : <strong>{noms[etape - 1]}</strong></div>
    </>
  )
}

function Progression({ phase, demarrage }: { phase: number; demarrage: boolean }) {
  const etapes = [
    'Votre foyer et des ménages types',
    'Les finances publiques et les inégalités (sur une population représentative de la France)',
    "L'emploi, le climat et le bien-être (d'après les études)",
  ]
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Calcul en cours…</h3>
      <div className="progression">
        {etapes.map((e, i) => {
          const st = phase <= 1 ? (i === 0 ? 'encours' : '') : (i === 0 ? 'ok' : 'encours')
          return (
            <div key={e} className={`etape-calc ${st}`}>
              {st === 'ok' ? <CheckCircle2 size={18} /> : st === 'encours' ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <span style={{ width: 18, display: 'inline-block' }} />}
              {e}
            </div>
          )
        })}
      </div>
      {demarrage
        ? <div className="notice warn small" style={{ marginTop: 10, marginBottom: 0 }}><div>Le site vient de redémarrer et prépare ses calculs : ce premier calcul peut prendre jusqu'à une minute. Les suivants seront bien plus rapides.</div></div>
        : <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>Comptez de 10 secondes à une minute : toutes les règles d'impôts et d'aides sont appliquées, une à une, à des milliers de foyers.</p>}
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
    <Modal title="Enregistrer votre proposition" onClose={onClose}>
      {proprietaire && (
        <div className="choices" style={{ marginBottom: 14 }}>
          <button className={`choice ${mode === 'commit' ? 'on' : ''}`} aria-pressed={mode === 'commit'} onClick={() => setMode('commit')}>Mettre à jour « {base!.societe.nom} »</button>
          <button className={`choice ${mode === 'fork' ? 'on' : ''}`} aria-pressed={mode === 'fork'} onClick={() => setMode('fork')}>Créer une nouvelle proposition</button>
        </div>
      )}
      {mode === 'fork' && (
        <>
          <label className="field"><span>Nom de votre proposition</span><input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex. : Le travail mieux payé" /></label>
          <label className="field"><span>Votre idée en quelques lignes (facultatif)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Quelle France voulez-vous ? Pourquoi ces changements ?" /></label>
        </>
      )}
      <label className="field"><span>En une phrase, ce que vous avez changé</span><input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : RSA à 800 €, financé par une tranche d'impôt à 50 %" />
        <span className="hint">Cette phrase apparaîtra dans l'historique de votre proposition.</span></label>
      <div className="small muted" style={{ marginBottom: 12 }}>{(() => { const m = changements.filter((c) => String(c.regle).startsWith('budget.etat.mission.')).length; const n = changements.length - m + (m ? 1 : 0); return <>{n} changement{n > 1 ? 's' : ''} {n > 1 ? 'seront enregistrés' : 'sera enregistré'}{m ? ` (dont le budget de l'État : ${m} domaine${m > 1 ? 's' : ''} ajusté${m > 1 ? 's' : ''})` : ''}.</> })()} Votre proposition sera visible par tous : chacun pourra s'en inspirer, créer sa propre version et vous suggérer des améliorations.</div>
      {changements.length === 0 && <Notice kind="warn">Rien n'a changé par rapport à votre point de départ.</Notice>}
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={busy || changements.length === 0 || (mode === 'fork' && !nom.trim())} onClick={go}>{busy ? 'Enregistrement…' : 'Enregistrer'} <ArrowRight size={15} /></button>
      </div>
    </Modal>
  )
}
