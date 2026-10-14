// Du budget national au budget de chaque ménage.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, Landmark, Lock, PiggyBank, Scale, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { api } from '../lib/api'
import { euros } from '../lib/format'
import { situationVersMenage, useApp, useFetch, type SituationSaisie } from '../lib/state'
import { PROFILS } from '../lib/profils'
import { ErrorBox, Loading } from '../components/ui'
import { Terme } from '../components/Terme'
import { milliards, parMenageMois } from '../lib/humain'
import { infoMission } from '../lib/missions'

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

// Domaines de la dépense publique qu'on peut changer directement par une règle : [règle, libellé du lien]
const LEVIERS_FONCTION: Record<string, [string, string]> = {
  sante: ['budget.secu.ondam.total', "Dépenser plus (ou moins) pour l'hôpital et les soins"],
  protection_sociale: ['retraites.age_legal.generation_1969_et_apres', "Changer l'âge de départ à la retraite"],
}

// Le budget de l'État, domaine par domaine : ce qu'on peut changer, ce qui est verrouillé (et pourquoi), et comment le modifier.
function BudgetEtat({ missions, depenseTotale }: { missions: { id: string; titre: string; md: number }[]; depenseTotale: number }) {
  const [tout, setTout] = useState(false)
  const totalEtat = missions.reduce((a, x) => a + x.md, 0)
  const max = Math.max(...missions.map((x) => x.md))
  const visibles = tout ? missions : missions.slice(0, 10)
  return (
    <div className="card" id="budget-etat" style={{ marginTop: 20, scrollMarginTop: 80 }}>
      <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}><Landmark size={20} /> Le budget de l'État, et comment le changer</h2>
      <p className="small ink2" style={{ marginTop: 0 }}>Sur les {milliards(depenseTotale)} d'argent public, l'État en gère environ <strong>{milliards(totalEtat)}</strong>.
        Le reste, c'est surtout la Sécurité sociale (retraites, santé, familles) et les communes, départements et régions.
        Les montants ci-dessous sont ceux du budget de l'État voté pour l'année ; plus haut, « Où va l'argent public » compte toutes les
        administrations, sur la dernière année publiée : c'est pourquoi un même domaine (la défense, par exemple) n'a pas le même chiffre.</p>
      <div className="notice small" style={{ marginBottom: 10 }}><Lock size={16} style={{ flexShrink: 0 }} /><div><strong>Pourquoi des cadenas ?</strong> Ces dépenses ne se décident pas d'un coup de crayon :
        elles découlent d'engagements déjà pris (les intérêts de la dette) ou des règles d'impôt. On ne peut pas les baisser directement ;
        on agit sur leurs causes : moins de déficit, d'autres règles d'impôt.</div></div>
      <Link className="btn primary small" style={{ marginBottom: 14 }} to="/atelier?budget=1">Modifier le budget de l'État <ArrowRight size={14} /></Link>
      <div className="split even" style={{ alignItems: 'start' }}>
        <div>
          {visibles.map((x) => {
            const i = infoMission(x.id, x.titre)
            return (
              <div key={x.id} className="ligne-montant">
                <div className="row between" style={{ flexWrap: 'nowrap', gap: 10 }}>
                  <span style={{ minWidth: 0 }}>
                    {i.verrou && <Lock size={14} color="var(--ink-2)" style={{ verticalAlign: -2 }} />} <Link to={`/regles/r/${x.id}`}>{i.nom}</Link>
                    {i.verrou && <span className="badge" style={{ marginLeft: 6 }}>obligatoire</span>}
                  </span>
                  <strong className="small" style={{ whiteSpace: 'nowrap' }}>{milliards(x.md)}</strong>
                </div>
                <Barre part={x.md / max} couleur={i.verrou ? 'var(--ink-3)' : 'var(--primary)'} />
                {i.verrou && <div className="small muted" style={{ marginTop: 4 }}>{i.verrou}</div>}
              </div>
            )
          })}
          {missions.length > 10 && <button className="btn ghost small" onClick={() => setTout(!tout)}>{tout ? 'Voir moins' : `Voir les ${missions.length - 10} autres domaines`}</button>}
        </div>
        <div className="stack" style={{ gap: 10 }}>
          <div className="kpi-label">Trois façons de changer ce budget</div>
          <div className="card flat" style={{ padding: 12 }}>
            <strong><Scale size={16} /> Répartir autrement</strong>
            <div className="small ink2">Plus pour l'école, moins ailleurs. Le total ne bouge pas : c'est toujours équilibré.</div>
          </div>
          <div className="card flat" style={{ padding: 12 }}>
            <strong><TrendingUp size={16} /> Dépenser plus</strong>
            <div className="small ink2">Il faut trouver l'argent : des économies ailleurs ou un impôt en plus (le site propose des solutions chiffrées).
              Ou bien emprunter, en l'assumant : la <Terme id="dette">dette</Terme> augmente. 10 milliards de plus par an ≈ {parMenageMois(10)} par mois et par ménage.</div>
          </div>
          <div className="card flat" style={{ padding: 12 }}>
            <strong><TrendingDown size={16} /> Dépenser moins</strong>
            <div className="small ink2">Le <Terme id="deficit">déficit</Terme> baisse, et avec lui la dette. En contrepartie, les services concernés (école, police…) ont moins de moyens.</div>
          </div>
          <Link className="btn primary" to="/atelier?budget=1">Modifier le budget de l'État <ArrowRight size={15} /></Link>
          <div className="card flat" style={{ padding: 12 }}>
            <strong>Et l'hôpital, les retraites, les aides ?</strong>
            <div className="small ink2">Ils relèvent de la Sécurité sociale, pas du budget de l'État. On les change par leurs règles : l'objectif de
              dépenses de santé, l'âge de départ, le montant du RSA… Le site calcule ce que cela coûte ou rapporte.</div>
            <div className="row small" style={{ marginTop: 6, gap: 12 }}>
              <Link to="/atelier?regle=budget.secu.ondam.total">Dépenser plus pour l'hôpital et les soins →</Link>
              <Link to="/atelier?regle=retraites.age_legal.generation_1969_et_apres">Changer l'âge de départ →</Link>
              <Link to="/atelier?regle=prestations.rsa.montant_forfaitaire">Changer le RSA →</Link>
            </div>
          </div>
        </div>
      </div>
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
  // sur téléphone, rien n'est déplié d'office et les listes montrent d'abord l'essentiel (la page reste courte)
  const petitEcran = typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches
  const [ouvert, setOuvert] = useState<string | null>(petitEcran ? null : 'protection_sociale')
  const [toutesFonctions, setToutesFonctions] = useState(!petitEcran)
  const [toutesRecettes, setToutesRecettes] = useState(!petitEcran)

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
      <div className="row" style={{ marginBottom: 16 }}>
        <a className="btn small" href="#budget-etat"><Lock size={14} /> Les cadenas, et comment changer le budget ↓</a>
        <a className="btn small" href="#et-vous"><Wallet size={14} /> Et vous ? ↓</a>
      </div>

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
          <p className="small muted">Toutes les administrations (État, Sécurité sociale, collectivités), par grand domaine, en {n.fonctions[0]?.annee} (le dernier détail publié). Cliquez sur un domaine pour le détail.
            Ailleurs sur le site, les montants votés pour 2026 (budget de l'État, objectif de dépenses de santé) sont un peu différents : autre année, autre périmètre.</p>
          {(toutesFonctions ? n.fonctions : n.fonctions.slice(0, 5)).map((f) => (
            <div key={f.id} style={{ marginBottom: 12 }}>
              <button className="row between" onClick={() => setOuvert(ouvert === f.id ? null : f.id)} aria-expanded={ouvert === f.id}
                style={{ width: '100%', background: 'none', border: 0, padding: '4px 0', cursor: f.detail ? 'pointer' : 'default', color: 'inherit', font: 'inherit', textAlign: 'left', flexWrap: 'nowrap', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ minWidth: 0 }}><strong>{f.detail && <ChevronDown size={14} style={{ transform: ouvert === f.id ? 'none' : 'rotate(-90deg)', verticalAlign: -2 }} />} {f.titre}</strong> <span className="small muted">— {f.description}</span></span>
                <span className="small" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}><strong>{milliards(f.md)}</strong><br /><span className="muted">{euros(f.par_habitant_an)}/hab.</span></span>
              </button>
              <Barre part={f.md / maxF} />
              {LEVIERS_FONCTION[f.id] && <Link className="small" to={`/atelier?regle=${LEVIERS_FONCTION[f.id][0]}`}>{LEVIERS_FONCTION[f.id][1]} →</Link>}
              {ouvert === f.id && f.detail && (
                <ul className="list small" style={{ marginLeft: 12 }}>
                  {f.detail.map((d) => <li key={d.id} className="list-row" style={{ padding: '5px 0' }}><span>{d.titre}</span><span>{milliards(d.md)} · {euros(d.par_habitant_an)}/hab.</span></li>)}
                </ul>
              )}
            </div>
          ))}
          {!toutesFonctions && n.fonctions.length > 5 && <button className="btn ghost small" onClick={() => setToutesFonctions(true)}>Voir {n.fonctions.length - 5 > 1 ? `les ${n.fonctions.length - 5} autres domaines` : "l'autre domaine"}</button>}
          <div className="small muted">Source : Eurostat / INSEE, comptes des administrations publiques (nomenclature internationale COFOG).</div>
        </div>
        <div className="card">
          <h3><PiggyBank size={18} /> D'où vient l'argent</h3>
          <p className="small muted">Principales recettes publiques ({n.recettes[0]?.annee}).</p>
          {(toutesRecettes ? n.recettes : n.recettes.slice(0, 5)).map((r) => (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div className="row between small"><strong>{r.titre}</strong><span>{milliards(r.md)} · {euros(r.par_habitant_an)}/hab.</span></div>
              <Barre part={r.md / Math.max(...n.recettes.map((x) => x.md))} couleur="var(--accent)" />
            </div>
          ))}
          {!toutesRecettes && n.recettes.length > 5 && <button className="btn ghost small" onClick={() => setToutesRecettes(true)}>Voir {n.recettes.length - 5 > 1 ? `les ${n.recettes.length - 5} autres recettes` : "l'autre recette"}</button>}
          <details className="explain">
            <summary><ChevronDown size={15} /> La Sécurité sociale, branche par branche</summary>
            <ul className="list small">{n.secu_branches.map((x) => <li key={x.id} className="list-row" style={{ padding: '5px 0' }}><Link to={`/regles/r/${x.id}`}>{x.titre}</Link><span>{milliards(x.md)}</span></li>)}</ul>
          </details>
        </div>
      </div>

      <BudgetEtat missions={n.etat_missions} depenseTotale={dep} />

      <div className="section-title" id="et-vous" style={{ scrollMarginTop: 80 }}><h2><Wallet size={22} /> Et vous ?</h2></div>
      <div className="row" style={{ marginBottom: 12 }}>
        {situation && <button className={`choice ${titreProfil.startsWith('Votre') ? 'on' : ''}`} aria-pressed={titreProfil.startsWith('Votre')} onClick={() => { setProfil(situation); setTitreProfil('Votre foyer (renseigné dans « Mes droits »)') }}>Mon foyer</button>}
        {PROFILS.map((p) => <button key={p.titre} className={`choice ${titreProfil === p.titre ? 'on' : ''}`} aria-pressed={titreProfil === p.titre} onClick={() => { setProfil(p.s); setTitreProfil(p.titre) }}>{p.titre}</button>)}
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
            <p className="small muted" style={{ marginTop: 10 }}>À cela s'ajoutent les services publics gratuits ou remboursés : école, hôpital, routes, police…
              Toute la dépense publique, retraites comprises, représente en moyenne {euros(n.par_habitant.depense ?? 0)} par habitant et par an ;
              chacun en profite très différemment selon son âge et sa situation.</p>
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
