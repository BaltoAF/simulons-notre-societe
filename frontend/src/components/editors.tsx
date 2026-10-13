import { useMemo, useState } from 'react'
import { Plus, Search, Trash2 } from 'lucide-react'
import type { Regle, Tranche, Valeur } from '../lib/api'
import { DOMAINE_TITRE, nombre, unite, valeur as fmt } from '../lib/format'
import { useFetch } from '../lib/state'
import { Loading, Modal } from './ui'

/** Éditeur de valeur adapté au type de la règle (nombre + curseur, oui/non, choix, barème). */
export function ValueEditor({ rule, value, onChange }: { rule: Regle; value: Valeur; onChange: (v: Valeur) => void }) {
  if (rule.type === 'bareme') return <BaremeEditor value={(value as Tranche[]) ?? []} onChange={onChange} />
  if (rule.type === 'booleen') {
    return (
      <div className="choices">
        <button type="button" className={`choice ${value === true ? 'on' : ''}`} onClick={() => onChange(true)}>Oui</button>
        <button type="button" className={`choice ${value === false ? 'on' : ''}`} onClick={() => onChange(false)}>Non</button>
      </div>
    )
  }
  if (rule.type === 'choix' && rule.choix?.length) {
    return (
      <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
        {rule.choix.map((c) => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
      </select>
    )
  }
  if (rule.type === 'texte') {
    return <textarea value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
  }
  const num = typeof value === 'number' ? value : Number(value ?? 0)
  const cur = typeof rule.valeur === 'number' ? rule.valeur : 0
  const [lo, hi] = rule.bornes ?? [Math.min(0, cur * 0.5), Math.max(cur * 2, cur + 10, 1)]
  const step = (hi - lo) / 200 > 1 ? Math.round((hi - lo) / 200) : (hi - lo) <= 5 ? 0.05 : 0.5
  // boutons rapides, appliqués à la valeur affichée : en points pour un taux, en unités pour une durée, en % pour un montant
  const borne = (v: number) => Math.min(rule.bornes ? hi : Infinity, Math.max(rule.bornes ? lo : -Infinity, v))
  const arrondi = (v: number) => (Math.abs(cur) >= 100 ? Math.round(v) : Math.round(v * 100) / 100)
  const singulier: Record<string, string> = { ans: 'an', mois: 'mois', jours: 'jour', heures: 'heure', enfants: 'enfant', parts: 'part' }
  const unitaire = singulier[rule.unite]
  const pasPt = (hi - lo) <= 3 ? 0.1 : (hi - lo) <= 20 ? 0.5 : 1
  const rapides: [string, number][] = rule.unite === 'pourcent'
    ? [[`−${nombre(pasPt, 1)} point`, borne(num - pasPt)], [`+${nombre(pasPt, 1)} point`, borne(num + pasPt)]]
    : unitaire ? [[`−1 ${unitaire}`, borne(num - 1)], [`+1 ${unitaire}`, borne(num + 1)]]
      : num !== 0 ? [['−10 %', borne(arrondi(num * 0.9))], ['−5 %', borne(arrondi(num * 0.95))], ['+5 %', borne(arrondi(num * 1.05))], ['+10 %', borne(arrondi(num * 1.1))]] : []
  return (
    <div>
      <div className="row" style={{ gap: 10 }}>
        <div className="input-suffix grow">
          <input type="number" value={Number.isFinite(num) ? num : ''} step="any" aria-label={`Nouvelle valeur : ${rule.titre}`}
            onChange={(e) => onChange(e.target.value === '' ? 0 : Number(e.target.value))} />
          <span className="suffix">{unite(rule.unite)}</span>
        </div>
      </div>
      <input type="range" min={lo} max={hi} step={step} value={Math.min(hi, Math.max(lo, num))}
        onChange={(e) => onChange(Number(e.target.value))} aria-label={rule.titre} />
      <div className="row between small muted"><span>{fmt(lo, rule.unite)}</span><span>Aujourd'hui : {fmt(rule.valeur, rule.unite)}</span><span>{fmt(hi, rule.unite)}</span></div>
      {(rapides.length > 0 || num !== cur) && (
        <div className="row" style={{ gap: 6, marginTop: 6 }}>
          {rapides.map(([l, v]) => <button key={l} type="button" className="btn small" onClick={() => onChange(v)}>{l}</button>)}
          {num !== cur && <button type="button" className="btn small ghost" onClick={() => onChange(cur)}>Valeur d'aujourd'hui</button>}
        </div>
      )}
    </div>
  )
}

export function BaremeEditor({ value, onChange }: { value: Tranche[]; onChange: (v: Tranche[]) => void }) {
  const rows = [...value].sort((a, b) => a.seuil - b.seuil)
  const set = (i: number, k: keyof Tranche, v: number) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)))
  return (
    <div className="bareme-table">
      <table className="table">
        <thead><tr><th>Revenu à partir de (par part)</th><th>Taux</th><th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td><div className="input-suffix"><input type="number" value={r.seuil} disabled={i === 0} onChange={(e) => set(i, 'seuil', Number(e.target.value))} /><span className="suffix">€</span></div></td>
              <td><div className="input-suffix"><input type="number" value={r.taux} step="0.5" onChange={(e) => set(i, 'taux', Number(e.target.value))} /><span className="suffix">%</span></div></td>
              <td>{i > 0 && <button className="icon-btn" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Supprimer la tranche"><Trash2 size={16} /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn small" onClick={() => {
        const last = rows[rows.length - 1] ?? { seuil: 0, taux: 0 }
        onChange([...rows, { seuil: Math.round(last.seuil * 1.5 + 10000), taux: Math.min(100, last.taux + 5) }])
      }}><Plus size={15} /> Ajouter une tranche</button>
      <div className="small muted" style={{ marginTop: 6 }}>Chaque taux ne s'applique qu'à la partie du revenu située au-dessus de son seuil (et sous le seuil suivant).</div>
    </div>
  )
}

