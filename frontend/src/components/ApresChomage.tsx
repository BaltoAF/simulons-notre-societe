// « Et après le chômage ? » (test Karim, 46 ans, au chômage depuis 7 mois) : le calcul savait répondre à ses deux
// inquiétudes, la fin de ses droits et une reprise d'emploi moins payée, mais rien ne l'y menait. Deux situations à
// comparer à la sienne, calculées par le même moteur, à la demande.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Hourglass } from 'lucide-react'
import { api } from '../lib/api'
import { euros } from '../lib/format'
import { situationVersMenage, type SituationSaisie } from '../lib/state'

type Ligne = { id: string; libelle: string; montant: number; nature: string }
type Res = { revenu_disponible: number; lignes: Ligne[] }
type Scenario = { res?: Res; loading?: boolean; erreur?: string }

/** Ce qui change d'une situation à l'autre, ligne par ligne (revenus, aides, impôts). */
function changements(avant: Res, apres: Res): string[] {
  const signe = (l: Ligne) => (l.nature === 'prelevement' ? -1 : 1)
  const ids = [...new Set([...avant.lignes, ...apres.lignes].map((l) => l.id))]
  return ids.flatMap((id) => {
    const a = avant.lignes.find((l) => l.id === id), b = apres.lignes.find((l) => l.id === id)
    const d = (b ? signe(b) * b.montant : 0) - (a ? signe(a) * a.montant : 0)
    return Math.abs(d) >= 1 ? [`${(b ?? a)!.libelle} ${d > 0 ? '+' : '−'}${euros(Math.abs(d), 0)}`] : []
  })
}

function Bilan({ sc, actuel }: { sc: Scenario; actuel: Res }) {
  if (sc.loading) return <div className="small muted" style={{ marginTop: 6 }}><span className="spinner" style={{ width: 14, height: 14, verticalAlign: -2 }} /> Calcul (une dizaine de secondes)…</div>
  if (sc.erreur) return <div className="small muted" style={{ marginTop: 6 }}>Calcul indisponible pour le moment.</div>
  if (!sc.res) return null
  const d = sc.res.revenu_disponible - actuel.revenu_disponible
  return (
    <div style={{ marginTop: 8 }}>
      <div><strong>{euros(sc.res.revenu_disponible)} par mois</strong> pour le foyer, soit{' '}
        <strong className={`delta ${d > 0.5 ? 'pos' : d < -0.5 ? 'neg' : ''}`}>{d > 0.5 ? '+' : d < -0.5 ? '−' : '±'}{euros(Math.abs(d), 0)}</strong> par rapport à aujourd'hui.</div>
      <div className="small ink2" style={{ marginTop: 2 }}>Ce qui change : {changements(actuel, sc.res).join(' · ') || 'rien'}.</div>
    </div>
  )
}

export function ApresLeChomage({ s, actuel }: { s: SituationSaisie; actuel: Res }) {
  const i = s.adultes.findIndex((a) => a.activite === 'chomeur')
  const [fin, setFin] = useState<Scenario>({})
  const [emploi, setEmploi] = useState<Scenario>({})
  const [salaire, setSalaire] = useState(0)
  const [cinqAns, setCinqAns] = useState(false) // condition de l'ASS : 5 ans de travail au cours des 10 dernières années
  if (i < 0) return null
  const calculer = async (adulte: Partial<SituationSaisie['adultes'][number]>, set: (x: Scenario) => void) => {
    set({ loading: true })
    const sit = { ...s, adultes: s.adultes.map((a, k) => (k === i ? { ...a, ...adulte } : a)) }
    try { set({ res: await api<Res>('/api/simulation/menage', { body: { menage: situationVersMenage(sit), montants: 'net' } }) }) } catch (e: any) { set({ erreur: e.message }) }
  }
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Et après le chômage ?</h3>
      <p className="small ink2" style={{ marginTop: 0 }}>Le calcul ci-dessus vaut tant que l'allocation chômage est versée. Comparez avec deux autres situations,
        calculées avec les mêmes règles :</p>
      <div className="stack" style={{ gap: 14 }}>
        <div>
          <strong><Hourglass size={16} /> Quand l'allocation chômage {s.adultes.length > 1 && i > 0 ? 'de votre conjoint(e) ' : ''}s'arrête</strong>
          <label className="row small" style={{ marginTop: 6, cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' }}><input type="checkbox" checked={cinqAns}
            onChange={(e) => { setCinqAns(e.target.checked); setFin({}) }} style={{ marginTop: 3 }} /> J'ai travaillé au moins 5 ans au cours des 10 dernières années (condition de l'ASS)</label>
          {!fin.res && !fin.loading && <div style={{ marginTop: 6 }}><button className="btn small" onClick={() => calculer({ montant_net: 0, ass_precondition: cinqAns }, setFin)}>Calculer</button></div>}
          <Bilan sc={fin} actuel={actuel} />
          {fin.res && <div className="small muted" style={{ marginTop: 4 }}>L'<Link to="/regles/r/travail.chomage.ass_montant_journalier">allocation de solidarité
            spécifique (ASS)</Link> est {cinqAns ? 'comptée ici si les ressources du foyer le permettent' : "réservée à ceux qui ont travaillé au moins 5 ans au cours des 10 dernières années : cochez la case si c'est votre cas"}. France Travail confirme le droit.</div>}
        </div>
        <div>
          <strong><Briefcase size={16} /> Si {i > 0 && s.adultes.length > 1 ? 'votre conjoint(e) reprend' : 'vous reprenez'} un emploi</strong>
          <div className="row" style={{ marginTop: 6, gap: 8, flexWrap: 'nowrap' }}>
            <div className="input-suffix" style={{ maxWidth: 190 }}><input type="number" min={0} step={50} value={salaire || ''} placeholder="ex. 1 300" aria-label="Salaire net mensuel de l'emploi repris"
              onChange={(e) => { setSalaire(Number(e.target.value)); setEmploi({}) }} /><span className="suffix">€ nets / mois</span></div>
            <button className="btn small" disabled={!(salaire > 0) || emploi.loading} onClick={() => calculer({ activite: 'salarie', montant_net: salaire }, setEmploi)}>Calculer</button>
          </div>
          <Bilan sc={emploi} actuel={actuel} />
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 0 }}>Le RSA et la prime d'activité se calculent sur les ressources des trois mois précédents : un changement de situation
        ne se voit pas tout de suite sur leur montant. Le site ne calcule pas encore un petit emploi cumulé avec une partie de l'allocation chômage.</p>
    </div>
  )
}
