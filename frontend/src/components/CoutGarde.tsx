// « Faire garder votre enfant » (test Lucie, bébé de 8 mois chez une assistante maternelle) : le calcul principal ne
// compte pas les aides à la garde, alors que c'est la vraie question d'un jeune parent : combien la garde coûtera, une
// fois le complément de la CAF et le crédit d'impôt déduits. Estimation à partir de deux chiffres du contrat.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { euros } from '../lib/format'
import { coutCreche, estimerGarde, paramsGarde, REGLES_GARDE } from '../lib/garde'
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
  const nbEnfants = s.enfants.filter((x) => x >= 0 && x < 21).length
  const e = heures > 0 && cout > 0
    ? estimerGarde({ heures, cout, ressources: ressources ?? estimees, enfants: nbEnfants, credit: moinsDe6 }, p)
    : null
  // la même garde en crèche : revenus comptés avant la déduction de 10 % (barème CAF 2026), crédit d'impôt sur le tarif payé
  const creche = e && moinsDe6 ? Math.round(coutCreche({ heures, ressourcesAvantAbattement: (ressources ?? estimees) / 0.9, enfants: nbEnfants }, p)) : null
  const crecheFinal = creche != null ? Math.round(creche - 0.5 * Math.min(creche * 12, p.creditPlafondDepenses) / 12) : null
  // montants affichés arrondis à l'euro, et calculés à partir des arrondis pour que les soustractions tombent juste
  const a = e && (() => {
    const cout = Math.round(e.cout), cmg = Math.round(e.cmg), creditAn = Math.round(e.creditMensuel * 12)
    return { cout, cmg, paye: cout - cmg, creditAn, final: Math.max(0, Math.round(cout - cmg - creditAn / 12)) }
  })()
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
        <label className="field" style={{ minWidth: 0, flex: '1 1 180px' }}><span>Ce que coûte la garde par mois</span>
          <div className="input-suffix"><input type="number" min={0} step={10} value={cout || ''} placeholder="ex. 800" onChange={(x) => setCout(Number(x.target.value))} /><span className="suffix">€</span></div>
          {/* avec Pajemploi+, la CAF paie directement sa part : sans le dire, le complément était compté deux fois (test Mehdi) */}
          <span className="hint">Salaire net et indemnités d'entretien et de repas, avant l'aide de la CAF (même si, avec Pajemploi+, vous ne payez que la différence).
            Les cotisations sociales, elles, sont payées par la CAF.</span></label>
      </div>
      <div className="small muted" style={{ marginTop: 8 }}>
        Revenus du foyer retenus : environ {euros(ressources ?? estimees, 0)} par mois{ressources == null && ", vos revenus après la déduction de 10 % que font aussi les impôts"}.
        La CAF regarde ceux d'il y a deux ans.{' '}
        {!corriger && <button className="lien" onClick={() => setCorriger(true)}>corriger</button>}
      </div>
      {corriger && (
        <div className="input-suffix" style={{ maxWidth: 240, marginTop: 6 }}><input type="number" min={0} step={50} value={ressources ?? estimees} aria-label="Revenus mensuels du foyer retenus par la CAF"
          onChange={(x) => setRessources(Number(x.target.value))} /><span className="suffix">€ / mois</span></div>
      )}
      {e && a && (
        <div style={{ marginTop: 12 }}>
          {/* ce qui sort du compte chaque mois, puis ce que les impôts rendent l'année suivante : un seul « reste à charge »
              qui comptait déjà le crédit d'impôt trompait sur la trésorerie (test Mehdi) */}
          <ul className="list">
            <li><div className="list-row"><span>Ce que coûte la garde</span><strong>{euros(a.cout)}</strong></div></li>
            <li><div className="list-row"><span>Complément de la CAF (CMG)</span><strong className={`delta ${a.cmg > 0 ? 'pos' : ''}`}>{a.cmg > 0 ? '−' : ''}{euros(a.cmg)}</strong></div>
              {a.cmg === 0 && <div className="small muted" style={{ marginTop: 2 }}>À ce niveau de revenus, le complément est nul.</div>}</li>
            <li><div className="list-row"><span><strong>Chaque mois, vous payez</strong></span><strong>{euros(a.paye)}</strong></div></li>
            {moinsDe6 && <li><div className="list-row"><span>Crédit d'impôt, versé l'année suivante</span><strong className="delta pos">−{euros(a.creditAn)} pour l'année</strong></div>
              <div className="small muted" style={{ marginTop: 2 }}>Les impôts vous le versent même si vous ne payez pas d'impôt.</div></li>}
          </ul>
          {moinsDe6 && <div style={{ marginTop: 8 }}>Au final, crédit d'impôt compris : <strong>environ {euros(a.final)} par mois</strong>.</div>}
          {creche != null && <div className="small ink2" style={{ marginTop: 8 }}>En crèche, au tarif que fixe la CAF selon les revenus, les mêmes heures
            coûteraient environ {euros(creche)} par mois, soit environ {euros(crecheFinal!)} une fois le crédit d'impôt déduit (repas et couches souvent compris).</div>}
          {e.auDessusDuPlafond && <div className="small muted" style={{ marginTop: 4 }}>Votre tarif dépasse {euros(p.plafondHoraire, 2)} de l'heure : le complément ne compte pas ce qui dépasse.</div>}
        </div>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>
        {sansActivite > 0 && <>Pour y avoir droit, {s.adultes.length > 1 ? 'chaque parent doit' : 'il faut'} en principe travailler ; des exceptions existent (études, AAH, RSA…) : vérifiez sur caf.fr. </>}
        Estimation pour un seul enfant gardé, selon <Link to={`/regles/r/${REGLES_GARDE[0]}`}>les règles en vigueur depuis septembre 2025</Link>. Le montant exact est calculé par la CAF :{' '}
        <a href="https://www.monenfant.fr/" target="_blank" rel="noreferrer">simulateur officiel sur monenfant.fr</a>.
      </p>
    </div>
  )
}
