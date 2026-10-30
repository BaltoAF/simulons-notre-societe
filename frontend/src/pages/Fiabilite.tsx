// « Nos chiffres face aux chiffrages officiels » : les mêmes réformes, chiffrées par des institutions publiques
// (Cour des comptes, COR, DG Trésor, lois de finances…) et par le site. Les écarts sont publiés, pas cachés.
import { Link } from 'react-router-dom'
import { CheckCircle2, CircleAlert, CircleDot, ExternalLink } from 'lucide-react'
import { date, natureLien, nombre } from '../lib/format'
import { useEffect } from 'react'
import { useApp, useFetch } from '../lib/state'
import { ErrorBox, Loading } from '../components/ui'

type Resultat = { simule_md: number; officiel_md: number; ecart_md: number; ecart_pct: number | null; verdict: 'concordant' | 'proche' | 'ecart'; erreur?: string }
type Reference = {
  id: string; reforme: string; valeur_md: number; fourchette_md: [number, number] | null; perimetre: string; annee: number
  citation?: string; note?: string; domaine?: string; comparabilite?: 'bonne' | 'moyenne'
  source: { id: string; titre?: string; editeur?: string; url?: string }
  resultat: Resultat | null
}
type Vue = { genere_le: string | null; references: Reference[]; bilan: Record<'concordant' | 'proche' | 'ecart', number> }

const VERDICT = {
  concordant: { txt: 'Concordant', cls: 'gain', Icone: CheckCircle2, aide: "moins de 15 % d'écart, ou moins de 0,2 milliard d'écart (petites mesures), ou dans la fourchette officielle" },
  proche: { txt: 'Proche', cls: 'warn', Icone: CircleDot, aide: 'entre 15 et 35 % d\'écart' },
  ecart: { txt: 'Écart', cls: 'loss', Icone: CircleAlert, aide: 'plus de 35 % d\'écart, ou pas le même sens' },
}
// pourquoi un verdict « concordant » malgré un pourcentage élevé : le dire, sinon on croit à une règle arrangée
function res_raison(r: Reference): string {
  const res = r.resultat
  if (!res || res.verdict !== 'concordant') return ''
  if (r.fourchette_md) {
    const [bas, haut] = [...r.fourchette_md].sort((a, b) => a - b)
    const marge = 0.1 * Math.max(Math.abs(bas), Math.abs(haut))
    if (res.simule_md >= bas - marge && res.simule_md <= haut + marge) return ' Concordant : dans la fourchette officielle.'
  }
  if (Math.abs(res.simule_md - res.officiel_md) <= 0.2) return " Concordant : moins de 0,2 milliard d'écart."
  return ''
}

const PERIMETRE: Record<string, string> = {
  statique: 'à comportements inchangés', avec_comportements: 'en tenant compte des réactions', constate: 'constaté après coup',
}

/** « Rapporte 7,2 milliards € » / « Coûte 13,5 milliards € » */
const montant = (v: number) => `${v >= 0 ? 'Rapporte' : 'Coûte'} ${nombre(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)} milliard${Math.abs(v) >= 2 ? 's' : ''} €`

