// Modifier le budget de l'État, en langage simple : d'abord une question (garder le même total ou non),
// puis des boutons + / − sur des domaines décrits en clair ; les dépenses obligatoires sont expliquées (cadenas).
import { useMemo, useState } from 'react'
import { Lock, Minus, Plus, RotateCcw, Search, Scale, TrendingUp } from 'lucide-react'
import type { Regle, Valeur } from '../lib/api'
import { nombre } from '../lib/format'
import { milliards, parMenageMois } from '../lib/humain'
import { infoMission } from '../lib/missions'
import { Modal } from './ui'

type Mode = 'repartir' | 'total'

export function BudgetEditor({ regles, overrides, onClose, onApply }: {
  regles: Regle[]; overrides: Record<string, Valeur>; onClose: () => void; onApply: (o: Record<string, Valeur>) => void
}) {
  const missions = useMemo(() => regles.filter((r) => r.id.startsWith('budget.etat.mission.') && typeof r.valeur === 'number')
    .sort((a, b) => (b.valeur as number) - (a.valeur as number)), [regles])
  const vote = useMemo(() => Object.fromEntries(missions.map((r) => [r.id, Number(r.valeur)])), [missions])
  const initial = useMemo(() => Object.fromEntries(missions.map((r) => [r.id, Number(overrides[r.id] ?? r.valeur)])), [missions, overrides])
  const [vals, setVals] = useState<Record<string, number>>(initial)
  const [touchees, setTouchees] = useState<string[]>(Object.keys(overrides).filter((k) => k.startsWith('budget.etat.mission.')))
  // Aucun mode imposé : on pose la question. Si des choix existent déjà, on rouvre dans le mode correspondant.
  const [mode, setMode] = useState<Mode | null>(() => {
    if (!Object.keys(overrides).some((k) => k.startsWith('budget.etat.mission.'))) return null
    const ecart = Object.values(initial).reduce((a, b) => a + b, 0) - Object.values(vote).reduce((a, b) => a + b, 0)
    return Math.abs(ecart) > 0.005 ? 'total' : 'repartir'
  })
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
      const base = libres.reduce((a, k) => a + vote[k], 0)
      // écart calculé avec les domaines libres à leur valeur votée (sinon les baisses précédentes seraient comptées deux fois)
      const ecart = missions.filter((m) => !libres.includes(m.id)).reduce((a, m) => a + next[m.id], 0) + base - totalVote
      if (base > 0) for (const k of libres) next[k] = Math.max(0, vote[k] - ecart * vote[k] / base)
    }
    setVals(next)
  }
  const pas = (v: number) => (v >= 20 ? 1 : v >= 5 ? 0.5 : 0.1)
  const libellePas = (v: number) => (pas(v) >= 1 ? '1 milliard' : pas(v) >= 0.5 ? '500 millions' : '100 millions')
  const reinit = () => { setVals({ ...vote }); setTouchees([]) }
  const choisirMode = (m: Mode) => {
    // passer de « dépenser plus » à « répartir » : on repart du budget voté, sinon le total ne serait pas respecté
    if (m === 'repartir' && Math.abs(ecartTotal) > 0.005) reinit()
    setMode(m)
  }
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

  // fonction (et non composant) : un composant déclaré ici serait recréé à chaque rendu, ce qui ferait perdre le focus
  const ligne = (m: Regle) => {
    const i = infoMission(m.id, m.titre)
    const v = vals[m.id]
    const d = v - vote[m.id]
    const lock = verrou(m.id)
    return (
      <div key={m.id} className="ligne-budget">
        <div className="grow">
          <div style={{ fontWeight: 650 }}>{lock && <Lock size={14} color="var(--ink-2)" />} {i.nom}{lock && <span className="badge" style={{ marginLeft: 6 }}>obligatoire</span>}</div>
          <div className="small muted">{i.description}</div>
          {lock && <div className="small" style={{ color: 'var(--ink-2)', marginTop: 2 }}>{i.verrou}</div>}
        </div>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
          {!lock && <button className="bouton-plusmoins" onClick={() => changer(m.id, v - pas(vote[m.id]))} aria-label={`Réduire ${i.nom} de ${libellePas(vote[m.id])}`} title={`− ${libellePas(vote[m.id])}`}><Minus size={16} /></button>}
          <div style={{ minWidth: 96, textAlign: 'right' }}>
            <div style={{ fontWeight: 750 }}>{nombre(v, v < 10 ? 2 : 1)} Md€</div>
            {Math.abs(d) >= 0.005 && <div className={`small delta ${d > 0 ? 'neg' : 'pos'}`}>{d > 0 ? '+' : '−'}{nombre(Math.abs(d), Math.abs(d) < 1 ? 2 : 1)} Md€</div>}
          </div>
          {!lock && <button className="bouton-plusmoins" onClick={() => changer(m.id, v + pas(vote[m.id]))} aria-label={`Augmenter ${i.nom} de ${libellePas(vote[m.id])}`} title={`+ ${libellePas(vote[m.id])}`}><Plus size={16} /></button>}
        </div>
      </div>
    )
  }

  const resume = mode === null ? null : mode === 'repartir' ? (
    deplace > 0.005
      ? <div><strong>Vous déplacez {milliards(deplace)}</strong> vers les domaines choisis ; les autres baissent un peu, chacun selon sa taille. Le total reste {milliards(total)}.</div>
      : <div className="muted">Utilisez + et − : le total restera {milliards(totalVote)}.</div>
  ) : (
    Math.abs(ecartTotal) < 0.005
      ? <div className="muted">Utilisez + et − pour dépenser plus ou moins.</div>
      : ecartTotal > 0
        ? <div><strong className="delta neg">+{milliards(ecartTotal)} de dépenses par an</strong>{Math.abs(ecartTotal) >= 0.4 && <> (≈ {parMenageMois(ecartTotal)} par mois et par ménage)</>}. Il faudra les financer : à l'étape suivante, le site vous proposera comment.</div>
        : <div><strong className="delta pos">{milliards(Math.abs(ecartTotal))} d'économies par an</strong>{Math.abs(ecartTotal) >= 0.4 && <> (≈ {parMenageMois(ecartTotal)} par mois et par ménage)</>} : le déficit diminue.</div>
  )

  return (
    <Modal title="Modifier le budget de l'État" onClose={onClose} width={860} footer={
      <div className="pied-budget">
        {resume && <div className="small resume">{resume}</div>}
        <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'nowrap' }}>
          <button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={appliquer} disabled={!mode}>Valider ces choix</button>
        </div>
      </div>
    }>
      <p className="ink2" style={{ marginTop: 0 }}>L'État dépense <strong>{milliards(totalVote)}</strong> par an, répartis en une trentaine de grands domaines.</p>
      <div className="kpi-label" style={{ marginBottom: 6 }}>D'abord, voulez-vous garder le même total ?</div>
      <div className="grid cols-2" style={{ marginBottom: 14 }}>
        <button className={`mode-carte ${mode === 'repartir' ? 'on' : ''}`} onClick={() => choisirMode('repartir')} aria-pressed={mode === 'repartir'}>
          <strong><Scale size={16} /> Oui : répartir autrement</strong>
          <div className="small ink2" style={{ marginTop: 4 }}>Ce que vous ajoutez à un domaine est retiré <strong>automatiquement</strong> de tous les autres, un peu chacun.</div>
        </button>
        <button className={`mode-carte ${mode === 'total' ? 'on' : ''}`} onClick={() => choisirMode('total')} aria-pressed={mode === 'total'}>
          <strong><TrendingUp size={16} /> Non : dépenser plus (ou moins)</strong>
          <div className="small ink2" style={{ marginTop: 4 }}>Seuls les domaines que vous touchez changent. Si vous dépensez plus, il faudra <strong>trouver l'argent</strong> ensuite.</div>
        </button>
      </div>
      {mode === null ? (
        <div className="card soft small" style={{ padding: 12 }}>Choisissez une des deux possibilités ci-dessus pour afficher les domaines.</div>
      ) : (
        <>
          <div className="row between" style={{ marginBottom: 6 }}>
            <span className="small muted">Chaque clic sur + ou − change le domaine d'1 milliard (moins pour les petits domaines).</span>
            <button className="btn ghost small" onClick={reinit}><RotateCcw size={14} /> Revenir au budget voté</button>
          </div>
          <div className="input-suffix" style={{ marginBottom: 6 }}>
            <input type="search" placeholder="Chercher : école, armée, police…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un domaine" />
            <span className="suffix"><Search size={16} /></span>
          </div>
          {libres.map(ligne)}
          {bloquees.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="kpi-label" style={{ marginBottom: 2 }}><Lock size={13} /> Dépenses obligatoires : pas de + ni de −</div>
              <div className="small muted">Elles découlent d'engagements déjà pris ou des règles d'impôt : on ne les change pas d'un simple coup de crayon.</div>
              {bloquees.map(ligne)}
            </div>
          )}
          {libres.length + bloquees.length === 0 && <div className="small muted" style={{ marginTop: 8 }}>Aucun domaine ne correspond à « {q} ».</div>}
        </>
      )}
    </Modal>
  )
}
