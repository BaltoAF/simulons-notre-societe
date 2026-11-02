import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GitFork, Scale, Search, ShieldCheck, Star } from 'lucide-react'
import type { Societe } from '../lib/api'
import { relatif } from '../lib/format'
import { ligneMesure } from '../components/DiffSociete'
import { useFetch } from '../lib/state'
import { Empty, Loading } from '../components/ui'
import { LegendeTableau, TableauDeBord, useRelance } from '../components/TableauDeBord'

// classer par indicateur (piste « tableau de bord, suite ») : sens où l'effet est le plus favorable d'abord ;
// la loi actuelle reste en tête, les propositions sans chiffre (non chiffré, en calcul) à la fin
const CLASSEMENTS: { id: string; libelle: string; sens: 1 | -1 }[] = [
  { id: 'finances', libelle: "Les moins coûteuses pour l'argent public", sens: 1 },
  { id: 'menages', libelle: "Le plus de pouvoir d'achat", sens: 1 },
  { id: 'pauvrete', libelle: 'Le moins de pauvreté', sens: -1 },
  { id: 'emploi', libelle: "Le plus d'emplois", sens: 1 },
  { id: 'climat', libelle: "Le moins d'émissions", sens: -1 },
]

function classer(liste: Societe[], selon: string | null): Societe[] {
  const c = CLASSEMENTS.find((x) => x.id === selon)
  if (!c) return liste
  const v = (s: Societe) => {
    const x = s.indicateurs?.statut === 'pret' ? s.indicateurs.valeurs?.[c.id]?.valeur : null
    return typeof x === 'number' ? x * c.sens : null
  }
  return [...liste].sort((a, b) => {
    if (a.reference !== b.reference) return a.reference ? -1 : 1
    const va = v(a), vb = v(b)
    if (va === null || vb === null) return va === null ? (vb === null ? 0 : 1) : -1
    return vb - va
  })
}

export default function Societes() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const tri = params.get('tri') ?? 'recent'
  const auteur = params.get('auteur')
  const selon = params.get('selon')
  const qs = new URLSearchParams({ tri, ...(params.get('q') ? { q: params.get('q')! } : {}), ...(auteur ? { auteur } : {}) })
  const chemin = `/api/societes?${qs}`
  const { data, loading, setData } = useFetch<{ societes: Societe[] }>(chemin)
  // chiffres pas encore prêts (calculés en arrière-plan) : on redemande discrètement toutes les 20 secondes
  useRelance(!!data?.societes.some((x) => x.indicateurs?.statut === 'en_calcul'), chemin, setData)
  return (
    <div className="container page">
      <div className="row between">
        <div>
          <h1>{auteur ? `Les propositions de ${auteur}` : 'Les propositions'}</h1>
          <p className="ink2" style={{ maxWidth: 720, margin: 0 }}>La loi d'aujourd'hui, avec quelques règles changées : les effets de chaque idée, côte à côte.</p>
        </div>
        <div className="row">
          <Link to="/comparer" className="btn"><Scale size={16} /> Comparer deux propositions</Link>
          <Link to="/atelier" className="btn primary"><GitFork size={16} /> Créer la mienne</Link>
        </div>
      </div>
      {!auteur && (
        <details className="curieux small" style={{ margin: '10px 0 0', maxWidth: 820 }}>
          <summary>Comment ça marche ?</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            <li><strong>Partir d'un modèle</strong> : copiez la loi actuelle ou la proposition de quelqu'un, puis changez-la librement.</li>
            <li><strong>Comparer</strong> : deux propositions côte à côte, avec leurs effets.</li>
            <li><strong>Suggérer un changement</strong> : sur la proposition de quelqu'un, il l'accepte ou non, comme un amendement.</li>
          </ul>
        </details>
      )}
      <div className="row" style={{ margin: '12px 0 18px' }}>
        <form className="input-suffix grow" style={{ maxWidth: 420 }} onSubmit={(e) => { e.preventDefault(); params.set('q', q); setParams(params) }}>
          <input type="search" placeholder="Rechercher une proposition" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="suffix"><Search size={16} /></span>
        </form>
        <div className="choices">
          <button className={`choice ${tri === 'recent' ? 'on' : ''}`} aria-pressed={tri === 'recent'} onClick={() => { params.set('tri', 'recent'); setParams(params) }}>Récentes</button>
          <button className={`choice ${tri === 'populaire' ? 'on' : ''}`} aria-pressed={tri === 'populaire'} onClick={() => { params.set('tri', 'populaire'); setParams(params) }}>Populaires</button>
        </div>
        <label className="row small" style={{ gap: 6, flexWrap: 'nowrap', maxWidth: '100%', minWidth: 0 }}>
          <span style={{ flexShrink: 0 }}>Classer :</span>
          <select value={selon ?? ''} style={{ width: 'auto', maxWidth: '100%', minWidth: 0, flex: '0 1 auto' }} onChange={(e) => { if (e.target.value) params.set('selon', e.target.value); else params.delete('selon'); setParams(params) }}>
            <option value="">sans classement</option>
            {CLASSEMENTS.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
          </select>
        </label>
        {auteur && <Link to="/societes" className="small">Voir toutes les propositions</Link>}
      </div>
      {loading ? <Loading /> : (data?.societes.length ? (<>
        <LegendeTableau />
        <div className="grid cols-2 cartes-propositions">
          {classer(data.societes, selon).map((s) => {
            const mesures = s.mesures ?? []
            const n = Math.max(s.nb_mesures ?? 0, mesures.length)
            return (
              <article key={s.id} className="card link carte-proposition">
                <div className="row between top" style={{ flexWrap: 'nowrap' }}>
                  <h3 style={{ margin: 0 }}><Link to={`/societes/${s.id}`} className="lien-carte">{s.reference && <ShieldCheck size={17} color="var(--primary)" />} {s.nom}</Link></h3>
                  {s.etoiles > 0 && <span className="badge"><Star size={12} /> {s.etoiles}</span>}
                </div>
                <div className="small muted" style={{ margin: '2px 0 10px' }}>
                  {s.reference ? "Aujourd'hui, en chiffres officiels" : <>par <strong>{s.owner_pseudo}</strong></>}
                  {' · '}mise à jour {relatif(s.updated_at)}
                  {s.propositions_ouvertes ? ` · ${s.propositions_ouvertes} suggestion${s.propositions_ouvertes > 1 ? 's' : ''} en discussion` : ''}
                </div>
                <TableauDeBord ind={s.indicateurs} compact />
                {!s.reference && n > 0 && (
                  <details className="detail-carte">
                    <summary>Ce qu'elle change : {n} mesure{n > 1 ? 's' : ''}{(s.nb_equilibrage ?? 0) > 0 ? ` (+ ${s.nb_equilibrage} pour l'équilibrer)` : ''}</summary>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                      {mesures.map((mm) => <li key={mm.regle}>{ligneMesure(mm)}</li>)}
                      {n > mesures.length && <li className="muted">et {n - mesures.length} autre{n - mesures.length > 1 ? 's' : ''}</li>}
                    </ul>
                    {(s.financement ?? []).length > 0 && <div className="muted" style={{ marginTop: 4 }}>Pour l'équilibrer : {s.financement!.map(ligneMesure).join(' ; ')}</div>}
                  </details>
                )}
              </article>
            )
          })}
        </div>
      </>      ) : <Empty>Aucune proposition pour l'instant. <Link to="/atelier">Créez la première !</Link></Empty>)}
    </div>
  )
}
