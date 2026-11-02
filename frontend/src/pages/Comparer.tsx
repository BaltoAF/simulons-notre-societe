// Comparer deux propositions : ce qu'elles changent, puis leurs effets côte à côte (calculés pour les deux), puis le
// détail règle par règle. Le choix des deux propositions est libre (la loi actuelle comprise).
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, type Changement, type Rapport, type Societe } from '../lib/api'
import { DOMAINE_TITRE, valeur } from '../lib/format'
import { milliards, parMenageMois, phrase, tonnes } from '../lib/humain'
import { resumeSituation, situationVersMenage, useApp, useFetch } from '../lib/state'
import { estTaxeConsommation, ligneMesure } from '../components/DiffSociete'
import { ErrorBox } from '../components/ui'
import { LegendeTableau, TableauDeBord, useRelance } from '../components/TableauDeBord'

type Effets = { rapport: Rapport | null; erreur?: string }

function indicateur(r: Rapport | null, id: string) {
  return r?.bilan.flatMap((p) => p.indicateurs).find((i) => i.id === id || i.id.startsWith(id))
}

/** Une ligne du tableau des effets : le même indicateur, dit en clair, pour chacune des deux propositions. */
const LIGNES: { titre: string; rendu: (r: Rapport | null) => string; foyer?: boolean }[] = [
  {
    titre: "L'argent public", rendu: (r) => {
      const e = r?.equilibres.find((x) => x.id === 'budget')
      if (!e) return '—'
      if (Math.abs(e.effet) < 0.05) return 'Pas d\'effet notable'
      return e.effet > 0 ? `Rapporte ${milliards(e.effet)} par an` : `Coûte ${milliards(Math.abs(e.effet))} par an (environ ${parMenageMois(e.effet)} par mois et par ménage)${e.statut === 'a_compenser' ? ', non financé' : ''}`
    },
  },
  {
    titre: 'Le climat', rendu: (r) => {
      const e = r?.equilibres.find((x) => x.id === 'carbone')
      if (!e || Math.abs(e.effet) < 0.005) return 'Pas d\'effet direct notable'
      return `${e.effet > 0 ? 'Hausse' : 'Baisse'} des émissions : ${tonnes(Math.abs(e.effet))} par an`
    },
  },
  {
    titre: 'Votre porte-monnaie', foyer: true, rendu: (r) => {
      const pv = r?.pour_vous
      if (!pv) return 'Décrivez votre foyer dans « Mes droits » pour le voir'
      return Math.abs(pv.delta_mois) < 0.5 ? 'Rien ne change' : `${pv.delta_mois > 0 ? '+' : '−'}${Math.abs(Math.round(pv.delta_mois))} € par mois`
    },
  },
  { titre: 'La pauvreté', rendu: (r) => { const i = indicateur(r, 'pauvrete'); return i ? phrase(i.id, i.valeur, i.unite) : '—' } },
  { titre: 'Les inégalités', rendu: (r) => { const i = indicateur(r, 'gini'); return i ? phrase(i.id, i.valeur, i.unite) : '—' } },
  {
    titre: 'Gagnants et perdants', foyer: true, rendu: (r) => {
      const i = indicateur(r, 'gagnants')
      return i ? `${Math.round(i.valeur)} % des ménages y gagnent${i.perdants != null ? `, ${Math.round(i.perdants)} % y perdent` : ''}` : '—'
    },
  },
  {
    // court et long terme : deux moments différents, dits séparément
    titre: "L'activité économique", rendu: (r) => {
      const items = r?.bilan.flatMap((p) => p.indicateurs).filter((i) => i.id === 'pib' || i.id === 'pib_long_terme') ?? []
      return items.length ? items.map((i) => phrase(i.id, i.valeur, i.unite)).join(' ') : '—'
    },
  },
]

function mesures(s: Societe | undefined) {
  if (!s) return []
  if (s.reference) return ['La loi telle qu\'elle est aujourd\'hui']
  return (s.mesures ?? []).map(ligneMesure)
}

