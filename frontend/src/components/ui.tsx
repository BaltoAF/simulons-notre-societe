import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Briefcase, Coins, ExternalLink, FileText, Globe, GraduationCap, HandHeart, Home, Hourglass, Info,
  Landmark, Leaf, Scale, Stethoscope, Users, Vote, X,
} from 'lucide-react'
import type { Confiance, Source } from '../lib/api'
import { date } from '../lib/format'

const ICONES: Record<string, typeof Coins> = {
  coins: Coins, 'hand-heart': HandHeart, briefcase: Briefcase, hourglass: Hourglass, landmark: Landmark,
  stethoscope: Stethoscope, 'graduation-cap': GraduationCap, home: Home, leaf: Leaf, scale: Scale, users: Users,
  vote: Vote, globe: Globe,
}
export function DomainIcon({ name, size = 22 }: { name: string; size?: number }) {
  const I = ICONES[name] ?? FileText
  return <span className="domain-icon"><I size={size} /></span>
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return <div className="loading"><span className="spinner" /> {label}</div>
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="notice err"><AlertTriangle size={18} /> <div>{message}</div></div>
}

export function useClickOutside(ref: React.RefObject<HTMLElement>, onOut: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onOut() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, onOut])
}

const NIVEAU_DOTS: Record<string, number> = { tres_faible: 1, faible: 2, eleve: 3, tres_eleve: 4 }

/** Badge de confiance à 4 niveaux ; un clic détaille les facteurs qui expliquent le score. */
export function ConfidenceBadge({ c, align = 'left', compact = false }: { c: Confiance | null | undefined; align?: 'left' | 'right'; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)
  useClickOutside(ref, () => setOpen(false))
  if (!c) return null
  const n = NIVEAU_DOTS[c.niveau] ?? 1
  return (
    <span className="popover-wrap" ref={ref}>
      <button type="button" className={`conf ${c.niveau}`} onClick={() => setOpen((o) => !o)}
        aria-expanded={open} title={`Confiance : ${c.libelle} (${c.score}/100)`}>
        <span className="dots" aria-hidden>{[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
        {compact ? null : <>Confiance {c.libelle.toLowerCase()}</>}
      </button>
      {open && (
        <div className={`popover ${align === 'right' ? 'right' : ''}`} role="dialog">
          <div className="row between" style={{ marginBottom: 8 }}>
            <strong>Confiance : {c.libelle}</strong>
            <span className="badge">{c.score}/100</span>
          </div>
          <p className="muted small" style={{ marginBottom: 10 }}>{c.description}</p>
          {c.facteurs.map((f, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div className="row between small"><strong>{f.nom}</strong><span className="muted">{Math.round(f.valeur * 100)} %</span></div>
              <div className="bar-track" style={{ margin: '4px 0' }}><div className="bar-fill" style={{ width: `${Math.max(3, f.valeur * 100)}%` }} /></div>
              <div className="small muted">{f.explication}</div>
            </div>
          ))}
          <div className="small"><Link to="/methode#confiance">Comment est calculé l'indice de confiance ?</Link></div>
        </div>
      )}
    </span>
  )
}

export const LIBELLE_TYPE_SOURCE: Record<string, string> = {
  texte_officiel: 'Texte officiel', statistique_publique: 'Statistique publique', modele_public: 'Modèle public',
  rapport_institutionnel: 'Rapport institutionnel', etude_academique: 'Étude académique',
  document_de_travail: 'Document de travail', think_tank: 'Think tank', presse: 'Presse',
}

export function SourceType({ type }: { type?: string }) {
  if (!type) return null
  return <span className={`src-type ${type}`}>{LIBELLE_TYPE_SOURCE[type] ?? type}</span>
}

export function SourceItem({ s }: { s: Source }) {
  return (
    <li>
      <div className="row top" style={{ gap: 10 }}>
        <SourceType type={s.type} />
        <div className="grow">
          <Link to={`/sources/${encodeURIComponent(s.id)}`} style={{ fontWeight: 650, color: 'var(--ink)' }}>{s.titre || s.id}</Link>
          <div className="small muted">
            {s.editeur}{s.auteurs && s.auteurs.length ? ' · ' + s.auteurs.slice(0, 3).join(', ') + (s.auteurs.length > 3 ? ' et al.' : '') : ''}
            {s.date_publication ? ' · ' + date(s.date_publication) : ''}
          </div>
        </div>
        {s.url ? <a className="icon-btn" href={s.url} target="_blank" rel="noreferrer noopener" title="Ouvrir la source"><ExternalLink size={16} /></a> : null}
      </div>
    </li>
  )
}

export function Modal({ title, onClose, children, width }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Notice({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'warn' | 'err' | 'ok' }) {
  return <div className={`notice ${kind === 'info' ? '' : kind}`}><Info size={18} style={{ flexShrink: 0, marginTop: 2 }} /><div>{children}</div></div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
