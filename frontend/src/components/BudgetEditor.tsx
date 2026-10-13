// Répartir le budget de l'État, en langage simple : deux façons de faire, des boutons + / −,
// des domaines décrits en clair, et des dépenses obligatoires expliquées (cadenas).
import { useMemo, useState } from 'react'
import { Lock, Minus, Plus, RotateCcw, Search, Scale, TrendingUp } from 'lucide-react'
import type { Regle, Valeur } from '../lib/api'
import { nombre } from '../lib/format'
import { milliards, parMenageMois } from '../lib/humain'
import { infoMission } from '../lib/missions'
import { Terme } from './Terme'
import { Modal } from './ui'

export function BudgetEditor({ regles, overrides, onClose, onApply }: {
  regles: Regle[]; overrides: Record<string, Valeur>; onClose: () => void; onApply: (o: Record<string, Valeur>) => void
}) {
  const missions = useMemo(() => regles.filter((r) => r.id.startsWith('budget.etat.mission.') && typeof r.valeur === 'number')
    .sort((a, b) => (b.valeur as number) - (a.valeur as number)), [regles])
  const vote = useMemo(() => Object.fromEntries(missions.map((r) => [r.id, Number(r.valeur)])), [missions])
  const initial = useMemo(() => Object.fromEntries(missions.map((r) => [r.id, Number(overrides[r.id] ?? r.valeur)])), [missions, overrides])
  const [vals, setVals] = useState<Record<string, number>>(initial)
  const [touchees, setTouchees] = useState<string[]>(Object.keys(overrides).filter((k) => k.startsWith('budget.etat.mission.')))
  // on rouvre l'éditeur dans le mode qui correspond aux choix déjà faits
  const [mode, setMode] = useState<'repartir' | 'total'>(() =>
    Math.abs(Object.values(initial).reduce((a, b) => a + b, 0) - Object.values(vote).reduce((a, b) => a + b, 0)) > 0.005 ? 'total' : 'repartir')
  const [q, setQ] = useState('')
  const verrou = (id: string) => !!infoMission(id, '').verrou
  const totalVote = Object.values(vote).reduce((a, b) => a + b, 0)
  const total = Object.values(vals).reduce((a, b) => a + b, 0)
  const ecartTotal = total - totalVote
  const deplace = missions.reduce((a, m) => a + Math.max(0, vals[m.id] - vote[m.id]), 0)

  const changer = (id: string, v: number) => {
    const t = touchees.includes(id) ? touchees : [...touchees, id]
    setTouchees(t)
    const next = { ...vals, [id]: Math.max(0, Math.round(v * 1000) / 1000) }
    if (mode === 'repartir') {
      // ce qui est ajouté ici est retiré des domaines non touchés (et non verrouillés), à proportion de leur taille
      const libres = missions.filter((m) => !t.includes(m.id) && !verrou(m.id)).map((m) => m.id)
      const ecart = Object.values(next).reduce((a, b) => a + b, 0) - totalVote
      const base = libres.reduce((a, k) => a + vote[k], 0)
      if (base > 0) for (const k of libres) next[k] = Math.max(0, vote[k] - ecart * vote[k] / base)
    }
    setVals(next)
  }
  const pas = (v: number) => (v >= 20 ? 1 : v >= 5 ? 0.5 : 0.1)
  const reinit = () => { setVals({ ...vote }); setTouchees([]) }
  const appliquer = () => {
    const o: Record<string, Valeur> = {}
    for (const m of missions) if (Math.abs(vals[m.id] - vote[m.id]) > 0.0005) o[m.id] = Math.round(vals[m.id] * 1000) / 1000
    onApply(o)
  }
  const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  const filtre = (m: Regle) => {
    if (!q) return true
    const i = infoMission(m.id, m.titre)
    return norm(`${i.nom} ${i.description} ${i.mots ?? ''}`).includes(norm(q))
  }
  const libres = missions.filter((m) => !verrou(m.id) && filtre(m))
  const bloquees = missions.filter((m) => verrou(m.id) && filtre(m))

  const Ligne = ({ m }: { m: Regle }) => {
    const i = infoMission(m.id, m.titre)
    const v = vals[m.id]
    const d = v - vote[m.id]
    const lock = verrou(m.id)
    return (
      <div className="row between" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)', flexWrap: 'nowrap', alignItems: 'center' }}>
        <div className="grow">
          <div style={{ fontWeight: 650 }}>{lock && <Lock size={14} color="var(--ink-3)" />} {i.nom}</div>
          <div className="small muted">{i.description}</div>
          {lock && <div className="small" style={{ color: 'var(--ink-2)', marginTop: 2 }}>{i.verrou}</div>}
        </div>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
          {!lock && <button className="bouton-plusmoins" onClick={() => changer(m.id, v - pas(vote[m.id]))} aria-label={`Réduire ${i.nom}`}><Minus size={14} /></button>}
          <div style={{ minWidth: 92, textAlign: 'right' }}>
            <div style={{ fontWeight: 750 }}>{nombre(v, v < 10 ? 2 : 1)} Md€</div>
            {Math.abs(d) >= 0.005 && <div className={`small delta ${d > 0 ? 'neg' : 'pos'}`}>{d > 0 ? '+' : '−'}{nombre(Math.abs(d), Math.abs(d) < 1 ? 2 : 1)}</div>}
          </div>
          {!lock && <button className="bouton-plusmoins" onClick={() => changer(m.id, v + pas(vote[m.id]))} aria-label={`Augmenter ${i.nom}`}><Plus size={14} /></button>}
        </div>
      </div>
    )
  }

  return (
    <Modal title="Le budget de l'État : à vous de répartir" onClose={onClose} width={860}>
      <p className="ink2" style={{ marginTop: 0 }}>L'État dépense <strong>{milliards(totalVote)}</strong> par an, répartis en grands domaines
        (les <Terme id="mission">missions</Terme>). Comment voulez-vous faire ?</p>
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <button className={`mode-carte ${mode === 'repartir' ? 'on' : ''}`} onClick={() => { setMode('repartir'); if (Math.abs(ecartTotal) > 0.005) reinit() }}>
          <strong><Scale size={16} /> Répartir autrement</strong>
          <div className="small ink2" style={{ marginTop: 4 }}>Le total ne bouge pas : ce que vous ajoutez à un domaine est retiré <strong>automatiquement</strong> des autres, un peu partout, à proportion de leur taille.</div>
        </button>
        <button className={`mode-carte ${mode === 'total' ? 'on' : ''}`} onClick={() => setMode('total')}>
          <strong><TrendingUp size={16} /> Dépenser plus (ou moins)</strong>
          <div className="small ink2" style={{ marginTop: 4 }}>Le total change. Si vous dépensez plus, il faudra <strong>trouver l'argent</strong> (impôts, autres économies) ou emprunter : l'étape suivante vous aidera.</div>
        </button>
      </div>
      <div className="input-suffix" style={{ marginBottom: 6 }}>
        <input type="search" placeholder="Chercher un domaine : école, armée, police, logement…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="suffix"><Search size={16} /></span>
      </div>
      <div style={{ maxHeight: '46vh', overflowY: 'auto', paddingRight: 6 }}>
        {libres.map((m) => <Ligne key={m.id} m={m} />)}
        {bloquees.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="kpi-label" style={{ marginBottom: 2 }}><Lock size={13} /> Dépenses obligatoires (non modifiables ici)</div>
            <div className="small muted">Elles découlent d'engagements déjà pris ou des règles d'impôt : on ne les change pas d'un simple coup de crayon.</div>
            {bloquees.map((m) => <Ligne key={m.id} m={m} />)}
          </div>
        )}
      </div>
      <div className="card soft" style={{ marginTop: 12, padding: 12 }}>
        {mode === 'repartir' ? (
          deplace > 0.005
            ? <div><strong>Vous déplacez {milliards(deplace)}</strong> vers les domaines que vous avez choisis ; les autres baissent légèrement d'autant. Le total reste {milliards(total)}.</div>
            : <div className="muted">Utilisez les boutons + et − : le total restera identique.</div>
        ) : (
          Math.abs(ecartTotal) < 0.005
            ? <div className="muted">Utilisez les boutons + et − pour dépenser plus ou moins.</div>
            : ecartTotal > 0
              ? <div><strong className="delta neg">+{milliards(ecartTotal)} de dépenses par an</strong> (≈ {parMenageMois(ecartTotal)} par mois et par ménage). Il faudra les financer : après avoir validé, cliquez sur « Voir les effets », le Système vous proposera comment.</div>
              : <div><strong className="delta pos">{milliards(ecartTotal)} d'économies par an</strong> (≈ {parMenageMois(ecartTotal)} par mois et par ménage) : le déficit diminue.</div>
        )}
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={reinit}><RotateCcw size={15} /> Revenir au budget voté</button>
        <div className="row"><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={appliquer}>Valider ces choix</button></div>
      </div>
    </Modal>
  )
}