/** Une hausse de taxe sur le tabac n'est pas comptée foyer par foyer : on le signale à côté du chiffre. */
const horsTaxes = (s: Societe | undefined) => [...(s?.mesures ?? []), ...(s?.financement ?? [])].some((m) => estTaxeConsommation(m.regle))

export default function Comparer() {
  const [p, setP] = useSearchParams()
  const { situation } = useApp()
  const a = p.get('a') ?? 'france', b = p.get('b') ?? ''
  const { data: liste, setData: setListe } = useFetch<{ societes: Societe[] }>('/api/societes?tri=populaire')
  // les chiffres de pilotage des deux propositions sont calculés en arrière-plan : on redemande tant qu'ils ne sont pas prêts
  useRelance(!!liste?.societes.some((x) => (x.id === a || x.id === b) && x.indicateurs?.statut === 'en_calcul'), '/api/societes?tri=populaire', setListe)
  const { data: diff } = useFetch<{ differences: Changement[] }>(a && b ? `/api/comparer?a=${a}&b=${b}` : null)
  const [effets, setEffets] = useState<Record<string, Effets>>({})
  const socs = liste?.societes ?? []
  const sa = socs.find((s) => s.id === a), sb = socs.find((s) => s.id === b)

  // effets des deux propositions, calculés en parallèle (avec votre foyer s'il est renseigné)
  useEffect(() => {
    if (!a || !b) return
    setEffets({})
    const menage = situation ? situationVersMenage(situation) : null
    for (const id of [a, b]) {
      api<Rapport>('/api/simulation/reforme', { body: { societe: id, menage, montants: 'net' } })
        .then((r) => setEffets((e) => ({ ...e, [id]: { rapport: r } })))
        .catch((x) => setEffets((e) => ({ ...e, [id]: { rapport: null, erreur: x.message } })))
    }
  }, [a, b, situation])

  const choisir = (cle: 'a' | 'b', v: string) => { p.set(cle, v); setP(p, { replace: true }) }
  const missions = (diff?.differences ?? []).filter((d) => d.regle.startsWith('budget.etat.mission.'))
  const autres = (diff?.differences ?? []).filter((d) => !d.regle.startsWith('budget.etat.mission.'))
  const enCours = a && b && (!effets[a] || !effets[b])

  return (
    <div className="container page">
      <h1>Comparer deux propositions</h1>
      <div className="grid cols-2" style={{ marginBottom: 18 }}>
        {(['a', 'b'] as const).map((cle) => (
          <label key={cle} className="field"><span>{cle === 'a' ? 'Première proposition' : 'Deuxième proposition'}</span>
            <select value={cle === 'a' ? a : b} onChange={(e) => choisir(cle, e.target.value)}>
              {cle === 'b' && !b && <option value="">Choisir…</option>}
              {socs.map((s) => <option key={s.id} value={s.id}>{s.nom}</option>)}
            </select>
          </label>
        ))}
      </div>
      {!b ? <div className="card soft">Choisissez la deuxième proposition à comparer.</div> : a === b ? <ErrorBox message="Choisissez deux propositions différentes." />
        // adresse ancienne ou proposition supprimée : le dire, plutôt qu'une comparaison vide (« aucune règle changée »)
        : liste && (!sa || !sb) ? <ErrorBox message="Une des deux propositions est introuvable (supprimée, ou adresse erronée) : choisissez-en une autre dans les listes ci-dessus." /> : (
        <div className="stack">
          {/* les chiffres d'abord (demande du responsable, 01/11/2026) : les cinq tuiles de chaque proposition, côte à côte */}
          <div className="card">
            <h2 style={{ fontSize: '1.25rem' }}>En chiffres</h2>
            <LegendeTableau />
            <div className="grid cols-2 bord-comparaison">
              {[sa, sb].map((s, k) => (
                <div key={k}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{s?.nom ?? (liste ? 'Proposition introuvable' : '…')}</div>
                  {/* liste pas encore chargée : un indicateur d'attente, et non « aucune règle changée » */}
                  {s ? <TableauDeBord ind={s.indicateurs} compact />
                    : liste ? <div className="small muted">Proposition introuvable : choisissez-en une dans la liste ci-dessus.</div>
                      : <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} aria-label="Chargement" />}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h2 style={{ fontSize: '1.25rem' }}>Ce qu'elles changent</h2>
            <div className="grid cols-2">
              {[sa, sb].map((s, k) => (
                <div key={k}>
                  <Link to={`/societes/${s?.id ?? ''}`} style={{ fontWeight: 700 }}>{s?.nom ?? '…'}</Link>
                  <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{mesures(s).map((m) => <li key={m}>{m}</li>)}</ul>
                  {(s?.financement ?? []).length > 0 && (
                    <div className="small" style={{ marginTop: 6 }}>
                      <span className="muted">Pour l'équilibrer (financement, climat) :</span>
                      <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>{s!.financement!.map((m) => <li key={m.regle + (m.ajuste ? '#' : '')}>{ligneMesure(m)}</li>)}</ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1.25rem' }}>Leurs effets</h2>
            {enCours && <p className="small muted">Calcul des effets des deux propositions (jusqu'à une minute)…</p>}
            <div className="table-wrap">
              <table className="table comparaison">
                <thead><tr><th></th><th>{sa?.nom ?? '…'}</th><th>{sb?.nom ?? '…'}</th></tr></thead>
                <tbody>
                  {LIGNES.map((l) => (
                    <tr key={l.titre}>
                      <th scope="row">{l.titre}</th>
                      {[[a, sa], [b, sb]].map(([id, s]) => (
                        <td key={id as string} data-label={(s as Societe | undefined)?.nom ?? ''}>{effets[id as string]
                          ? (effets[id as string].erreur ? <span className="muted">indisponible</span>
                            : <>{l.rendu(effets[id as string].rapport)}{l.foyer && horsTaxes(s as Societe | undefined) && (l.titre !== 'Votre porte-monnaie' || effets[id as string].rapport?.pour_vous) && ' *'}</>)
                          : <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(horsTaxes(sa) || horsTaxes(sb)) && <p className="small muted">* Sans compter la hausse ou la baisse des taxes sur le tabac : seule une minorité de ménages fume, elle n'est donc pas répartie foyer par foyer (celles de la TVA, des carburants, du chauffage et de l'électricité le sont).</p>}
            {situation && <p className="small muted">« Votre porte-monnaie » : calculé pour {resumeSituation(situation)} (<Link to="/mes-droits">modifier</Link>).</p>}
            <p className="small muted" style={{ marginBottom: 0 }}>Le détail et la fiabilité de chaque chiffre sont sur la page de chaque proposition, onglet « Ses effets ».</p>
          </div>

          <details className="card curieux">
            <summary>Le détail règle par règle ({diff ? autres.length + (missions.length ? 1 : 0) : '…'})</summary>
            <div className="table-wrap" style={{ marginTop: 10 }}>
              <table className="table">
                <thead><tr><th>Règle</th><th>{sa?.nom ?? 'Première'}</th><th>{sb?.nom ?? 'Deuxième'}</th></tr></thead>
                <tbody>
                  {missions.length > 0 && (
                    // les domaines du budget de l'État : une seule ligne, le total (le détail est sur la page de chaque proposition)
                    <tr>
                      <td><strong>Budget de l'État</strong><div className="small muted">{missions.length} domaines différents</div></td>
                      <td>{valeur(missions.reduce((x, d) => x + Number(d.avant), 0), 'milliards_euros')}</td>
                      <td>{valeur(missions.reduce((x, d) => x + Number(d.apres), 0), 'milliards_euros')}</td>
                    </tr>
                  )}
                  {autres.map((d) => (
                    <tr key={d.regle}>
                      <td><Link to={`/regles/r/${d.regle}`}>{d.titre ?? d.regle}</Link><div className="small muted">{d.domaine ? DOMAINE_TITRE[d.domaine] : ''}</div></td>
                      <td>{valeur(d.avant, d.unite, d.type)}</td>
                      <td>{valeur(d.apres, d.unite, d.type)}</td>
                    </tr>
                  ))}
                  {diff && diff.differences.length === 0 && <tr><td colSpan={3} className="muted">Ces deux propositions sont identiques.</td></tr>}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  )
}
