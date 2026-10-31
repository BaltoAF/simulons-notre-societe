import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { GitFork, GitPullRequest, Scale, Search, ShieldCheck, Star } from 'lucide-react'
import type { Societe } from '../lib/api'
import { relatif } from '../lib/format'
import { ligneMesure } from '../components/DiffSociete'
import { useFetch } from '../lib/state'
import { Empty, Loading } from '../components/ui'

export default function Societes() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const tri = params.get('tri') ?? 'recent'
  const auteur = params.get('auteur')
  const qs = new URLSearchParams({ tri, ...(params.get('q') ? { q: params.get('q')! } : {}), ...(auteur ? { auteur } : {}) })
  const { data, loading } = useFetch<{ societes: Societe[] }>(`/api/societes?${qs}`)
  return (
    <div className="container page">
      <div className="row between">
        <div>
          <h1>{auteur ? `Les propositions de ${auteur}` : 'Les propositions'}</h1>
          <p className="ink2" style={{ maxWidth: 720 }}>Chaque proposition est une idée de France, imaginée par quelqu'un : la loi d'aujourd'hui, avec quelques règles changées. Explorez-les, comparez-les, ou partez de celle qui vous plaît pour faire la vôtre.</p>
        </div>
        <div className="row">
          <Link to="/comparer" className="btn"><Scale size={16} /> Comparer deux propositions</Link>
          <Link to="/atelier" className="btn primary"><GitFork size={16} /> Créer la mienne</Link>
        </div>
      </div>
      {!auteur && (
        <div className="grid cols-3" style={{ margin: '14px 0 6px' }}>
          <div className="card flat"><strong><GitFork size={16} /> Partir d'un modèle</strong>
            <p className="small ink2" style={{ margin: '6px 0 0' }}>Partez de la loi actuelle, ou de la proposition de quelqu'un : vous en faites une copie à vous, que vous changez librement.</p></div>
          <div className="card flat"><strong><Scale size={16} /> Comparer</strong>
            <p className="small ink2" style={{ margin: '6px 0 0' }}>Mettez deux propositions côte à côte : ce qui change, et leurs effets pour les ménages, l'argent public et le climat.</p></div>
          <div className="card flat"><strong><GitPullRequest size={16} /> Suggérer un changement</strong>
            <p className="small ink2" style={{ margin: '6px 0 0' }}>Sur la proposition de quelqu'un, « Proposer un changement » : il l'accepte ou non, comme un amendement.
              Un parti pourrait y écrire son programme, et ses adhérents l'amender.</p></div>
        </div>
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
        {auteur && <Link to="/societes" className="small">Voir toutes les propositions</Link>}
      </div>
      {loading ? <Loading /> : (data?.societes.length ? (
        <div className="grid cols-2">
          {data.societes.map((s) => (
            <Link key={s.id} to={`/societes/${s.id}`} className="card link" style={s.reference ? { borderColor: 'var(--primary)' } : undefined}>
              <div className="row between top">
                <h3 style={{ margin: 0 }}>{s.reference && <ShieldCheck size={17} color="var(--primary)" />} {s.nom}</h3>
                {s.etoiles > 0 && <span className="badge"><Star size={12} /> {s.etoiles}</span>}
              </div>
              {!s.reference && (s.mesures ?? []).length > 0 ? (
                <div className="small" style={{ margin: '8px 0' }}>
                  <div className="kpi-label" style={{ marginBottom: 2 }}>Ce qu'elle change</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(s.mesures ?? []).map((mm) => (
                      <li key={mm.regle}>{ligneMesure(mm)}</li>
                    ))}
                    {(s.nb_mesures ?? 0) > (s.mesures ?? []).length && <li className="muted">et {(s.nb_mesures ?? 0) - (s.mesures ?? []).length} autre{(s.nb_mesures ?? 0) - (s.mesures ?? []).length > 1 ? 's' : ''}</li>}
                  </ul>
                  {(s.financement ?? []).length > 0 && <div className="muted" style={{ marginTop: 4 }}>Pour l'équilibrer : {s.financement!.map(ligneMesure).join(' ; ')}</div>}
                </div>
              ) : s.description && <p className="small ink2" style={{ margin: '6px 0' }}>{s.description.length > 180 ? s.description.slice(0, 177) + '…' : s.description}</p>}
              <div className="small muted">
                {s.reference ? 'La loi actuelle, tenue à jour automatiquement' : (s.mesures ?? []).length ? <>par <strong>{s.owner_pseudo}</strong></> : <>par <strong>{s.owner_pseudo}</strong> · {s.nb_differences ?? 0} règle{(s.nb_differences ?? 0) > 1 ? 's' : ''} changée{(s.nb_differences ?? 0) > 1 ? 's' : ''} par rapport à aujourd'hui</>}
                {' · '}mise à jour {relatif(s.updated_at)}
                {s.propositions_ouvertes ? ` · ${s.propositions_ouvertes} suggestion${s.propositions_ouvertes > 1 ? 's' : ''} en discussion` : ''}
              </div>
            </Link>
          ))}
        </div>
      ) : <Empty>Aucune proposition pour l'instant. <Link to="/atelier">Créez la première !</Link></Empty>)}
    </div>
  )
}
