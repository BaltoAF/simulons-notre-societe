import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Calculator, GitFork, HelpCircle, Landmark, PlayCircle, Scale, Search, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Bienvenue } from '../components/Bienvenue'
import { ParcoursDecouverte } from '../components/Parcours'
import { QUESTIONS } from '../lib/questions'
import { useApp, useFetch } from '../lib/state'
import { PRESETS, resoudrePreset } from '../lib/presets'
import type { Regle, Societe } from '../lib/api'
import { nombre, relatif } from '../lib/format'
import { DomainIcon } from '../components/ui'
import { Terme } from '../components/Terme'

export default function Accueil() {
  const { meta, setDraft, parcours } = useApp()
  // première visite : la prise en main s'ouvre d'elle-même (une seule fois) ; ensuite, depuis le bouton ou le menu
  const [visite, setVisite] = useState(!parcours.bienvenue_vue)
  const nav = useNavigate()
  const { data: soc } = useFetch<{ societes: Societe[] }>('/api/societes?tri=populaire')
  const { data: regles } = useFetch<{ regles: Regle[] }>('/api/regles?simulable=true&limit=2000')
  const s = meta?.stats

  const lancerPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!
    const actuelles = Object.fromEntries((regles?.regles ?? []).map((r) => [r.id, r.valeur]))
    setDraft({ overrides: resoudrePreset(p, actuelles), justifications: {}, societe: null, branche: 'principale', nomSociete: p.titre })
    nav('/atelier?lancer=1')
  }

  return (
    <div>
      <section className="hero">
        <div className="container">
          <span className="badge primary" style={{ marginBottom: 14 }}><GitFork size={14} /> Les règles de la France, ouvertes à tous</span>
          <h1>Comprenez les règles de la France. <em>Imaginez les vôtres.</em></h1>
          <p className="lead">Impôts, aides, retraites, climat : voyez ce que la loi vous donne, puis testez vos idées et leurs effets, pour vous et pour le pays.
            Chaque chiffre est prouvé et dit à quel point on peut s'y fier.</p>
          <button className="btn" style={{ marginTop: 6 }} onClick={() => setVisite(true)}><PlayCircle size={17} /> Découvrir le site en 1 minute</button>
          <div className="grid cols-3" style={{ marginTop: 26 }}>
            <Link to="/mes-droits" className="card link" style={{ borderColor: 'var(--primary)' }}>
              <Calculator size={26} color="var(--primary)" />
              <h3 style={{ marginTop: 8 }}>Mes droits</h3>
              <p className="small ink2" style={{ margin: 0 }}>Vos aides, vos impôts, votre âge de départ à la retraite… en 3 questions, sans compte.</p>
            </Link>
            <Link to="/budget" className="card link">
              <Landmark size={26} color="var(--accent)" />
              <h3 style={{ marginTop: 8 }}>Où va l'argent public ?</h3>
              <p className="small ink2" style={{ margin: 0 }}>Le budget de la France, et ce que vous y mettez, poste par poste.</p>
            </Link>
            <Link to="/atelier" className="card link">
              <GitFork size={26} color="var(--gain)" />
              <h3 style={{ marginTop: 8 }}>Changer les règles</h3>
              <p className="small ink2" style={{ margin: 0 }}>Testez une idée : ce qu'elle change pour vous, pour les finances publiques, le climat et le bien-être.</p>
            </Link>
          </div>
        </div>
      </section>

      {visite && <Bienvenue onClose={() => setVisite(false)} />}

      <section className="container" style={{ marginTop: 22 }}>
        <ParcoursDecouverte />
      </section>

      <section className="container">
        <div className="section-title"><h2><HelpCircle size={22} /> Comprendre en quelques minutes</h2><Link to="/comprendre">Toutes les questions <ArrowRight size={14} /></Link></div>
        <div className="grid cols-3">
          {QUESTIONS.map((q) => (
            <Link key={q.id} to={`/comprendre/${q.id}`} className="card link" style={{ padding: 14 }}>
              <strong>{q.titre}</strong>
              <span className="small muted" style={{ display: 'block', marginTop: 4 }}>{q.sousTitre ?? 'Les chiffres officiels, expliqués simplement'} <ArrowRight size={12} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="section-title"><h2>Des idées à tester en un clic</h2><Link to="/atelier">Imaginer la vôtre <ArrowRight size={14} /></Link></div>
        <div className="grid cols-3">
          {PRESETS.slice(0, 6).map((p) => (
            <button key={p.id} className="preset" onClick={() => lancerPreset(p.id)}>
              <strong>{p.titre}</strong>
              <span className="small muted">{p.description}</span>
              <div className="pill-list" style={{ marginTop: 8 }}>{p.tags.map((t) => <span key={t} className="badge">{t}</span>)}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="section-title"><h2>Comment ça marche</h2><Link to="/methode">En savoir plus <ArrowRight size={14} /></Link></div>
      </section>
      <section className="container">
        <div className="grid cols-3">
          <div className="card">
            <div className="row"><span className="step-num">1</span><h3 style={{ margin: 0 }}>La France d'aujourd'hui</h3></div>
            <p className="ink2" style={{ marginTop: 10 }}>Toutes les règles en vigueur : c'est la « <Terme id="societe_1_0">loi actuelle</Terme> ». Chaque valeur est <strong>prouvée</strong> par un texte officiel, et tenue à jour automatiquement quand la loi change.</p>
            <Link to="/regles">Explorer les règles <ArrowRight size={14} /></Link>
          </div>
          <div className="card">
            <div className="row"><span className="step-num">2</span><h3 style={{ margin: 0 }}>Votre version</h3></div>
            <p className="ink2" style={{ marginTop: 10 }}>Changez une ou plusieurs règles et enregistrez votre proposition. Les autres peuvent s'en inspirer, créer leur version et vous suggérer des améliorations. Chaque changement est <strong>signé et daté</strong>.</p>
            <Link to="/societes">Voir les propositions <ArrowRight size={14} /></Link>
          </div>
          <div className="card">
            <div className="row"><span className="step-num">3</span><h3 style={{ margin: 0 }}>Les effets, sans tricher</h3></div>
            <p className="ink2" style={{ marginTop: 10 }}>Pour votre foyer et pour le pays : argent, inégalités, climat, bien-être. Toute dépense en plus doit être <strong>financée ailleurs</strong>, et toute hausse des émissions compensée. Quand les études se contredisent, le site tranche et dit avec quelle confiance.</p>
            <Link to="/preuves">Voir les études <ArrowRight size={14} /></Link>
          </div>
        </div>
      </section>


      <section className="container">
        <div className="section-title"><h2>Toutes les règles, par thème</h2><Link to="/regles"><Search size={14} /> Rechercher une règle</Link></div>
        <div className="grid auto">
          {(meta?.domaines ?? []).map((d) => (
            <Link key={d.id} to={`/regles/d/${d.id}`} className="card link">
              <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <DomainIcon name={d.icone} />
                <div className="grow">
                  <h3 style={{ marginBottom: 2 }}>{d.titre}</h3>
                  <div className="small muted">{d.question}</div>
                  <div className="small" style={{ marginTop: 6, fontWeight: 650 }}>{d.nb_regles ? `${d.nb_regles} règles` : 'En cours de numérisation'}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="grid cols-2" style={{ marginTop: 32 }}>
          <div className="card">
            <h3><ShieldCheck size={18} /> Des principes non négociables</h3>
            <ul className="list small">
              <li><BadgeCheck size={15} color="var(--gain)" /> <strong>Pas de chiffre sans source.</strong> Chaque règle renvoie à son texte (Légifrance, JO, BOFiP) ; chaque estimation à son étude.</li>
              <li><Scale size={15} color="var(--primary)" /> <strong>Neutralité.</strong> Toutes les études crédibles sont prises en compte, même contradictoires. La synthèse est calculée par une méthode publique.</li>
              <li><GitFork size={15} color="var(--accent)" /> <strong>Ouverture.</strong> Tester est libre et anonyme ; un compte ne sert qu'à enregistrer et partager. Le code et les données sont publics.</li>
            </ul>
          </div>
          <div className="card">
            <h3><GitFork size={18} /> Exemples de propositions</h3>
            <ul className="list">
              {(soc?.societes ?? []).slice(0, 5).map((x) => (
                <li key={x.id} className="list-row">
                  <div><Link to={`/societes/${x.id}`}><strong>{x.nom}</strong></Link>
                    <div className="small muted">{x.reference ? 'La loi actuelle, tenue à jour automatiquement' : `par ${x.owner_pseudo} · ${x.nb_mesures != null
                      ? `${x.nb_mesures} changement${x.nb_mesures > 1 ? 's' : ''}${x.nb_equilibrage ? ` (+ ${x.nb_equilibrage} pour l'équilibrer)` : ''}`
                      : `${x.nb_differences ?? 0} règle${(x.nb_differences ?? 0) > 1 ? 's' : ''} changée${(x.nb_differences ?? 0) > 1 ? 's' : ''}`}`} · {relatif(x.updated_at)}</div></div>
                  {x.etoiles > 0 && <span className="badge">★ {x.etoiles}</span>}
                </li>
              ))}
            </ul>
            <Link to="/societes" className="small">Toutes les propositions <ArrowRight size={13} /></Link>
          </div>
        </div>
      </section>

      {s && (
        <section className="container" style={{ marginTop: 28 }}>
          <div className="card soft">
            <div className="grid cols-4">
              <div><div className="kpi">{nombre(s.regles, 0)}</div><div className="kpi-label">règles numérisées</div></div>
              <div><div className="kpi">{nombre(s.sources, 0)}</div><div className="kpi-label">sources référencées</div></div>
              <div><div className="kpi">{s.regles ? nombre(s.regles_texte_officiel / s.regles * 100, 0) : 0} %</div><div className="kpi-label">des règles prouvées par un texte officiel</div></div>
              <div><div className="kpi">{nombre(s.estimations, 0)}</div><div className="kpi-label">résultats d'études, sur {nombre(s.preuves, 0)} grandes questions</div></div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
