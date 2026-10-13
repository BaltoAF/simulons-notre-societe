import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Calculator, GitFork, Lock, Minus, Plus, RotateCcw } from 'lucide-react'
import { api, type Confiance, type Regle } from '../lib/api'
import { euros } from '../lib/format'
import { PRESETS, resoudrePreset } from '../lib/presets'
import { situationVersMenage, useApp, useFetch, type AdulteSaisie, type SituationSaisie } from '../lib/state'
import { ConfidenceBadge, ErrorBox, Loading, Notice } from '../components/ui'
import { DroitsNonMonetaires } from '../components/DroitsNonMonetaires'
import { Terme } from '../components/Terme'
import { PROFILS } from '../lib/profils'

type Resultat = {
  revenu_disponible: number
  niveau_de_vie: number
  lignes: { id: string; libelle: string; montant: number; nature: string }[]
  confiance: Confiance
}

const ADULTE: AdulteSaisie = { age: 35, activite: 'salarie', montant_net: 1600, cadre: false, handicap: false }
const DEFAUT: SituationSaisie = { couple: 'seul', adultes: [ADULTE], enfants: [], logement: 'locataire_prive', loyer_mensuel: 600, zone: 2, revenus_capital_annuels: 0 }

// Règles qui « expliquent » chaque ligne du résultat.
const POURQUOI: Record<string, { regles: string[]; texte: string }> = {
  rsa: { regles: ['prestations.rsa.montant_forfaitaire'], texte: 'Le RSA complète vos ressources jusqu\'à un montant garanti qui dépend de la composition du foyer.' },
  prime_activite: { regles: ['prestations.prime_activite.montant_forfaitaire', 'prestations.prime_activite.part_revenus_activite', 'prestations.prime_activite.bonification_max'], texte: 'La prime d\'activité soutient les revenus des travailleurs modestes.' },
  aides_logement: { regles: ['prestations.aides_logement.forfait_charges'], texte: 'L\'aide au logement dépend du loyer, de la zone, de la composition du foyer et des ressources.' },
  allocations_familiales: { regles: ['prestations.famille.bmaf', 'prestations.famille.af_taux_deux_enfants', 'prestations.famille.af_nombre_enfants_minimum'], texte: 'Versées à partir de 2 enfants, modulées selon les revenus.' },
  impot_revenu: { regles: ['fiscalite.impot_revenu.bareme', 'fiscalite.impot_revenu.decote.taux', 'fiscalite.impot_revenu.quotient_familial.plafond_demi_part'], texte: 'Impôt progressif calculé sur le revenu du foyer, divisé par le nombre de parts.' },
  aspa: { regles: ['prestations.aspa.montant_personne_seule'], texte: 'Le minimum vieillesse garantit un revenu minimal aux personnes âgées.' },
  aah: { regles: ['prestations.aah.montant'], texte: 'Allocation pour les personnes en situation de handicap aux ressources modestes.' },
  salaire_net: { regles: ['fiscalite.csg.salaires_taux', 'travail.smic.horaire_brut'], texte: 'Salaire brut moins les cotisations sociales, la CSG et la CRDS.' },
  retraite_nette: { regles: ['fiscalite.csg.retraites_taux_plein'], texte: 'Pension brute moins la CSG, la CRDS et la Casa.' },
  pfu: { regles: ['fiscalite.capital.pfu_taux_ir'], texte: 'Impôt forfaitaire de 12,8 % sur les intérêts et dividendes.' },
}

