// « Ce qui change par rapport à la loi actuelle » : les différences d'une société avec la Société 1.0,
// regroupées par domaine, avec leur ampleur, leur auteur et leur justification.
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, GitCommit, Quote } from 'lucide-react'
import type { Changement, Tranche, Valeur } from '../lib/api'
import { DOMAINE_TITRE, nombre, relatif, valeur } from '../lib/format'
import { milliards } from '../lib/humain'
import { infoMission } from '../lib/missions'
import { Terme } from './Terme'

export type Diff = Changement & {
  pour_equilibrer?: boolean
  lignes?: string[] // lignes de barème à afficher (quand un barème est réparti entre l'idée et l'équilibrage)
  provenance?: { commit: string; auteur: string | null; auteur_systeme: boolean; date: string; message: string; justification: string } | null
  variation_pct?: number | null
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
  const items = missions.length >= 3 ? tous.filter((d) => !missions.includes(d)) : tous
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
                    {c.unite === 'pourcent' && typeof c.avant === 'number' && typeof c.apres === 'number' ? (
                      <span className={`badge ${hausse ? 'accent' : 'primary'}`}>{c.apres > c.avant ? '+' : '−'}{nombre(Math.abs(c.apres - c.avant), 2)} point{Math.abs(c.apres - c.avant) >= 2 ? 's' : ''}</span>
                    ) : c.variation_pct !== undefined && c.variation_pct !== null && Math.abs(c.variation_pct) >= 0.05 && (
                      <span className={`badge ${hausse ? 'accent' : 'primary'}`}>{c.variation_pct > 0 ? '+' : '−'}{nombre(Math.abs(c.variation_pct), 1)} %</span>
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
