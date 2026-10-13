import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Calculator, GitFork, Landmark, Scale, Search, ShieldCheck } from 'lucide-react'
import { useApp, useFetch } from '../lib/state'
import { PRESETS, resoudrePreset } from '../lib/presets'
import type { Regle, Societe } from '../lib/api'
import { nombre, relatif } from '../lib/format'
import { DomainIcon } from '../components/ui'

export default function Accueil() {
  const { meta, setDraft } = useApp()
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
          <span className="badge primary" style={{ marginBottom: 14 }}><GitFork size={14} /> Les règles de la société, en open source</span>
          <h1>Et si on changeait les règles ? <em>Mesurons d'abord.</em></h1>
          <p className="lead">Société 2.0 traduit les règles de la France — impôts, aides, travail, retraites, justice, institutions… — en paramètres
            vérifiables. Chacun peut en créer sa version, comme on « forke » un logiciel, et voir ce que ça change : pour soi, pour le pays,
            avec un indice de confiance pour chaque chiffre.</p>
          <div className="grid cols-3" style={{ marginTop: 26 }}>
            <Link to="/mes-droits" className="card link" style={{ borderColor: 'var(--primary)' }}>
              <Calculator size={26} color="var(--primary)" />
              <h3 style={{ marginTop: 8 }}>Que me donne la société ?</h3>
              <p className="small ink2" style={{ margin: 0 }}>Vos aides, vos impôts, votre âge de départ à la retraite… en 3 questions.</p>
            </Link>
            <Link to="/budget" className="card link">
              <Landmark size={26} color="var(--accent)" />
              <h3 style={{ marginTop: 8 }}>Où va l'argent public ?</h3>
              <p className="small ink2" style={{ margin: 0 }}>Du budget de la France à votre propre contribution, poste par poste.</p>
            </Link>
            <Link to="/atelier" className="card link">
              <GitFork size={26} color="var(--gain)" />
              <h3 style={{ marginTop: 8 }}>Et si on changeait les règles ?</h3>
              <p className="small ink2" style={{ margin: 0 }}>Testez une idée : effets sur vous, l'économie, le social, la planète et le bien-être.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="container">
        <div className="grid cols-3">
          <div className="card">
            <div className="row"><span className="step-num">1</span><h3 style={{ margin: 0 }}>La Société 1.0</h3></div>
            <p className="ink2" style={{ marginTop: 10 }}>Les règles en vigueur aujourd'hui. Chaque valeur est <strong>prouvée</strong> par un texte officiel ou une statistique publique, et tenue à jour par le Système.</p>
            <Link to="/regles">Explorer les règles <ArrowRight size={14} /></Link>
          </div>
          <div className="card">
            <div className="row"><span className="step-num">2</span><h3 style={{ margin: 0 }}>Votre version</h3></div>
            <p className="ink2" style={{ marginTop: 10 }}>Modifiez une ou plusieurs règles, enregistrez votre société, proposez-la, améliorez celle des autres. Tout est versionné et public, <strong>comme git</strong>.</p>
            <Link to="/societes">Voir les sociétés proposées <ArrowRight size={14} /></Link>
          </div>
          <div className="card">
            <div className="row"><span className="step-num">3</span><h3 style={{ margin: 0 }}>Les impacts, sourcés</h3></div>
            <p className="ink2" style={{ marginTop: 10 }}>Pour votre foyer et pour le pays, sur quatre dimensions : économie, social, écologie et bien-être. Une hausse qui dégrade le budget public ou le budget carbone doit être <strong>compensée ailleurs</strong>. Quand les études divergent, le Système tranche et dit avec quelle confiance.</p>
            <Link to="/preuves">Voir les études <ArrowRight size={14} /></Link>
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
              <div><div className="kpi">{nombre(s.estimations, 0)}</div><div className="kpi-label">estimations issues de {nombre(s.preuves, 0)} questions d'études</div></div>
            </div>
          </div>
        </section>
      )}

      <section className="container">
        <div className="section-title"><h2>Des idées à tester en un clic</h2><Link to="/atelier">Composer la vôtre <ArrowRight size={14} /></Link></div>
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
        <div className="section-title"><h2>Toutes les règles de la société</h2><Link to="/regles"><Search size={14} /> Rechercher une règle</Link></div>
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
              <li><GitFork size={15} color="var(--accent)" /> <strong>Ouverture.</strong> Tester est libre et anonyme ; proposer nécessite seulement de s'identifier. Code et données sont ouverts.</li>
            </ul>
          </div>
          <div className="card">
            <h3><GitFork size={18} /> Sociétés populaires</h3>
            <ul className="list">
              {(soc?.societes ?? []).slice(0, 5).map((x) => (
                <li key={x.id} className="list-row">
                  <div><Link to={`/societes/${x.id}`}><strong>{x.nom}</strong></Link>
                    <div className="small muted">{x.reference ? 'Référence, maintenue par le Système' : `par ${x.owner_pseudo} · ${x.nb_differences ?? 0} règle(s) modifiée(s)`} · {relatif(x.updated_at)}</div></div>
                  <span className="badge">★ {x.etoiles}</span>
                </li>
              ))}
            </ul>
            <Link to="/societes" className="small">Toutes les sociétés <ArrowRight size={13} /></Link>
          </div>
        </div>
      </section>
    </div>
  )
}