export default function Fiabilite() {
  const { data, loading, error } = useFetch<Vue>('/api/etalonnage')
  const { marquer } = useApp()
  useEffect(() => { marquer('source') }, [marquer])
  if (loading) return <div className="container page"><Loading /></div>
  if (error || !data) return <div className="container page"><ErrorBox message={error ?? 'Indisponible'} /></div>
  const faits = data.references.filter((r) => r.resultat && !r.resultat.erreur)
  return (
    <div className="container page" style={{ maxWidth: 980 }}>
      <h1>Nos chiffres face aux chiffrages officiels</h1>
      <p className="lead ink2">Pour savoir si le site calcule juste, on lui fait chiffrer des réformes que des institutions publiques ont déjà chiffrées
        (Cour des comptes, Conseil d'orientation des retraites, ministère des Finances…), et on compare. Les écarts sont publiés, pas cachés.</p>

      {faits.length > 0 && (
        <div className="grid cols-3" style={{ marginBottom: 18 }}>
          {(['concordant', 'proche', 'ecart'] as const).map((v) => {
            const { txt, cls, Icone, aide } = VERDICT[v]
            return (
              <div key={v} className="card">
                <div className="kpi-label"><Icone size={15} /> {txt}</div>
                <div className={`kpi delta ${cls === 'gain' ? 'pos' : cls === 'loss' ? 'neg' : ''}`}>{data.bilan[v] ?? 0}</div>
                <div className="small muted">{aide}</div>
              </div>
            )
          })}
        </div>
      )}

      <div className="stack">
        {data.references.map((r) => {
          const v = r.resultat && !r.resultat.erreur ? VERDICT[r.resultat.verdict] : null
          return (
            <div key={r.id} className="card">
              <div className="row between top" style={{ flexWrap: 'nowrap', gap: 10 }}>
                <strong>{r.reforme}</strong>
                {v && <span className={`badge ${v.cls}`} style={{ whiteSpace: 'nowrap' }}><v.Icone size={13} /> {v.txt}</span>}
              </div>
              <div className="grid cols-2" style={{ marginTop: 10 }}>
                <div>
                  <div className="kpi-label">Chiffrage officiel ({r.annee})</div>
                  <div style={{ fontWeight: 700 }}>{montant(r.valeur_md)} par an</div>
                  {r.fourchette_md && <div className="small muted">fourchette : {nombre(r.fourchette_md[0], 1)} à {nombre(r.fourchette_md[1], 1)} milliards €</div>}
                  <div className="small muted">{PERIMETRE[r.perimetre] ?? r.perimetre}</div>
                </div>
                <div>
                  <div className="kpi-label">Calcul du site</div>
                  {r.resultat?.erreur ? <div className="small muted">Pas encore rejoué.</div>
                    : r.resultat ? <>
                      <div style={{ fontWeight: 700 }}>{montant(r.resultat.simule_md)} par an</div>
                      {/* en mots : « le site trouve 1,2 milliard de plus » (un signe seul se lisait à l'envers pour un coût) */}
                      <div className="small muted">{(() => {
                        const res = r.resultat!, d = Math.abs(res.simule_md) - Math.abs(res.officiel_md)
                        const md = `${nombre(Math.abs(d), 1)} milliard${Math.abs(d) >= 2 ? 's' : ''} €`
                        const pct = res.ecart_pct != null ? ` (${nombre(Math.abs(res.ecart_pct), 0)} %)` : ''
                        return Math.abs(d) < 0.05 ? "Même montant que le chiffrage officiel." : `Le site trouve ${md}${pct} ${d > 0 ? 'de plus' : 'de moins'} que le chiffrage officiel.`
                      })()}
                        {res_raison(r)}</div>
                    </> : <div className="small muted">Pas encore rejoué.</div>}
                </div>
              </div>
              {r.comparabilite === 'moyenne' && <div className="small" style={{ marginTop: 8 }}><span className="badge">Comparaison approchée</span>{' '}
                <span className="muted">la réforme officielle portait sur une autre année ou un champ un peu différent : un écart peut s'expliquer par là.</span></div>}
              {r.note && <p className="small ink2" style={{ margin: '8px 0 0' }}>{r.note}</p>}
              <div className="small muted" style={{ marginTop: 6 }}>
                Source : {r.source.url ? <a href={r.source.url} target="_blank" rel="noreferrer">{r.source.editeur ? `${r.source.editeur}, ` : ''}{r.source.titre ?? r.source.id}{natureLien(r.source.url)} <ExternalLink size={12} /></a>
                  : `${r.source.editeur ?? ''} ${r.source.titre ?? r.source.id}`}
                {r.citation && <> — « {r.citation} »</>}
              </div>
            </div>
          )
        })}
      </div>

      <details className="card soft small curieux" style={{ marginTop: 18 }}>
        <summary>Comment la comparaison est faite</summary>
        <p>Chaque réforme est décrite par les règles qu'elle change, puis rejouée par le moteur sur la population simulée. Pour un chiffrage officiel
          « à comportements inchangés » (le plus courant, celui des lois de finances), on compare avec l'effet direct calculé par le site ; pour un chiffrage
          qui tient compte des réactions (emploi, consommation), avec l'effet total. Les chiffrages officiels portent parfois sur une autre année ou un
          champ un peu différent : la note de chaque ligne le précise.</p>
        <p>Le Système rejoue ce banc d'essai à chaque changement du moteur de calcul ou de la population.{data.genere_le && <> Dernière comparaison : {date(data.genere_le)}.</>}{' '}
          Voir aussi <Link to="/methode">la méthode</Link>.</p>
      </details>
    </div>
  )
}
