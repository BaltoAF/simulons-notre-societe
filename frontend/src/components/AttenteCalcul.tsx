// Attente du calcul de « Mes droits » (une dizaine de secondes) : plutôt qu'un simple sablier, on montre ce que le site
// calcule, étape par étape, et quelques chiffres officiels à lire pendant ce temps (demande du responsable, 02/11/2026).
// Les chiffres viennent des statistiques du site (/api/metriques), avec leur année et leur source : rien n'est écrit en dur.
import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Lightbulb } from 'lucide-react'
import { useFetch } from '../lib/state'
import { nombre } from '../lib/format'

type Stat = { id: string; derniere: { date: string; valeur: number } | null; source: { editeur?: string } | null }

const ETAPES = [
  'Lecture de votre situation',
  'Vos revenus nets : cotisations et CSG retirées',
  "Votre impôt sur le revenu, part par part",
  "Vos aides : prime d'activité, RSA, aides au logement, allocations familiales…",
  'Votre place parmi les Français',
]

const IDS = ['prestations.caf.foyers_allocataires_total', 'prestations.prime_activite.foyers_allocataires', 'prestations.rsa.foyers_allocataires',
  'prestations.aides_logement.foyers_allocataires', 'revenus.niveau_vie.mediane_mensuelle', 'revenus.pauvrete.taux_seuil_60']

const millions = (v: number) => `${nombre(v / 1e6, 1)} millions`

function anecdotes(stats: Stat[]): string[] {
  const v = (id: string) => stats.find((s) => s.id === id)
  const dit = (id: string, f: (x: number) => string) => {
    const s = v(id)
    if (!s?.derniere) return null
    const src = s.source?.editeur ? `${s.source.editeur.replace(/\s*\(.*\)$/, '')}, ${s.derniere.date.slice(0, 4)}` : s.derniere.date.slice(0, 4)
    return `${f(s.derniere.valeur)} (${src}).`
  }
  return [
    dit('revenus.niveau_vie.mediane_mensuelle', (x) => `Une personne sur deux en France a un niveau de vie inférieur à ${nombre(x, 0)} € par mois`),
    dit('prestations.prime_activite.foyers_allocataires', (x) => `${millions(x)} de foyers touchent la prime d'activité, le complément de revenu des travailleurs modestes`),
    dit('prestations.aides_logement.foyers_allocataires', (x) => `${millions(x)} de foyers reçoivent une aide au logement`),
    dit('prestations.rsa.foyers_allocataires', (x) => `${millions(x)} de foyers touchent le RSA`),
    dit('revenus.pauvrete.taux_seuil_60', (x) => `${nombre(x, 1)} % des personnes vivent sous le seuil de pauvreté`),
    dit('prestations.caf.foyers_allocataires_total', (x) => `${millions(x)} de foyers reçoivent au moins une aide de la CAF`),
    'La plupart des aides ne sont versées que si on les demande : le site vous dira où le faire.',
  ].filter((x): x is string => !!x)
}

export function AttenteCalcul({ lent }: { lent: boolean }) {
  const [t, setT] = useState(0) // secondes écoulées
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 0.25), 250)
    return () => window.clearInterval(id)
  }, [])
  const { data } = useFetch<{ metriques: Stat[] }>(`/api/metriques?ids=${IDS.join(',')}`)
  const faits = anecdotes(data?.metriques ?? [])
  // une étape toutes les deux secondes ; la barre approche 95 % vers dix secondes, sans jamais prétendre avoir fini
  const etape = Math.min(ETAPES.length - 1, Math.floor(t / 2))
  const avance = Math.min(95, 100 * (1 - Math.exp(-t / 5)))
  const fait = faits.length ? faits[Math.floor(t / 5) % faits.length] : null
  return (
    <div className="card attente-calcul" role="status" aria-live="polite">
      <h2 style={{ fontSize: '1.2rem', margin: '0 0 10px' }}>Calcul de vos droits…</h2>
      <div className="bar-track" style={{ height: 8 }} aria-hidden><div className="bar-fill attente-barre" style={{ width: `${avance}%` }} /></div>
      <ol className="attente-etapes">
        {ETAPES.map((e, i) => (
          <li key={e} className={i < etape ? 'faite' : i === etape ? 'en-cours' : ''}>
            {i < etape ? <CheckCircle2 size={17} /> : i === etape ? <span className="spinner" style={{ width: 15, height: 15, borderWidth: 2 }} /> : <Circle size={17} />}
            <span>{e}</span>
          </li>
        ))}
      </ol>
      {lent && <p className="small" style={{ margin: '8px 0 0' }}>Le calcul prend plus longtemps que d'habitude : le site vient sans doute d'être mis à jour et
        prépare son moteur de calcul (jusqu'à trois minutes). Merci de patienter, vos réponses sont gardées.</p>}
      {fait && (
        <div className="attente-fait" key={fait}>
          <Lightbulb size={18} aria-hidden />
          <div><strong>Le saviez-vous ?</strong> {fait}</div>
        </div>
      )}
    </div>
  )
}
