// « Votre découverte » : quatre missions concrètes pour prendre le site en main, cochées toutes seules quand on les fait.
import { Link } from 'react-router-dom'
import { BadgeCheck, Calculator, CheckCircle2, Circle, GitFork, HelpCircle, PartyPopper, X } from 'lucide-react'
import { useApp, type EtapeParcours } from '../lib/state'

export const MISSIONS: { id: EtapeParcours; titre: string; detail: string; lien: string; Icone: typeof Calculator }[] = [
  { id: 'droits', titre: 'Voir ce que la loi vous donne', detail: 'Vos aides, vos impôts, ce qui vous reste chaque mois : environ une minute.', lien: '/mes-droits', Icone: Calculator },
  { id: 'question', titre: 'Comprendre une grande question', detail: "Où va l'argent public ? La dette, c'est grave ? Les retraites ?", lien: '/comprendre', Icone: HelpCircle },
  { id: 'idee', titre: 'Tester une idée de réforme', detail: 'Changez une règle et voyez ce que cela change, pour vous et pour le pays.', lien: '/atelier', Icone: GitFork },
  { id: 'source', titre: "Vérifier d'où vient un chiffre", detail: 'Ouvrez une règle : le texte de loi, son historique, sa fiabilité.', lien: '/regles/r/travail.smic.horaire_brut', Icone: BadgeCheck },
]

/** La règle à vérifier : une qui concerne le visiteur s'il a décrit son foyer (la CSG de sa pension, sa prime d'activité…). */
function regleQuiVousConcerne(activites: string[]): string {
  if (activites.includes('retraite')) return '/regles/r/fiscalite.csg.retraites_taux_plein'
  if (activites.includes('salarie')) return '/regles/r/prestations.prime_activite.montant_forfaitaire'
  if (activites.includes('chomeur')) return '/regles/r/travail.chomage.taux_remplacement'
  return '/regles/r/travail.smic.horaire_brut'
}

export function ParcoursDecouverte() {
  const { parcours, setParcours, situation } = useApp()
  const lien = (m: (typeof MISSIONS)[number]) => (m.id === 'source' ? regleQuiVousConcerne((situation?.adultes ?? []).map((a) => a.activite)) : m.lien)
  if (parcours.masque) return null
  const faites = MISSIONS.filter((m) => parcours.faites.includes(m.id)).length
  const suivante = MISSIONS.find((m) => !parcours.faites.includes(m.id))
  const fini = faites === MISSIONS.length
  return (
    <section className="card parcours" aria-labelledby="parcours-titre">
      <div className="row between" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
        <div>
          <h2 id="parcours-titre" style={{ margin: 0, fontSize: '1.25rem' }}>{fini ? <><PartyPopper size={20} /> Bravo, vous avez fait le tour !</> : 'Votre découverte, pas à pas'}</h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>{fini
            ? 'Vous savez maintenant tout ce qu\'il faut pour explorer le site. Vous pouvez masquer ce guide.'
            : `${faites} sur ${MISSIONS.length} faites. Chaque étape se coche toute seule quand vous la faites.`}</p>
        </div>
        <button className="btn ghost small" onClick={() => setParcours((p) => ({ ...p, masque: true }))} aria-label="Masquer le guide de découverte"><X size={15} /> Masquer</button>
      </div>
      <div className="barre-progres" role="progressbar" aria-valuemin={0} aria-valuemax={MISSIONS.length} aria-valuenow={faites} aria-label="Progression de la découverte">
        <span style={{ width: `${(faites / MISSIONS.length) * 100}%` }} />
      </div>
      <ol className="missions">
        {MISSIONS.map((m, k) => {
          const faite = parcours.faites.includes(m.id)
          const active = m === suivante
          return (
            <li key={m.id} className={faite ? 'faite' : active ? 'active' : ''}>
              <Link to={lien(m)} className="mission">
                <span className="mission-etat" aria-hidden="true">{faite ? <CheckCircle2 size={20} /> : <Circle size={20} />}</span>
                <span className="grow">
                  <strong>{k + 1}. {m.titre}</strong>{faite && <span className="sr-only"> (fait)</span>}
                  <span className="small muted" style={{ display: 'block' }}>{m.detail}</span>
                </span>
                {active && <span className="badge primary">À faire</span>}
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/** En bas d'une page liée à une mission : « étape faite, voici la suivante », tant que le parcours n'est pas masqué. */
export function ProchaineEtape({ apres }: { apres: EtapeParcours }) {
  const { parcours, setParcours } = useApp()
  // le message final ne s'affiche que sur la page de la dernière mission faite
  const derniere = parcours.faites[parcours.faites.length - 1]
  const suivante = MISSIONS.find((m) => !parcours.faites.includes(m.id))
  if (parcours.masque || !parcours.faites.includes(apres) || (!suivante && derniere !== apres)) return null
  const faites = MISSIONS.filter((m) => parcours.faites.includes(m.id)).length
  return (
    <div className="notice ok prochaine-etape" role="status">
      <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
      <div className="grow">
        {suivante ? <>
          <strong>Étape faite ({faites} sur {MISSIONS.length}).</strong> Prochaine étape de votre découverte :{' '}
          <Link to={suivante.lien}>{suivante.titre} →</Link>
        </> : <><strong>Bravo, vous avez fait le tour du site !</strong> Vous savez maintenant voir vos droits, comprendre une question, tester une idée et vérifier un chiffre.</>}
      </div>
      <button className="btn ghost small" onClick={() => setParcours((p) => ({ ...p, masque: true }))}>Ne plus afficher</button>
    </div>
  )
}
