// « Les grandes questions » : comprendre la France en quelques chiffres officiels, expliqués simplement, puis agir
// (calculer pour soi, tester une idée). Chaque chiffre vient d'une statistique du modèle, avec sa source.
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Briefcase, Coins, ExternalLink, Globe, GraduationCap, HeartPulse, Hourglass, Info, Landmark, Leaf, Scale, TrendingDown, Users } from 'lucide-react'
import { api, type Regle } from '../lib/api'
import { natureLien } from '../lib/format'
import { teinteQuestion } from '../lib/teintes'
import { PRESETS, resoudrePreset } from '../lib/presets'
import { QUESTIONS, VRAI_FAUX, formater, type Chiffre, type Question, type VraiFaux } from '../lib/questions'
import { useApp, useFetch } from '../lib/state'
import { ErrorBox, Loading } from '../components/ui'
import { Terme } from '../components/Terme'
import { ProchaineEtape } from '../components/Parcours'
import { ProposerSoutien } from '../components/Soutien'
import { noterActionUtile } from '../lib/soutien'

type Point = { date: string; valeur: number; source?: string }
type SourceCourte = { id: string; titre?: string; editeur?: string; url?: string }
type Stat = { id: string; titre: string; unite: string; derniere: Point | null; premiere?: Point | null; serie?: Point[]; sources_serie?: Record<string, SourceCourte>; source: { id: string; titre?: string; editeur?: string; url?: string } | null }

const ICONES: Record<string, typeof Info> = { Landmark, Coins, TrendingDown, Hourglass, Users, Leaf, Briefcase, GraduationCap, HeartPulse, Globe }

function Icone({ nom, size = 22 }: { nom: string; size?: number }) {
  const I = ICONES[nom] ?? Info
  return <I size={size} />
}

/** Valeurs de tous les chiffres d'une question (statistiques, règles, puis calculs). */
function useChiffres(q: Question | undefined) {
  const ids = q?.chiffres.filter((c) => c.metrique).map((c) => c.metrique).join(',')
  const { data: stats, loading, error } = useFetch<{ metriques: Stat[] }>(ids ? `/api/metriques?ids=${ids}` : null)
  const [regles, setRegles] = useState<Record<string, Regle>>({})
  useEffect(() => {
    const ids = (q?.chiffres ?? []).map((c) => c.regle).filter((x): x is string => !!x)
    Promise.all(ids.map((id) => api<Regle>(`/api/regles/${id}`).then((r) => [id, r] as const).catch(() => null)))
      .then((rs) => setRegles(Object.fromEntries(rs.filter((x): x is readonly [string, Regle] => !!x))))
  }, [q])
  const valeurs = useMemo(() => {
    const v: Record<string, number> = {}
    if (!q) return v
    for (const c of q.chiffres) {
      if (c.metrique) {
        const s = stats?.metriques.find((x) => x.id === c.metrique)
        const point = c.annee ? s?.serie?.find((p) => p.date.startsWith(c.annee!)) : c.premiere ? s?.premiere : s?.derniere
        if (point) v[c.cle] = Number(point.valeur)
      } else if (c.regle && typeof regles[c.regle]?.valeur === 'number') v[c.cle] = regles[c.regle].valeur as number
    }
    for (const c of q.chiffres) if (c.calcul) { const x = c.calcul(v); if (x != null) v[c.cle] = x }
    return v
  }, [q, stats, regles])
  return { valeurs, stats: stats?.metriques ?? [], regles, loading, error }
}

// mots techniques expliqués au toucher (la première fois seulement dans un paragraphe)
const TERMES: [RegExp, string][] = [
  [/PIB/, 'pib'], [/au sens du BIT/, 'chomage_bit'], [/\bactifs\b/, 'actifs'], [/équivalent CO₂/, 'equivalent_co2'],
  [/minima sociaux/, 'minima_sociaux'], [/budget carbone/, 'budget_carbone'], [/TVA/, 'tva'], [/CSG/, 'csg'],
]

