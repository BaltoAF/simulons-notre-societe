// Répartir le budget de l'État : augmenter une mission oblige à en réduire d'autres (vases communicants).
import { useMemo, useState } from 'react'
import { Lock, RotateCcw } from 'lucide-react'
import type { Regle, Valeur } from '../lib/api'
import { nombre } from '../lib/format'
import { Modal } from './ui'

const VERROUILLEES = ['engagements_financiers', 'remboursements', 'charge_dette']

export function BudgetEditor({ regles, overrides, onClose, onApply }: {
  regles: Regle[]; overrides: Record<string, Valeur>; onClose: () => void; onApply: (o: Record<string, Valeur>) => void
}) {
  const missions = useMemo(() => regles.filter((r) => r.id.startsWith('budget.etat.mission.') && typeof r.valeur === 'number')
    .sort((a, b) => (b.valeur as number) - (a.valeur as number)), [regles])
  const initial = useMemo(() => Object.fromEntries(missions.map((r) => [r.id, Number(overrides[r.id] ?? r.valeur)])), [missions, overrides])
  const [vals, setVals] = useState<Record<string, number>>(initial)
  const [touchees, setTouchees] = useState<string[]>([])
  const [constant, setConstant] = useState(true)
  const verrou = (id: string) => VERROUILLEES.some((v) => id.includes(v))
  const totalInitial = Object.values(initial).reduce((a, b) => a + b, 0)
  const total = Object.values(vals).reduce((a, b) => a + b, 0)

  const changer = (id: string, v: number) => {
    const t = touchees.includes(id) ? touchees : [...touchees, id]
    setTouchees(t)
    const next = { ...vals, [id]: Math.max(0, v) }
    if (constant) {
      // compense l'écart sur les missions non modifiées et non verrouillées, à proportion de leur poids
      const libres = missions.filter((m) => !t.includes(m.id) && !verrou(m.id)).map((m) => m.id)
      const ecart = Object.values(next).reduce((a, b) => a + b, 0) - totalInitial
      const base = libres.reduce((a, k) => a + initial[k], 0)
      if (base > 0) for (const k of libres) next[k] = Math.max(0, initial[k] - ecart * initial[k] / base)
    }
    setVals(next)
  }
  const reinit = () => { setVals(Object.fromEntries(missions.map((r) => [r.id, Number(r.valeur)]))); setTouchees([]) }
  const appliquer = () => {
    const o: Record<string, Valeur> = {}
    for (const m of missions) if (Math.abs(vals[m.id] - Number(m.valeur)) > 0.0005) o[m.id] = Math.round(vals[m.id] * 1000) / 1000
    onApply(o)
  }
  return (
    <Modal title="Répartir le budget de l'État" onClose={onClose} width={860}>
      <p className="small ink2">Crédits de paiement votés pour 2026, en milliards d'euros. Si vous gardez le total constant, chaque hausse est automatiquement compensée par une baisse proportionnelle des missions que vous n'avez pas touchées.</p>
      <div className="row between" style={{ marginBottom: 10 }}>
        <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={constant} onChange={(e) => setConstant(e.target.checked)} /> Garder le total constant (vases communicants)</label>
        <span className="small">Total : <strong>{nombre(total, 1)} Md€</strong> <span className={`delta ${Math.abs(total - totalInitial) < 0.05 ? 'zero' : total > totalInitial ? 'neg' : 'pos'}`}>({total - totalInitial >= 0 ? '+' : '−'}{nombre(Math.abs(total - totalInitial), 1)})</span></span>
      </div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        <table className="table">
          <tbody>
            {missions.map((m) => {
              const v = vals[m.id]
              const d = v - Number(m.valeur)
              const lock = verrou(m.id)
              return (
                <tr key={m.id}>
                  <td style={{ width: '45%' }}>{m.titre.replace(/ : crédits de paiement.*$/, '').replace(/^Mission /, '')}{lock && <span className="muted small"> <Lock size={12} /> engagement</span>}</td>
                  <td style={{ width: '35%' }}>
                    <input type="range" min={0} max={Math.max(2 * Number(m.valeur), 1)} step={0.1} value={v} disabled={lock} onChange={(e) => changer(m.id, Number(e.target.value))} aria-label={m.titre} />
                  </td>
                  <td className="num"><input type="number" value={Math.round(v * 10) / 10} step={0.1} disabled={lock} style={{ width: 90 }} onChange={(e) => changer(m.id, Number(e.target.value))} /></td>
                  <td className="num"><span className={`delta ${Math.abs(d) < 0.05 ? 'zero' : d > 0 ? 'neg' : 'pos'}`}>{Math.abs(d) < 0.05 ? '' : (d > 0 ? '+' : '−') + nombre(Math.abs(d), 1)}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="row between" style={{ marginTop: 12 }}>
        <button className="btn ghost" onClick={reinit}><RotateCcw size={15} /> Revenir aux crédits votés</button>
        <div className="row"><button className="btn" onClick={onClose}>Annuler</button><button className="btn primary" onClick={appliquer}>Appliquer à ma réforme</button></div>
      </div>
    </Modal>
  )
}
