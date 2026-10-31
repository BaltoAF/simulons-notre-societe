// « Un avis sur cette page » : sur toutes les pages, un bouton discret ouvre un petit formulaire anonyme. L'avis part avec la
// page où l'on est (et, si on le veut, l'endroit qu'on a touché : « Montrer l'endroit »). Les avis sont lus chaque jour par la
// tâche d'auto-amélioration (system/auto_amelioration/), qui s'en inspire en suivant une charte publique.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, Crosshair, Lock, MessageSquarePlus, X } from 'lucide-react'
import { api } from '../lib/api'
import { Modal } from './ui'

const CATEGORIES: { id: string; libelle: string; aide: string }[] = [
  { id: 'incomprehension', libelle: "Je n'ai pas compris quelque chose", aide: "Sur cette page, qu'est-ce qui n'était pas clair ? Un mot, un chiffre, une phrase ?" },
  { id: 'erreur', libelle: 'Un chiffre ou une règle me semble faux', aide: 'Lequel, et pourquoi ? Si vous connaissez une source officielle, indiquez-la.' },
  { id: 'idee', libelle: 'Une idée pour améliorer le site', aide: "Sur cette page, qu'est-ce qui vous aiderait, vous ou d'autres personnes ?" },
  { id: 'bug', libelle: 'Quelque chose ne marche pas', aide: 'Que s\'est-il passé ? Sur téléphone ou sur ordinateur ?' },
]
const MAX = 2000

/** Ouvre la fenêtre d'avis depuis n'importe quelle page (ex. la page « Ce que vos avis ont changé »). */
export function ouvrirAvis() {
  window.dispatchEvent(new Event('ouvrir-avis'))
}

/** Le nom de la page, tel que le visiteur le voit : son grand titre, sinon son adresse. */
function nomDeLaPage(): string {
  const h1 = document.querySelector('main h1, .page h1, h1')?.textContent?.trim()
  return h1 && h1.length < 120 ? h1 : location.pathname
}

/** Ce que dit l'élément touché : son texte visible, précédé du titre de la partie de page où il se trouve. */
function decrireEndroit(el: Element): string {
  const texte = (el as HTMLElement).innerText?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? ''
  let partie = ''
  for (let n: Element | null = el; n && !partie; n = n.parentElement) {
    const titre = n.querySelector(':scope > h1, :scope > h2, :scope > h3, :scope > .kpi-label, :scope > .card-head h3')
    if (titre && titre !== el) partie = titre.textContent?.replace(/\s+/g, ' ').trim().slice(0, 100) ?? ''
  }
  return partie && !texte.startsWith(partie) ? `${partie} › ${texte}` : texte
}

export function DonnerAvis() {
  const [ouvert, setOuvert] = useState(false)
  const [montrer, setMontrer] = useState(false) // mode « touchez l'endroit » : la fenêtre se cache le temps de choisir
  const [endroit, setEndroit] = useState('')
  useEffect(() => {
    const h = () => setOuvert(true)
    window.addEventListener('ouvrir-avis', h)
    return () => window.removeEventListener('ouvrir-avis', h)
  }, [])
  const { pathname } = useLocation()
  useEffect(() => { setEndroit('') }, [pathname]) // un endroit montré ne vaut que pour sa page
  return (
    <>
      <button className="bouton-avis" onClick={() => setOuvert(true)} aria-label="Donner mon avis sur cette page">
        <MessageSquarePlus size={18} aria-hidden="true" /><span>Un avis sur cette page ?</span>
      </button>
      {ouvert && !montrer && <FenetreAvis endroit={endroit} onMontrer={() => setMontrer(true)} onOublier={() => setEndroit('')}
        onClose={() => { setOuvert(false); setEndroit('') }} />}
      {montrer && <Viseur onChoix={(t) => { setEndroit(t); setMontrer(false) }} onAnnuler={() => setMontrer(false)} />}
    </>
  )
}

/** Mode « montrer l'endroit » : un bandeau en haut, l'élément survolé est encadré ; un toucher ou un clic le choisit. */
function Viseur({ onChoix, onAnnuler }: { onChoix: (texte: string) => void; onAnnuler: () => void }) {
  useEffect(() => {
    let survole: HTMLElement | null = null
    const marquer = (el: HTMLElement | null) => {
      survole?.classList.remove('avis-cible')
      survole = el
      survole?.classList.add('avis-cible')
    }
    const cible = (e: Event) => {
      const el = e.target as HTMLElement
      return el.closest('.avis-viseur') ? null : (el.closest('p, li, tr, td, h1, h2, h3, .card, .kpi, .notice, button, label, img, svg') as HTMLElement | null) ?? el
    }
    const survol = (e: MouseEvent) => marquer(cible(e))
    const clic = (e: MouseEvent) => {
      const el = cible(e)
      if (!el) return
      e.preventDefault(); e.stopPropagation()
      marquer(null)
      onChoix(decrireEndroit(el))
    }
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') onAnnuler() }
    document.addEventListener('mouseover', survol, true)
    document.addEventListener('click', clic, true)
    document.addEventListener('keydown', echap)
    document.body.classList.add('avis-en-visee')
    return () => {
      marquer(null)
      document.removeEventListener('mouseover', survol, true)
      document.removeEventListener('click', clic, true)
      document.removeEventListener('keydown', echap)
      document.body.classList.remove('avis-en-visee')
    }
  }, [onChoix, onAnnuler])
  return (
    <div className="avis-viseur" role="dialog" aria-label="Montrer l'endroit">
      <Crosshair size={18} aria-hidden="true" />
      <span>Touchez la partie de la page qui pose problème (un chiffre, une phrase, un bouton…).</span>
      <button className="btn small" onClick={onAnnuler}><X size={14} /> Annuler</button>
    </div>
  )
}

