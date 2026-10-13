// Graphiques SVG légers, lisibles en clair et en sombre.
import { nombre } from '../lib/format'

type Bar = { label: string; value: number; sub?: string }

/** Barres horizontales centrées sur zéro (gains à droite, pertes à gauche). */
export function DivergingBars({ data, format = (v: number) => nombre(v, 0), height = 30 }: { data: Bar[]; format?: (v: number) => string; height?: number }) {
  const max = Math.max(1e-9, ...data.map((d) => Math.abs(d.value)))
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {data.map((d, i) => {
        const w = (Math.abs(d.value) / max) * 50
        const pos = d.value >= 0
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 40%) 1fr', gap: 10, alignItems: 'center' }}>
            <div className="small" style={{ lineHeight: 1.25 }}>{d.label}{d.sub ? <div className="muted" style={{ fontSize: '.78rem' }}>{d.sub}</div> : null}</div>
            <div style={{ position: 'relative', height, background: 'var(--surface-2)', borderRadius: 8 }}>
              <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--line-2)' }} />
              {Math.abs(d.value) > 0.004 && (
                <div style={{
                  position: 'absolute', top: 5, bottom: 5, borderRadius: 6,
                  left: pos ? '50%' : `${50 - w}%`, width: `${Math.max(w, 0.6)}%`,
                  background: pos ? 'var(--gain)' : 'var(--loss)', opacity: .85,
                }} />
              )}
              <div className={`delta ${Math.abs(d.value) < 0.005 ? 'zero' : pos ? 'pos' : 'neg'}`} style={{
                position: 'absolute', top: '50%', transform: 'translateY(-50%)', fontSize: '.8rem',
                ...(pos ? { right: 8 } : { left: 8 }),
              }}>{format(d.value)}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Histogramme vertical (ex. effet par décile), valeurs positives et négatives. */
export function ColumnChart({ data, format = (v: number) => nombre(v, 1), height = 220, yLabel }: { data: Bar[]; format?: (v: number) => string; height?: number; yLabel?: string }) {
  const W = 640, H = height, padL = 46, padB = 34, padT = 16
  const vals = data.map((d) => d.value)
  const maxV = Math.max(0, ...vals), minV = Math.min(0, ...vals)
  const span = maxV - minV || 1
  const y = (v: number) => padT + (maxV - v) / span * (H - padT - padB)
  const bw = (W - padL - 10) / data.length
  const ticks = [minV, (minV + maxV) / 2, maxV].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={yLabel || 'graphique'}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line className="grid-line" x1={padL} x2={W - 6} y1={y(t)} y2={y(t)} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text>
        </g>
      ))}
      <line className="axis" x1={padL} x2={W - 6} y1={y(0)} y2={y(0)} />
      {data.map((d, i) => {
        const x = padL + i * bw + bw * 0.15
        const top = y(Math.max(0, d.value)), bottom = y(Math.min(0, d.value))
        return (
          <g key={i}>
            <rect x={x} y={top} width={bw * 0.7} height={Math.max(1, bottom - top)} rx={4}
              fill={d.value >= 0 ? 'var(--gain)' : 'var(--loss)'} opacity={0.85}>
              <title>{d.label} : {format(d.value)}</title>
            </rect>
            <text x={x + bw * 0.35} y={H - padB + 16} textAnchor="middle">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Courbe d'une série temporelle (métriques). */
export function LineChart({ points, format = (v: number) => nombre(v, 1), height = 200 }: { points: { x: string; y: number }[]; format?: (v: number) => string; height?: number }) {
  if (points.length === 0) return null
  const W = 640, H = height, padL = 60, padB = 28, padT = 14, padR = 14
  const ys = points.map((p) => p.y)
  let minV = Math.min(...ys), maxV = Math.max(...ys)
  if (minV === maxV) { minV -= 1; maxV += 1 }
  const m = (maxV - minV) * 0.1
  minV -= m; maxV += m
  const x = (i: number) => padL + (points.length === 1 ? (W - padL - padR) / 2 : i / (points.length - 1) * (W - padL - padR))
  const y = (v: number) => padT + (maxV - v) / (maxV - minV) * (H - padT - padB)
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.y)}`).join(' ')
  const step = Math.ceil(points.length / 8)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="évolution">
      {[minV + m, (minV + maxV) / 2, maxV - m].map((t, i) => (
        <g key={i}><line className="grid-line" x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} />
          <text x={padL - 6} y={y(t) + 4} textAnchor="end">{format(t)}</text></g>
      ))}
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth={2.5} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(p.y)} r={3.5} fill="var(--surface)" stroke="var(--primary)" strokeWidth={2}><title>{p.x} : {format(p.y)}</title></circle>
          {i % step === 0 || i === points.length - 1 ? <text x={x(i)} y={H - 8} textAnchor="middle">{p.x.slice(0, 7)}</text> : null}
        </g>
      ))}
    </svg>
  )
}

type Est = { label: string; sub?: string; value: number | null; ci?: [number, number] | null; weight: number }

/** « Forest plot » : chaque étude avec son intervalle, la synthèse en losange. */
export function ForestPlot({ items, synthese, fourchette, format = (v: number) => nombre(v, 2) }: { items: Est[]; synthese: number | null; fourchette: [number, number] | null; format?: (v: number) => string }) {
  const num = items.filter((i) => i.value !== null) as (Est & { value: number })[]
  if (num.length === 0) return null
  const all = num.flatMap((i) => [i.value, ...(i.ci ?? [])]).concat(synthese !== null ? [synthese] : []).concat(fourchette ?? [])
  let lo = Math.min(...all, 0), hi = Math.max(...all, 0)
  const pad = (hi - lo) * 0.08 || 1
  lo -= pad; hi += pad
  const rowH = 30, padT = 10, labelW = 190  // marge droite réservée aux noms des études
  const W = 680, H = padT + (num.length + 1.6) * rowH + 24
  const x = (v: number) => 16 + (v - lo) / (hi - lo) * (W - labelW - 32)
  const maxW = Math.max(...num.map((i) => i.weight), 1e-9)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="estimations des études">
      <line className="axis" x1={x(0)} x2={x(0)} y1={padT} y2={H - 24} strokeDasharray="4 3" />
      {fourchette && <rect x={x(fourchette[0])} y={padT} width={Math.max(2, x(fourchette[1]) - x(fourchette[0]))} height={H - 24 - padT} fill="var(--primary)" opacity={0.07} />}
      {num.map((it, i) => {
        const cy = padT + (i + 0.5) * rowH
        const r = 4 + 7 * Math.sqrt(it.weight / maxW)
        return (
          <g key={i}>
            {it.ci && <line x1={x(it.ci[0])} x2={x(it.ci[1])} y1={cy} y2={cy} stroke="var(--ink-3)" strokeWidth={2} />}
            <rect x={x(it.value) - r / 2} y={cy - r / 2} width={r} height={r} fill="var(--ink-2)"><title>{it.label} : {format(it.value)}</title></rect>
            <text x={W - labelW + 8} y={cy + 4} textAnchor="start">{it.label.length > 30 ? it.label.slice(0, 29) + '…' : it.label}</text>
          </g>
        )
      })}
      {synthese !== null && (() => {
        const cy = padT + (num.length + 0.8) * rowH
        return <g>
          <polygon points={`${x(synthese) - 9},${cy} ${x(synthese)},${cy - 9} ${x(synthese) + 9},${cy} ${x(synthese)},${cy + 9}`} fill="var(--primary)" />
          <text x={x(synthese) + 14} y={cy + 4} style={{ fill: 'var(--primary)', fontWeight: 700 }}>Valeur retenue : {format(synthese)}</text>
        </g>
      })()}
      {[lo + pad, 0, hi - pad].filter((v, i, a) => a.indexOf(v) === i).map((t, i) => (
        <text key={i} x={x(t)} y={H - 6} textAnchor="middle">{format(t)}</text>
      ))}
    </svg>
  )
}