function avecTermes(txt: string, deja: Set<string>): ReactNode[] {
  // le premier terme pas encore expliqué qui apparaît le plus tôt dans le texte
  const trouve = TERMES.filter(([, id]) => !deja.has(id))
    .map(([re, id]) => ({ m: new RegExp(`(?:«[\\s\u202f\u00a0]?)?(?:${re.source})(?:[\\s\u202f\u00a0]?»)?`).exec(txt), id }))
    .filter((x) => x.m).sort((a, b) => a.m!.index - b.m!.index)[0]
  if (!trouve) return [txt]
  deja.add(trouve.id)
  const { index } = trouve.m!, mot = trouve.m![0]
  return [txt.slice(0, index), <Terme key={trouve.id} id={trouve.id}>{mot}</Terme>, ...avecTermes(txt.slice(index + mot.length), deja)]
}

/** Remplace {cle} par le chiffre mis en forme (en gras) ; les mots techniques sont expliqués au survol. */
function avecChiffres(texte: string, q: Question, v: Record<string, number>, gras = true): ReactNode {
  const morceaux = texte.split(/(\{[a-z0-9_]+\})/)
  const deja = new Set<string>()
  return morceaux.map((m, i) => {
    const cle = m.match(/^\{([a-z0-9_]+)\}$/)?.[1]
    const c = cle ? q.chiffres.find((x) => x.cle === cle) : undefined
    // chiffre pas encore chargé : un repère discret plutôt qu'une phrase à trous
    if (cle && (!c || v[cle] == null)) return <span key={i} className="attente-chiffre" role="img" aria-label="chiffre en cours de chargement" />
    const txt = cle && c ? formater(v[cle], c.format, c.absolu) : m
    const rendu = avecTermes(txt, deja)
    return cle && gras ? <strong key={i}>{rendu}</strong> : <span key={i}>{rendu}</span>
  })
}

function Liste() {
  // les chiffres cités dans les accroches, lus en une seule requête
  // un chiffre calculé (« l'impôt sur le revenu en rapporte environ 8 % ») a besoin de toutes les statistiques de sa question :
  // sans elles, l'accroche affichait « environ  % » (test Odette)
  const cites = QUESTIONS.flatMap((q) => {
    const direct = (q.accroche.match(/\{([a-z0-9_]+)\}/g) ?? []).map((k) => q.chiffres.find((c) => c.cle === k.slice(1, -1)))
    return direct.some((c) => c?.calcul) ? q.chiffres : direct
  })
  const ids = [...new Set(cites.map((c) => c?.metrique).filter(Boolean))].join(',')
  const { data } = useFetch<{ metriques: Stat[] }>(ids ? `/api/metriques?ids=${ids}` : null)
  const valeursDe = (q: Question) => {
    const v: Record<string, number> = {}
    for (const c of q.chiffres) {
      const m = data?.metriques.find((x) => x.id === c.metrique)
      if (m?.derniere) v[c.cle] = Number(m.derniere.valeur)
    }
    for (const c of q.chiffres) if (c.calcul) { const x = c.calcul(v); if (x != null && Number.isFinite(x)) v[c.cle] = x }
    return v
  }
  const accroche = (q: Question) => {
    const v = valeursDe(q)
    return q.accroche.split(/(\{[a-z0-9_]+\})/).map((morceau, i) => {
      const k = morceau.match(/^\{([a-z0-9_]+)\}$/)?.[1]
      if (!k) return morceau
      const c = q.chiffres.find((x) => x.cle === k)
      return c && v[k] != null ? formater(v[k], c.format, c.absolu)
        : <span key={i} className="attente-chiffre" role="img" aria-label="chiffre en cours de chargement" />
    })
  }
  return (
    <div className="container page" style={{ maxWidth: 1000 }}>
      <h1>Les grandes questions</h1>
      <p className="lead ink2">Pour comprendre la France en quelques minutes : des réponses simples, avec les chiffres officiels les plus récents et leur source.</p>
      <div className="grid cols-2">
        {QUESTIONS.map((q) => (
          <Link key={q.id} to={`/comprendre/${q.id}`} className={`card link question-carte carte-teinte ${teinteQuestion(q.id)}`}>
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
              <span className="question-icone"><Icone nom={q.icone} /></span>
              <span>
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 4px' }}>{q.titre}</h2>
                <span className="small ink2">{accroche(q)}</span>
                <span className="small" style={{ display: 'block', marginTop: 6, fontWeight: 650, color: 'var(--primary)' }}>Lire la réponse <ArrowRight size={13} /></span>
              </span>
            </div>
          </Link>
        ))}
      </div>
      <VraiOuFaux />
    </div>
  )
}

