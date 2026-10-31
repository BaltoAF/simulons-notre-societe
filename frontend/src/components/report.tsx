import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen, ChevronDown, ChevronRight, Scale } from 'lucide-react'
import type { Indicateur, Rapport, Section, Valeur } from '../lib/api'
import { delta, euros, nombre, valeur } from '../lib/format'
import { milliards } from '../lib/humain'
import { Pourquoi } from './Terme'
import { ColumnChart, DivergingBars } from './charts'
import { ConfidenceBadge } from './ui'
import { EnBref, EquilibresPanel, type Contexte } from './synthese'

const UNITES_DELTA = new Set(['euros_mois', 'euros', 'milliards_euros', 'points', 'points_pib', 'pourcent', 'emplois', 'personnes', 'mt_co2e', 'points_sur_10', 'ecart_type', 'heures'])

export function IndicatorCard({ ind, big = false }: { ind: Indicateur; big?: boolean }) {
  const isDelta = ind.avant !== null || ind.id.startsWith('solde') || UNITES_DELTA.has(ind.unite)
  const d = delta(ind.valeur, ind.unite)
  // la couleur suit le sens (favorable / défavorable), pas le signe : une baisse des inégalités est une bonne nouvelle
  const cls = d.cls === 'zero' ? 'zero' : ind.sens === 'favorable' ? 'pos' : ind.sens === 'defavorable' ? 'neg' : d.cls
  return (
    <div className="card flat">
      <div className="card-head">
        <div className="kpi-label">{ind.libelle}</div>
        <ConfidenceBadge c={ind.confiance} align="right" compact />
      </div>
      <div className={big ? 'kpi big' : 'kpi'}>
        {isDelta && ind.valeur !== null ? <span className={`delta ${cls}`}>{d.txt}</span> : valeur(ind.valeur, ind.unite)}
      </div>
      {ind.avant !== null && ind.apres !== null && (
        <div className="small muted" style={{ marginTop: 4 }}>{valeur(ind.avant, ind.unite.replace('_mois', ''))} <ArrowRight size={12} /> {valeur(ind.apres, ind.unite.replace('_mois', ''))}</div>
      )}
      {ind.fourchette && <div className="small muted">Fourchette plausible : {valeur(ind.fourchette[0], ind.unite)} à {valeur(ind.fourchette[1], ind.unite)}</div>}
      {ind.explication && <p className="small ink2" style={{ margin: '8px 0 0' }}>{ind.explication}</p>}
      {(ind.calcul.length > 0 || ind.sources.length > 0 || ind.preuves.length > 0) && (
        <details className="explain">
          <summary><ChevronDown size={15} /> Comment c'est calculé ?</summary>
          {ind.calcul.length > 0 && <ul className="small" style={{ paddingLeft: 18, margin: '0 0 8px' }}>{ind.calcul.map((c, i) => <li key={i}>{c}</li>)}</ul>}
          {ind.preuves.length > 0 && (
            <div className="small" style={{ marginBottom: 6 }}><Scale size={13} /> Études mobilisées :{' '}
              {ind.preuves.map((p, i) => <span key={p}>{i ? ', ' : ''}<Link to={`/preuves/${p}`}>{p.replace(/_/g, ' ')}</Link></span>)}
            </div>
          )}
          {ind.sources.length > 0 && (
            <div className="small"><BookOpen size={13} /> Sources :{' '}
              {ind.sources.slice(0, 8).map((s, i) => <span key={s}>{i ? ', ' : ''}<Link to={`/sources/${encodeURIComponent(s)}`}>{s}</Link></span>)}
            </div>
          )}
        </details>
      )}
    </div>
  )
}

