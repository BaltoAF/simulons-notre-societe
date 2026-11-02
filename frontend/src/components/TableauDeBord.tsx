// Le tableau de bord d'une proposition : cinq indicateurs, toujours les mêmes, dans le même ordre, avec leur fiabilité.
// Les chiffres sont calculés en arrière-plan par le serveur (une simulation complète prend une minute) puis gardés :
// tant qu'ils ne sont pas prêts, chaque tuile l'indique discrètement.
import { useEffect } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api, type IndicateursCles, type Sens, type ValeurIndicateur } from '../lib/api'
import { nombre } from '../lib/format'
import { ConfidenceBadge } from './ui'

type Def = { id: string; libelle: string; libelleRef?: string; effet: (v: number) => [string, string]; ref?: (v: number) => [string, string] }

const s = (v: number, txt: string) => (v > 0 ? '+' : v < 0 ? '−' : '') + txt
const md = (v: number) => nombre(Math.abs(v), Math.abs(v) < 10 ? 1 : 0)

// valeur affichée, puis unité (courte, sous la valeur)
export const TUILES: Def[] = [
  { id: 'finances', libelle: 'Argent public', libelleRef: 'Solde public',
    effet: (v) => [s(v, md(v)), 'Md€ par an'], ref: (v) => [s(v, md(v)), 'Md€ par an'] },
  // effet moyen par ménage, taxes sur les achats comprises ; gagnants et perdants dessous (la part de gagnants seule cache les pertes)
  { id: 'menages', libelle: "Pouvoir d'achat", libelleRef: 'Ménages',
    effet: (v) => [Math.abs(v) < 0.5 ? '0' : s(v, nombre(Math.abs(v), 0)) + ' €', 'par ménage et par mois'] },
  { id: 'pauvrete', libelle: 'Taux de pauvreté',
    effet: (v) => [Math.abs(v) < 0.005 ? '0' : s(v, nombre(Math.abs(v), 2)), 'point'], ref: (v) => [`${nombre(v, 1)} %`, 'des personnes'] },
  { id: 'emploi', libelle: 'Emploi', libelleRef: 'Chômage',
    // toujours en milliers : la même unité d'une carte à l'autre, et un chiffre qui tient dans la tuile
    effet: (v) => [Math.abs(v) < 50 ? '0' : s(v, nombre(Math.abs(v) / 1000, Math.abs(v) < 10000 ? 1 : 0)), "milliers d'emplois"], ref: (v) => [`${nombre(v, 1)} %`, 'des actifs'] },
  { id: 'climat', libelle: 'Émissions', libelleRef: 'Émissions',
    effet: (v) => [s(v, nombre(Math.abs(v), Math.abs(v) < 1 ? 2 : 1)), 'Mt CO₂ par an'], ref: (v) => [nombre(v, 0), 'Mt CO₂ par an'] },
]

const SENS_TXT: Record<Sens, string> = { favorable: 'effet favorable', defavorable: 'effet défavorable', neutre: 'effet faible ou nul' }

