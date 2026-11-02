import { createPortal } from 'react-dom'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle, Briefcase, Car, Coins, ExternalLink, FileText, Globe, GraduationCap, HandHeart, Home, Hourglass, Info,
  Landmark, Leaf, Scale, Stethoscope, Users, Vote, X,
} from 'lucide-react'
import type { Confiance, Source } from '../lib/api'
import { date, natureLien } from '../lib/format'
import { CONFIANCE_FEMININ } from '../lib/humain'

const ICONES: Record<string, typeof Coins> = {
  coins: Coins, 'hand-heart': HandHeart, briefcase: Briefcase, hourglass: Hourglass, landmark: Landmark,
  stethoscope: Stethoscope, 'graduation-cap': GraduationCap, home: Home, leaf: Leaf, scale: Scale, users: Users,
  vote: Vote, globe: Globe, car: Car,
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
        aria-expanded={open} aria-label={`Fiabilité ${CONFIANCE_FEMININ[c.niveau]} : cliquer pour comprendre`} title={`Fiabilité ${CONFIANCE_FEMININ[c.niveau]} — cliquez pour comprendre`}>
        <span className="dots" aria-hidden>{[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? 'on' : ''} />)}</span>
        {compact ? null : <>Fiabilité {CONFIANCE_FEMININ[c.niveau]}</>}
      </button>
      {open && (
        <div className={`popover ${align === 'right' ? 'right' : ''}`} role="dialog">
          <strong style={{ display: 'block', marginBottom: 6 }}>Fiabilité {CONFIANCE_FEMININ[c.niveau]}</strong>
          <p className="small" style={{ marginBottom: 10 }}>{c.description}</p>
          {c.facteurs.length > 0 && (
            <details className="curieux small" style={{ marginBottom: 8 }}>
              <summary>Le détail ({c.score}/100)</summary>
              {c.facteurs.map((f, i) => (
                <div key={i} style={{ margin: '8px 0' }}>
                  <div className="row between small"><strong>{f.nom}</strong><span className="muted">{Math.round(f.valeur * 100)} %</span></div>
                  <div className="bar-track" style={{ margin: '4px 0' }}><div className="bar-fill" style={{ width: `${Math.max(3, f.valeur * 100)}%` }} /></div>
                  <div className="small muted">{f.explication}</div>
                </div>
              ))}
            </details>
          )}
          <div className="small"><Link to="/methode#confiance">Comment on mesure la fiabilité</Link></div>
        </div>
      )}
    </span>
  )
}

export const LIBELLE_TYPE_SOURCE: Record<string, string> = {
  texte_officiel: 'Texte officiel', statistique_publique: 'Statistique publique', modele_public: 'Modèle public',
  rapport_institutionnel: 'Rapport institutionnel', etude_academique: 'Étude académique',
  document_de_travail: 'Document de travail', think_tank: "Laboratoire d'idées", presse: 'Presse',
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
          <Link to={`/sources/${encodeURIComponent(s.id)}`} style={{ fontWeight: 650, color: 'var(--primary)' }}>{s.titre || s.id}</Link>
          <div className="small muted">
            {s.editeur}{s.auteurs && s.auteurs.length ? ' · ' + s.auteurs.slice(0, 3).join(', ') + (s.auteurs.length > 3 ? ' et al.' : '') : ''}
            {s.date_publication ? ' · ' + date(s.date_publication) : ''}
          </div>
        </div>
        {s.url ? <a className="icon-btn" href={s.url} target="_blank" rel="noreferrer noopener" title={`Ouvrir la source${natureLien(s.url)}`}><ExternalLink size={16} /></a> : null}
      </div>
    </li>
  )
}

const FOCUSABLES = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Fenêtre : un seul défilement (le contenu), et un pied facultatif toujours visible (boutons d'action).
 *  Accessible au clavier : le focus entre dans la fenêtre, y reste (Tab / Maj+Tab), et revient au bouton d'ouverture. */
export function Modal({ title, onClose, children, width, footer }: { title: string; onClose: () => void; children: ReactNode; width?: number; footer?: ReactNode }) {
  const boite = useRef<HTMLDivElement>(null)
  const fermer = useRef(onClose)
  fermer.current = onClose
  useEffect(() => {
    const avant = document.activeElement as HTMLElement | null
    const root = document.getElementById('root')
    root?.setAttribute('inert', '')                       // rien derrière le voile n'est atteignable
    const premier = boite.current?.querySelector<HTMLElement>('.modal-corps ' + FOCUSABLES) ?? boite.current?.querySelector<HTMLElement>(FOCUSABLES)
    premier?.focus()
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { fermer.current(); return }
      if (e.key !== 'Tab' || !boite.current) return
      const els = Array.from(boite.current.querySelectorAll<HTMLElement>(FOCUSABLES)).filter((x) => x.offsetParent !== null)
      if (!els.length) return
      const [prem, dern] = [els[0], els[els.length - 1]]
      if (e.shiftKey && document.activeElement === prem) { e.preventDefault(); dern.focus() }
      else if (!e.shiftKey && document.activeElement === dern) { e.preventDefault(); prem.focus() }
    }
    document.addEventListener('keydown', h)
    return () => {
      document.removeEventListener('keydown', h)
      root?.removeAttribute('inert')
      avant?.focus?.()
    }
  }, [])
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={boite} style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="modal-tete">
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer"><X size={20} /></button>
        </div>
        <div className="modal-corps">{children}</div>
        {footer && <div className="modal-pied">{footer}</div>}
      </div>
    </div>, document.body
  )
}

export function Notice({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'warn' | 'err' | 'ok' }) {
  return <div className={`notice ${kind === 'info' ? '' : kind}`}><Info size={18} style={{ flexShrink: 0, marginTop: 2 }} /><div>{children}</div></div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