/** Valeurs d'une liste de chiffres (statistiques lues d'un coup, puis calculs). */
function useValeurs(chiffres: Chiffre[]) {
  const ids = [...new Set(chiffres.map((c) => c.metrique).filter(Boolean))].join(',')
  const { data } = useFetch<{ metriques: Stat[] }>(ids ? `/api/metriques?ids=${ids}` : null)
  return useMemo(() => {
    const v: Record<string, number> = {}
    for (const c of chiffres) {
      const m = data?.metriques.find((x) => x.id === c.metrique)
      if (m?.derniere) v[c.cle] = Number(m.derniere.valeur)
    }
    for (const c of chiffres) if (c.calcul) { const x = c.calcul(v); if (x != null) v[c.cle] = x }
    return { v, sources: [...new Set((data?.metriques ?? []).map((m) => m.source?.editeur).filter(Boolean))] as string[] }
  }, [chiffres, data])
}

const VERDICTS = { vrai: { txt: 'Vrai', cls: 'gain' }, faux: { txt: 'Faux', cls: 'loss' }, nuance: { txt: "C'est plus compliqué", cls: 'warn' } }

function CarteVraiFaux({ c }: { c: VraiFaux }) {
  const [vu, setVu] = useState(false)
  const { v, sources } = useValeurs(c.chiffres)
  const q = { chiffres: c.chiffres } as Question
  return (
    <div className="card vrai-faux">
      <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: '0 0 10px' }}>« {c.affirmation} »</p>
      {!vu ? <button className="btn" onClick={() => setVu(true)} aria-expanded={false}>Vrai ou faux ? Voir la réponse</button> : (
        <div role="status">
          <span className={`badge ${VERDICTS[c.verdict].cls}`} style={{ fontSize: '.9rem' }}>{VERDICTS[c.verdict].txt}</span>
          <p style={{ margin: '8px 0 6px' }}>{avecChiffres(c.explication, q, v)}</p>
          <div className="small muted">{sources.length > 0 && <>Sources : {sources.join(', ')}. </>}{c.lien && <Link to={c.lien.lien!}>{c.lien.libelle} →</Link>}</div>
        </div>
      )}
    </div>
  )
}

function VraiOuFaux() {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: '1.3rem' }}>Vrai ou faux ?</h2>
      <p className="ink2" style={{ marginTop: 0 }}>Des idées qu'on entend souvent, vérifiées avec les chiffres officiels. Faites-vous votre avis avant de regarder la réponse.</p>
      <div className="grid cols-2">{VRAI_FAUX.map((c) => <CarteVraiFaux key={c.id} c={c} />)}</div>
    </section>
  )
}

type Fonction = { id: string; titre: string; md: number; description?: string }

