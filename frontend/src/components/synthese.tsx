// « En bref » et « Les équilibres » : le résultat d'une réforme raconté en phrases simples.
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, Coins, Globe2, Heart, Landmark, Leaf, ShieldAlert, Users, Wallet } from 'lucide-react'
import { api, type Equilibre, type OptionCompensation, type Pilier, type Rapport, type Regle, type Valeur } from '../lib/api'
import { euros, nombre, valeur } from '../lib/format'
import { departsDuFoyer, estAgeLegal } from '../lib/retraite'
import { useApp, useFetch } from '../lib/state'
import { CONFIANCE_FEMININ, equivalentCarbone, milliards, parMenageMois, phrase, tonnes } from '../lib/humain'
import { Pourquoi, Terme } from './Terme'
import { ConfidenceBadge, ErrorBox, Loading } from './ui'

const ICONES = { economie: Landmark, social: Users, ecologie: Leaf, bien_etre: Heart }
// pilier sans indicateur : dire ce qui n'est pas mesuré, sans laisser croire qu'il n'y a « aucun effet »
const AUCUN: Record<string, string> = {
  economie: "Pas d'effet mesuré sur l'argent public ni sur l'activité.",
  social: "L'effet sur les revenus des ménages et les inégalités n'est pas encore chiffré pour ce type de mesure.",
  ecologie: "Pas d'effet mesuré sur les émissions de gaz à effet de serre.",
  bien_etre: "L'effet sur le bien-être n'est pas encore chiffré pour ce type de mesure.",
}
const VERDICT: Record<Pilier['verdict'], { txt: string; cls: string }> = {
  amelioration: { txt: 'Plutôt positif', cls: 'gain' },
  degradation: { txt: 'Plutôt négatif', cls: 'loss' },
  contraste: { txt: 'Du positif et du négatif', cls: 'warn' },
  neutre: { txt: 'Peu de changement', cls: '' },
  non_mesure: { txt: 'Pas encore chiffré', cls: '' },
  incertain: { txt: 'Effet incertain', cls: '' },
}

export type Contexte = 'reforme' | 'societe'

// Expressions difficiles des phrases du résumé, reliées au lexique (soulignées en pointillé, explication au survol)
const TERMES: [RegExp, string][] = [
  [/seuil de pauvreté/i, 'pauvrete'], [/richesse produite/i, 'richesse'], [/inégalités/i, 'gini'], [/niveau de vie/i, 'niveau_vie'],
  [/\b\d+e dixième\b|plus modestes/i, 'decile'],
]

/** Une phrase avec ses mots difficiles cliquables (le premier de chaque sorte seulement, pour ne pas surcharger). */
function avecTermes(texte: string): ReactNode {
  let morceaux: ReactNode[] = [texte]
  for (const [re, id] of TERMES) {
    morceaux = morceaux.flatMap((m): ReactNode[] => {
      if (typeof m !== 'string') return [m]
      const r = m.match(re)
      if (!r || r.index === undefined) return [m]
      return [m.slice(0, r.index), <Terme key={id} id={id}>{r[0]}</Terme>, m.slice(r.index + r[0].length)]
    })
  }
  return <>{morceaux}</>
}

/** La pauvreté (relative) recule alors que presque personne ne gagne : effet de seuil à expliquer, sinon le lecteur croit à une erreur. */
function paradoxePauvrete(p: Pilier): boolean {
  const pauv = p.indicateurs.find((i) => i.id === 'pauvrete')
  const gagnants = p.indicateurs.find((i) => i.id === 'gagnants')
  return !!pauv && !!gagnants && pauv.valeur <= -0.02 && gagnants.valeur < 10 && (gagnants.perdants ?? 0) > 30
}

