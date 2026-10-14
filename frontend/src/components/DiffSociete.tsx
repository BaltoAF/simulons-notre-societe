// « Ce qui change par rapport à la loi actuelle » : les différences d'une société avec la Société 1.0,
// regroupées par domaine, avec leur ampleur, leur auteur et leur justification.
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, GitCommit, Quote } from 'lucide-react'
import type { Changement, Mesure, Tranche, Valeur } from '../lib/api'
import { DOMAINE_TITRE, ecartLisible, nombre, relatif, valeur } from '../lib/format'
import { milliards } from '../lib/humain'
import { infoMission } from '../lib/missions'
import { AGE_TERME, estAgeLegal, GENERATIONS, nomGeneration } from '../lib/retraite'
import { Terme } from './Terme'

export type Diff = Changement & {
  pour_equilibrer?: boolean
  lignes?: string[] // lignes de barème à afficher (quand un barème est réparti entre l'idée et l'équilibrage)
  provenance?: { commit: string; auteur: string | null; auteur_systeme: boolean; date: string; message: string; justification: string } | null
  variation_pct?: number | null
  generations?: Diff[] // âge légal : les générations regroupées sous l'âge à terme
}

/** Changement d'un barème dit en clair : « Nouvelle tranche à 50 % au-delà de 250 000 € », « 30 % → 32 % dès 29 579 € ». */
const JUSTIFS_EQUILIBRE = ['Équilibrer la proposition', 'Financer la réforme', 'Compenser les émissions']

export function diffBareme(avant: Valeur | undefined, apres: Valeur | undefined): string[] | null {
  if (!Array.isArray(avant) || !Array.isArray(apres)) return null
  const a = avant as Tranche[], b = apres as Tranche[]
  const out: string[] = []
  for (const t of b) {
    const old = a.find((x) => Math.abs(x.seuil - t.seuil) < 0.5)
    if (!old) out.push(`Nouvelle tranche à ${nombre(t.taux, 1)} % au-delà de ${nombre(t.seuil, 0)} € par part`)
    else if (Math.abs(old.taux - t.taux) > 1e-9) out.push(`Tranche dès ${nombre(t.seuil, 0)} € : ${nombre(old.taux, 1)} % → ${nombre(t.taux, 1)} %`)
  }
  for (const t of a) if (!b.find((x) => Math.abs(x.seuil - t.seuil) < 0.5)) out.push(`Tranche à ${nombre(t.taux, 1)} % dès ${nombre(t.seuil, 0)} € supprimée`)
  return out.length ? out : null
}

/** Les domaines du budget de l'État modifiés, résumés en une ligne : « École +5 milliards · −2,8 % sur 28 autres domaines ». */
function BudgetResume({ items }: { items: Diff[] }) {
  const mv = items.map((c) => ({ c, nom: infoMission(c.regle, c.titre ?? c.regle).nom, d: Number(c.apres) - Number(c.avant), pct: Number(c.apres) / Number(c.avant) - 1 }))
  const total = mv.reduce((a, m) => a + m.d, 0)
  // une baisse (ou hausse) uniforme appliquée à beaucoup de domaines : on la dit en une fois
  const freq: Record<string, number> = {}
  for (const m of mv) freq[(m.pct * 100).toFixed(1)] = (freq[(m.pct * 100).toFixed(1)] ?? 0) + 1
  const [pctCommun, n] = Object.entries(freq).sort((a, b) => b[1] - a[1])[0] ?? ['0', 0]
  const uniforme = n >= 4 ? Number(pctCommun) : null
  // tolérance : les arrondis font varier le pourcentage de quelques dixièmes sur les petits domaines
  const dansUniforme = (m: { pct: number }) => uniforme !== null && Math.abs(m.pct * 100 - uniforme) < 0.25
  const nUniforme = mv.filter(dansUniforme).length
  const autres = mv.filter((m) => !dansUniforme(m)).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
  return (
    <li>
      <strong>Budget de l'État</strong>
      <div className="small" style={{ marginTop: 4 }}>
        {autres.slice(0, 4).map((m) => `${m.nom} ${milliards(m.d, true)}`).join(' · ')}
        {uniforme !== null && <>{autres.length ? ' · ' : ''}{uniforme > 0 ? '+' : '−'}{nombre(Math.abs(uniforme), 1)} % sur {nUniforme}{autres.length ? ' autres' : ''} domaines</>}
      </div>
      <div className="small muted">Au total : {Math.abs(total) < 0.05 ? 'même montant, réparti autrement' : total > 0 ? `${milliards(total)} de dépenses en plus par an` : `${milliards(Math.abs(total))} d'économies par an`}</div>
      <details className="curieux small" style={{ marginTop: 4 }}><summary>Voir les {items.length} domaines</summary>
        <ul className="list small">{mv.sort((a, b) => a.d - b.d).map((m) => <li key={m.c.regle} className="list-row"><Link to={`/regles/r/${m.c.regle}`}>{m.nom}</Link><span>{milliards(m.d, true)}</span></li>)}</ul>
      </details>
    </li>
  )
}