function FenetreAvis({ endroit, onMontrer, onOublier, onClose }: { endroit: string; onMontrer: () => void; onOublier: () => void; onClose: () => void }) {
  const { pathname } = useLocation()
  const [page] = useState(nomDeLaPage)
  const [categorie, setCategorie] = useState<string | null>(null)
  const [texte, setTexte] = useState('')
  const [piege, setPiege] = useState('') // invisible pour les humains : seuls les robots le remplissent
  const [etat, setEtat] = useState<'saisie' | 'envoi' | 'merci'>('saisie')
  const [err, setErr] = useState<string | null>(null)
  const cat = CATEGORIES.find((c) => c.id === categorie)
  const pret = !!categorie && texte.trim().length >= 10 && etat === 'saisie'

  const envoyer = async () => {
    setEtat('envoi'); setErr(null)
    try {
      await api('/api/avis', { body: { categorie, texte, page: pathname, endroit: [page, endroit].filter(Boolean).join(' › '), site_web: piege } })
      setEtat('merci')
    } catch (e: any) {
      setErr(e.message); setEtat('saisie')
    }
  }

  if (etat === 'merci') {
    return (
      <Modal title="Merci pour votre avis !" onClose={onClose} width={540}
        footer={<div className="row" style={{ justifyContent: 'flex-end', width: '100%' }}><button className="btn primary" onClick={onClose}>Fermer</button></div>}>
        <div className="notice ok"><CheckCircle2 size={18} style={{ flexShrink: 0 }} /><div>Il sera lu lors de la prochaine amélioration quotidienne du site.</div></div>
        <p className="small ink2">La décision (idée retenue, adaptée, ou pourquoi elle ne l'est pas) apparaîtra dans{' '}
          <Link to="/vos-avis" onClick={onClose}>Ce que vos avis ont changé</Link>, avec un résumé de votre avis, jamais votre texte tel quel.</p>
      </Modal>
    )
  }

  return (
    <Modal title="Un avis sur cette page ?" onClose={onClose} width={580} footer={
      <div className="row between" style={{ width: '100%', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn ghost small" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={!pret} onClick={envoyer}>{etat === 'envoi' ? 'Envoi…' : 'Envoyer mon avis'}</button>
      </div>
    }>
      {/* la page où l'on est part avec l'avis : on peut écrire « ici, ce chiffre… » sans tout réexpliquer */}
      <div className="notice small" style={{ marginTop: 0 }}><div>
        Votre avis portera sur la page <strong>« {page} »</strong> : vous pouvez écrire « sur cette page… » sans réexpliquer où vous êtes.
        {endroit
          ? <div style={{ marginTop: 6 }}>Endroit montré : <em>« {endroit.length > 140 ? endroit.slice(0, 137) + '…' : endroit} »</em>{' '}
            <button className="lien" onClick={onMontrer}>changer</button> · <button className="lien" onClick={onOublier}>retirer</button></div>
          : <div style={{ marginTop: 6 }}><button className="btn small" onClick={onMontrer}><Crosshair size={14} /> Montrer l'endroit sur la page (facultatif)</button></div>}
      </div></div>
      <div className="field"><span>C'est à propos de…</span></div>
      <div className="choices" style={{ marginBottom: 14 }}>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={`choice ${categorie === c.id ? 'on' : ''}`} aria-pressed={categorie === c.id} onClick={() => setCategorie(c.id)}>{c.libelle}</button>
        ))}
      </div>
      <label className="field"><span>Votre avis</span>
        <textarea rows={5} maxLength={MAX} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder={cat?.aide ?? "Choisissez d'abord le sujet ci-dessus."} />
        <span className="hint">{texte.length} / {MAX} caractères</span>
      </label>
      <div className="champ-piege" aria-hidden="true">
        <label>Site web <input tabIndex={-1} autoComplete="off" value={piege} onChange={(e) => setPiege(e.target.value)} /></label>
      </div>
      {err && <div className="notice err small" role="alert">{err}</div>}
      <p className="small muted" style={{ marginBottom: 0 }}><Lock size={13} /> Votre avis est anonyme : n'indiquez ni nom, ni adresse, ni numéro (ils seraient masqués).
        Il n'est jamais publié tel quel. {endroit && "L'endroit montré peut contenir vos montants : il est traité de la même façon."}</p>
      <p className="small muted" style={{ marginBottom: 0 }}>Les avis sont lus chaque jour et le site est amélioré pour tous, selon une charte publique.{' '}
        <Link to="/vos-avis" onClick={onClose}>Comment les avis sont choisis</Link></p>
    </Modal>
  )
}