/** « Plutôt négatif » sur le plan social alors que personne n'y perd : les inégalités se creusent, il faut le dire. */
function gainPourLesPlusAises(p: Pilier): boolean {
  const gini = p.indicateurs.find((i) => i.id === 'gini')
  const gagnants = p.indicateurs.find((i) => i.id === 'gagnants')
  return p.verdict === 'degradation' && !!gini && gini.valeur >= 0.02 && !!gagnants && (gagnants.perdants ?? 0) < 1
}

export function EnBref({ r, contexte = 'reforme', overrides }: { r: Rapport; contexte?: Contexte; overrides?: Record<string, Valeur> }) {
  const pv = r.pour_vous
  const { situation } = useApp()
  // l'âge de départ ne change pas le budget du mois : on dit plutôt quand le foyer pourra partir
  const ages = Object.keys(overrides ?? {}).filter(estAgeLegal)
  const { data: rd } = useFetch<{ regles: Regle[] }>((ages.length || overrides?.['travail.smic.horaire_brut'] !== undefined) && situation && pv ? '/api/regles?limit=5000' : null)
  const departs = useMemo(() => {
    if (!rd || !situation) return []
    const actuelles = Object.fromEntries(rd.regles.map((x) => [x.id, x.valeur]))
    return departsDuFoyer(situation.adultes, situation.mois_naissance ?? 1, actuelles, { ...actuelles, ...overrides }).filter((d) => d.apres !== d.avant)
  }, [rd, situation, overrides])
  // SMIC relevé : la prime d'activité peut baisser à salaire égal, ce qui paraît absurde si on ne dit pas pourquoi.
  // Son bonus individuel atteint son maximum à 138 fois le SMIC horaire de revenus nets (paramètre OpenFisca
  // ppa.pa_m.bonification.seuil_max_bonification, depuis avril 2026) : relever le SMIC relève ce seuil.
  const smicActuel = Number(rd?.regles.find((x) => x.id === 'travail.smic.horaire_brut')?.valeur ?? 0)
  const smicChange = overrides?.['travail.smic.horaire_brut'] !== undefined
  const primeBaisse = smicChange && (pv?.detail ?? []).some((l) => l.id === 'prime_activite' && l.delta_mois < 0)
  const salaireInchange = smicChange && !!situation?.adultes.some((a) => a.activite === 'salarie') && !(pv?.detail ?? []).some((l) => l.id === 'salaire_net')
  // « rien ne change » sans un mot passe pour une panne : on dit pourquoi
  const csgRetraiteNonConcernee = overrides?.['fiscalite.csg.retraites_taux_plein'] !== undefined && !!situation?.adultes.some((a) => a.activite === 'retraite')
  return (
    <div className="card" style={{ borderColor: 'var(--primary)' }}>
      <h2 style={{ fontSize: '1.35rem', marginBottom: 12 }}>{contexte === 'societe' ? 'Ce que change cette proposition' : 'Ce que change votre réforme'}</h2>
      {pv && (
        <div className="row" style={{ marginBottom: 14, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Wallet size={22} color="var(--primary)" style={{ flexShrink: 0, marginTop: 4 }} />
          <div>
            <div className="phrase-xl">
              {Math.abs(pv.delta_mois) < 0.5 ? <>Pour votre porte-monnaie : <span className="muted">rien ne change.</span></>
                : <>Pour votre porte-monnaie : <span className={`delta ${pv.delta_mois > 0 ? 'pos' : 'neg'}`}>{pv.delta_mois > 0 ? '+' : '−'}{euros(Math.abs(pv.delta_mois))} par mois</span>.</>}
            </div>
            {Math.abs(pv.delta_mois) < 0.5 && (
              <div className="small muted" style={{ marginTop: 2 }}>{csgRetraiteNonConcernee
                ? "Le taux plein de CSG ne concerne que les retraités dont le revenu fiscal de référence dépasse un plafond. Avec vos revenus, vous payez un taux réduit, ou pas de CSG du tout, et ce changement ne le touche pas."
                : "Les règles changées ne s'appliquent pas à votre situation, ou leur effet fait moins de 50 centimes par mois."}</div>
            )}
            {Math.abs(pv.delta_mois) >= 0.5 && (pv.detail ?? []).length > 0 && (
              <div className="small ink2" style={{ marginTop: 2 }}>Ce qui bouge : {pv.detail!.map((l) => l.nature === 'prelevement'
                ? `${l.libelle} ${l.delta_mois > 0 ? '+' : '−'}${euros(Math.abs(l.delta_mois))} à payer`
                : `${l.libelle} ${l.delta_mois > 0 ? '+' : '−'}${euros(Math.abs(l.delta_mois))}`).join(' · ')}.</div>
            )}
            {salaireInchange && !primeBaisse && <div className="small muted" style={{ marginTop: 2 }}>Votre salaire est au-dessus du nouveau SMIC : il ne change pas dans ce calcul.</div>}
            {primeBaisse && (
              <div className="small muted" style={{ marginTop: 2 }}>Pourquoi la prime d'activité baisse : elle comprend un bonus pour chaque personne qui travaille, qui atteint son
                maximum à un salaire fixé en proportion du SMIC{smicActuel ? ` (environ ${euros(Math.round(138 * smicActuel / 10) * 10, 0)} net par mois aujourd'hui)` : ''}.
                Si le SMIC monte, ce seuil monte aussi : à salaire égal, le bonus est plus petit.{salaireInchange ? ' Votre salaire, lui, ne change pas dans ce calcul : il est déjà au-dessus du nouveau SMIC.' : ''}</div>
            )}
            {departs.map((d) => (
              <div key={d.qui} className="small" style={{ marginTop: 4 }}><strong>{d.qui === 'Vous' ? 'Votre départ' : 'Le départ de votre conjoint(e)'} à la retraite : à {valeur(d.apres, 'ans')}, en {d.dateApres}</strong>
                <span className="muted"> (au lieu de {valeur(d.avant, 'ans')}, en {d.dateAvant}).</span></div>
            ))}
          </div>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))' }}>
        {r.bilan.map((p) => {
          const I = ICONES[p.pilier]
          const v = VERDICT[p.verdict]
          // la fiabilité du chiffre principal (le premier affiché), pas celle du plus fragile des effets secondaires :
          // sinon « Écologie : très faible » contredisait « Pour la planète : élevée » plus bas
          const conf = p.indicateurs.find((i) => i.confiance)?.confiance ?? null
          return (
            <div key={p.pilier} className="card flat" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 8 }}>
                <strong className="row" style={{ gap: 6, fontSize: '1.05rem' }}><I size={18} /> {p.titre}</strong>
                <span className={`badge ${v.cls}`}>{v.txt}</span>
              </div>
              {p.indicateurs.length === 0 ? <div className="small muted">{AUCUN[p.pilier]}</div> : (
                <div>
                  {p.indicateurs.slice(0, 3).map((i) => (
                    <div key={i.id} className="ligne-phrase small">
                      <span className={`puce-sens ${i.sens}`} />
                      <span>{avecTermes(i.id === 'gagnants' && i.perdants != null ? `${nombre(i.valeur, 0)} % des ménages y gagnent, ${nombre(i.perdants, 0)} % y perdent (au moins 1 € par mois).` : phrase(i.id, i.valeur, i.unite))}
                        {/* l'activité résulte de plusieurs mécanismes de sens contraires : on dit lesquels, sinon le chiffre semble contredire les autres */}
                        {(i.id === 'pib' || i.id === 'pib_long_terme') && i.explication && Math.abs(i.valeur) >= 0.01 && <span className="muted"> Pourquoi : {i.explication}</span>}</span>
                    </div>
                  ))}
                </div>
              )}
              {p.pilier === 'social' && paradoxePauvrete(p) && (
                <div className="small muted" style={{ marginTop: 6 }}>Pourquoi la pauvreté recule-t-elle si presque personne n'y gagne ? Elle se mesure par rapport au revenu du milieu
                  de la population : quand presque tout le monde perd un peu, ce repère baisse, et moins de personnes se retrouvent en dessous.</div>
              )}
              {p.pilier === 'social' && gainPourLesPlusAises(p) && (
                <div className="small muted" style={{ marginTop: 6 }}>Pourquoi « plutôt négatif » si personne n'y perd ? Le gain va surtout aux ménages
                  les plus aisés : l'écart entre les revenus se creuse.</div>
              )}
              {conf && <div className="small muted" style={{ marginTop: 8 }}>Fiabilité : <ConfidenceBadge c={conf} compact align="right" /> {CONFIANCE_FEMININ[conf.niveau]}</div>}
            </div>
          )
        })}
      </div>
      <div className="row between small muted" style={{ marginTop: 12 }}>
        <span>Pas de note globale : à vous de peser ce qui compte le plus.</span>
        <span><span className="puce-sens favorable" style={{ marginTop: 0 }} />plutôt bien <span className="puce-sens defavorable" style={{ marginTop: 0, marginLeft: 10 }} />plutôt mal</span>
      </div>
    </div>
  )
}