/** Fenêtre de recherche d'une règle à modifier. */
export function RulePicker({ onPick, onClose, exclude, domaine = '' }: { onPick: (r: Regle) => void; onClose: () => void; exclude: string[]; domaine?: string }) {
  const { data, loading } = useFetch<{ regles: Regle[] }>('/api/regles?limit=2000')
  const [q, setQ] = useState('')
  const [dom, setDom] = useState(domaine)
  const [seulementSimulables, setSeulementSimulables] = useState(true)
  const list = useMemo(() => {
    const ql = q.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
    return (data?.regles ?? []).filter((r) => r.levier && !exclude.includes(r.id)
      && (!dom || r.domaine === dom) && (!seulementSimulables || r.simulable)
      && (!ql || (r.titre + ' ' + r.theme + ' ' + r.explication).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').includes(ql)))
  }, [data, q, dom, seulementSimulables, exclude])
  const domaines = useMemo(() => Array.from(new Set((data?.regles ?? []).map((r) => r.domaine))), [data])
  return (
    <Modal title="Quelle règle voulez-vous changer ?" onClose={onClose} width={820}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="input-suffix grow">
          <input type="search" autoFocus placeholder="Rechercher : RSA, TVA, SMIC, peine, retraite…" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="suffix"><Search size={16} /></span>
        </div>
        <select value={dom} onChange={(e) => setDom(e.target.value)} style={{ width: 'auto' }}>
          <option value="">Tous les domaines</option>
          {domaines.map((d) => <option key={d} value={d}>{DOMAINE_TITRE[d] ?? d}</option>)}
        </select>
      </div>
      <label className="row small" style={{ marginBottom: 10, cursor: 'pointer' }}>
        <input type="checkbox" checked={seulementSimulables} onChange={(e) => setSeulementSimulables(e.target.checked)} />
        Seulement les règles dont le Système sait calculer les effets
      </label>
      {loading ? <Loading /> : (
        <ul className="list" style={{ maxHeight: '58vh', overflowY: 'auto' }}>
          {list.slice(0, 200).map((r) => (
            <li key={r.id}>
              <button className="preset" onClick={() => onPick(r)} style={{ border: 0, padding: '6px 4px' }}>
                <div className="row between">
                  <strong style={{ display: 'inline' }}>{r.titre}</strong>
                  <span className="badge">{fmt(r.valeur, r.unite, r.type)}</span>
                </div>
                {r.explication && <div className="small ink2">{r.explication.length > 130 ? r.explication.slice(0, 127).replace(/\s+\S*$/, '') + '…' : r.explication}</div>}
                <div className="small muted">{DOMAINE_TITRE[r.domaine] ?? r.domaine} · {r.theme}{r.simulable ? '' : ' · effets pas encore calculés'}</div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="muted">Aucune règle ne correspond.</li>}
          {list.length > 200 && <li className="muted small">{nombre(list.length - 200, 0)} autres résultats : affinez la recherche.</li>}
        </ul>
      )}
    </Modal>
  )
}
