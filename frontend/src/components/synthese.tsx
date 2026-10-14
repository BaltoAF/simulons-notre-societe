// « En bref » et « Les équilibres » : le résultat d'une réforme raconté en phrases simples.
import { useState, type ReactNode } from 'react'
import { CheckCircle2, Coins, Globe2, Heart, Landmark, Leaf, ShieldAlert, Users, Wallet } from 'lucide-react'
import { api, type Equilibre, type OptionCompensation, type Pilier, type Rapport, type Valeur } from '../lib/api'
import { euros, nombre } from '../lib/format'
import { CONFIANCE_FEMININ, equivalentCarbone, milliards, parMenageMois, phrase, tonnes } from '../lib/humain'
import { Pourquoi, Terme } from './Terme'
import { ConfidenceBadge, ErrorBox, Loading } from './ui'

const ICONES = { economie: Landmark, social: Users, ecologie: Leaf, bien_etre: Heart }
// pilier sans indicateur : dire ce qui n'est pas mesuré, sans laisser croire qu'il n'y a « aucun effet »
const AUCUN: Record<string, string> = {
  economie: "Pas d'effet mesuré sur l'argent public ni sur l'activité.",
  social: "L'effet sur les inégalités n'est pas mesuré pour ce type de mesure (il ne passe pas par les revenus des ménages).",
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

export function EnBref({ r, contexte = 'reforme' }: { r: Rapport; contexte?: Contexte }) {
  const pv = r.pour_vous
  return (
    <div className="card" style={{ borderColor: 'var(--primary)' }}>
      <h2 style={{ fontSize: '1.35rem', marginBottom: 12 }}>{contexte === 'societe' ? 'Ce que change cette proposition' : 'Ce que change votre réforme'}</h2>
      {pv && (
        <div className="row" style={{ marginBottom: 14, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Wallet size={22} color="var(--primary)" style={{ flexShrink: 0, marginTop: 4 }} />
          <div className="phrase-xl">
            {Math.abs(pv.delta_mois) < 0.5 ? <>Pour votre porte-monnaie : <span className="muted">rien ne change.</span></>
              : <>Pour votre porte-monnaie : <span className={`delta ${pv.delta_mois > 0 ? 'pos' : 'neg'}`}>{pv.delta_mois > 0 ? '+' : '−'}{euros(Math.abs(pv.delta_mois))} par mois</span>.</>}
          </div>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))' }}>
        {r.bilan.map((p) => {
          const I = ICONES[p.pilier]
          const v = VERDICT[p.verdict]
          const confs = p.indicateurs.map((i) => i.confiance).filter(Boolean)
          const conf = confs.length ? confs.reduce((a, b) => ((a!.score) < (b!.score) ? a : b)) : null
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
                      <span>{avecTermes(i.id === 'gagnants' && i.perdants != null ? `${nombre(i.valeur, 0)} % des ménages y gagnent, ${nombre(i.perdants, 0)} % y perdent (au moins 1 € par mois).` : phrase(i.id, i.valeur, i.unite))}</span>
                    </div>
                  ))}
                </div>
              )}
              {p.pilier === 'social' && paradoxePauvrete(p) && (
                <div className="small muted" style={{ marginTop: 6 }}>Pourquoi la pauvreté recule-t-elle si presque personne n'y gagne ? Elle se mesure par rapport au revenu du milieu
                  de la population : quand presque tout le monde perd un peu, ce repère baisse, et moins de personnes se retrouvent en dessous.</div>
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
  if (e.statut === 'a_compenser') return <><span className="delta neg">{tonnes(e.manque)}</span> de trop par an.</>
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
              {e.statut !== 'non_mesure' && <ConfidenceBadge c={e.confiance} compact align="right" />}
            </div>
            <div className="phrase-xl" style={{ margin: '6px 0' }}><Titre e={e} /></div>
            {budget && alerte && <div className="small muted">soit environ {parMenageMois(e.manque)} par mois et par ménage.</div>}
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