// d'où vient chaque morceau du chiffre, en mots simples (clé : titre de la rubrique du rapport)
const SOURCE_EFFET: Record<string, string> = {
  'Pour les finances publiques': 'Impôts et aides des ménages',
  "Budget de l'État et de la Sécurité sociale": 'Dépenses publiques (budget voté)',
  'Effets économiques et comportementaux': 'Effets sur les prix et la consommation',
  'Pour la planète': 'Carburants, vitesse et consommation des ménages',
}

const FAMILLES: Record<OptionCompensation['famille'], string> = {
  depenses: 'Faire des économies ailleurs', recettes: 'Trouver de nouvelles recettes', assumer: 'Ou bien…',
  regles: 'Changer une autre règle', prix: 'Agir par les prix',
}

function Compensations({ e, overrides, onAppliquer }: { e: Equilibre; overrides: Record<string, Valeur>; onAppliquer: (o: Record<string, Valeur>) => void }) {
  const [opts, setOpts] = useState<OptionCompensation[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const charger = async () => {
    setLoading(true); setErr(null)
    try { setOpts((await api<{ options: OptionCompensation[] }>('/api/compensations', { body: { overrides, equilibre: e.id, manque: e.manque } })).options) }
    catch (x: any) { setErr(x.message) } finally { setLoading(false) }
  }
  if (!opts) return (
    <div style={{ marginTop: 12 }}>
      <button className="btn primary" onClick={charger} disabled={loading}>{loading ? 'Recherche des solutions…' : e.id === 'budget' ? 'Trouver comment financer' : 'Trouver comment compenser'}</button>
      {err && <ErrorBox message={err} />}
    </div>
  )
  if (loading) return <Loading />
  const familles = Array.from(new Set(opts.map((o) => o.famille)))
  return (
    <div style={{ marginTop: 14 }}>
      <p className="small ink2" style={{ marginTop: 0 }}>Choisissez une solution : elle sera ajoutée à votre réforme et les effets seront recalculés. Vous pourrez toujours en changer.</p>
      {opts.length === 0 && <div className="small muted">Pas encore de solution chiffrée pour cet équilibre.</div>}
      {familles.map((f) => (
        <div key={f} style={{ marginBottom: 12 }}>
          <div className="kpi-label" style={{ marginBottom: 6 }}>{FAMILLES[f]}</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {opts.filter((o) => o.famille === f).map((o) => (
              <div key={o.id} className="preset" style={{ cursor: 'default', display: 'flex', flexDirection: 'column' }}>
                <strong>{o.titre}</strong>
                <span className="small muted" style={{ flex: 1 }}>{o.description}</span>
                {o.rendement !== 0 && <div className="small" style={{ marginTop: 6 }}>Couvre <strong style={{ whiteSpace: 'nowrap' }}>{o.unite === 'mt_co2e' ? tonnes(Math.abs(o.rendement)) : milliards(Math.abs(o.rendement))}</strong> par an</div>}
                <button className="btn small primary" style={{ marginTop: 8, alignSelf: 'flex-start' }} aria-label={`Choisir : ${o.titre}`} onClick={() => onAppliquer(o.overrides)}>Choisir cette solution</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function Titre({ e }: { e: Equilibre }) {
  const budget = e.id === 'budget'
  if (e.statut === 'non_mesure') return <>{budget ? "Pas d'effet sur les finances publiques." : "Pas d'effet direct sur les émissions."}</>
  if (budget) {
    if (e.statut === 'a_compenser') return <>Il manque <span className="delta neg">{milliards(e.manque)}</span> par an.</>
    if (e.statut === 'assume') return <>Financé par l'emprunt : <span className="delta neg">{milliards(e.effet)}</span> de dette en plus chaque année.</>
    if (e.statut === 'a_surveiller') return <>Coût estimé : environ <span className="delta neg">{milliards(Math.abs(e.effet))}</span> par an (estimation incertaine).</>
    return e.effet > 0.05 ? <>C'est financé, et ça rapporte <span className="delta pos">{milliards(e.effet)}</span> par an.</> : <>C'est financé. <CheckCircle2 size={20} color="var(--gain)" style={{ verticalAlign: -3 }} /></>
  }
  if (e.statut === 'a_compenser') return <><span className="delta neg">{tonnes(e.manque)}</span> d'émissions en plus par an, à compenser.</>
  if (e.statut === 'a_surveiller') return <>Hausse estimée d'environ {tonnes(Math.abs(e.effet))} par an (estimation incertaine).</>
  if (e.statut === 'information') return <>{e.effet > 0 ? 'Hausse' : 'Baisse'} de {tonnes(e.effet)} par an.</>
  return e.effet < -0.005 ? <>Les émissions baissent de <span className="delta pos">{tonnes(e.effet)}</span> par an. <CheckCircle2 size={20} color="var(--gain)" style={{ verticalAlign: -3 }} /></> : <>Dans les clous. <CheckCircle2 size={20} color="var(--gain)" style={{ verticalAlign: -3 }} /></>
}

export function EquilibresPanel({ r, overrides, onAppliquer, contexte = 'reforme' }: { r: Rapport; overrides?: Record<string, Valeur>; onAppliquer?: (o: Record<string, Valeur>) => void; contexte?: Contexte }) {
  // effet indirect sur les émissions (via l'activité) : affiché, mais pas compté dans le plafond car trop incertain
  const indirect = r.sections.flatMap((s) => s.indicateurs).find((i) => i.id === 'impact_emissions_activite')?.valeur ?? 0
  return (
    <div className="stack">
      {r.equilibres.map((e) => {
        const budget = e.id === 'budget'
        const I = budget ? Coins : Globe2
        const alerte = e.statut === 'a_compenser'
        return (
          <div key={e.id} className="card" style={{ borderColor: alerte ? 'var(--c-tres-faible)' : e.statut === 'respecte' ? 'var(--gain)' : 'var(--line)', borderWidth: alerte ? 2 : 1 }}>
            <div className="row between top" style={{ flexWrap: 'nowrap' }}>
              <div className="kpi-label"><I size={15} /> {budget ? 'L\'argent public' : 'Le climat'}</div>
              {e.statut !== 'non_mesure' && <ConfidenceBadge c={e.confiance} align="right" />}
            </div>
            <div className="phrase-xl" style={{ margin: '6px 0' }}><Titre e={e} /></div>
            {budget && alerte && <div className="small muted">soit environ {parMenageMois(e.manque)} par mois et par ménage.</div>}
            {/* la même mesure chiffrée par une institution : à côté de notre chiffre, pour que chacun juge */}
            {budget && r.reference_officielle && (
              <div className="small" style={{ marginTop: 4 }}>Pour comparer : {r.reference_officielle.source.editeur ?? 'une institution publique'} chiffre la même mesure à{' '}
                <strong>{r.reference_officielle.valeur_md >= 0 ? '+' : '−'}{milliards(Math.abs(r.reference_officielle.valeur_md))} par an</strong>
                {' '}({r.reference_officielle.annee}{r.reference_officielle.perimetre === 'statique' ? ', à comportements inchangés' : ''}).{' '}
                <Link to="/fiabilite">Tous les chiffrages comparés</Link></div>
            )}
            {!budget && Math.abs(e.effet) >= 0.005 && <div className="small muted">{equivalentCarbone(e.effet)}.</div>}
            {!budget && Math.abs(indirect) >= 0.005 && (
              <div className="small muted">Effet indirect, par l'activité économique : {tonnes(indirect, true)} par an. Trop incertain pour être compté dans le plafond.</div>
            )}
            {alerte && (
              <div className={`notice ${contexte === 'societe' ? 'warn' : 'err'} small`} style={{ marginTop: 10 }}><ShieldAlert size={16} />
                <div>{contexte === 'societe'
                  ? (budget ? "Cette proposition n'est pas entièrement financée : elle a été enregistrée avant cette vérification, ou la loi a changé depuis." : "Cette proposition dépasse le plafond d'émissions : elle a été enregistrée avant cette vérification, ou la loi a changé depuis.")
                  : (budget ? 'Il faut trouver cet argent ailleurs avant de pouvoir enregistrer votre réforme.' : 'Il faut compenser ces émissions ailleurs avant de pouvoir enregistrer votre réforme.')}</div></div>
            )}
            {e.statut === 'a_surveiller' && <div className="notice warn small" style={{ marginTop: 10 }}><ShieldAlert size={16} /><div>Cette estimation est trop incertaine pour être exigée. Vous pouvez quand même choisir une solution ci-dessous.</div></div>}
            <Pourquoi titre={budget ? 'Pourquoi faut-il financer ?' : 'Pourquoi faut-il compenser ?'}>
              {budget ? (
                <>La France dépense déjà plus qu'elle ne gagne : son <Terme id="deficit">déficit</Terme> dépasse la <Terme id="limite3">limite européenne de 3 %</Terme>.
                  Comme pour les députés avec l'<Terme id="article40">article 40 de la Constitution</Terme>, toute dépense nouvelle (ou baisse d'impôt) doit donc être
                  financée : par des économies ailleurs, par de nouvelles recettes, ou en choisissant explicitement d'emprunter davantage.
                  <div className="small muted" style={{ marginTop: 6 }}>{e.explication}</div></>
              ) : (
                <>La loi fixe un plafond d'émissions de gaz à effet de serre : le <Terme id="budget_carbone">budget carbone</Terme>. La France émet aujourd'hui plus
                  que ce plafond, donc toute réforme qui augmente les émissions doit être compensée par une autre qui les réduit.
                  <div className="small muted" style={{ marginTop: 6 }}>{e.explication}</div></>
              )}
            </Pourquoi>
            {(alerte || e.statut === 'a_surveiller') && onAppliquer && overrides && <Compensations e={e} overrides={overrides} onAppliquer={onAppliquer} />}
            {e.composantes.length > 1 && (
              <details className="explain">
                <summary>D'où vient ce chiffre ?</summary>
                <ul className="list small">{e.composantes.map((c, i) => <li key={i} className="list-row"><span>{SOURCE_EFFET[c.section] ?? c.libelle}</span>
                  <strong>{budget ? milliards(c.valeur, true) : tonnes(c.valeur, true)}</strong></li>)}</ul>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
