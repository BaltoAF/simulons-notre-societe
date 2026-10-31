// « Et si votre situation changeait ? » (test Lucie, jeunes parents) : les deux questions qu'un foyer se pose le plus
// souvent, un enfant de plus et un temps partiel, calculées par le même moteur que le résultat, à la demande.
import { useState } from 'react'
import { Baby, Clock } from 'lucide-react'
import { api } from '../lib/api'
import { euros } from '../lib/format'
import { situationVersMenage, type SituationSaisie } from '../lib/state'
import { Bilan, type Res, type Scenario } from './ApresChomage'

const SALARIE = ['salarie', 'apprenti']

export function EtSiSituation({ s, actuel, valeurs }: { s: SituationSaisie; actuel: Res; valeurs: Record<string, unknown> }) {
  const [enfant, setEnfant] = useState<Scenario>({})
  const [partiel, setPartiel] = useState<Scenario>({})
  const iSalarie = s.adultes.findIndex((a) => SALARIE.includes(a.activite) && a.montant_net > 0)
  const enfantPossible = s.adultes.some((a) => a.age < 45 && a.activite !== 'retraite')
  if (iSalarie < 0 && !enfantPossible) return null
  const calculer = async (sit: SituationSaisie, set: (x: Scenario) => void) => {
    set({ loading: true })
    try { set({ res: await api<Res>('/api/simulation/menage', { body: { menage: situationVersMenage(sit), montants: 'net' } }) }) } catch (e: any) { set({ erreur: e.message }) }
  }
  const qui = iSalarie > 0 ? 'votre conjoint(e) passait' : 'vous passiez'
  // montants publiés par Service-public (model/regles/prestations/naissance.yaml), cités sans être calculés par le moteur
  const montant = (id: string) => { const v = valeurs[`prestations.naissance.${id}`]; return typeof v === 'number' ? euros(v, 0) : null }
  const prime = montant('prime_naissance'), arret = montant('prepare_taux_plein'), partiel80 = montant('prepare_partiel_50_80')
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Et si votre situation changeait ?</h3>
      <p className="small ink2" style={{ marginTop: 0 }}>Le budget du foyer dans une autre situation, calculé avec les mêmes règles :</p>
      <div className="stack" style={{ gap: 14 }}>
        {enfantPossible && (
          <div>
            <strong><Baby size={16} /> Avec un enfant de plus</strong>
            {!enfant.res && !enfant.loading && <div style={{ marginTop: 6 }}><button className="btn small" onClick={() => calculer({ ...s, enfants: [...s.enfants, 0] }, setEnfant)}>Calculer</button></div>}
            <Bilan sc={enfant} actuel={actuel} />
            {enfant.res && <div className="small muted" style={{ marginTop: 4 }}>Pour un bébé de moins d'un an, sans les frais de garde. Ne sont pas comptés non plus : la prime
              à la naissance{prime && ` (${prime})`}, versée une fois si les revenus sont sous un plafond, et la PreParE, versée par la CAF au parent
              qui arrête de travailler{arret && ` (${arret} par mois)`} ou passe à temps partiel, s'il a assez cotisé.</div>}
          </div>
        )}
        {iSalarie >= 0 && (
          <div>
            <strong><Clock size={16} /> Si {qui} à temps partiel (80 %)</strong>
            {!partiel.res && !partiel.loading && <div style={{ marginTop: 6 }}><button className="btn small"
              onClick={() => calculer({ ...s, adultes: s.adultes.map((a, k) => (k === iSalarie ? { ...a, montant_net: Math.round(a.montant_net * 0.8) } : a)) }, setPartiel)}>Calculer</button></div>}
            <Bilan sc={partiel} actuel={actuel} />
            {partiel.res && <div className="small muted" style={{ marginTop: 4 }}>Salaire réduit d'un cinquième. Les aides suivent avec retard : trois mois
              pour le RSA et la prime d'activité, deux ans pour la PAJE (la CAF regarde les revenus d'il y a deux ans).
              {s.enfants.some((e) => e >= 0 && e < 3) && <> Avec un enfant de moins de 3 ans, la CAF peut aussi verser la PreParE (prestation partagée
              d'éducation de l'enfant){partiel80 && ` : ${partiel80} par mois à temps partiel entre 50 et 80 %`}, si vous avez assez cotisé ; elle n'est pas comptée ici.</>}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
