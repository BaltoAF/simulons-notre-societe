// Un mot technique souligné en pointillé : survol ou toucher pour voir son explication simple.
import { useRef, useState, type ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { GLOSSAIRE } from '../lib/glossaire'
import { useClickOutside } from './ui'

export function Terme({ id, children, icone = false }: { id: keyof typeof GLOSSAIRE | string; children?: ReactNode; icone?: boolean }) {
  const e = GLOSSAIRE[id]
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useClickOutside(ref, () => setOpen(false))
  if (!e) return <>{children}</>
  return (
    <span className="terme-wrap" ref={ref}>
      {/* un clic (ou un toucher) ouvre toujours : sur écran tactile, le survol simulé précède le clic et le refermerait */}
      <button type="button" className={icone ? 'terme-icone' : 'terme'} onClick={() => setOpen(true)}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onBlur={() => setOpen(false)}
        onKeyDown={(ev) => { if (ev.key === 'Escape') setOpen(false) }} aria-expanded={open} aria-label={icone ? `Qu'est-ce que « ${e.terme} » ?` : undefined}>
        {icone ? <HelpCircle size={15} /> : (children ?? e.terme)}
      </button>
      {open && (
        <span className="terme-bulle" role="tooltip">
          <strong>{e.terme}</strong>
          <span>{e.definition}</span>
        </span>
      )}
    </span>
  )
}

/** Petit encadré « Pourquoi ? » dépliable, pour expliquer sans encombrer. */
export function Pourquoi({ titre = 'Pourquoi ?', children }: { titre?: string; children: ReactNode }) {
  return (
    <details className="pourquoi">
      <summary><HelpCircle size={14} /> {titre}</summary>
      <div>{children}</div>
    </details>
  )
}
