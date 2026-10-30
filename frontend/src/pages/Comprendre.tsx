// « Les grandes questions » : comprendre la France en quelques chiffres officiels, expliqués simplement, puis agir
// (calculer pour soi, tester une idée). Chaque chiffre vient d'une statistique du modèle, avec sa source.
import { useEffect, useMemo, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Coins, ExternalLink, Hourglass, Info, Landmark, Leaf, TrendingDown, Users } from 'lucide-react'
import type { Regle } from '../lib/api'
import { PRESETS, resoudrePreset } from '../lib/presets'
import { QUESTIONS, formater, type Question } from '../lib/questions'
import { useApp, useFetch } from '../lib/state'
import { ErrorBox, Loading } from '../components/ui'
import { ProchaineEtape } from '../components/Parcours'

type Stat = { id: string; titre: string; unite: string; derniere: { date: string; valeur: number } | null; source: { id: string; titre?: string; editeur?: string; url?: string } | null }

const ICONES: Record<string, typeof Info> = { Landmark, Coins, TrendingDown, Hourglass, Users, Leaf }

function Icone({ nom, size = 22 }: { nom: string; size?: number }) {
  const I = ICONES[nom] ?? Info
  return <I size={size} />
}

/** Valeurs de tous les chiffres d'une question (statistiques, règles, puis calculs). */
function useChiffres(q: Question | undefined) {
  const ids = q?.chiffres.filter((c) => c.metrique).map((c) => c.metrique).join(',')
  const { data: stats, loading, error } = useFetch<{ metriques: Stat[] }>(ids ? `/api/metriques?ids=${ids}` : null)
  const regleId = q?.chiffres.find((c) => c.regle)?.regle
  const { data: regle } = useFetch<Regle>(regleId ? `/api/regles/${regleId}` : null)
  const valeurs = useMemo(() => {
    const v: Record<string, number> = {}
    if (!q) return v
    for (const c of q.chiffres) {
      if (c.metrique) {
        const s = stats?.metriques.find((x) => x.id === c.metrique)
        if (s?.derniere) v[c.cle] = Number(s.derniere.valeur)
      } else if (c.regle && regle && typeof regle.valeur === 'number') v[c.cle] = regle.valeur
    }
    for (const c of q.chiffres) if (c.calcul) { const x = c.calcul(v); if (x != null) v[c.cle] = x }
    return v
  }, [q, stats, regle])
  return { valeurs, stats: stats?.metriques ?? [], regle, loading, error }
}

/** Remplace {cle} par le chiffre mis en forme (en gras). */
function avecChiffres(texte: string, q: Question, v: Record<string, number>): ReactNode {
  const morceaux = texte.split(/(\{[a-z_]+\})/)
  return morceaux.map((m, i) => {
    const cle = m.match(/^\{([a-z_]+)\}$/)?.[1]
    if (!cle) return <span key={i}>{m}</span>
    const c = q.chiffres.find((x) => x.cle === cle)
    return <strong key={i}>{c && v[cle] != null ? formater(v[cle], c.format, c.absolu) : '…'}</strong>
  })
}

function Liste() {
  return (
    <div className="container page" style={{ maxWidth: 1000 }}>
      <h1>Les grandes questions</h1>
      <p className="lead ink2">Pour comprendre la France en quelques minutes : des réponses simples, avec les chiffres officiels les plus récents et leur source.</p>
      <div className="grid cols-2">
        {QUESTIONS.map((q) => (
          <Link key={q.id} to={`/comprendre/${q.id}`} className="card link question-carte">
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 12 }}>
              <span className="question-icone"><Icone nom={q.icone} /></span>
              <span>
                <h2 style={{ fontSize: '1.15rem', margin: '0 0 4px' }}>{q.titre}</h2>
                <span className="small ink2">{q.accroche.replace(/\{[a-z_]+\}/g, '…')}</span>
                <span className="small" style={{ display: 'block', marginTop: 6, fontWeight: 650, color: 'var(--primary)' }}>Lire la réponse <ArrowRight size={13} /></span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Detail({ q }: { q: Question }) {
  const { valeurs, stats, regle, loading, error } = useChiffres(q)
  const { marquer, setDraft } = useApp()
  const nav = useNavigate()
  const { data: regles } = useFetch<{ regles: Regle[] }>(q.actions.some((a) => a.preset) ? '/api/regles?simulable=true&limit=2000' : null)
  useEffect(() => { marquer('question') }, [marquer])
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
    <div className="container page" style={{ maxWidth: 900 }}>
      <div className="breadcrumb"><Link to="/comprendre">Les grandes questions</Link> › {q.titre}</div>
      <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: 14 }}>
        <span className="question-icone grande"><Icone nom={q.icone} size={28} /></span>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0 }}>{q.titre}</h1>
          <p className="lead ink2" style={{ marginTop: 8 }}>{avecChiffres(q.accroche, q, valeurs)}</p>
        </div>
      </div>

      {loading ? <Loading /> : (
        <div className="grid cols-3" style={{ margin: '18px 0' }}>
          {visibles.map((c) => {
            const s = stats.find((x) => x.id === c.metrique)
            return (
              <div key={c.cle} className="card">
                <div className="kpi-label">{c.libelle}</div>
                {(() => {
                  const t = valeurs[c.cle] != null ? formater(valeurs[c.cle], c.format, c.absolu) : '—'
                  // un chiffre écrit en toutes lettres (« 359,4 millions de tonnes de CO₂ ») s'affiche un peu plus petit
                  return <div className={`kpi ${t.length > 16 ? 'kpi-long' : ''}`}>{t}</div>
                })()}
                <div className="small muted">
                  {s?.derniere?.date && <>{s.derniere.date.slice(0, 4)} · </>}
                  {s?.source ? (s.source.url
                    ? <a href={s.source.url} target="_blank" rel="noreferrer">{s.source.editeur ?? s.source.titre} <ExternalLink size={11} /></a>
                    : <Link to={`/sources/${s.source.id}`}>{s.source.editeur ?? s.source.titre}</Link>)
                    : c.regle && regle ? <Link to={`/regles/r/${regle.id}`}>la règle et son texte officiel</Link> : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>En clair</h2>
        {q.texte.map((t, k) => <p key={k} style={{ fontSize: '1.05rem' }}>{avecChiffres(t, q, valeurs)}</p>)}
        {q.aSavoir && <div className="notice small"><Info size={16} style={{ flexShrink: 0 }} /><div>{q.aSavoir}</div></div>}
      </div>

      <div className="card soft" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>Et vous ?</h2>
        <div className="row" style={{ gap: 10 }}>
          {q.actions.map((a) => a.preset
            ? <button key={a.libelle} className="btn primary" onClick={() => lancer(a.preset!)} disabled={!regles}>{a.libelle} <ArrowRight size={15} /></button>
            : <Link key={a.libelle} to={a.lien!} className="btn">{a.libelle} <ArrowRight size={15} /></Link>)}
        </div>
      </div>

      <div style={{ marginTop: 16 }}><ProchaineEtape apres="question" /></div>

      <div className="row between" style={{ marginTop: 20 }}>
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
