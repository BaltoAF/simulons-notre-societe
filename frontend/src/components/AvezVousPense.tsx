// « Avez-vous pensé à… ? » : sous le résultat de « Mes droits », les aides souvent oubliées qui correspondent au foyer,
// avec ce qu'elles apportent, comment les demander et la fiche officielle.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ExternalLink, Lightbulb, Users } from 'lucide-react'
import { aidesPourVous, type AideOubliee } from '../lib/aidesOubliees'
import { date, euros } from '../lib/format'
import { useFetch, type SituationSaisie } from '../lib/state'
import { Beta } from './Beta'

type Ligne = { id: string; montant: number; nature: string; libelle?: string }

// pistes que la personne touche déjà ou a déjà demandées (test Odette : la réversion, qu'elle touche, revenait sans cesse) :
// masquées dans ce navigateur seulement
const CLE = 'societe.aides_deja'
const lireDeja = (): string[] => { try { return JSON.parse(localStorage.getItem(CLE) ?? '[]') } catch { return [] } }

export function AvezVousPense({ s, lignes }: { s: SituationSaisie; lignes: Ligne[] }) {
  const { data } = useFetch<{ aides: AideOubliee[] }>('/api/aides-oubliees')
  const [deja, setDeja] = useState<string[]>(lireDeja)
  const marquer = (id: string | null) => {
    const v = id ? [...deja, id] : []
    setDeja(v)
    try { localStorage.setItem(CLE, JSON.stringify(v)) } catch { /* navigation privée */ }
  }
  if (!data) return null
  const toutes = aidesPourVous(data.aides, s, lignes)
  const aides = toutes.filter((a) => a.montant != null || !deja.includes(a.id))
  const masquees = toutes.length - aides.length
  if (!toutes.length) return null
  const pistes = aides.filter((a) => a.montant == null).length
  return (
    <section className="card" id="avez-vous-pense" aria-labelledby="avez-vous-pense-titre">
      <h3 id="avez-vous-pense-titre"><Lightbulb size={19} /> Avez-vous pensé à… ? <Beta /></h3>
      <p className="small muted" style={{ marginTop: 0 }}>Des aides que beaucoup de gens ne demandent pas, alors qu'ils y ont droit. La plupart n'arrivent pas toutes seules : chaque fiche dit s'il faut en faire la demande.</p>
      <ul className="list">
        {aides.map((a) => (
          <li key={a.id} className="aide-oubliee">
            <div className="list-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <strong>{a.libelle}</strong>
              {a.montant != null
                ? <span className="badge gain">Déjà comptée ci-dessus{a.versement === 'annuel' ? ` (${euros(a.montant)} par an)` : ` : ${euros(a.montant)} / mois`}</span>
                : <span className="row" style={{ gap: 8 }}><span className="badge">Piste à vérifier</span>
                    <button className="btn ghost small" onClick={() => marquer(a.id)}>Je l'ai déjà</button></span>}
            </div>
            <p className="small" style={{ margin: '4px 0 0' }}>{a.en_bref}</p>
            <p className="small muted" style={{ margin: '4px 0 0' }}>{a.pourquoi_vous}</p>
            {a.non_recours && <p className="small aide-non-recours"><Users size={14} aria-hidden="true" /> {a.non_recours}</p>}
            {a.rappelVisible && a.rappel && (a.rappel.ton === 'rassurant'
              ? <div className="notice ok small" style={{ marginTop: 8 }}><CheckCircle2 size={16} style={{ flexShrink: 0 }} /> {a.rappel.texte}</div>
              : <div className="notice warn small" style={{ marginTop: 8 }}><AlertCircle size={16} style={{ flexShrink: 0 }} /> {a.rappel.texte}</div>)}
            <details className="explain">
              <summary>Comment la demander</summary>
              <p className="small" style={{ marginTop: 0 }}>{a.ou_la_demander}</p>
              <p className="small"><strong>Ce que ça apporte : </strong>{a.ce_que_ca_apporte}</p>
              {a.pour_qui && <p className="small"><strong>Pour qui : </strong>{a.pour_qui}</p>}
              <div className="small row" style={{ gap: 14 }}>
                <a href={a.url_officielle} target="_blank" rel="noreferrer noopener">La fiche officielle <ExternalLink size={12} /></a>
                {a.source && <Link to={`/sources/${encodeURIComponent(a.source.id)}`}>D'où viennent ces informations</Link>}
                {a.source?.consulte_le && <span className="muted">relevées le {date(a.source.consulte_le)}</span>}
              </div>
            </details>
          </li>
        ))}
      </ul>
      {masquees > 0 && <p className="small muted">{masquees} piste{masquees > 1 ? 's' : ''} que vous avez déjà masquée{masquees > 1 ? 's' : ''}.{' '}
        <button className="lien" onClick={() => marquer(null)}>Tout réafficher</button></p>}
      {pistes > 0 && (
        <p className="small muted" style={{ marginBottom: 0 }}>Les « pistes à vérifier » ne sont pas calculées par le site : elles sont proposées d'après votre profil, avec des revenus estimés.
          Pour en avoir le cœur net, suivez la fiche officielle de chaque aide, ou le simulateur public <a href="https://www.mesdroitssociaux.gouv.fr" target="_blank" rel="noreferrer noopener">mesdroitssociaux.gouv.fr</a>.</p>
      )}
    </section>
  )
}
