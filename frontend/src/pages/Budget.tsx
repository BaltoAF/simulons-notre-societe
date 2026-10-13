// Du budget national au budget de chaque ménage.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Landmark, Lock, PiggyBank, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { euros, nombre } from '../lib/format'
import { situationVersMenage, useApp, useFetch, type SituationSaisie } from '../lib/state'
import { PROFILS } from '../lib/profils'
import { ErrorBox, Loading } from '../components/ui'
import { Pourquoi, Terme } from '../components/Terme'
import { milliards, parMenageMois } from '../lib/humain'
import { MISSIONS, infoMission } from '../lib/missions'

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

// Comment modifier le budget : les trois façons de faire, et pourquoi certaines dépenses sont verrouillées.
function CommentChanger({ totalEtat }: { totalEtat: number }) {
  const verrouillees = Object.values(MISSIONS).filter((m) => m.verrou)
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Comment changer ce budget ?</h2>
      <p className="small muted" style={{ marginTop: 0 }}>Dans l'atelier, vous pouvez modifier le budget de l'État (environ {milliards(totalEtat)} par an) de trois façons :</p>
      <div className="grid cols-3">
        <div className="card flat">
          <strong><Scale size={16} /> Répartir autrement</strong>
          <p className="small ink2" style={{ marginBottom: 0 }}>Plus pour l'école, moins ailleurs. Le total ne bouge pas : c'est toujours équilibré.</p>
        </div>
        <div className="card flat">
          <strong><TrendingUp size={16} /> Dépenser plus</strong>
          <p className="small ink2" style={{ marginBottom: 0 }}>Il faut trouver l'argent : faire des économies ailleurs, augmenter un impôt… Le site vous propose des solutions chiffrées.
            Sinon, il faut emprunter : c'est autorisé, mais vous devez l'assumer, car la <Terme id="dette">dette</Terme> augmente. Exemple : 10 milliards de plus par an ≈ {parMenageMois(10)} par mois et par ménage.</p>
        </div>
        <div className="card flat">
          <strong><TrendingDown size={16} /> Dépenser moins</strong>
          <p className="small ink2" style={{ marginBottom: 0 }}>Le <Terme id="deficit">déficit</Terme> baisse, et avec lui la dette. En contrepartie, les services concernés (école, police…) ont moins de moyens.</p>
        </div>
      </div>
      <Pourquoi titre="Pourquoi certaines dépenses ont un cadenas ?">
        <p style={{ marginTop: 0 }}>Certaines dépenses ne se décident pas d'un simple coup de crayon :</p>
        <ul style={{ paddingLeft: 18, margin: '0 0 6px' }}>{verrouillees.map((m) => <li key={m.nom}><strong>{m.nom}</strong> : {m.verrou}</li>)}</ul>
        <p style={{ marginBottom: 0 }}>On ne peut donc pas les baisser directement ; on agit sur leurs causes (moins de déficit, autres règles d'impôt).</p>
      </Pourquoi>
      <Pourquoi titre="Et la Sécurité sociale, les retraites, les aides ?">
        Elles dépendent surtout de règles (montant du RSA, âge de départ, taux de cotisation…) plutôt que d'un budget voté. Pour les changer, modifiez ces règles
        dans l'atelier : le Système calcule ce que cela coûte ou rapporte.
      </Pourquoi>
      <Link className="btn primary" style={{ marginTop: 14 }} to="/atelier?budget=1">Essayer de répartir le budget <ArrowRight size={15} /></Link>
    </div>
  )
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
        <div className="card"><div className="kpi-label">L'argent public dépensé en {n.depenses?.date?.slice(0, 4)}</div><div className="kpi">{milliards(dep)}</div>
          <div className="small muted">soit <strong>{euros(n.par_habitant.depense ?? 0)}</strong> par habitant et par an</div></div>
        <div className="card"><div className="kpi-label"><Terme id="deficit">Le déficit</Terme> {n.solde?.date?.slice(0, 4)}</div><div className="kpi"><span className="delta neg">{milliards(Math.abs(n.solde?.valeur ?? 0))}</span></div>
          <div className="small muted">dépensés en plus de ce qui rentre ({milliards(n.recettes_totales?.valeur ?? 0)} de recettes) : il faut l'emprunter</div></div>
        <div className="card"><div className="kpi-label"><Terme id="dette">La dette publique</Terme></div><div className="kpi">{milliards(n.dette?.valeur ?? 0)}</div>
          <div className="small muted">soit {euros(n.par_habitant.dette ?? 0)} par habitant : la somme des déficits passés</div></div>
      </div>

      <div className="split even">
        <div className="card">
          <h3><Landmark size={18} /> Où va l'argent public</h3>
          <p className="small muted">Toutes les administrations (État, Sécurité sociale, collectivités), par grand domaine, en {n.fonctions[0]?.annee}. Cliquez sur un domaine pour le détail.</p>
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
          <div className="small muted">Source : Eurostat / INSEE, comptes des administrations publiques (nomenclature internationale COFOG).</div>
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
            <summary><ChevronDown size={15} /> Le budget de l'État, domaine par domaine</summary>
            <ul className="list small">{n.etat_missions.slice(0, 40).map((x) => {
              const i = infoMission(x.id, x.titre)
              return <li key={x.id} className="list-row" style={{ padding: '5px 0' }}>
                <span>{i.verrou && <span title={i.verrou}><Lock size={12} color="var(--ink-3)" /> </span>}<Link to={`/regles/r/${x.id}`}>{i.nom}</Link></span><span>{nombre(x.md, 1)} Md€</span></li>
            })}</ul>
            <div className="small muted"><Lock size={12} /> = dépense obligatoire, voir « Pourquoi certaines dépenses ont un cadenas ? » plus bas.</div>
          </details>
          <details className="explain">
            <summary><ChevronDown size={15} /> La Sécurité sociale, branche par branche</summary>
            <ul className="list small">{n.secu_branches.map((x) => <li key={x.id} className="list-row" style={{ padding: '5px 0' }}><Link to={`/regles/r/${x.id}`}>{x.titre}</Link><span>{nombre(x.md, 1)} Md€</span></li>)}</ul>
          </details>
        </div>
      </div>

      <CommentChanger totalEtat={n.etat_missions.reduce((a, x) => a + x.md, 0)} />

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
