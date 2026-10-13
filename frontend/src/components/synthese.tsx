// « En bref » : le bilan d'une réforme en quatre piliers, et les équilibres à respecter (finances publiques, climat).
import { useState } from 'react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Heart, Landmark, Leaf, Scale, ShieldAlert, Users, Wallet } from 'lucide-react'
import { api, type Equilibre, type OptionCompensation, type Pilier, type Rapport, type Valeur } from '../lib/api'
import { euros, nombre, valeur } from '../lib/format'
import { ConfidenceBadge, ErrorBox, Loading } from './ui'

const ICONES = { economie: Landmark, social: Users, ecologie: Leaf, bien_etre: Heart }
const VERDICT: Record<Pilier['verdict'], { txt: string; cls: string; Icone: typeof ArrowUpRight }> = {
  amelioration: { txt: 'Plutôt positif', cls: 'gain', Icone: ArrowUpRight },
  degradation: { txt: 'Plutôt négatif', cls: 'loss', Icone: ArrowDownRight },
  contraste: { txt: 'Effets contrastés', cls: 'warn', Icone: Scale },
  neutre: { txt: 'Peu d\'effet', cls: '', Icone: ArrowRight },
  non_mesure: { txt: 'Non mesuré', cls: '', Icone: ArrowRight },
}

function fmtItem(v: number, u: string) {
  if (u === 'emplois' || u === 'personnes') return (v > 0 ? '+' : v < 0 ? '−' : '') + nombre(Math.abs(v), 0) + (u === 'emplois' ? ' emplois' : ' pers.')
  const t = valeur(Math.abs(v), u)
  return (v > 0 ? '+' : v < 0 ? '−' : '±') + t
}

