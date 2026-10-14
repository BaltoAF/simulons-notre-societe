import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Calculator, Cpu, FileCode2, GitFork } from 'lucide-react'
import type { RegleDetail as RD, Tranche } from '../lib/api'
import { date, DOMAINE_TITRE, nombre, valeur } from '../lib/format'
import { useApp, useFetch } from '../lib/state'
import { ConfidenceBadge, ErrorBox, Loading, SourceItem } from '../components/ui'
import { Pourquoi, Terme } from '../components/Terme'
import { infoMission } from '../lib/missions'

// « CSS, art. L161-17-2 » → « Code de la sécurité sociale, art. L161-17-2 »
const CODES: Record<string, string> = { CSS: 'Code de la sécurité sociale', CGI: 'Code général des impôts', CT: 'Code du travail',
  CASF: "Code de l'action sociale et des familles", CCH: "Code de la construction et de l'habitation", CP: 'Code pénal',
  CPP: 'Code de procédure pénale', CSP: 'Code de la santé publique', CE: "Code de l'environnement" }
const codesEnClair = (t: string) => t.replace(/\b(CSS|CGI|CASF|CCH|CPP|CSP|CT|CP|CE)\b/g, (m) => CODES[m] ?? m)

function Bareme({ t }: { t: Tranche[] }) {
  const rows = [...t].sort((a, b) => a.seuil - b.seuil)
  return (
    <table className="table" style={{ maxWidth: 520 }}>
      <thead><tr><th>Tranche de revenu (par part)</th><th className="num">Taux</th></tr></thead>
      <tbody>{rows.map((r, i) => (
        <tr key={i}><td>{i < rows.length - 1 ? `de ${nombre(r.seuil, 0)} € à ${nombre(rows[i + 1].seuil, 0)} €` : `au-delà de ${nombre(r.seuil, 0)} €`}</td><td className="num"><strong>{nombre(r.taux, 2)} %</strong></td></tr>
      ))}</tbody>
    </table>
  )
}