/** Nom court d'une règle pour une liste : « RSA », « CSG sur les revenus d'activité », « TVA ». */
export function nomCourt(titre: string): string {
  return titre.split(' : ')[0].replace(/\s*\([^)]*\)\s*$/, '').trim()
}

// règles dont l'effet sur les prix n'est pas compté foyer par foyer (« votre porte-monnaie », gagnants et perdants)
export const TAXES_CONSOMMATION = ['fiscalite.tva.', 'environnement_energie.accise.', 'sante.tabac.']
export const estTaxeConsommation = (id: string) => TAXES_CONSOMMATION.some((p) => id.startsWith(p))

/** Une mesure d'une proposition en une ligne simple : « RSA : 800 € (aujourd'hui 651,69 €) », « Taxe sur le gazole :
 *  +11 centimes par litre », « Impôt sur le revenu : +1,8 point sur chaque tranche ». */
export function ligneMesure(m: Mesure): string {
  const av = Number(m.avant), ap = Number(m.apres)
  if (m.budget_resume) {
    const pct = av ? ` (${ap > 0 ? '+' : '−'}${nombre(Math.abs(ap / av * 100), 1)} % sur les ministères)` : ''
    return `Budget de l'État : ${ap >= 0 ? `${milliards(ap)} de dépenses en plus` : `${milliards(Math.abs(ap))} d'économies`} par an${pct}`
  }
  if (Array.isArray(m.avant) && Array.isArray(m.apres)) {
    const a = m.avant as Tranche[], b = m.apres as Tranche[]
    if (m.ajuste) {
      // barème relevé pour équilibrer : l'écart de taux, tranche par tranche
      const ecarts = b.map((t) => { const o = a.find((x) => Math.abs(x.seuil - t.seuil) < 0.5); return o ? t.taux - o.taux : null })
        .filter((d): d is number => d !== null && Math.abs(d) > 1e-9)
      if (ecarts.length) {
        const mn = Math.min(...ecarts), mx = Math.max(...ecarts)
        const pt = (d: number) => `${d > 0 ? '+' : '−'}${nombre(Math.abs(d), 1)} point${Math.abs(d) >= 2 ? 's' : ''}`
        return `Impôt sur le revenu : ${Math.abs(mx - mn) < 0.05 ? `${pt(mx)} sur chaque tranche` : `taux relevés de ${pt(mn)} à ${pt(mx)}`}`
      }
    }
    const lignes = diffBareme(m.avant, m.apres) ?? []
    return lignes.sort((x, y) => Number(y.startsWith('Nouvelle')) - Number(x.startsWith('Nouvelle')))[0] ?? nomCourt(m.titre)
  }
  if (m.regle.startsWith('environnement_energie.accise.') && Number.isFinite(av) && Number.isFinite(ap)) {
    // €/hectolitre → centimes par litre, TVA comprise (le prix à la pompe)
    const c = (ap - av) * 1.2
    const carburant = m.regle.includes('gazole') ? 'de gazole' : "d'essence"
    return `Prix du litre ${carburant} : ${c > 0 ? '+' : '−'}${nombre(Math.abs(c), 0)} centime${Math.abs(c) >= 1.5 ? 's' : ''} (taxe relevée)`
  }
  return `${nomCourt(m.titre)} : ${valeur(m.apres, m.unite, m.type)} (aujourd'hui ${valeur(m.avant, m.unite, m.type)})`
}