function SectionMenage({ s, overrides }: { s: Section; overrides?: Record<string, Valeur> }) {
  const lignes = s.donnees.lignes as { id: string; libelle: string; avant: number; apres: number; delta: number; nature: string }[]
  // un gel des pensions : « 1 280 € → 1 271,55 € » se lisait comme une baisse (test Odette) ; c'est une hausse qui n'a pas lieu
  const gel = overrides?.['retraites.revalorisation.pensions_base'] !== undefined && lignes.some((l) => l.id === 'retraite_nette' && l.delta < -0.5)
  return (
    <div className="table-wrap">
      {/* sur téléphone, chaque ligne se lit « aujourd'hui → avec la réforme » sans défiler de côté (test Karim) */}
      <table className="table table-empilee">
        <thead><tr><th>Par mois</th><th className="num">Aujourd'hui</th><th className="num">Avec la réforme</th><th className="num">Écart</th></tr></thead>
        <tbody>
          {lignes.map((l) => {
            const sign = l.nature === 'prelevement' ? -1 : 1
            const d = delta(Math.round(sign * l.delta), 'euros')
            return (
              <tr key={l.id}>
                <td>{l.libelle}{l.nature === 'prelevement' && !/imp[oô]t|prélèvement|cotisation|csg|crds|tva/i.test(l.libelle) ? <span className="muted small"> · payé</span> : null}</td>
                <td className="num" data-libelle="Aujourd'hui">{euros(l.avant)}</td>
                <td className="num" data-libelle="Avec la réforme">{euros(l.apres)}</td>
                <td className="num" data-libelle="Écart"><span className={`delta ${d.cls}`}>{d.txt}</span></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {gel && <p className="small muted" style={{ marginTop: 8 }}>Votre pension ne baisse pas : « Aujourd'hui » compte l'augmentation que la loi actuelle prévoit
        chaque 1er janvier, « Avec la réforme » ne la compte pas. L'écart est ce que vous n'auriez pas en plus.</p>}
    </div>
  )
}

function SectionCasTypes({ s }: { s: Section }) {
  const cas = s.donnees.cas as { libelle: string; avant: number; apres: number; delta: number; delta_pct: number | null }[]
  return (
    <>
      <DivergingBars data={cas.filter((c) => Math.abs(c.delta) >= 0.5).map((c) => ({ label: c.libelle, value: c.delta, sub: `${euros(c.avant)} → ${euros(c.apres)} / mois` }))}
        format={(v) => (v > 0 ? '+' : v < 0 ? '−' : '') + euros(Math.abs(v))} />
      {cas.some((c) => Math.abs(c.delta) < 0.5) && (
        <div className="small muted" style={{ marginTop: 8 }}>Inchangés : {cas.filter((c) => Math.abs(c.delta) < 0.5).map((c) => c.libelle).join(' · ')}</div>
      )}
    </>
  )
}

type Poste = { libelle: string; avant: number; apres: number; delta: number; nature: string; calage?: { officiel: number | null; ecart: number | null } }

function SectionBudget({ s }: { s: Section }) {
  const postes = (s.donnees.postes ?? []) as Poste[]
  if (!postes.length) return null
  const touches = postes.filter((p) => Math.abs(p.delta) >= 0.005)
  return (
    <div>
      {touches.length > 0 && <TablePostes postes={touches} />}
      <details className="explain">
        <summary><ChevronDown size={15} /> Fidélité du modèle : tous les postes comparés aux chiffres officiels</summary>
        <p className="small muted">Pour la situation actuelle, chaque poste simulé est comparé au montant officiel observé. Plus l'écart est faible, plus la confiance dans la variation calculée est élevée.</p>
        <TablePostes postes={postes} />
      </details>
    </div>
  )
}

function TablePostes({ postes }: { postes: Poste[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Poste (par an)</th><th className="num">Simulé aujourd'hui</th><th className="num">Avec la réforme</th><th className="num">Effet sur le solde</th><th className="num">Chiffre officiel</th></tr></thead>
        <tbody>
          {postes.map((p, i) => {
            const effet = p.nature === 'recette' ? p.delta : -p.delta
            const d = delta(effet, 'milliards_euros')
            return (
              <tr key={i}>
                <td>{p.libelle} <span className="muted small">({p.nature})</span></td>
                <td className="num">{nombre(p.avant, 1)} Md€</td>
                <td className="num">{nombre(p.apres, 1)} Md€</td>
                <td className="num"><span className={`delta ${d.cls}`}>{d.txt}</span></td>
                <td className="num muted">{p.calage?.officiel != null ? `${nombre(p.calage.officiel, 1)} Md€` : '—'}{p.calage?.ecart != null ? <div className="small">écart {nombre(p.calage.ecart * 100, 0)} %</div> : null}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SectionRedistribution({ s }: { s: Section }) {
  const dec = (s.donnees.deciles ?? []) as { decile: number; delta_euros: number; delta_pct: number }[]
  if (!dec.length) return null
  return (
    <div>
      <div className="small muted" style={{ marginBottom: 6 }}>Variation moyenne du niveau de vie par décile (D1 = les 10 % les plus modestes), en % :</div>
      <ColumnChart data={dec.map((d) => ({ label: `D${d.decile}`, value: d.delta_pct }))} format={(v) => nombre(v, 2) + ' %'} />
      <div className="small muted" style={{ marginTop: 6 }}>En euros par mois et par unité de consommation : {dec.map((d) => `D${d.decile} ${d.delta_euros >= 0 ? '+' : '−'}${nombre(Math.abs(d.delta_euros), 0)} €`).join(' · ')}</div>
    </div>
  )
}

function SectionBudgetEtat({ s }: { s: Section }) {
  const lignes = (s.donnees.lignes ?? []) as { regle: string; titre: string; avant: number; apres: number; delta: number }[]
  return (
    <ul className="list">
      {lignes.map((l) => (
        <li key={l.regle} className="list-row">
          <Link to={`/regles/r/${l.regle}`}>{l.titre}</Link>
          <span>{nombre(l.avant, 2)} → {nombre(l.apres, 2)} milliards € <span className={`delta ${l.delta > 0 ? 'neg' : 'pos'}`}>({l.delta > 0 ? '+' : '−'}{nombre(Math.abs(l.delta), 2)})</span></span>
        </li>
      ))}
    </ul>
  )
}

function SectionNonModelise({ s }: { s: Section }) {
  const regles = (s.donnees.regles ?? []) as { regle: string; titre: string; avant: any; apres: any; unite: string; preuves_liees: { id: string; titre: string; confiance: any }[] }[]
  return (
    <ul className="list">
      {regles.map((r) => (
        <li key={r.regle}>
          <div className="list-row"><Link to={`/regles/r/${r.regle}`}><strong>{r.titre}</strong></Link>
            <span className="small">{valeur(r.avant, r.unite)} → <strong>{valeur(r.apres, r.unite)}</strong></span></div>
          {r.preuves_liees.length > 0 ? (
            <div className="small" style={{ marginTop: 4 }}>Études disponibles : {r.preuves_liees.map((p) => <Link key={p.id} to={`/preuves/${p.id}`} style={{ marginRight: 8 }}>{p.titre}</Link>)}</div>
          ) : <div className="small muted">Aucune étude référencée pour l'instant.</div>}
        </li>
      ))}
    </ul>
  )
}

const RENDUS: Record<string, (p: { s: Section; overrides?: Record<string, Valeur> }) => JSX.Element | null> = {
  menage: SectionMenage, cas_types: SectionCasTypes, budget: SectionBudget, redistribution: SectionRedistribution,
  budget_etat: SectionBudgetEtat, non_modelise: SectionNonModelise,
}

export function SectionView({ s, ouvert = false, overrides }: { s: Section; ouvert?: boolean; overrides?: Record<string, Valeur> }) {
  const R = RENDUS[s.id]
  const principaux = s.indicateurs
  const [open, setOpen] = useState(ouvert)
  return (
    <section className="card" id={`section-${s.id}`}>
      <div className="card-head" style={{ marginBottom: open ? 12 : 0 }}>
        <button className="row" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          {open ? <ChevronDown size={20} style={{ marginTop: 2, flexShrink: 0 }} /> : <ChevronRight size={20} style={{ marginTop: 2, flexShrink: 0 }} />}
          <div>
            <h3 style={{ marginBottom: 2 }}>{s.titre}</h3>
            <div className="muted small">{s.sous_titre}</div>
          </div>
        </button>
        <ConfidenceBadge c={s.confiance} align="right" />
      </div>
      {open && <>
      {principaux.length > 0 && (
        <div className="grid" style={{ marginBottom: 14, gridTemplateColumns: principaux.length === 1 ? '1fr' : 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {principaux.map((i) => <IndicatorCard key={i.id} ind={i} big={s.id === 'menage'} />)}
        </div>
      )}
      {R ? <R s={s} overrides={overrides} /> : null}
      {(s.methode || s.limites.length > 0) && (
        <details className="explain">
          <summary><ChevronDown size={15} /> Méthode et limites</summary>
          {s.methode && <p className="small">{s.methode}</p>}
          {s.limites.length > 0 && <ul className="small" style={{ paddingLeft: 18 }}>{s.limites.map((l, i) => <li key={i}>{l}</li>)}</ul>}
        </details>
      )}
      </>}
    </section>
  )
}

export function ReportView({ r, overrides, onAppliquer, contexte = 'reforme' }: { r: Rapport; overrides?: Record<string, Valeur>; onAppliquer?: (o: Record<string, Valeur>) => void; contexte?: Contexte }) {
  const syn = r.synthese
  const budget = r.equilibres?.find((e) => e.id === 'budget')
  if (r.partiel) {
    // 1er temps du calcul : seulement le foyer et les ménages types, le reste arrive
    return <div className="stack">{r.sections.map((s) => <SectionView key={s.id} s={s} ouvert />)}</div>
  }
  return (
    <div className="stack">
      {r.bilan && <EnBref r={r} contexte={contexte} overrides={overrides} />}
      {(r.avertissements ?? []).map((a) => (
        <div key={a} className="small muted" style={{ marginTop: -6 }}><strong>À noter :</strong> {a}
          {/très hauts revenus/i.test(a) && <Pourquoi titre="Pourquoi ?">Les très hauts revenus sont rares : la simulation les représente par quelques dizaines de foyers fictifs, calés sur
            les statistiques fiscales officielles. Mais on ne sait pas, en données ouvertes, quelle part de leurs revenus vient des salaires
            et quelle part de l'épargne : ce qu'une tranche d'impôt très haute rapporterait est donc incertain.</Pourquoi>}
        </div>
      ))}
      {r.equilibres && (
        <div>
          <h2 id="equilibres" style={{ margin: '8px 0 4px', fontSize: '1.3rem', scrollMarginTop: 80 }}>Les équilibres à respecter</h2>
          <p className="small muted" style={{ marginTop: 0, marginBottom: 10 }}>Deux limites s'imposent à toute réforme : ne pas dépenser sans financer, et ne pas émettre plus de gaz à effet de serre que le plafond fixé pour le climat.</p>
          <EquilibresPanel r={r} overrides={overrides} onAppliquer={onAppliquer} contexte={contexte} />
          {syn.solde_public_annuel_md !== null && budget && Math.abs(syn.solde_public_annuel_md - budget.effet) > 0.05 && (
            <details className="explain" style={{ marginTop: 8 }}>
              <summary>Pourquoi un autre chiffre plus loin ?</summary>
              <p className="small" style={{ marginBottom: 0 }}>Le montant ci-dessus ({milliards(Math.abs(budget.effet))}) est {budget.statut === 'a_surveiller' ? 'une estimation de l\'effet direct de la réforme' : 'le coût direct, calculé règle par règle'}. Si l'on ajoute les réactions
                des ménages et des entreprises et l'effet sur l'activité, le coût {syn.solde_public_annuel_md >= 0 ? 'deviendrait un gain' : 'serait plutôt'} d'environ {milliards(Math.abs(syn.solde_public_annuel_md))} par an :
                c'est une estimation incertaine, donc on ne s'en sert pas pour décider si la réforme est financée.</p>
            </details>
          )}
        </div>
      )}
      <h2 style={{ margin: '8px 0 0', fontSize: '1.3rem' }}>Pour aller plus loin : le détail</h2>
      <p className="small muted" style={{ margin: 0 }}>Cliquez sur une rubrique pour l'ouvrir. Chaque chiffre indique d'où il vient et à quel point on peut s'y fier.</p>
      {r.sections.map((s) => <SectionView key={s.id} s={s} overrides={overrides} ouvert={s.id === 'menage' && Math.abs(r.pour_vous?.delta_mois ?? 0) >= 0.5} />)}
      {r.erreurs.length > 0 && (
        <div className="notice warn small">Certains modules n'ont pas pu être calculés : {r.erreurs.map((e) => e.module).join(', ')}.</div>
      )}
      {r.duree_secondes >= 0.5 && <div className="small muted">Calcul réalisé en {nombre(r.duree_secondes, 0)} seconde{Math.round(r.duree_secondes) >= 2 ? 's' : ''}.</div>}
    </div>
  )
}