export default function RegleDetail() {
  const { id } = useParams()
  const { data: r, loading, error } = useFetch<RD>(`/api/regles/${id}`)
  const { setDraft } = useApp()
  const nav = useNavigate()
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !r) return <div className="container page"><ErrorBox message={error ?? 'Introuvable'} /></div>
  const srcById = Object.fromEntries(r.sources.map((s) => [s.id, s]))
  const tester = () => {
    setDraft((d) => ({ ...d, overrides: { ...d.overrides, [r.id]: r.valeur } }))
    nav('/atelier')
  }
  const hist = [...r.valeurs].reverse()
  const mission = r.id.startsWith('budget.etat.mission.') ? infoMission(r.id, r.titre) : null
  return (
    <div className="container page">
      <div className="breadcrumb"><Link to="/regles">Les règles</Link> › <Link to={`/regles/d/${r.domaine}`}>{DOMAINE_TITRE[r.domaine] ?? r.domaine}</Link> › {r.theme}</div>
      <div className="split aside-360">
        <div className="stack">
          <div className="card">
            {mission ? <>
              {/* un domaine du budget de l'État : d'abord en clair, le vocabulaire budgétaire ensuite, replié */}
              <h1 style={{ fontSize: '1.8rem' }}>Budget de l'État : {mission.nom}</h1>
              <p className="ink2" style={{ fontSize: '1.05rem' }}>{mission.description ? <>L'argent que l'État consacre chaque année à : {mission.description.charAt(0).toLowerCase() + mission.description.slice(1)}.</> : <>Un des grands domaines du budget de l'État.</>}</p>
              {mission.verrou && <div className="notice small" style={{ marginBottom: 12 }}><div><strong>Dépense obligatoire.</strong> {mission.verrou}</div></div>}
              <details className="curieux small" style={{ marginBottom: 12 }}><summary>Le détail budgétaire</summary><p className="ink2">{r.explication}</p></details>
            </> : <>
              <h1 style={{ fontSize: '1.8rem' }}>{r.titre}</h1>
              <p className="ink2" style={{ fontSize: '1.05rem' }}>{r.explication}</p>
            </>}
            <div className="kpi-label">Valeur en vigueur{r.valeur_depuis ? ` depuis le ${date(r.valeur_depuis)}` : ''}</div>
            {r.type === 'bareme' && Array.isArray(r.valeur) ? <>
              <Bareme t={r.valeur as Tranche[]} />
              <Pourquoi titre="Comment lire ce barème ?">Chaque taux ne s'applique qu'à la partie du revenu comprise dans sa tranche. Exemple : passer dans une tranche supérieure ne fait pas payer plus sur tout le revenu, seulement sur ce qui dépasse le seuil.</Pourquoi>
            </> : <div className="value-big">{valeur(r.valeur, r.unite, r.type)}</div>}
            {r.article && <div className="small muted" style={{ marginTop: 4 }}>{codesEnClair(r.article)}</div>}
            {r.prochaine_valeur && <div className="notice" style={{ marginTop: 12 }}>Évolution déjà prévue : {valeur(r.prochaine_valeur.valeur, r.unite, r.type)} à partir du {date(r.prochaine_valeur.depuis)}.</div>}
            {r.a_verifier && <div className="notice warn" style={{ marginTop: 12 }}><AlertTriangle size={18} /> Cette valeur n'a pas encore pu être confirmée sur une source officielle.</div>}
            {(r.controles ?? []).map((c, i) => (
              <div key={i} className={`notice ${c.concordant ? 'ok' : 'warn'}`} style={{ marginTop: 12 }}>
                {c.concordant ? <BadgeCheck size={18} /> : <AlertTriangle size={18} />}
                <div>{c.concordant ? 'Valeur confirmée par une seconde source indépendante' : 'Désaccord entre deux sources'} : {c.autre_source} donne {valeur(c.autre_valeur, r.unite, r.type)}.</div>
              </div>
            ))}
            {r.note && (mission
              ? <details className="curieux small" style={{ marginTop: 12 }}><summary>Notes techniques</summary><p className="muted">{r.note}</p></details>
              : <p className="small muted" style={{ marginTop: 12 }}>{r.note}</p>)}
            {r.virtuel && <div className="notice" style={{ marginTop: 12 }}>Ce dispositif n'existe pas aujourd'hui : il est proposé pour que chacun puisse l'essayer dans sa proposition et en mesurer les effets.</div>}
          </div>

          <div className="card">
            <h3>D'où vient cette valeur ?</h3>
            <p className="small muted">Les textes officiels qui la fixent : cliquez pour les consulter.</p>
            {r.sources.length ? <ul className="list">{r.sources.map((s) => <SourceItem key={s.id} s={s} />)}</ul> : <div className="small muted">Aucune source (dispositif virtuel).</div>}
          </div>

          <div className="card">
            <h3>Comment elle a évolué</h3>
            <ul className="timeline">
              {hist.map((v, i) => (
                <li key={i} className={v.depuis === r.valeur_depuis ? 'current' : ''}>
                  <div className="row between"><strong>{date(v.depuis)}</strong>{v.depuis === r.valeur_depuis && <span className="badge primary">en vigueur</span>}</div>
                  <div>{r.type === 'bareme' && Array.isArray(v.valeur) ? valeur(v.valeur) : valeur(v.valeur, r.unite, r.type)}</div>
                  <div className="small muted">{v.sources.map((s) => srcById[s]?.titre ?? s).filter((x) => x !== 'openfisca-france').slice(0, 2).join(' · ')}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="stack sticky">
          {r.levier && (
            <div className="card">
              <h3><GitFork size={17} /> Et si on la changeait ?</h3>
              <p className="small ink2">{r.simulable ? 'Essayez une autre valeur : le site calculera ce que cela change pour vous, pour les finances publiques et pour le pays.' : 'Vous pouvez essayer une autre valeur. Son effet n\'est pas encore calculé précisément, mais les études disponibles seront affichées.'}</p>
              <button className="btn primary" style={{ width: '100%' }} onClick={tester}><Calculator size={16} /> Essayer une autre valeur</button>
            </div>
          )}
          {r.preuves.length > 0 && (
            <div className="card">
              <h3>Ce que disent les études</h3>
              <p className="small muted" style={{ marginTop: 0 }}>Les effets de cette règle, d'après la recherche. La <Terme id="confiance">confiance</Terme> dit à quel point les études sont solides et d'accord entre elles.</p>
              <ul className="list">
                {r.preuves.map((p) => (
                  <li key={p.id}>
                    <Link to={`/preuves/${p.id}`} style={{ fontWeight: 650 }}>{p.titre}</Link>
                    <div className="row between small" style={{ marginTop: 4 }}>
                      <span className="muted">{p.n_estimations > 1 ? `${p.n_estimations} estimations comparées` : p.n_estimations === 1 ? 'Une seule estimation' : 'Pas encore d\'estimation'}</span>
                      <ConfidenceBadge c={p.confiance} compact align="right" />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details className="card soft small curieux">
            <summary>Pour les curieux : détails techniques</summary>
            <div style={{ marginTop: 8 }}><FileCode2 size={14} /> Fichier : <code>{r.fichier}</code></div>
            {r.moteur && <div style={{ marginTop: 4 }}><Cpu size={14} /> Moteur : paramètre OpenFisca <code>{r.moteur.openfisca}</code></div>}
            {r.verifie_le && <div style={{ marginTop: 4 }}>Valeur confirmée par les mainteneurs d'OpenFisca le {date(r.verifie_le)}.</div>}
            <div style={{ marginTop: 4 }} className="muted">Identifiant : <code>{r.id}</code></div>
          </details>
        </div>
      </div>
    </div>
  )
}
