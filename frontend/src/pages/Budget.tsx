// Du budget national au budget de chaque ménage.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Landmark, Lock, PiggyBank, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { euros, nombre } from '../lib/format'
import { situationVersMenage, useApp, useFetch, type SituationSaisie } from '../lib/state'
import { PROFILS } from '../lib/profils'
import { ErrorBox, Loading } from '../components/ui'

type Fonction = { id: string; titre: string; description: string; md: number; part: number; par_habitant_an: number; annee: string; source: string
  detail?: { id: string; titre: string; md: number; par_habitant_an: number }[] }
type National = {
  population: number; menages: number
  depenses: { valeur: number; date: string; source: string } | null
  recettes_totales: { valeur: number; date: string } | null
  solde: { valeur: number; date: string } | null
  dette: { valeur: number; date: string } | null
  fonctions: Fonction[]; total_fonctions: number
  recettes: { id: string; titre: string; md: number; annee: string; par_habitant_an: number; source: string }[]
  par_habitant: { depense: number | null; dette: number | null }
  etat_missions: { id: string; titre: string; md: number }[]
  secu_branches: { id: string; titre: string; md: number }[]
}
type VueMenage = {
  paye: { id: string; titre: string; montant: number; nature: string; note?: string }[]; total_paye: number
  cotisations_employeur: number; recu: { id: string; titre: string; montant: number }[]; total_recu: number
  finance: { id: string; titre: string; montant: number; description: string; detail?: { titre: string; montant: number }[] }[]
  revenu_disponible: number; depense_publique_moyenne_foyer: number; personnes: number; note: string
}


function Barre({ part, couleur = 'var(--primary)' }: { part: number; couleur?: string }) {
  return <div className="bar-track" style={{ height: 10 }}><div className="bar-fill" style={{ width: `${Math.max(0.5, part * 100)}%`, background: couleur }} /></div>
}