function Tuile({ d, v, statut }: { d: Def; v?: ValeurIndicateur; statut: IndicateursCles['statut'] }) {
  const reference = statut === 'reference'
  const libelle = reference ? d.libelleRef ?? d.libelle : d.libelle
  if (statut === 'en_calcul') {
    return <div className="tuile attente" aria-label={`${libelle} : calcul en cours`}>
      <span className="tuile-libelle">{libelle}</span><span className="tuile-valeur muted">…</span><span className="tuile-unite">en calcul</span></div>
  }
  if (reference && d.id === 'menages') {
    return <div className="tuile vide"><span className="tuile-libelle">{libelle}</span>
      <span className="tuile-valeur nc">—</span><span className="tuile-unite">point de départ</span></div>
  }
  const val = v?.valeur
  const fmt = val === null || val === undefined ? null : reference ? d.ref?.(val) : d.effet(val)
  if (!fmt) {
    return <div className="tuile vide" aria-label={`${libelle} : non chiffré`}>
      <span className="tuile-libelle">{libelle}</span><span className="tuile-valeur nc">non chiffré</span><span className="tuile-unite">&nbsp;</span></div>
  }
  const sens: Sens = reference ? 'neutre' : v?.sens ?? 'neutre'
  const Fleche = reference || v?.incertain || Math.abs(val!) < 1e-9 || fmt[0] === '0' ? null : val! > 0 ? ArrowUp : ArrowDown
  const parts = d.id === 'menages' && v?.gagnants != null && v?.perdants != null
    ? `gagnants ${nombre(v.gagnants, 0)} % · perdants ${nombre(v.perdants, 0)} %` : null
  // fourchette des études, dans la même unité que la valeur ; si elle contient zéro, le sens de l'effet n'est pas établi
  const bornes = !reference && v?.fourchette ? v.fourchette.map((x) => d.effet(x)[0]) : null
  const plage = bornes ? `${v?.incertain ? 'effet incertain : ' : ''}de ${bornes[0]} à ${bornes[1]}` : null
  const unite = [parts ? `${fmt[1]} ; ${parts}` : fmt[1], plage].filter(Boolean).join(' · ')
  return (
    <div className={`tuile ${sens}`} title={reference ? `Chiffre officiel${v?.annee ? ` (${v.annee})` : ''}` : v?.incertain ? "Les études ne s'accordent pas même sur le sens de l'effet" : SENS_TXT[sens]}>
      <span className="tuile-libelle">{libelle}</span>
      <span className="tuile-valeur">{Fleche && <Fleche size={16} strokeWidth={2.6} aria-hidden />}{fmt[0]}
        {!reference && <span className="sr-only"> ({SENS_TXT[sens]})</span>}</span>
      <span className="tuile-unite">{unite}{reference && v?.annee ? ` · ${v.annee}` : ''}</span>
      {!reference && v?.confiance && <span className="tuile-conf"><ConfidenceBadge c={v.confiance} compact /></span>}
    </div>
  )
}

/** Les cinq tuiles. `compact` : dans une carte de la liste. */
export function TableauDeBord({ ind, compact = false }: { ind?: IndicateursCles | null; compact?: boolean }) {
  if (!ind || ind.statut === 'aucun_changement') {
    return <div className="small muted">Aucune règle changée par rapport à la loi actuelle : mêmes chiffres qu'aujourd'hui.</div>
  }
  const statut = ind.statut === 'erreur' ? 'pret' : ind.statut
  return (
    <div className={`tableau-bord ${compact ? 'compact' : ''}`} role="list" aria-label={ind.statut === 'reference' ? "La situation aujourd'hui" : 'Indicateurs clés'}>
      {TUILES.map((d) => <div key={d.id} role="listitem" className="tuile-cellule"><Tuile d={d} v={ind.valeurs?.[d.id]} statut={statut} /></div>)}
    </div>
  )
}

/** Tant qu'un calcul est en cours, redemande les chiffres de temps en temps (sans recharger la page). */
export function useRelance(enCalcul: boolean, chemin: string, appliquer: (d: any) => void, delai = 20000) {
  useEffect(() => {
    if (!enCalcul) return
    const t = window.setInterval(() => { api(chemin).then(appliquer).catch(() => undefined) }, delai)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCalcul, chemin])
}

/** Une ligne pour lire les tuiles : de quoi on parle, et ce que disent flèches, couleurs et points. */
export function LegendeTableau() {
  return (
    <p className="legende-tableau small muted">
      Effets estimés par an, par rapport à la loi actuelle.
      <span className="legende-item"><span className="pastille favorable" aria-hidden /> favorable</span>
      <span className="legende-item"><span className="pastille defavorable" aria-hidden /> défavorable</span>
      <span className="legende-item"><span className="conf-mini" aria-hidden>●●○○</span> fiabilité</span>
      <Link to="/methode#confiance">Comment c'est calculé</Link>
    </p>
  )
}
