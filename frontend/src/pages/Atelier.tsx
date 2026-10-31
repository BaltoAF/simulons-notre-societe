import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, BookOpen, Calculator, Check, CheckCircle2, ChevronDown, GitBranch, GitFork, GitPullRequest, Landmark, Lightbulb, MessageSquare, Plus, Trash2, Undo2, User } from 'lucide-react'
import { api, type Rapport, type Regle, type SocieteDetail, type Valeur } from '../lib/api'
import { ecrireSession, lireSession } from '../lib/session'
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
import { ProchaineEtape } from '../components/Parcours'
import { ProposerSoutien } from '../components/Soutien'
import { noterActionUtile } from '../lib/soutien'
import { Terme } from '../components/Terme'
import { ErrorBox, Modal, Notice } from '../components/ui'

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const estMission = (id: string) => id.startsWith('budget.etat.mission.')

export default function Atelier() {
  const { draft, setDraft, situation, setSituation, user, marquer } = useApp()
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
  const [saving, setSaving] = useState<false | true | 'suggestion' | 'propre'>(false)
  const [ouvert, setOuvert] = useState<string | null>(null) // le changement déplié pour être réglé (les autres tiennent sur une ligne)
  const [supprime, setSupprime] = useState<typeof draft | null>(null) // « Supprimer ce changement » peut être annulé
  const supprimer = (faire: () => void) => { setSupprime(draft); faire(); setOuvert(null) }
  // rétablir ne remet que ce qui a été supprimé : les réglages faits depuis sont gardés
  const aRetablir = supprime ? Object.keys(supprime.overrides).filter((k) => !(k in draft.overrides)) : []
  const retablir = () => {
    setDraft((d) => ({ ...d, overrides: { ...d.overrides, ...Object.fromEntries(aRetablir.map((k) => [k, supprime!.overrides[k]])) } }))
    setSupprime(null)
  }
  // le changement qu'on vient d'ajouter : on l'amène sous les yeux (sur téléphone, la liste des thèmes est en dessous)
  useEffect(() => {
    if (ouvert) document.querySelector(`[data-changement="${ouvert}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [ouvert])
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
        setDraft({ overrides: { ...e.overrides }, justifications: {}, societe: soc.reference ? null : sid, branche: br, nomSociete: soc.nom,
          suggestion: params.get('suggestion') === '1' && !soc.reference })
        setRapport(null)
        params.delete('societe'); params.delete('branche'); params.delete('suggestion'); params.set('lancer', '1'); setParams(params, { replace: true })
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
  const [lent, setLent] = useState(false) // plus de 20 secondes : rassurer plutôt que laisser croire à une panne
  const [phase, setPhase] = useState(0) // 0 : rien en cours ; 1 : foyer et ménages types ; 2 : effets nationaux
  const resultats = useRef<HTMLDivElement>(null)
  const simuler = async (ov: Record<string, Valeur> = draft.overrides) => {
    setLoading(true); setErr(null); setPhase(1); setDemarrage(false); setLent(false)
    const debut = Date.now(), minuteur = setTimeout(() => setLent(true), 20000)
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
      setRapport({ ...r, duree_secondes: Math.max(r.duree_secondes ?? 0, (Date.now() - debut) / 1000) })
      setRapportPour(JSON.stringify(ov))
      marquer('idee'); noterActionUtile('reforme')
    } catch (e: any) { setErr(e.message) } finally { clearTimeout(minuteur); setLoading(false); setPhase(0); setLent(false) }
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
    if (estAgeLegal(r.id)) { if (!(AGE_TERME in draft.overrides) && regles[AGE_TERME]) setVal(AGE_TERME, regles[AGE_TERME].valeur); setOuvert(AGE_TERME) }
    else { if (!(r.id in draft.overrides)) setVal(r.id, r.valeur); setOuvert(r.id) }
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
    setPresets(false); setOuvert(null) // une idée arrive réglée : ses changements restent repliés
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
        <div className="stack atelier-reforme">
          {/* une seule carte : le point de départ, les changements (une ligne chacun, dépliée pour la régler), le foyer */}
          <div className="card">
            <div className="card-head" style={{ marginBottom: 4 }}><h3 style={{ margin: 0 }}>Ce que vous changez</h3>
              {nbChangements > 0 && <span className="badge primary">{nbChangements} changement{nbChangements > 1 ? 's' : ''}</span>}</div>
            <div className="small muted" style={{ marginBottom: 12 }}>
              À partir de {base && !base.societe.reference ? <>« {base.societe.nom} » (<Link to={`/societes/${base.societe.id}`}>voir</Link>)</>
                : <>la France d'aujourd'hui (la <Terme id="societe_1_0">loi actuelle</Terme>)</>}</div>
            {base && !base.societe.reference && !proprietaire && (
              <div className="notice small" style={{ margin: '0 0 10px' }}><GitPullRequest size={16} style={{ flexShrink: 0 }} /><div>
                {draft.suggestion ? <>Vous préparez une <strong>suggestion</strong> pour « {base.societe.nom} » : changez ses règles, voyez les effets, puis envoyez-la.
                  Son auteur l'acceptera ou non, comme un amendement.</>
                  : <>Changez ses règles, puis suggérez vos changements à son auteur, ou faites-en votre propre proposition.</>}
              </div></div>
            )}
            {aRetablir.length > 0 && (
              <div className="notice small" style={{ margin: '0 0 8px' }}><div>Changement supprimé.{' '}
                <button className="lien" onClick={retablir}>Rétablir</button></div></div>
            )}
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
                <Changement key={AGE_TERME} id={AGE_TERME} titre="Âge légal de départ à la retraite" avant={`${valeur(avant, r.unite, r.type)} (à terme)`}
                  apres={v !== avant ? valeur(v, r.unite, r.type) : null}
                  badge={v !== avant && <span className="badge primary">{ecartLisible(avant, v, r.unite)}</span>}
                  ouvert={ouvert === AGE_TERME || v === avant} repliable={v !== avant} onBasculer={() => setOuvert(ouvert === AGE_TERME ? null : AGE_TERME)}>
                  <div className="small muted">
                    {v < avant ? `Personne ne partira plus tard que ${valeur(v, r.unite, r.type)}, quelle que soit sa date de naissance.`
                      : v > avant ? `Pour les personnes nées à partir de 1969 ; les générations précédentes gardent leur âge actuel.`
                        : `L'âge choisi vaudra pour toutes les générations : personne ne partira plus tard.`}
                  </div>
                  <div style={{ marginTop: 10 }}><ValueEditor rule={r} value={v} onChange={(x) => { setAges(Number(x)); setOuvert(AGE_TERME) }} /></div>
                  {detail.length > 0 && (
                    <details className="curieux small" style={{ marginTop: 6 }}>
                      <summary>Le détail par génération ({detail.length})</summary>
                      <ul className="list small">{detail.map((id) => (
                        <li key={id} className="list-row"><span>{nomGeneration(regles[id].titre)}</span>
                          <span>{valeur(regles[id].valeur, 'ans')} → <strong>{valeur(draft.overrides[id], 'ans')}</strong></span></li>
                      ))}</ul>
                    </details>
                  )}
                  <PiedChangement lien={`/regles/r/${AGE_TERME}`} modifie={v !== avant} onRetirer={() => supprimer(retirerAges)} onFermer={v !== avant ? () => setOuvert(null) : undefined}
                    justification={draft.justifications[AGE_TERME] ?? ''} onJustifier={(t) => setDraft((d) => ({ ...d, justifications: { ...d.justifications, [AGE_TERME]: t } }))} />
                </Changement>
              )
            })()}
            {ids.filter((id) => !estMission(id) && !estAgeLegal(id)).map((id) => {
              const r = regles[id]
              if (!r) return <div key={id} className="small muted">Chargement…</div>
              const v = draft.overrides[id]
              const modifie = !same(v, r.valeur)
              const pct = typeof v === 'number' && typeof r.valeur === 'number' && r.valeur !== 0 ? (v / r.valeur - 1) * 100 : null
              // un montant annuel (« par an ») se lit mieux par mois
              const annuel = r.unite === 'euros' && /\(par an\)/i.test(r.titre) && typeof v === 'number' && typeof r.valeur === 'number'
              const montant = (x: Valeur) => annuel ? `${euros(Number(x) / 12, 0)} par mois` : valeur(x, r.unite, r.type)
              return (
                <Changement key={id} id={id} titre={annuel ? r.titre.replace(/\s*\(par an\)/i, '') : r.titre} avant={montant(r.valeur)} apres={modifie ? montant(v) : null}
                  badge={modifie && typeof v === 'number' && typeof r.valeur === 'number' && (pct === null || Math.abs(pct) >= 0.05) && v !== r.valeur
                    && <span className="badge primary">{ecartLisible(r.valeur, v, r.unite)}</span>}
                  ouvert={ouvert === id || !modifie} repliable={modifie} onBasculer={() => setOuvert(ouvert === id ? null : id)}>
                  {id === 'travail.smic.horaire_brut' && typeof v === 'number' && (
                    <div className="small muted">Soit environ {euros(v * 151.67, 0)} brut, environ {euros(v * 151.67 * 0.79, 0)} net par mois à temps plein.</div>
                  )}
                  {annuel && <div className="small muted">Montant annuel : {valeur(v, r.unite, r.type)} par an, soit {euros(Number(v) / 12, 0)} par mois.</div>}
                  {/* un pourcentage de la BMAF ne parle à personne : son équivalent en euros par mois */}
                  {/% de la BMAF/.test(r.titre) && typeof v === 'number' && typeof r.valeur === 'number' && regles['prestations.famille.bmaf'] && (() => {
                    const bmaf = Number(regles['prestations.famille.bmaf'].valeur)
                    return <div className="small muted">Soit {euros(bmaf * r.valeur / 100, 0)}{modifie ? <> → <strong>{euros(bmaf * v / 100, 0)}</strong></> : null} par mois (avant la baisse prévue pour les revenus élevés).</div>
                  })()}
                  {/* sinon on change la règle… et rien ne bouge dans les résultats, sans savoir pourquoi */}
                  {!r.simulable && <div className="notice small" style={{ margin: '4px 0' }}><div>Le site ne sait pas encore calculer
                    l'effet de cette règle : les résultats montreront ce qu'en disent les études, sans chiffrage.</div></div>}
                  <div style={{ marginTop: 6 }}><ValueEditor rule={r} value={v} onChange={(x) => { setVal(id, x); setOuvert(id) }} /></div>
                  <PiedChangement lien={`/regles/r/${id}`} modifie={modifie} onRetirer={() => supprimer(() => retirer(id))} onFermer={modifie ? () => setOuvert(null) : undefined}
                    justification={draft.justifications[id] ?? ''} onJustifier={(t) => setDraft((d) => ({ ...d, justifications: { ...d.justifications, [id]: t } }))} />
                </Changement>
              )
            })}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={() => setPicker('')}><Plus size={16} /> Changer une règle</button>
              <button className="btn ghost" onClick={() => setPresets(true)}><Lightbulb size={16} /> Des idées</button>
              <button className="btn ghost" onClick={() => setBudgetEd(true)}><Landmark size={16} /> Le budget de l'État</button>
            </div>
            {ids.length > 0 && <>
              <hr className="divider" />
              {/* le bouton principal reste visible quand la liste des changements dépasse l'écran */}
              {/* pendant le calcul, le bouton flottant cachait le choix du foyer type : il reprend sa place. Et le choix du foyer
                  vient après le bouton : juste au-dessus, le bouton flottant couvrait « modifier » (test Josiane, téléphone) */}
              <div className={ouvert || loading ? '' : 'cta-collant'}>
                <button className="btn primary large" style={{ width: '100%' }} disabled={!changes.length || loading} onClick={() => simuler()}>
                  <Calculator size={18} /> {loading ? 'Calcul en cours…' : rapportPour && !aJour ? 'Recalculer les effets' : 'Voir les effets'}
                </button>
              </div>
              {!changes.length && <div className="small muted" style={{ marginTop: 6, textAlign: 'center' }}>Réglez au moins une valeur pour voir ses effets.</div>}
              <label className="row" style={{ cursor: situation ? 'pointer' : 'default', flexWrap: 'nowrap', alignItems: 'flex-start', marginTop: 12 }}>
                <input type="checkbox" checked={avecFoyer && !!situation} disabled={!situation} onChange={(e) => setAvecFoyer(e.target.checked)} style={{ marginTop: 3 }} />
                <span className="small"><User size={14} /> Calculer aussi l'effet sur mon foyer{situation && avecFoyer && <span className="muted"> ({resumeSituation(situation)} · <Link to="/mes-droits?retour=atelier&modifier=1">modifier</Link>)</span>}</span>
              </label>
              {!situation && (
                <div className="small muted" style={{ marginTop: 6 }}>Décrivez votre situation dans <Link to="/mes-droits?retour=atelier">Mes droits</Link>, ou choisissez un foyer qui vous ressemble :
                  <div className="pill-list" style={{ marginTop: 6 }}>{PROFILS.map((p) => <button key={p.titre} className="btn small" onClick={() => { setSituation(p.s); setAvecFoyer(true) }}>{p.titre}</button>)}</div>
                </div>
              )}
            </>}
          </div>
        </div>

        <div ref={resultats} style={{ scrollMarginTop: 80 }}>
          {err && <ErrorBox message={err} />}
          {loading && <Progression phase={phase} demarrage={demarrage} lent={lent} />}
          {rapport && !loading && !aJour && rapportPour !== null && (
            <div className="notice warn perime" style={{ marginBottom: 12 }}><div>Vous avez modifié votre réforme depuis le dernier calcul : les résultats ci-dessous ne sont plus à jour.{' '}
              <button className="btn small" onClick={() => simuler()}>Recalculer les effets</button></div></div>
          )}
          {aJour && !loading && desequilibres.length === 0 && aSurveiller.length > 0 && (
            <div className="notice warn" style={{ marginBottom: 12 }}><div>
              <strong>À surveiller :</strong> {aSurveiller.map((e) => e.id === 'budget' ? `cette réforme coûterait environ ${milliards(Math.abs(e.effet))} par an` : `elle augmenterait les émissions d'environ ${tonnes(Math.abs(e.effet))} par an`).join(', et ')}.
              {' '}L'estimation est trop incertaine pour être exigée : vous pouvez enregistrer, mais il est conseillé de {aSurveiller[0].id === 'budget' ? 'la financer' : 'compenser'}. <a href="#equilibres">Voir les solutions ↓</a></div></div>
          )}
          {aJour && !loading && changes.length > 0 && desequilibres.length === 0 && aSurveiller.length === 0 && (
            <div className="notice ok" style={{ marginBottom: 12 }}><CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              {/* « équilibrée » se lisait « juste, raisonnable » (test Nadia) : dire seulement que les comptes tiennent */}
              <div className="grow"><strong>Les comptes tiennent :</strong> pas de dépense sans financement, ni d'émissions en trop. Ses effets sont détaillés ci-dessous.</div>
            </div>
          )}
          {aJour && !loading && desequilibres.length > 0 && (
            <div className="notice warn" style={{ marginBottom: 12 }}><div><strong>Encore une étape :</strong>{' '}
              {desequilibres.map((e) => e.id === 'budget' ? `il manque ${milliards(e.manque)} par an pour financer votre réforme` : `votre réforme ajouterait ${tonnes(e.manque)} d'émissions par an, à compenser pour tenir l'objectif climat de la France`).join(', et ')}.
              {/* une baisse d'impôt qui « pollue » surprend : dire d'où viennent ces émissions */}
              {desequilibres.some((e) => e.id === 'carbone') && rapport?.bilan?.some((p) => p.indicateurs.some((i) => i.id === 'equilibre_carbone_revenus'))
                && " Elles viennent du pouvoir d'achat : plus de revenus, plus de consommation."}
              {' '}<a href="#equilibres">Choisir une solution ↓</a></div></div>
          )}
          {/* pendant un nouveau calcul, l'ancien résultat reste visible, grisé (sinon un écran presque vide pendant 10 s à 1 min) */}
          {rapport && (
            <div className={loading && !rapport.partiel ? 'ancien-resultat' : undefined} aria-busy={loading && !rapport.partiel}>
              {loading && !rapport.partiel && <div className="small muted" style={{ marginBottom: 8 }}>Résultat précédent, en attendant le nouveau calcul :</div>}
              <ReportView r={rapport} overrides={draft.overrides} onAppliquer={appliquerCompensation} />
            </div>
          )}
          {/* enregistrer vient après les résultats : en tête, le bouton « Se connecter pour enregistrer » passait avant ce que
              la réforme change (test Nadia) */}
          {aJour && !loading && changes.length > 0 && desequilibres.length === 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <h3 style={{ marginTop: 0 }}>Partager, si vous le voulez</h3>
              <p className="small ink2" style={{ marginTop: 0 }}>Enregistrée, votre proposition reçoit une adresse à partager ; chacun peut la consulter et en faire sa propre version.</p>
              {!user ? <Link className="btn small" to="/connexion?retour=/atelier">Se connecter pour enregistrer</Link>
                : proprietaire ? <div className="row"><button className="btn primary small" onClick={() => setSaving(true)}><GitBranch size={15} /> Mettre à jour « {base!.societe.nom} »</button>
                  <button className="btn small" onClick={() => setSaving(true)}><GitFork size={15} /> Nouvelle proposition</button></div>
                : base && !base.societe.reference ? <div className="row">
                    <button className={`btn small ${draft.suggestion ? 'primary' : ''}`} onClick={() => setSaving('suggestion')}><GitPullRequest size={15} /> Suggérer ces changements à « {base.societe.nom} »</button>
                    <button className={`btn small ${draft.suggestion ? '' : 'primary'}`} onClick={() => setSaving('propre')}><GitFork size={15} /> En faire ma propre proposition</button></div>
                : <button className="btn primary small" onClick={() => setSaving(true)}><GitFork size={15} /> Enregistrer ma proposition</button>}
            </div>
          )}
          {aJour && !loading && <div style={{ marginTop: 16 }}><ProchaineEtape apres="idee" /></div>}
          {aJour && !loading && <ProposerSoutien />}
          {/* en attendant le calcul : ce qu'il montrera (un seul bouton « Voir les effets », dans la carte de la réforme) */}
          {!loading && !rapport && changes.length > 0 && (
            <div className="card soft bureau-seul" style={{ padding: 24 }}>
              <h3 style={{ marginTop: 0 }}>Ce que le calcul vous montrera</h3>
              <ul className="small ink2" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                <li>ce que votre réforme change pour {avecFoyer && situation ? 'votre foyer et ' : ''}des foyers types, en euros par mois ;</li>
                <li>ce qu'elle coûte ou rapporte à l'État, et qui y gagne ou y perd ;</li>
                <li>ses effets probables sur l'emploi, le climat et le bien-être, avec leur degré de certitude ;</li>
                <li>s'il faut la financer ou la compenser, avec des solutions en un clic.</li>
              </ul>
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

      {picker !== false && <RulePicker onPick={ajouter} onClose={() => setPicker(false)} exclude={ids} domaine={picker}
        idees={PRESETS} onIdee={(pid) => { appliquerPreset(pid); setPicker(false) }} />}
      {budgetEd && rdata && <BudgetEditor regles={rdata.regles} overrides={draft.overrides} onClose={() => setBudgetEd(false)}
        onRegle={(id) => { setBudgetEd(false); if (regles[id]) ajouter(regles[id]) }}
        onApply={(o) => { setDraft((d) => { const ov = { ...d.overrides }; for (const k of Object.keys(ov)) if (estMission(k)) delete ov[k]; return { ...d, overrides: { ...ov, ...o } } }); setBudgetEd(false) }} />}
      {presets && (
        <Modal title="Des idées de réformes" onClose={() => setPresets(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>Cliquez sur une idée : elle s'ajoute à votre réforme, et vous pourrez ensuite ajuster chaque valeur.</p>
          <div className="grid cols-2">{PRESETS.map((p) => <button key={p.id} className="preset" onClick={() => appliquerPreset(p.id)}><strong>{p.titre}</strong><span className="small muted">{p.description}</span></button>)}</div>
        </Modal>
      )}
      {saving && <SaveModal proprietaire={proprietaire} base={base} changements={aCommitter()} nomDefaut={draft.nomSociete}
        suggestion={saving === 'suggestion' || (!!draft.suggestion && saving !== 'propre')}
        onClose={() => setSaving(false)} onDone={(sid, suggestion) => {
          setSaving(false)
          if (suggestion) { setDraft((d) => ({ ...d, suggestion: false })); nav(`/societes/${sid}?suggestion=envoyee`) }
          else { setDraft((d) => ({ ...d, societe: sid, suggestion: false })); nav(`/societes/${sid}`) }
        }} />}
    </div>
  )
}

// Un changement de la réforme : une ligne « avant → après » ; on la déplie pour la régler. Une règle encore à régler
// reste dépliée (elle n'est pas « repliable »).
function Changement({ id, titre, avant, apres, badge, ouvert, repliable, onBasculer, children }: {
  id: string; titre: string; avant: string; apres: string | null; badge?: ReactNode; ouvert: boolean; repliable: boolean
  onBasculer: () => void; children: ReactNode
}) {
  const resume = (
    <>
      <span className="grow">
        <strong className="change-titre">{titre}</strong>
        <span className="small muted change-valeurs">{apres !== null ? <>{avant} <ArrowRight size={12} /> <strong className="ink">{apres}</strong></> : <>Aujourd'hui : {avant} · à régler ci-dessous</>}</span>
      </span>
      {badge}
      {repliable && <ChevronDown size={18} className={`change-chevron ${ouvert ? 'ouvert' : ''}`} aria-hidden="true" />}
    </>
  )
  return (
    <div className={`change-chip ${ouvert ? 'ouvert' : ''}`} data-changement={id}>
      {repliable ? <button type="button" className="change-tete" aria-expanded={ouvert} onClick={onBasculer}>{resume}</button>
        : <div className="change-tete">{resume}</div>}
      {ouvert && <div className="change-corps">{children}</div>}
    </div>
  )
}

function PiedChangement({ lien, modifie, onRetirer, onFermer, justification, onJustifier }: {
  lien: string; modifie: boolean; onRetirer: () => void; onFermer?: () => void; justification: string; onJustifier: (t: string) => void
}) {
  const [expliquer, setExpliquer] = useState(!!justification)
  return (
    <>
      {modifie && expliquer && (
        <input type="text" autoFocus={!justification} placeholder="Pourquoi ce changement ? (facultatif)" style={{ marginTop: 10, fontSize: '.88rem' }}
          value={justification} onChange={(e) => onJustifier(e.target.value)} />
      )}
      <div className="row" style={{ marginTop: 8, gap: 2 }}>
        {modifie && !expliquer && <button className="btn ghost small" onClick={() => setExpliquer(true)}><MessageSquare size={14} /> Expliquer mon choix</button>}
        <Link className="btn ghost small" to={lien}><BookOpen size={14} /> La règle en détail</Link>
        <button className="btn ghost small" onClick={onRetirer}><Trash2 size={14} /> Supprimer ce changement</button>
        {onFermer && <button className="btn small" style={{ marginLeft: 'auto' }} onClick={onFermer}><Check size={14} /> Fermer</button>}
      </div>
    </>
  )
}

function Etapes({ etape }: { etape: number }) {
  const noms = ['Choisir ce qui change', 'Régler', 'Voir les effets', 'Équilibrer', 'Partager, si vous le voulez']
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

function Progression({ phase, demarrage, lent }: { phase: number; demarrage: boolean; lent: boolean }) {
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
        ? <div className="notice warn small" style={{ marginTop: 10, marginBottom: 0 }}><div>Le site vient d'être mis à jour et prépare ses calculs : ce premier calcul peut prendre deux à trois minutes. Restez sur cette page ; les suivants seront bien plus rapides.</div></div>
        : lent
          ? <div className="notice small" style={{ marginTop: 10, marginBottom: 0 }}><div>C'est plus long que d'habitude : le site vient sans doute d'être mis à jour et se prépare. Cela peut prendre deux à trois minutes ; restez sur cette page, le résultat s'affichera tout seul.</div></div>
          : <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>Comptez de 10 secondes à une minute : toutes les règles d'impôts et d'aides sont appliquées, une à une, à des milliers de foyers.</p>}
    </div>
  )
}

function SaveModal({ proprietaire, base, changements, nomDefaut, suggestion = false, onClose, onDone }: {
  proprietaire: boolean; base: { societe: SocieteDetail } | null; changements: any[]; nomDefaut?: string; suggestion?: boolean
  onClose: () => void; onDone: (sid: string, suggestion?: boolean) => void
}) {
  // suggérer à la proposition de quelqu'un d'autre : une copie à soi, puis une suggestion que son auteur acceptera ou non
  const peutSuggerer = !!base && !base.societe.reference && !proprietaire
  const [mode, setMode] = useState<'commit' | 'fork' | 'suggestion'>(proprietaire ? 'commit' : peutSuggerer && suggestion ? 'suggestion' : 'fork')
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
      } else if (mode === 'suggestion' && base) {
        const copie = await api<{ id: string }>('/api/societes', { body: { source: base.societe.id, branche: base.societe.branche,
          nom: `Suggestion pour « ${base.societe.nom} »`.slice(0, 120), description, changements, message } })
        await api('/api/propositions', { body: { source: copie.id, source_branche: 'principale', cible: base.societe.id,
          cible_branche: base.societe.branche, titre: message, description } })
        onDone(base.societe.id, true)
      } else {
        const source = base?.societe.id ?? 'france'
        const s = await api<{ id: string }>('/api/societes', { body: { source, branche: base?.societe.branche ?? 'principale', nom, description, changements, message } })
        onDone(s.id)
      }
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Modal title={mode === 'suggestion' ? 'Suggérer vos changements' : 'Enregistrer votre proposition'} onClose={onClose}>
      {peutSuggerer && (
        <div className="choices" style={{ marginBottom: 14 }}>
          <button className={`choice ${mode === 'suggestion' ? 'on' : ''}`} aria-pressed={mode === 'suggestion'} onClick={() => setMode('suggestion')}>Suggérer à « {base!.societe.nom} »</button>
          <button className={`choice ${mode === 'fork' ? 'on' : ''}`} aria-pressed={mode === 'fork'} onClick={() => setMode('fork')}>Ma propre proposition</button>
        </div>
      )}
      {mode === 'suggestion' && <p className="small ink2" style={{ marginTop: 0 }}>Votre suggestion sera envoyée à l'auteur de « {base!.societe.nom} ». Il pourra en discuter
        avec vous, puis l'accepter ou non ; s'il l'accepte, vos changements entrent dans sa proposition.</p>}
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
      {mode === 'suggestion' && <label className="field"><span>Pourquoi ce changement ? (facultatif)</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ce que vous voulez améliorer, et pour qui." /></label>}
      <label className="field"><span>{mode === 'suggestion' ? 'En une phrase, ce que vous suggérez' : 'En une phrase, ce que vous avez changé'}</span><input type="text" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ex. : RSA à 800 €, financé par une tranche d'impôt à 50 %" />
        <span className="hint">Cette phrase apparaîtra dans l'historique de votre proposition.</span></label>
      <div className="small muted" style={{ marginBottom: 12 }}>{(() => { const m = changements.filter((c) => String(c.regle).startsWith('budget.etat.mission.')).length; const n = changements.length - m + (m ? 1 : 0); return <>{n} changement{n > 1 ? 's' : ''} {n > 1 ? 'seront enregistrés' : 'sera enregistré'}{m ? ` (dont le budget de l'État : ${m} domaine${m > 1 ? 's' : ''} ajusté${m > 1 ? 's' : ''})` : ''}.</> })()} Votre proposition sera visible par tous : chacun pourra s'en inspirer, créer sa propre version et vous suggérer des améliorations.</div>
      {changements.length === 0 && <Notice kind="warn">Rien n'a changé par rapport à votre point de départ.</Notice>}
      {err && <ErrorBox message={err} />}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={busy || changements.length === 0 || (mode === 'fork' && !nom.trim()) || (mode === 'suggestion' && !message.trim())} onClick={go}>{busy ? 'Envoi…' : mode === 'suggestion' ? 'Envoyer ma suggestion' : 'Enregistrer'} <ArrowRight size={15} /></button>
      </div>
    </Modal>
  )
}