export function DiffSociete({ items, vide }: { items: Diff[]; vide: string }) {
  if (!items.length) return <div className="small muted">{vide}</div>
  // d'abord l'idée de l'auteur, puis ce qui a été ajouté pour respecter les équilibres (financement, climat)
  const principales: Diff[] = []
  const equilibrage: Diff[] = items.filter((d) => d.pour_equilibrer)
  for (const d of items.filter((x) => !x.pour_equilibrer)) {
    // barème d'abord changé par l'auteur (nouvelle tranche) puis relevé partout pour équilibrer : on sépare les deux
    const lignes = diffBareme(d.avant, d.apres)
    const ajuste = JUSTIFS_EQUILIBRE.includes(d.provenance?.justification ?? '')
    if (lignes && ajuste) {
      const idee = lignes.filter((l) => l.startsWith('Nouvelle tranche') || l.includes('supprimée'))
      const hausse = lignes.filter((l) => !idee.includes(l))
      if (idee.length && hausse.length) {
        principales.push({ ...d, lignes: idee, provenance: null })
        equilibrage.push({ ...d, regle: `${d.regle}#equilibre`, lignes: hausse })
        continue
      }
    }
    principales.push(d)
  }
  return (
    <div>
      <ListeDiff items={principales.length ? principales : items} pastilles vide={vide} />
      {principales.length > 0 && equilibrage.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: '0 0 2px' }}>Ajouté pour l'équilibrer</h4>
          <p className="small muted" style={{ marginTop: 0 }}>Le site exige que toute proposition soit financée et respecte le plafond d'émissions.
            Ces changements servent à cela, ils ne sont pas le cœur de l'idée.</p>
          <ListeDiff items={equilibrage} pastilles={false} vide="" />
        </div>
      )}
    </div>
  )
}