/** « Sur 100 € d'argent public » : la dépense publique répartie par grand domaine (comptes des administrations, Eurostat/Insee). */
function Sur100() {
  const { data } = useFetch<{ fonctions: Fonction[]; total_fonctions: number }>('/api/budget/national')
  if (!data?.fonctions?.length) return null
  const total = data.fonctions.reduce((a, f) => a + f.md, 0)
  const max = Math.max(...data.fonctions.map((f) => f.md))
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>Sur 100 € d'argent public</h2>
      <ul className="list">
        {data.fonctions.map((f) => (
          <li key={f.id}>
            <div className="row between" style={{ flexWrap: 'nowrap', gap: 10 }}>
              <span><strong>{f.titre}</strong>{f.description && <span className="small muted"> — {f.description}</span>}</span>
              <strong style={{ whiteSpace: 'nowrap' }}>{Math.round((f.md / total) * 100)} €</strong>
            </div>
            <div className="bar-track" style={{ height: 8 }}><div className="bar-fill" style={{ width: `${(f.md / max) * 100}%` }} /></div>
          </li>
        ))}
      </ul>
      <p className="small muted" style={{ marginBottom: 0 }}>Toutes les administrations (État, Sécurité sociale, collectivités), par grand domaine. « Protection sociale » regroupe surtout les retraites, mais aussi les allocations familiales, le chômage et les aides. Source : Eurostat et Insee.</p>
    </div>
  )
}

