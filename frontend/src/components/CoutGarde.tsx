// « Faire garder votre enfant » (test Lucie, bébé de 8 mois chez une assistante maternelle) : le calcul principal ne
// compte pas les aides à la garde, alors que c'est la vraie question d'un jeune parent : combien la garde coûtera, une
// fois le complément de la CAF et le crédit d'impôt déduits. Estimation à partir de deux chiffres du contrat.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { euros } from '../lib/format'
import { estimerGarde, paramsGarde, REGLES_GARDE } from '../lib/garde'
import type { SituationSaisie } from '../lib/state'

type Ligne = { id: string; montant: number; nature: string }

/** Un enfant ouvre droit au complément de la CAF avant 6 ans, avant 12 ans pour un parent qui l'élève seul (depuis septembre 2025). */
export function gardeConcernee(s: SituationSaisie): boolean {
  return s.enfants.some((e) => e >= 0 && (e < 6 || (s.adultes.length === 1 && e < 12)))
}

export function CoutGarde({ s, lignes, valeurs }: { s: SituationSaisie; lignes: Ligne[]; valeurs: Record<string, unknown> }) {
  const [heures, setHeures] = useState(0)
  const [cout, setCout] = useState(0)
  // la CAF retient les revenus d'il y a deux ans, après l'abattement de 10 % : estimés d'après les revenus d'aujourd'hui
  // (même approximation que le revenu fiscal de référence d'« Avez-vous pensé à… ? »)
  const estimees = Math.round(lignes.filter((l) => l.nature === 'revenu').reduce((a, l) => a + l.montant, 0) * 0.93 + s.revenus_capital_annuels / 12)
  const [ressources, setRessources] = useState<number | null>(null)
  const [corriger, setCorriger] = useState(false)
  const p = paramsGarde(valeurs)
  if (!gardeConcernee(s) || !p) return null
  const moinsDe6 = s.enfants.some((e) => e >= 0 && e < 6)
  const e = heures > 0 && cout > 0
    ? estimerGarde({ heures, cout, ressources: ressources ?? estimees, enfants: s.enfants.filter((a) => a >= 0 && a < 21).length, credit: moinsDe6 }, p)
    : null
  const sansActivite = s.adultes.filter((a) => !['salarie', 'apprenti', 'independant', 'etudiant'].includes(a.activite)).length
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><Baby size={18} /> Faire garder votre enfant</h3>
      <p className="small ink2" style={{ marginTop: 0 }}>Chez une assistante maternelle agréée, la CAF verse un complément chaque mois et l'État rembourse une partie du reste
        l'année suivante. Estimez ce qui resterait à votre charge avec deux chiffres de votre contrat :</p>
      <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
        <label className="field" style={{ minWidth: 0, flex: '1 1 180px' }}><span>Heures de garde par mois</span>
          <div className="input-suffix"><input type="number" min={0} step={10} value={heures || ''} placeholder="ex. 150" onChange={(x) => setHeures(Number(x.target.value))} /><span className="suffix">h</span></div>
          <span className="hint">Un temps plein fait souvent 150 à 200 heures.</span></label>
        <label className="field" style={{ minWidth: 0, flex: '1 1 180px' }}><span>Ce que vous lui versez par mois</span>
          <div className="input-suffix"><input type="number" min={0} step={10} value={cout || ''} placeholder="ex. 800" onChange={(x) => setCout(Number(x.target.value))} /><span className="suffix">€</span></div>
          <span className="hint">Salaire net et indemnités d'entretien et de repas. Les cotisations sociales, elles, sont payées par la CAF.</span></label>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        Revenus du foyer retenus : environ {euros(ressources ?? estimees, 0)} par mois, estimés d'après vos revenus actuels (la CAF regarde ceux d'il y a deux ans).{' '}
        {!corriger && <button className="lien" onClick={() => setCorriger(true)}>corriger</button>}
      </div>
      {corriger && (
        <div className="input-suffix" style={{ maxWidth: 240, marginTop: 6 }}><input type="number" min={0} step={50} value={ressources ?? estimees} aria-label="Revenus mensuels du foyer retenus par la CAF"
          onChange={(x) => setRessources(Number(x.target.value))} /><span className="suffix">€ / mois</span></div>
      )}
      {e && (
        <div style={{ marginTop: 12 }}>
          <ul className="list">
            <li><div className="list-row"><span>Ce que vous versez</span><strong>{euros(e.cout, 0)}</strong></div></li>
            <li><div className="list-row"><span>Complément de la CAF (CMG), chaque mois</span><strong className={`delta ${e.cmg > 0.5 ? 'pos' : ''}`}>{e.cmg > 0.5 ? '−' : ''}{euros(e.cmg, 0)}</strong></div>
              {e.cmg < 0.5 && <div className="small muted" style={{ marginTop: 2 }}>À ce niveau de revenus, le complément est nul.</div>}</li>
            {moinsDe6 && <li><div className="list-row"><span>Crédit d'impôt, ramené au mois</span><strong className="delta pos">−{euros(e.creditMensuel, 0)}</strong></div>
              <div className="small muted" style={{ marginTop: 2 }}>Versé par les impôts l'année suivante, même si vous ne payez pas d'impôt : environ {euros(e.creditMensuel * 12, 0)} pour l'année.</div></li>}
          </ul>
          <div style={{ marginTop: 8 }}>Reste à votre charge : <strong>environ {euros(e.resteACharge, 0)} par mois</strong>.</div>
          {e.auDessusDuPlafond && <div className="small muted" style={{ marginTop: 4 }}>Votre tarif dépasse {euros(p.plafondHoraire, 2)} de l'heure : le complément ne compte pas ce qui dépasse.</div>}
        </div>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        {sansActivite > 0 && <>Pour y avoir droit, {s.adultes.length > 1 ? 'chaque parent doit' : 'il faut'} en principe travailler ; des exceptions existent (études, AAH, RSA…) : vérifiez sur caf.fr. </>}
        Estimation pour un seul enfant gardé, selon <Link to={`/regles/r/${REGLES_GARDE[0]}`}>les règles de septembre 2025</Link>. Le montant exact est calculé par la CAF :{' '}
        <a href="https://www.monenfant.fr/" target="_blank" rel="noreferrer">simulateur officiel sur monenfant.fr</a>.
      </p>
    </div>
  )
}