export function EnBref({ r }: { r: Rapport }) {
  return (
    <div className="card" style={{ borderColor: 'var(--primary)' }}>
      <h3 style={{ marginBottom: 4 }}>En bref</h3>
      <p className="small muted" style={{ marginTop: 0 }}>Le bilan de la réforme sur quatre dimensions. Aucune note globale : à vous de peser les arbitrages.</p>
      {r.pour_vous && (
        <div className="notice" style={{ marginBottom: 12 }}>
          <Wallet size={18} />
          <div><strong>Pour votre foyer :</strong>{' '}
            <span className={`delta ${r.pour_vous.delta_mois > 0.5 ? 'pos' : r.pour_vous.delta_mois < -0.5 ? 'neg' : 'zero'}`}>
              {r.pour_vous.delta_mois > 0.5 ? '+' : r.pour_vous.delta_mois < -0.5 ? '−' : '±'}{euros(Math.abs(r.pour_vous.delta_mois))} par mois</span>
            {' '}<span className="muted small">({euros(r.pour_vous.avant)} → {euros(r.pour_vous.apres)})</span>
          </div>
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
        {r.bilan.map((p) => {
          const I = ICONES[p.pilier]
          const v = VERDICT[p.verdict]
          return (
            <div key={p.pilier} className="card flat" style={{ padding: 14 }}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <strong className="row" style={{ gap: 6 }}><I size={17} /> {p.titre}</strong>
                <span className={`badge ${v.cls}`}><v.Icone size={13} /> {v.txt}</span>
              </div>
              {p.indicateurs.length === 0 && <div className="small muted">Pas d'effet chiffré sur cette dimension pour cette réforme.</div>}
              <ul className="list small">
                {p.indicateurs.slice(0, 4).map((i) => (
                  <li key={i.id} style={{ padding: '6px 0' }}>
                    <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                      <span style={{ lineHeight: 1.3 }}>{i.libelle}</span>
                      <span className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                        <strong className={`delta ${i.sens === 'favorable' ? 'pos' : i.sens === 'defavorable' ? 'neg' : 'zero'}`}>{fmtItem(i.valeur, i.unite)}</strong>
                        <ConfidenceBadge c={i.confiance} compact align="right" />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const FAMILLES: Record<OptionCompensation['famille'], string> = {
  depenses: 'Réduire d\'autres dépenses', recettes: 'Augmenter des recettes', assumer: 'Assumer',
  regles: 'Changer d\'autres règles', prix: 'Agir par les prix',
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
    <div style={{ marginTop: 10 }}>
      <button className="btn primary" onClick={charger} disabled={loading}>{loading ? 'Recherche…' : 'Voir comment compenser'}</button>
      {err && <ErrorBox message={err} />}
    </div>
  )
  if (loading) return <Loading />
  const familles = Array.from(new Set(opts.map((o) => o.famille)))
  return (
    <div style={{ marginTop: 12 }}>
      {opts.length === 0 && <div className="small muted">Le Système ne dispose pas encore de levier chiffré pour compenser cet équilibre.</div>}
      {familles.map((f) => (
        <div key={f} style={{ marginBottom: 10 }}>
          <div className="kpi-label" style={{ marginBottom: 6 }}>{FAMILLES[f]}</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            {opts.filter((o) => o.famille === f).map((o) => (
              <div key={o.id} className="preset" style={{ cursor: 'default' }}>
                <strong>{o.titre}</strong>
                <span className="small muted">{o.description}</span>
                {o.rendement !== 0 && <div className="small" style={{ marginTop: 4 }}>Rendement estimé : <strong>{valeur(Math.abs(o.rendement), o.unite)}</strong> par an</div>}
                <button className="btn small" style={{ marginTop: 8 }} onClick={() => onAppliquer(o.overrides)}>Appliquer et recalculer</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function EquilibresPanel({ r, overrides, onAppliquer }: { r: Rapport; overrides?: Record<string, Valeur>; onAppliquer?: (o: Record<string, Valeur>) => void }) {
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      {r.equilibres.map((e) => {
        const ok = e.statut === 'respecte'
        const nm = e.statut === 'non_mesure'
        const fmt = (v: number) => valeur(Math.abs(v), e.unite)
        const bon = e.id === 'budget' ? e.effet >= 0 : e.effet <= 0
        return (
          <div key={e.id} className="card" style={{ borderColor: e.statut === 'a_compenser' ? 'var(--c-tres-faible)' : ok ? 'var(--gain)' : e.statut === 'a_surveiller' ? 'var(--c-faible)' : 'var(--line)' }}>
            <div className="card-head">
              <div>
                <div className="kpi-label">{e.id === 'budget' ? <Landmark size={14} /> : <Leaf size={14} />} {e.titre}</div>
                {nm ? <div className="small muted" style={{ marginTop: 6 }}>Pas d'effet direct chiffré sur cet équilibre.</div> : (
                  <div className="kpi"><span className={`delta ${Math.abs(e.effet) < 0.005 ? 'zero' : bon ? 'pos' : 'neg'}`}>
                    {e.effet > 0 ? '+' : e.effet < 0 ? '−' : '±'}{fmt(e.effet)}</span> <span className="small muted">par an</span></div>
                )}
                {e.id === 'budget' && e.par_menage_mois !== undefined && Math.abs(e.par_menage_mois) >= 1 && (
                  <div className="small muted">soit {euros(Math.abs(e.par_menage_mois))} par mois et par ménage {e.par_menage_mois < 0 ? 'à financer' : 'économisés'}</div>
                )}
              </div>
              {!nm && <ConfidenceBadge c={e.confiance} align="right" />}
            </div>
            {ok && !nm && <div className="notice ok small"><CheckCircle2 size={16} /> <div>Équilibre respecté{e.effet > 0 && e.id === 'budget' ? ' : la réforme dégage même des marges.' : '.'}</div></div>}
            {e.statut === 'assume' && <div className="notice warn small"><ShieldAlert size={16} /> <div>Votre société assume ce déficit supplémentaire : il s'ajoute à la dette.</div></div>}
            {e.statut === 'a_surveiller' && <div className="notice warn small"><ShieldAlert size={16} /> <div><strong>À surveiller :</strong> dépassement estimé de {fmt(e.manque)} par an, mais avec une confiance trop faible pour imposer une compensation.</div></div>}
            {e.statut === 'information' && <div className="notice small"><ShieldAlert size={16} /> <div>Effet signalé pour information : le budget carbone de la période en cours n'est pas encore intégré par le Système.</div></div>}
            {e.statut === 'a_compenser' && (
              <div className="notice err small"><ShieldAlert size={16} /> <div><strong>À compenser : {fmt(e.manque)} par an.</strong>{' '}
                {e.id === 'budget' ? 'Toute dépense nouvelle ou baisse de recettes doit être compensée ailleurs.' : 'Les émissions dépassent déjà le budget carbone : toute hausse doit être compensée.'}</div></div>
            )}
            <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>{e.explication}</p>
            {(e.statut === 'a_compenser' || e.statut === 'a_surveiller') && onAppliquer && overrides && <Compensations e={e} overrides={overrides} onAppliquer={onAppliquer} />}
          </div>
        )
      })}
    </div>
  )
}