function Stepper({ step }: { step: number }) {
  const etapes = ['Votre foyer', 'Vos revenus', 'Votre logement']
  return (
    <ol className="etapes" aria-label="Les étapes">
      {etapes.map((e, i) => (
        <li key={e} className={i < step ? 'fait' : i === step ? 'actif' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="n">{i < step ? '✓' : i + 1}</span>{e}
        </li>
      ))}
    </ol>
  )
}

export default function MesDroits() {
  const { situation, setSituation, setDraft } = useApp()
  const [s, setS] = useState<SituationSaisie>(situation ?? DEFAUT)
  const [step, setStep] = useState(situation ? 3 : 0)
  const [res, setRes] = useState<Resultat | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [etSi, setEtSi] = useState<Record<string, { delta: number; loading?: boolean }>>({})
  const { data: regles } = useFetch<{ regles: Regle[] }>('/api/regles?simulable=true&limit=2000')
  const nav = useNavigate()

  const up = (patch: Partial<SituationSaisie>) => setS((x) => ({ ...x, ...patch }))
  const upA = (i: number, patch: Partial<AdulteSaisie>) => setS((x) => ({ ...x, adultes: x.adultes.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))

  const calculer = async (sit = s) => {
    setLoading(true); setErr(null); setEtSi({})
    try {
      setSituation(sit)
      const r = await api<Resultat>('/api/simulation/menage', { body: { menage: situationVersMenage(sit), montants: 'net' } })
      setRes(r); setStep(3)
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  // De retour sur la page avec une situation déjà saisie : on affiche directement le résultat
  useEffect(() => {
    if (situation && !res && !loading) calculer(situation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tester = async (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!
    const actuelles = Object.fromEntries((regles?.regles ?? []).map((r) => [r.id, r.valeur]))
    setEtSi((x) => ({ ...x, [pid]: { delta: 0, loading: true } }))
    try {
      const rap = await api<any>('/api/simulation/reforme', { body: { overrides: resoudrePreset(p, actuelles), menage: situationVersMenage(s), montants: 'net', modules: ['menage'] } })
      const m = rap.sections.find((x: any) => x.id === 'menage')
      setEtSi((x) => ({ ...x, [pid]: { delta: m?.indicateurs?.[0]?.valeur ?? 0 } }))
    } catch {
      setEtSi((x) => ({ ...x, [pid]: { delta: NaN } }))
    }
  }

  const ouvrirAtelier = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!
    const actuelles = Object.fromEntries((regles?.regles ?? []).map((r) => [r.id, r.valeur]))
    setDraft({ overrides: resoudrePreset(p, actuelles), justifications: {}, societe: null, branche: 'principale', nomSociete: p.titre })
    nav('/atelier?lancer=1')
  }

  if (step === 3 && (res || loading || err)) {
    const revenus = res?.lignes.filter((l) => l.nature === 'revenu') ?? []
    const prest = res?.lignes.filter((l) => l.nature === 'prestation') ?? []
    const prel = res?.lignes.filter((l) => l.nature === 'prelevement') ?? []
    return (
      <div className="container page">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>Vos droits aujourd'hui</h1>
          <button className="btn" onClick={() => { setStep(0); setRes(null) }}><RotateCcw size={16} /> Modifier ma situation</button>
        </div>
        {loading && <Loading label="Le moteur calcule vos droits…" />}
        {err && <ErrorBox message={err} />}
        {res && (
          <div className="split aside-380">
            <div className="stack">
              <div className="card">
                <div className="card-head">
                  <div>
                    <div className="kpi-label"><Terme id="revenu_disponible">Ce qui reste au foyer chaque mois</Terme></div>
                    <div className="kpi big">{euros(res.revenu_disponible)} <span className="muted" style={{ fontSize: '1rem', fontWeight: 600 }}>/ mois</span></div>
                    <div className="small muted">Revenus + aides − impôts. Soit un <Terme id="niveau_vie">niveau de vie</Terme> de {euros(res.niveau_de_vie)} par mois et par personne (en tenant compte de la taille du foyer).</div>
                  </div>
                  <ConfidenceBadge c={res.confiance} align="right" />
                </div>
                <hr className="divider" />
                {[['Vos revenus nets', revenus, 1], ['Aides et prestations', prest, 1], ['Impôts payés', prel, -1]].map(([titre, lignes, sg]) => (
                  (lignes as any[]).length > 0 && (
                    <div key={titre as string} style={{ marginBottom: 14 }}>
                      <div className="kpi-label" style={{ marginBottom: 6 }}>{titre as string}</div>
                      <ul className="list">
                        {(lignes as Resultat['lignes']).map((l) => (
                          <li key={l.id}>
                            <div className="list-row">
                              <span>{l.libelle}</span>
                              <strong className={`delta ${(sg as number) > 0 ? (l.nature === 'prestation' ? 'pos' : '') : 'neg'}`}>{(sg as number) > 0 ? '' : '−'}{euros(l.montant)}</strong>
                            </div>
                            {POURQUOI[l.id] && (
                              <details className="explain" style={{ marginTop: 6, paddingTop: 6 }}>
                                <summary>Pourquoi ce montant ?</summary>
                                <p className="small ink2" style={{ marginBottom: 6 }}>{POURQUOI[l.id].texte}</p>
                                <div className="small">Règles en jeu : {POURQUOI[l.id].regles.map((r, i) => <span key={r}>{i ? ' · ' : ''}<Link to={`/regles/r/${r}`}>{regles?.regles.find((x) => x.id === r)?.titre ?? r}</Link></span>)}</div>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
                <Notice>Ce sont vos <strong>droits théoriques</strong> selon la législation en vigueur, calculés par le moteur public OpenFisca-France. Pour une démarche officielle, utilisez les simulateurs de l'administration (mesdroitssociaux.gouv.fr, impots.gouv.fr).</Notice>
              </div>
              <DroitsNonMonetaires age={s.adultes[0]?.age ?? 35} />
            </div>
            <div className="stack sticky">
              <div className="card">
                <h3>Et si les règles changeaient ?</h3>
                <p className="small muted">Testez des propositions du débat public sur <strong>votre</strong> foyer.</p>
                <ul className="list">
                  {PRESETS.map((p) => {
                    const r = etSi[p.id]
                    return (
                      <li key={p.id}>
                        <div className="small" style={{ fontWeight: 650 }}>{p.titre}</div>
                        <div className="row between" style={{ marginTop: 4 }}>
                          {r ? (r.loading ? <span className="small muted"><span className="spinner" style={{ width: 14, height: 14, verticalAlign: -2 }} /> calcul…</span>
                            : Number.isNaN(r.delta) ? <span className="small muted">indisponible</span>
                              : <span className={`delta ${r.delta > 0.5 ? 'pos' : r.delta < -0.5 ? 'neg' : 'zero'}`}>{r.delta > 0.5 ? '+' : r.delta < -0.5 ? '−' : '±'}{euros(Math.abs(r.delta))} / mois</span>)
                            : <button className="btn small" onClick={() => tester(p.id)}>Tester sur mon foyer</button>}
                          {r && !r.loading && <button className="btn small ghost" onClick={() => ouvrirAtelier(p.id)}>Effets sur le pays <ArrowRight size={13} /></button>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <Link to="/atelier" className="btn primary" style={{ width: '100%', marginTop: 8 }}><GitFork size={16} /> Imaginer ma propre réforme</Link>
              </div>
              <div className="small muted"><Lock size={13} /> Votre situation reste dans votre navigateur. Elle sert uniquement au calcul et n'est jamais enregistrée par Société 2.0.</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const enCouple = s.adultes.length > 1
  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      <h1>Calculer mes droits</h1>
      <p className="lead ink2">Trois questions pour connaître vos aides, votre impôt et votre revenu disponible selon les règles actuelles. Sans compte, sans enregistrement.</p>
      <Stepper step={step} />
      {step === 0 && (
        <div className="card soft" style={{ marginBottom: 14, padding: 14 }}>
          <div className="small" style={{ fontWeight: 650, marginBottom: 6 }}>Pressé ? Partez d'un foyer qui vous ressemble :</div>
          <div className="pill-list">{PROFILS.map((p) => <button key={p.titre} className="badge" style={{ cursor: 'pointer' }} onClick={() => { setS(p.s); calculer(p.s) }}>{p.titre}</button>)}</div>
        </div>
      )}
      <div className="card">
        {step === 0 && (
          <div>
            <label className="field"><span>Vous vivez…</span></label>
            <div className="choices" style={{ marginBottom: 16 }}>
              <button className={`choice ${!enCouple ? 'on' : ''}`} onClick={() => up({ couple: 'seul', adultes: [s.adultes[0]] })}>Seul(e)</button>
              <button className={`choice ${enCouple ? 'on' : ''}`} onClick={() => up({ couple: s.couple === 'seul' ? 'marie' : s.couple, adultes: [s.adultes[0], s.adultes[1] ?? { ...ADULTE, age: 34 }] })}>En couple</button>
            </div>
            {enCouple && (
              <>
                <label className="field"><span>Votre union</span></label>
                <div className="choices" style={{ marginBottom: 16 }}>
                  {([['marie', 'Mariés'], ['pacse', 'Pacsés'], ['concubin', 'Union libre']] as const).map(([v, l]) => (
                    <button key={v} className={`choice ${s.couple === v ? 'on' : ''}`} onClick={() => up({ couple: v })}>{l}</button>
                  ))}
                </div>
              </>
            )}
            <label className="field"><span>Enfants à charge</span></label>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className="btn small" disabled={!s.enfants.length} onClick={() => up({ enfants: s.enfants.slice(0, -1) })} aria-label="Retirer un enfant"><Minus size={15} /></button>
              <strong style={{ minWidth: 30, textAlign: 'center' }}>{s.enfants.length}</strong>
              <button className="btn small" disabled={s.enfants.length >= 8} onClick={() => up({ enfants: [...s.enfants, 5] })} aria-label="Ajouter un enfant"><Plus size={15} /></button>
            </div>
            {s.enfants.length > 0 && (
              <div className="grid cols-4">
                {s.enfants.map((a, i) => (
                  <label key={i} className="field"><span>Âge enfant {i + 1}</span>
                    <input type="number" min={0} max={25} value={a} onChange={(e) => up({ enfants: s.enfants.map((x, j) => (j === i ? Number(e.target.value) : x)) })} /></label>
                ))}
              </div>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            {s.adultes.map((a, i) => (
              <div key={i}>
                {enCouple && <h3>{i === 0 ? 'Vous' : 'Votre conjoint(e)'}</h3>}
                <div className="grid cols-2">
                  <label className="field"><span>Âge</span><input type="number" min={16} max={110} value={a.age} onChange={(e) => upA(i, { age: Number(e.target.value) })} /></label>
                  <label className="field"><span>Situation</span>
                    <select value={a.activite} onChange={(e) => upA(i, { activite: e.target.value as AdulteSaisie['activite'] })}>
                      <option value="salarie">Salarié(e)</option>
                      <option value="chomeur">Au chômage, indemnisé(e)</option>
                      <option value="retraite">Retraité(e)</option>
                      <option value="etudiant">Étudiant(e)</option>
                      <option value="inactif">Sans activité</option>
                    </select></label>
                </div>
                {['salarie', 'chomeur', 'retraite'].includes(a.activite) && (
                  <label className="field">
                    <span>{a.activite === 'salarie' ? 'Salaire net mensuel (avant impôt)' : a.activite === 'chomeur' ? 'Allocation chômage nette mensuelle' : 'Pension de retraite nette mensuelle'}</span>
                    <div className="input-suffix"><input type="number" min={0} step={50} value={a.montant_net} onChange={(e) => upA(i, { montant_net: Number(e.target.value) })} /><span className="suffix">€ / mois</span></div>
                    <span className="hint">Le montant qui figure en bas de votre fiche de paie ou de votre relevé, avant prélèvement à la source.</span>
                  </label>
                )}
                <div className="row" style={{ gap: 18 }}>
                  {a.activite === 'salarie' && <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={a.cadre} onChange={(e) => upA(i, { cadre: e.target.checked })} /> Cadre</label>}
                  <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={a.handicap} onChange={(e) => upA(i, { handicap: e.target.checked })} /> Handicap reconnu (taux ≥ 80 %)</label>
                </div>
              </div>
            ))}
            <label className="field"><span>Revenus de l'épargne (intérêts, dividendes) par an</span>
              <div className="input-suffix"><input type="number" min={0} step={100} value={s.revenus_capital_annuels} onChange={(e) => up({ revenus_capital_annuels: Number(e.target.value) })} /><span className="suffix">€ / an</span></div>
              <span className="hint">Hors livrets réglementés (livret A…), qui ne sont pas imposés.</span></label>
          </div>
        )}
        {step === 2 && (
          <div>
            <label className="field"><span>Votre logement</span></label>
            <div className="choices" style={{ marginBottom: 16 }}>
              {([['locataire_prive', 'Locataire (parc privé)'], ['locataire_social', 'Locataire HLM'], ['proprietaire', 'Propriétaire'], ['heberge', 'Hébergé(e) gratuitement']] as const).map(([v, l]) => (
                <button key={v} className={`choice ${s.logement === v ? 'on' : ''}`} onClick={() => up({ logement: v })}>{l}</button>
              ))}
            </div>
            {s.logement.startsWith('locataire') && (
              <label className="field"><span>Loyer mensuel (hors charges)</span>
                <div className="input-suffix"><input type="number" min={0} step={10} value={s.loyer_mensuel} onChange={(e) => up({ loyer_mensuel: Number(e.target.value) })} /><span className="suffix">€ / mois</span></div></label>
            )}
            <label className="field"><span>Vous habitez…</span></label>
            <div className="choices">
              {([[1, 'Paris et sa proche banlieue'], [2, 'Une grande ville'], [3, 'Une ville moyenne ou la campagne']] as const).map(([v, l]) => (
                <button key={v} className={`choice ${s.zone === v ? 'on' : ''}`} onClick={() => up({ zone: v })}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div className="row between" style={{ marginTop: 22 }}>
          {step > 0 ? <button className="btn" onClick={() => setStep(step - 1)}><ArrowLeft size={16} /> Précédent</button> : <span />}
          {step < 2 ? <button className="btn primary" onClick={() => setStep(step + 1)}>Suivant <ArrowRight size={16} /></button>
            : <button className="btn primary" onClick={() => calculer()} disabled={loading}><Calculator size={16} /> {loading ? 'Calcul…' : 'Calculer mes droits'}</button>}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}><Lock size={13} /> Vos réponses restent dans votre navigateur. Le calcul applique la législation du mois en cours.</p>
    </div>
  )
}
