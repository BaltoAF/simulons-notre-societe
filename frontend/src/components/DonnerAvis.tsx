// « Donner mon avis » : sur toutes les pages, un bouton discret ouvre un petit formulaire anonyme. Les avis sont lus chaque jour
// par la tâche d'auto-amélioration (system/auto_amelioration/), qui s'en inspire en suivant une charte publique.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CheckCircle2, Lock, MessageSquarePlus } from 'lucide-react'
import { api } from '../lib/api'
import { Modal } from './ui'

const CATEGORIES: { id: string; libelle: string; aide: string }[] = [
  { id: 'incomprehension', libelle: "Je n'ai pas compris quelque chose", aide: "Qu'est-ce qui n'était pas clair ? Un mot, un chiffre, une page ?" },
  { id: 'erreur', libelle: 'Un chiffre ou une règle me semble faux', aide: 'Lequel, et pourquoi ? Si vous connaissez une source officielle, indiquez-la.' },
  { id: 'idee', libelle: 'Une idée pour améliorer le site', aide: "Qu'est-ce qui vous aiderait, vous ou d'autres personnes ?" },
  { id: 'bug', libelle: 'Quelque chose ne marche pas', aide: 'Que s\'est-il passé ? Sur téléphone ou sur ordinateur ?' },
]
const MAX = 2000

/** Ouvre la fenêtre d'avis depuis n'importe quelle page (ex. la page « Ce que vos avis ont changé »). */
export function ouvrirAvis() {
  window.dispatchEvent(new Event('ouvrir-avis'))
}

export function DonnerAvis() {
  const [ouvert, setOuvert] = useState(false)
  useEffect(() => {
    const h = () => setOuvert(true)
    window.addEventListener('ouvrir-avis', h)
    return () => window.removeEventListener('ouvrir-avis', h)
  }, [])
  return (
    <>
      <button className="bouton-avis" onClick={() => setOuvert(true)} aria-label="Donner mon avis sur le site">
        <MessageSquarePlus size={18} aria-hidden="true" /><span>Donner mon avis</span>
      </button>
      {ouvert && <FenetreAvis onClose={() => setOuvert(false)} />}
    </>
  )
}

function FenetreAvis({ onClose }: { onClose: () => void }) {
  const { pathname } = useLocation()
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
      await api('/api/avis', { body: { categorie, texte, page: pathname, site_web: piege } })
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
    <Modal title="Votre avis aide à améliorer le site" onClose={onClose} width={580} footer={
      <div className="row between" style={{ width: '100%', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn ghost small" onClick={onClose}>Annuler</button>
        <button className="btn primary" disabled={!pret} onClick={envoyer}>{etat === 'envoi' ? 'Envoi…' : 'Envoyer mon avis'}</button>
      </div>
    }>
      <p className="small ink2" style={{ marginTop: 0 }}>Chaque jour, les avis sont lus et le site est amélioré pour tous. Les idées sont adaptées, pas recopiées :
        on retient ce qui aide le plus grand nombre, reste neutre et peut être vérifié dans les sources officielles.{' '}
        <Link to="/vos-avis" onClick={onClose}>Comment les avis sont choisis</Link></p>
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
        Il n'est jamais publié tel quel.</p>
    </Modal>
  )
}