export default function Budget() {
  const { situation } = useApp()
  const { data: n, loading, error } = useFetch<National>('/api/budget/national')
  const [profil, setProfil] = useState<SituationSaisie | null>(situation)
  const [titreProfil, setTitreProfil] = useState<string>(situation ? 'Votre foyer (renseigné dans « Mes droits »)' : '')
  const [m, setM] = useState<VueMenage | null>(null)
  const [mLoading, setMLoading] = useState(false)
  const [ouvert, setOuvert] = useState<string | null>('protection_sociale')

  useEffect(() => {
    if (!profil) return
    setMLoading(true)
    api<VueMenage>('/api/budget/menage', { body: { menage: situationVersMenage(profil), montants: 'net' } })
      .then(setM).finally(() => setMLoading(false))
  }, [profil])

  if (loading) return <div className="container page"><Loading /></div>
  if (error || !n) return <div className="container page"><ErrorBox message={error ?? 'Erreur'} /></div>
  const dep = n.depenses?.valeur ?? n.total_fonctions
  const maxF = Math.max(...n.fonctions.map((f) => f.md))
  return (
    <div className="container page">
      <h1>Le budget de la France… et le vôtre</h1>
      <p className="lead ink2" style={{ maxWidth: 820 }}>D'où vient l'argent public, où il va, et quelle est votre part. Toutes les dépenses publiques sont comptées : État, Sécurité sociale et collectivités locales.</p>

      <div className="grid cols-3" style={{ marginBottom: 20 }}>
        <div className="card"><div className="kpi-label">Dépense publique {n.depenses?.date?.slice(0, 4)}</div><div className="kpi">{nombre(dep, 0)} Md€</div>
          <div className="small muted">soit <strong>{euros(n.par_habitant.depense ?? 0)}</strong> par habitant et par an</div></div>
        <div className="card"><div className="kpi-label">Déficit {n.solde?.date?.slice(0, 4)}</div><div className="kpi"><span className="delta neg">{nombre(Math.abs(n.solde?.valeur ?? 0), 1)} Md€</span></div>
          <div className="small muted">dépenses non couvertes par les recettes ({nombre(n.recettes_totales?.valeur ?? 0, 0)} Md€)</div></div>
        <div className="card"><div className="kpi-label">Dette publique</div><div className="kpi">{nombre(n.dette?.valeur ?? 0, 0)} Md€</div>
          <div className="small muted">soit {euros(n.par_habitant.dette ?? 0)} par habitant</div></div>
      </div>

      <div className="split" style={{ gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)' }}>
        <div className="card">
          <h3><Landmark size={18} /> Où va l'argent public</h3>
          <p className="small muted">Dépenses par grande fonction (classification internationale COFOG, {n.fonctions[0]?.annee}). Cliquez pour le détail.</p>
          {n.fonctions.map((f) => (
            <div key={f.id} style={{ marginBottom: 12 }}>
              <button className="row between" onClick={() => setOuvert(ouvert === f.id ? null : f.id)}
                style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: f.detail ? 'pointer' : 'default', color: 'inherit', font: 'inherit', textAlign: 'left' }}>
                <span><strong>{f.titre}</strong> <span className="small muted">— {f.description}</span></span>
                <span className="small" style={{ whiteSpace: 'nowrap' }}><strong>{nombre(f.md, 0)} Md€</strong> · {euros(f.par_habitant_an)}/hab.</span>
              </button>
              <Barre part={f.md / maxF} />
              {ouvert === f.id && f.detail && (
                <ul className="list small" style={{ marginLeft: 12 }}>
                  {f.detail.map((d) => <li key={d.id} className="list-row" style={{ padding: '5px 0' }}><span>{d.titre}</span><span>{nombre(d.md, 0)} Md€ · {euros(d.par_habitant_an)}/hab.</span></li>)}
                </ul>
              )}
            </div>
          ))}
          <div className="small muted">Source : Eurostat / INSEE, comptes des administrations publiques.</div>
        </div>
        <div className="card">
          <h3><PiggyBank size={18} /> D'où vient l'argent</h3>
          <p className="small muted">Principales recettes publiques ({n.recettes[0]?.annee}).</p>
          {n.recettes.map((r) => (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div className="row between small"><strong>{r.titre}</strong><span>{nombre(r.md, 0)} Md€ · {euros(r.par_habitant_an)}/hab.</span></div>
              <Barre part={r.md / Math.max(...n.recettes.map((x) => x.md))} couleur="var(--accent)" />
            </div>
          ))}
          <details className="explain">
            <summary><ChevronDown size={15} /> Le budget de l'État, mission par mission</summary>
            <ul className="list small">{n.etat_missions.slice(0, 40).map((x) => <li key={x.id} className="list-row" style={{ padding: '5px 0' }}><Link to={`/regles/r/${x.id}`}>{x.titre}</Link><span>{nombre(x.md, 1)} Md€</span></li>)}</ul>
          </details>
          <details className="explain">
            <summary><ChevronDown size={15} /> La Sécurité sociale, branche par branche</summary>
            <ul className="list small">{n.secu_branches.map((x) => <li key={x.id} className="list-row" style={{ padding: '5px 0' }}><Link to={`/regles/r/${x.id}`}>{x.titre}</Link><span>{nombre(x.md, 1)} Md€</span></li>)}</ul>
          </details>
          <Link className="btn" style={{ marginTop: 12 }} to="/atelier?budget=1">Répartir autrement le budget de l'État</Link>
        </div>
      </div>

      <div className="section-title"><h2><Wallet size={22} /> Et vous ?</h2></div>
      <div className="row" style={{ marginBottom: 12 }}>
        {situation && <button className={`choice ${titreProfil.startsWith('Votre') ? 'on' : ''}`} onClick={() => { setProfil(situation); setTitreProfil('Votre foyer (renseigné dans « Mes droits »)') }}>Mon foyer</button>}
        {PROFILS.map((p) => <button key={p.titre} className={`choice ${titreProfil === p.titre ? 'on' : ''}`} onClick={() => { setProfil(p.s); setTitreProfil(p.titre) }}>{p.titre}</button>)}
        {!situation && <Link to="/mes-droits" className="small">Renseigner mon propre foyer</Link>}
      </div>
      {!profil && <div className="card soft">Choisissez un profil ci-dessus, ou renseignez votre situation dans <Link to="/mes-droits">Mes droits</Link>.</div>}
      {mLoading && <Loading label="Calcul de votre part…" />}
      {m && !mLoading && (
        <div className="grid cols-3" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="kpi-label">{titreProfil} paie chaque année</div>
            <div className="kpi">{euros(m.total_paye)}</div>
            <ul className="list small">{m.paye.map((p) => <li key={p.id}><div className="list-row"><span>{p.titre}</span><strong>{euros(p.montant)}</strong></div>{p.note && <div className="muted" style={{ fontSize: '.78rem' }}>{p.note}</div>}</li>)}</ul>
            {m.cotisations_employeur > 0 && <div className="small muted">En plus, l'employeur verse {euros(m.cotisations_employeur)} de cotisations patronales sur les salaires.</div>}
          </div>
          <div className="card">
            <div className="kpi-label">… et reçoit en prestations</div>
            <div className="kpi">{euros(m.total_recu)}</div>
            {m.recu.length ? <ul className="list small">{m.recu.map((r) => <li key={r.id} className="list-row"><span>{r.titre}</span><strong>{euros(r.montant)}</strong></li>)}</ul>
              : <div className="small muted">Aucune prestation monétaire.</div>}
            <p className="small muted" style={{ marginTop: 10 }}>Sans compter les services publics gratuits ou remboursés (école, soins, routes…) : en moyenne, la dépense publique représente {euros(m.depense_publique_moyenne_foyer)} par an pour un foyer de {m.personnes} personne(s).</p>
          </div>
          <div className="card">
            <div className="kpi-label">Ce que finance sa contribution</div>
            <ul className="list small">
              {m.finance.map((f) => (
                <li key={f.id}>
                  <div className="list-row"><span>{f.titre}</span><strong>{euros(f.montant)}</strong></div>
                  <Barre part={m.total_paye ? f.montant / m.total_paye : 0} />
                  {f.detail && <div className="muted" style={{ fontSize: '.78rem', marginTop: 4 }}>{f.detail.slice(0, 4).map((d) => `${d.titre} ${euros(d.montant)}`).join(' · ')}</div>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {m && <p className="small muted" style={{ marginTop: 10 }}><Lock size={13} /> {m.note} Votre situation n'est jamais enregistrée.</p>}
    </div>
  )
}