function ListeDiff({ items: tous, vide, pastilles }: { items: Diff[]; vide: string; pastilles: boolean }) {
  if (!tous.length) return <div className="small muted">{vide}</div>
  const missions = tous.filter((d) => d.regle.startsWith('budget.etat.mission.'))
  // les générations de l'âge légal : une seule ligne, dite par l'âge à terme, le détail replié
  const ages = tous.filter((d) => estAgeLegal(d.regle))
  const tete = ages.length > 1 ? (ages.find((d) => d.regle === AGE_TERME) ?? ages[ages.length - 1]) : null
  const items = tous.filter((d) => !(missions.length >= 3 && missions.includes(d)) && !(tete && ages.includes(d) && d !== tete))
    .map((d) => d === tete ? { ...d, titre: 'Âge légal de départ à la retraite', generations: ages } : d)
  const parDomaine: Record<string, Diff[]> = {}
  for (const d of items) (parDomaine[d.domaine ?? 'autre'] ??= []).push(d)
  if (missions.length >= 3) parDomaine.budget = parDomaine.budget ?? []
  const domaines = Object.keys(parDomaine).sort((a, b) => parDomaine[b].length - parDomaine[a].length)
  return (
    <div>
      {pastilles && <div className="pill-list" style={{ marginBottom: 12 }}>
        {domaines.map((d) => <a key={d} href={`#diff-${d}`} className="badge primary">{DOMAINE_TITRE[d] ?? d} · {parDomaine[d].length + (d === 'budget' && missions.length >= 3 ? 1 : 0)}</a>)}
      </div>}
      {domaines.map((dom) => (
        <div key={dom} id={`diff-${dom}`} style={{ marginBottom: 16 }}>
          <div className="kpi-label" style={{ marginBottom: 6 }}>{DOMAINE_TITRE[dom] ?? dom}</div>
          <ul className="list">
            {dom === 'budget' && missions.length >= 3 && <BudgetResume items={missions} />}
            {parDomaine[dom].map((c) => {
              const hausse = typeof c.avant === 'number' && typeof c.apres === 'number' ? (c.apres as number) > (c.avant as number) : null
              return (
                <li key={c.regle}>
                  <div className="row between top" style={{ flexWrap: 'nowrap' }}>
                    <Link to={`/regles/r/${c.regle}`} style={{ fontWeight: 650 }}>{c.titre ?? c.regle}</Link>
                    {typeof c.avant === 'number' && typeof c.apres === 'number' && c.avant !== c.apres && (
                      <span className={`badge ${hausse ? 'accent' : 'primary'}`}>{ecartLisible(c.avant, c.apres, c.unite ?? '')}</span>
                    )}
                  </div>
                  {(c.lignes ?? diffBareme(c.avant, c.apres)) ? (
                    <>
                      <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{(c.lignes ?? diffBareme(c.avant, c.apres))!.map((l) => <li key={l}><strong>{l}</strong></li>)}</ul>
                      <div className="small muted">Les seuils s'entendent par <Terme id="part_fiscale">part</Terme> (une part par adulte, une demi-part par enfant).</div>
                    </>
                  ) : (
                    <div className="row small" style={{ gap: 8, marginTop: 4 }}>
                      <span className="muted">Loi actuelle : {valeur(c.avant, c.unite, c.type)}</span>
                      <ArrowRight size={14} className="arrow" />
                      <strong>Cette proposition : {valeur(c.apres, c.unite, c.type)}</strong>
                    </div>
                  )}
                  {c.generations && (
                    <details className="curieux small" style={{ marginTop: 4 }}><summary>Le détail par génération ({c.generations.length})</summary>
                      <ul className="list small">{[...c.generations].sort((x, y) => GENERATIONS.indexOf(x.regle) - GENERATIONS.indexOf(y.regle)).map((g) => (
                        <li key={g.regle} className="list-row"><Link to={`/regles/r/${g.regle}`}>{nomGeneration(g.titre ?? g.regle)}</Link>
                          <span>{valeur(g.avant, 'ans')} → <strong>{valeur(g.apres, 'ans')}</strong></span></li>
                      ))}</ul>
                    </details>
                  )}
                  {c.provenance && (
                    <div className="small muted" style={{ marginTop: 4 }}>
                      {c.provenance.justification && <div><Quote size={12} /> « {c.provenance.justification} »</div>}
                      <div><GitCommit size={12} /> {c.provenance.auteur_systeme ? 'Changé automatiquement (la loi a changé)' : `Changé par ${c.provenance.auteur}`}, {relatif(c.provenance.date)}</div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function MisesAJourAuto({ commits }: { commits: { id: string; message: string; created_at: string; changes: Changement[] }[] }) {
  if (!commits.length) return null
  return (
    <details className="card soft small curieux">
      <summary><Bot size={15} /> Tenue à jour automatiquement avec la loi ({commits.length} mise{commits.length > 1 ? 's' : ''} à jour)</summary>
      <p className="small muted">Quand la loi change (nouvelle loi, revalorisation, entrée en vigueur), le site met à jour automatiquement cette proposition pour toutes les règles qu'elle n'a pas modifiées.</p>
      <ul className="list small">
        {commits.map((c) => (
          <li key={c.id}>{c.message} <span className="muted">· {relatif(c.created_at)}</span>
            {c.changes.length > 0 && c.changes.length <= 8 && <div className="muted">{c.changes.map((x) => x.titre ?? x.regle).join(' · ')}</div>}
          </li>
        ))}
      </ul>
    </details>
  )
}