function Detail({ q }: { q: Question }) {
  const { valeurs, stats, regles: reglesCitees, loading, error } = useChiffres(q)
  const { marquer, setDraft } = useApp()
  const nav = useNavigate()
  const { data: regles } = useFetch<{ regles: Regle[] }>(q.actions.some((a) => a.preset) ? '/api/regles?simulable=true&limit=2000' : null)
  useEffect(() => { marquer('question'); noterActionUtile('question') }, [marquer])
  const i = QUESTIONS.indexOf(q)
  const suivante = QUESTIONS[(i + 1) % QUESTIONS.length]

  const lancer = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)
    if (!p) return
    const actuelles = Object.fromEntries((regles?.regles ?? []).map((r) => [r.id, r.valeur]))
    setDraft({ overrides: resoudrePreset(p, actuelles), justifications: {}, societe: null, branche: 'principale', nomSociete: p.titre })
    nav('/atelier?lancer=1')
  }

  if (error) return <div className="container page"><ErrorBox message={error} /></div>
  const visibles = q.chiffres.filter((c) => !c.cache)
  return (
    <div className={`container page ${teinteQuestion(q.id)}`} style={{ maxWidth: 900 }}>
      <div className="breadcrumb"><Link to="/comprendre">Les grandes questions</Link> › {q.titre}</div>
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 14 }}>
        <span className="question-icone grande"><Icone nom={q.icone} size={28} /></span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{q.titre}</h1>
          <p className="lead ink2" style={{ marginTop: 8 }}>{avecChiffres(q.accroche, q, valeurs)}</p>
        </div>
      </div>

      {q.enBref && (
        <div className="card en-bref" style={{ marginTop: 14 }}>
          <div className="kpi-label">En bref</div>
          <p style={{ margin: '4px 0 0', fontSize: '1.1rem' }}>{avecChiffres(q.enBref, q, valeurs)}</p>
        </div>
      )}

      {loading ? <Loading /> : (
        <div className="grid cols-3" style={{ margin: '18px 0' }}>
          {visibles.map((c) => {
            const s = stats.find((x) => x.id === c.metrique)
            return (
              <div key={c.cle} className="card kpi-teinte">
                <div className="kpi-label">{c.libelle}</div>
                {(() => {
                  const t = valeurs[c.cle] != null ? formater(valeurs[c.cle], c.format, c.absolu) : '—'
                  // un chiffre écrit en toutes lettres (« 359,4 millions de tonnes de CO₂ ») s'affiche un peu plus petit
                  return <div className={`kpi ${t.length > 16 ? 'kpi-long' : ''}`}>{t}</div>
                })()}
                <div className="small muted">
                  {s?.derniere?.date && <>{s.derniere.date.slice(0, 4)} · </>}
                  {s?.source ? (s.source.url
                    ? <a href={s.source.url} target="_blank" rel="noreferrer">{s.source.editeur ?? s.source.titre}{natureLien(s.source.url)} <ExternalLink size={11} /></a>
                    : <Link to={`/sources/${s.source.id}`}>{s.source.editeur ?? s.source.titre}</Link>)
                    : c.regle && reglesCitees[c.regle] ? <Link to={`/regles/r/${c.regle}`}>la règle et son texte officiel</Link> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>En clair</h2>
        {q.texte.map((t, k) => <p key={k} style={{ fontSize: '1.05rem' }}>{avecChiffres(t, q, valeurs)}</p>)}
        {q.aSavoir && <div className="notice small"><Info size={16} style={{ flexShrink: 0 }} /><div>{avecChiffres(q.aSavoir, q, valeurs, false)}</div></div>}
        {/* les chiffres cités seulement dans le texte (années anciennes, comparaisons) n'avaient pas de source visible
            (relecture de neutralité) : chacun avec la publication d'où vient le point utilisé */}
        <details className="curieux small" style={{ marginTop: 12 }}>
          <summary>D'où viennent ces chiffres ?</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 20 }} className="ink2">
            {q.chiffres.filter((c) => c.metrique || c.regle).map((c) => {
              if (c.regle) return <li key={c.cle}>{c.libelle} : <Link to={`/regles/r/${c.regle}`}>la règle et son texte officiel</Link></li>
              const s = stats.find((x) => x.id === c.metrique)
              const point = c.annee ? s?.serie?.find((p) => p.date.startsWith(c.annee!)) : c.premiere ? s?.premiere : s?.derniere
              const src = point?.source ? s?.sources_serie?.[point.source] : undefined
              if (!point || !src) return null
              return <li key={c.cle}>{c.libelle}{c.libelle.includes(point.date.slice(0, 4)) ? '' : ` (${point.date.slice(0, 4)})`} : {src.url
                ? <a href={src.url} target="_blank" rel="noreferrer">{src.editeur}{src.titre ? ` – ${src.titre}` : ''} <ExternalLink size={11} /></a>
                : <Link to={`/sources/${src.id}`}>{src.editeur}{src.titre ? ` – ${src.titre}` : ''}</Link>}</li>
            })}
          </ul>
        </details>
      </div>

      {q.debat && (
        // deux positions à égalité (même couleur, même place) : le site ne choisit pas
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}><Scale size={20} /> Ce qui fait débat</h2>
          <p style={{ fontWeight: 650, fontSize: '1.05rem' }}>{q.debat.question}</p>
          <div className={`grid cols-${q.debat.positions.length}`}>
            {q.debat.positions.map((p) => (
              <div key={p.titre}>
                <div className="kpi-label">{p.titre}</div>
                <p style={{ margin: '4px 0 0' }}>{p.texte}</p>
              </div>
            ))}
          </div>
          <p className="small muted" style={{ marginBottom: 0, marginTop: 14 }}>Le site ne tranche pas : la réponse dépend aussi de ce qui compte le plus pour chacun.
            Pour voir ce que changerait une idée, chiffres à l'appui, testez-la dans <Link to="/atelier">« Changer les règles »</Link>.</p>
        </div>
      )}

      {q.id === 'depenses-publiques' && <Sur100 />}

      <div className="card soft" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>Et vous ?</h2>
        <div className="row" style={{ gap: 10 }}>
          {q.actions.map((a) => a.preset
            ? <button key={a.libelle} className="btn primary" onClick={() => lancer(a.preset!)} disabled={!regles}>{a.libelle} <ArrowRight size={15} /></button>
            : <Link key={a.libelle} to={a.lien!} className="btn">{a.libelle} <ArrowRight size={15} /></Link>)}
        </div>
      </div>

      <div style={{ marginTop: 16 }}><ProchaineEtape apres="question" /></div>
      <ProposerSoutien />

      <div className="row between nav-questions" style={{ marginTop: 20, rowGap: 18 }}>
        <Link to="/comprendre">← Toutes les questions</Link>
        <Link to={`/comprendre/${suivante.id}`}>Question suivante : {suivante.titre} →</Link>
      </div>
    </div>
  )
}

export default function Comprendre() {
  const { id } = useParams()
  if (!id) return <Liste />
  const q = QUESTIONS.find((x) => x.id === id)
  if (!q) return <div className="container page"><ErrorBox message="Question introuvable" /></div>
  return <Detail key={q.id} q={q} />
}
