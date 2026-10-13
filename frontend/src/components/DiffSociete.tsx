// « Ce qui change par rapport à la loi actuelle » : les différences d'une société avec la Société 1.0,
// regroupées par domaine, avec leur ampleur, leur auteur et leur justification.
import { Link } from 'react-router-dom'
import { ArrowRight, Bot, GitCommit, Quote } from 'lucide-react'
import type { Changement, Tranche, Valeur } from '../lib/api'
import { DOMAINE_TITRE, nombre, relatif, valeur } from '../lib/format'

export type Diff = Changement & {
  provenance?: { commit: string; auteur: string | null; auteur_systeme: boolean; date: string; message: string; justification: string } | null
  variation_pct?: number | null
}

/** Changement d'un barème dit en clair : « Nouvelle tranche à 50 % au-delà de 250 000 € », « 30 % → 32 % dès 29 579 € ». */
function diffBareme(avant: Valeur | undefined, apres: Valeur | undefined): string[] | null {
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

export function DiffSociete({ items, vide }: { items: Diff[]; vide: string }) {
  if (!items.length) return <div className="small muted">{vide}</div>
  const parDomaine: Record<string, Diff[]> = {}
  for (const d of items) (parDomaine[d.domaine ?? 'autre'] ??= []).push(d)
  const domaines = Object.keys(parDomaine).sort((a, b) => parDomaine[b].length - parDomaine[a].length)
  return (
    <div>
      <div className="pill-list" style={{ marginBottom: 12 }}>
        {domaines.map((d) => <a key={d} href={`#diff-${d}`} className="badge primary">{DOMAINE_TITRE[d] ?? d} · {parDomaine[d].length}</a>)}
      </div>
      {domaines.map((dom) => (
        <div key={dom} id={`diff-${dom}`} style={{ marginBottom: 16 }}>
          <div className="kpi-label" style={{ marginBottom: 6 }}>{DOMAINE_TITRE[dom] ?? dom}</div>
          <ul className="list">
            {parDomaine[dom].map((c) => {
              const hausse = typeof c.avant === 'number' && typeof c.apres === 'number' ? (c.apres as number) > (c.avant as number) : null
              return (
                <li key={c.regle}>
                  <div className="row between top" style={{ flexWrap: 'nowrap' }}>
                    <Link to={`/regles/r/${c.regle}`} style={{ fontWeight: 650 }}>{c.titre ?? c.regle}</Link>
                    {c.variation_pct !== undefined && c.variation_pct !== null && Math.abs(c.variation_pct) >= 0.05 && (
                      <span className={`badge ${hausse ? 'accent' : 'primary'}`}>{c.variation_pct > 0 ? '+' : '−'}{nombre(Math.abs(c.variation_pct), 1)} %</span>
                    )}
                  </div>
                  {diffBareme(c.avant, c.apres) ? (
                    <ul className="small" style={{ margin: '4px 0 0', paddingLeft: 18 }}>{diffBareme(c.avant, c.apres)!.map((l) => <li key={l}><strong>{l}</strong></li>)}</ul>
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
                      <div><GitCommit size={12} /> Changé par {c.provenance.auteur_systeme ? 'le Système' : c.provenance.auteur}, {relatif(c.provenance.date)}</div>
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
      <p className="small muted">Quand la loi change (nouvelle loi, revalorisation, entrée en vigueur), le Système met à jour cette proposition pour toutes les règles qu'elle n'a pas modifiées.</p>
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
