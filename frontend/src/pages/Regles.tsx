import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Calculator, Search } from 'lucide-react'
import type { Regle } from '../lib/api'
import { DOMAINE_TITRE, nombre, valeur } from '../lib/format'
import { useApp, useFetch } from '../lib/state'
import { chercherRegles } from '../lib/recherche'
import { DomainIcon, Loading, SourceType } from '../components/ui'

export function RegleLigne({ r }: { r: Regle }) {
  return (
    <li>
      <div className="list-row" style={{ alignItems: 'flex-start' }}>
        <div className="grow">
          <Link to={`/regles/r/${r.id}`} style={{ fontWeight: 650, color: 'var(--ink)' }}>{r.titre}</Link>
          <div className="small muted" style={{ marginTop: 2 }}>{r.explication.length > 160 ? r.explication.slice(0, 157) + '…' : r.explication}</div>
          <div className="pill-list" style={{ marginTop: 6 }}>
            <SourceType type={r.meilleure_source ?? undefined} />
            {r.simulable && <span className="badge primary"><Calculator size={12} /> effets calculés</span>}
            {r.virtuel && <span className="badge accent">dispositif proposé</span>}
            {r.a_verifier && <span className="badge warn">à vérifier</span>}
            {r.prochaine_valeur && <span className="badge">évolution prévue le {new Date(r.prochaine_valeur.depuis).toLocaleDateString('fr-FR')}</span>}
          </div>
        </div>
        <div style={{ textAlign: 'right', minWidth: 120 }}>
          <strong>{valeur(r.valeur, r.unite, r.type)}</strong>
          {r.valeur_depuis && <div className="small muted">depuis {new Date(r.valeur_depuis).getFullYear()}</div>}
        </div>
      </div>
    </li>
  )
}

export default function Regles() {
  const { meta } = useApp()
  const [q, setQ] = useState('')
  const { data, loading } = useFetch<{ regles: Regle[] }>('/api/regles?limit=5000')
  const res = useMemo(() => {
    if (q.trim().length < 2) return []
    return chercherRegles(data?.regles ?? [], q).slice(0, 80)
  }, [q, data])
  const s = meta?.stats
  return (
    <div className="container page">
      <h1>Les règles en vigueur aujourd'hui</h1>
      <p className="lead ink2" style={{ maxWidth: 780 }}>La France d'aujourd'hui, traduite en règles chiffrées. Chaque règle indique sa valeur en vigueur, son historique et le texte qui la prouve.</p>
      {/* hauteur réservée : la ligne arrive après le chargement, sans faire bouger le champ de recherche */}
      <div style={{ minHeight: 34, marginBottom: 18 }}>{s && <div className="row small">
        <span className="badge gain"><BadgeCheck size={13} /> {nombre(s.regles_texte_officiel, 0)} règles prouvées par un texte officiel</span>
        <span className="badge">{nombre(s.regles, 0)} règles au total</span>
        {s.regles_a_verifier > 0 && <span className="badge warn">{s.regles_a_verifier} à vérifier</span>}
      </div>}</div>
      <div className="input-suffix" style={{ maxWidth: 640, marginBottom: 24 }}>
        <input type="search" placeholder="Rechercher une règle : SMIC, majorité, TVA, garde à vue, RSA…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une règle" />
        <span className="suffix"><Search size={16} /></span>
      </div>
      {q.trim().length >= 2 ? (
        <div className="card">
          {loading ? <Loading /> : res.length ? <ul className="list">{res.map((r) => <RegleLigne key={r.id} r={r} />)}</ul> : <div className="muted">Aucune règle trouvée pour « {q} ».</div>}
        </div>
      ) : (
        <div className="grid auto">
          {(meta?.domaines ?? []).map((d) => (
            <Link key={d.id} to={`/regles/d/${d.id}`} className="card link">
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <DomainIcon name={d.icone} />
                <div className="grow"><h3 style={{ marginBottom: 2 }}>{d.titre}</h3><div className="small muted">{d.question}</div>
                  <div className="small" style={{ marginTop: 6, fontWeight: 650 }}>{d.nb_regles} règles</div></div>
              </div>
            </Link>
          ))}
        </div>
      )}
      <p className="small muted" style={{ marginTop: 20 }}>Domaines : {Object.values(DOMAINE_TITRE).join(' · ')}.</p>
    </div>
  )
}
