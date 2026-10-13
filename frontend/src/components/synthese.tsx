// « En bref » et « Les équilibres » : le résultat d'une réforme raconté en phrases simples.
import { useState } from 'react'
import { CheckCircle2, Coins, Globe2, Heart, Landmark, Leaf, ShieldAlert, Users, Wallet } from 'lucide-react'
import { api, type Equilibre, type OptionCompensation, type Pilier, type Rapport, type Valeur } from '../lib/api'
import { euros, valeur } from '../lib/format'
import { CONFIANCE_FEMININ, equivalentCarbone, milliards, parMenageMois, phrase, tonnes } from '../lib/humain'
import { Pourquoi, Terme } from './Terme'
import { ConfidenceBadge, ErrorBox, Loading } from './ui'

const ICONES = { economie: Landmark, social: Users, ecologie: Leaf, bien_etre: Heart }
const VERDICT: Record<Pilier['verdict'], { txt: string; cls: string }> = {
  amelioration: { txt: 'Plutôt positif', cls: 'gain' },
  degradation: { txt: 'Plutôt négatif', cls: 'loss' },
  contraste: { txt: 'Du positif et du négatif', cls: 'warn' },
  neutre: { txt: 'Peu de changement', cls: '' },
  non_mesure: { txt: 'Pas d\'effet mesuré', cls: '' },
}

export function EnBref({ r }: { r: Rapport }) {
  const pv = r.pour_vous
  return (
    <div className="card" style={{ borderColor: 'var(--primary)' }}>
      <h2 style={{ fontSize: '1.35rem', marginBottom: 12 }}>Ce que change votre réforme</h2>
      {pv && (
        <div className="row" style={{ marginBottom: 14, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
          <Wallet size={22} color="var(--primary)" style={{ flexShrink: 0, marginTop: 4 }} />
          <div className="phrase-xl">
            {Math.abs(pv.delta_mois) < 0.5 ? <>Pour votre foyer : <span className="muted">rien ne change.</span></>
              : <>Pour votre foyer : <span className={`delta ${pv.delta_mois > 0 ? 'pos' : 'neg'}`}>{pv.delta_mois > 0 ? '+' : '−'}{euros(Math.abs(pv.delta_mois))} par mois</span>.</>}
          </div>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
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
              {p.indicateurs.length === 0 ? <div className="small muted">Cette réforme ne touche pas cette dimension, ou son effet n'est pas encore chiffré.</div> : (
                <div>
                  {p.indicateurs.slice(0, 3).map((i) => (
                    <div key={i.id} className="ligne-phrase small">
                      <span className={`puce-sens ${i.sens}`} />
                      <span>{phrase(i.id, i.valeur, i.unite)}</span>
                    </div>
                  ))}
                </div>
              )}
              {conf && <div className="small muted" style={{ marginTop: 8 }}>Fiabilité : <ConfidenceBadge c={conf} compact align="right" /> {CONFIANCE_FEMININ[conf.niveau]}</div>}
            </div>
          )
        })}
      </div>
      <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>Le Système ne donne pas de note globale : à vous de peser ce qui compte le plus. <span className="puce-sens favorable" style={{ marginTop: 0 }} />plutôt bien <span className="puce-sens defavorable" style={{ marginTop: 0, marginLeft: 8 }} />plutôt mal</p>
    </div>
  )
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
      {opts.length === 0 && <div className="small muted">Le Système ne dispose pas encore de solution chiffrée pour cet équilibre.</div>}
      {familles.map((f) => (
        <div key={f} style={{ marginBottom: 12 }}>
          <div className="kpi-label" style={{ marginBottom: 6 }}>{FAMILLES[f]}</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {opts.filter((o) => o.famille === f).map((o) => (
              <div key={o.id} className="preset" style={{ cursor: 'default', display: 'flex', flexDirection: 'column' }}>
                <strong>{o.titre}</strong>
                <span className="small muted" style={{ flex: 1 }}>{o.description}</span>
                {o.rendement !== 0 && <div className="small" style={{ marginTop: 6 }}>Couvre <strong>{o.unite === 'mt_co2e' ? tonnes(Math.abs(o.rendement)) : milliards(Math.abs(o.rendement))}</strong> par an</div>}
                <button className="btn small primary" style={{ marginTop: 8, alignSelf: 'flex-start' }} onClick={() => onAppliquer(o.overrides)}>Choisir cette solution</button>
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
  if (e.statut === 'non_mesure') return <>Pas d'effet mesuré.</>
  if (budget) {
    if (e.statut === 'a_compenser') return <>Il manque <span className="delta neg">{milliards(e.manque)}</span> par an.</>
    if (e.statut === 'assume') return <>Financé par l'emprunt : <span className="delta neg">{milliards(e.effet)}</span> de dette en plus chaque année.</>
    if (e.statut === 'a_surveiller') return <>Coût estimé : {milliards(e.effet)} par an (à confirmer).</>
    return e.effet > 0.05 ? <>C'est financé, et ça rapporte <span className="delta pos">{milliards(e.effet)}</span> par an.</> : <>C'est financé. <CheckCircle2 size={20} color="var(--gain)" style={{ verticalAlign: -3 }} /></>
  }
  if (e.statut === 'a_compenser') return <><span className="delta neg">{tonnes(e.manque)}</span> de trop par an.</>
  if (e.statut === 'a_surveiller') return <>Hausse estimée de {tonnes(e.effet)} par an (à confirmer).</>
  if (e.statut === 'information') return <>{e.effet > 0 ? 'Hausse' : 'Baisse'} de {tonnes(e.effet)} par an.</>
  return e.effet < -0.005 ? <>Les émissions baissent de <span className="delta pos">{tonnes(e.effet)}</span> par an. <CheckCircle2 size={20} color="var(--gain)" style={{ verticalAlign: -3 }} /></> : <>Dans les clous. <CheckCircle2 size={20} color="var(--gain)" style={{ verticalAlign: -3 }} /></>
}

export function EquilibresPanel({ r, overrides, onAppliquer }: { r: Rapport; overrides?: Record<string, Valeur>; onAppliquer?: (o: Record<string, Valeur>) => void }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
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
            {alerte && (
              <div className="notice err small" style={{ marginTop: 10 }}><ShieldAlert size={16} />
                <div>{budget ? 'Il faut trouver cet argent ailleurs avant de pouvoir enregistrer votre société.' : 'Il faut compenser ces émissions ailleurs avant de pouvoir enregistrer votre société.'}</div></div>
            )}
            {e.statut === 'a_surveiller' && <div className="notice warn small" style={{ marginTop: 10 }}><ShieldAlert size={16} /><div>Estimation trop incertaine pour exiger une compensation : à surveiller.</div></div>}
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
                <ul className="list small">{e.composantes.map((c, i) => <li key={i} className="list-row"><span>{c.libelle}</span><strong>{valeur(c.valeur, e.unite)}</strong></li>)}</ul>
              </details>
            )}
          </div>
        )
      })}
    </div>
  )
}
