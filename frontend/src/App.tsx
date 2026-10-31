import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, GitFork, LogIn, LogOut, Menu, User, X } from 'lucide-react'
import { api } from './lib/api'
import { useApp } from './lib/state'
import { Loading, useClickOutside } from './components/ui'
import { Bienvenue } from './components/Bienvenue'
import { DonnerAvis, ouvrirAvis } from './components/DonnerAvis'
import Accueil from './pages/Accueil'

const MesDroits = lazy(() => import('./pages/MesDroits'))
const Budget = lazy(() => import('./pages/Budget'))
const Regles = lazy(() => import('./pages/Regles'))
const Domaine = lazy(() => import('./pages/Domaine'))
const RegleDetail = lazy(() => import('./pages/RegleDetail'))
const Atelier = lazy(() => import('./pages/Atelier'))
const Societes = lazy(() => import('./pages/Societes'))
const SocieteDetail = lazy(() => import('./pages/SocieteDetail'))
const Proposition = lazy(() => import('./pages/Proposition'))
const Comparer = lazy(() => import('./pages/Comparer'))
const Preuves = lazy(() => import('./pages/Preuves'))
const PreuveDetail = lazy(() => import('./pages/PreuveDetail'))
const Sources = lazy(() => import('./pages/Sources'))
const SourceDetail = lazy(() => import('./pages/SourceDetail'))
const Systeme = lazy(() => import('./pages/Systeme'))
const Methode = lazy(() => import('./pages/Methode'))
const Fiabilite = lazy(() => import('./pages/Fiabilite'))
const Comprendre = lazy(() => import('./pages/Comprendre'))
const Connexion = lazy(() => import('./pages/Connexion'))
const Glossaire = lazy(() => import('./pages/Glossaire'))
const VosAvis = lazy(() => import('./pages/VosAvis'))
const Soutenir = lazy(() => import('./pages/Soutenir'))
const Tester = lazy(() => import('./pages/Tester'))
const QuiFait = lazy(() => import('./pages/QuiFait'))
const Frequentation = lazy(() => import('./pages/Frequentation'))

function MenuPlus({ onVisite }: { onVisite: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useClickOutside(ref, () => setOpen(false))
  useEffect(() => setOpen(false), [pathname])
  const actif = ['/regles', '/preuves', '/sources', '/systeme', '/methode', '/glossaire', '/fiabilite', '/vos-avis'].some((p) => pathname.startsWith(p))
  return (
    <div className="popover-wrap" ref={ref}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { setOpen(false); (ref.current?.querySelector('button') as HTMLElement | null)?.focus() } }}
      onBlur={(e) => { if (!ref.current?.contains(e.relatedTarget as Node)) setOpen(false) }}>
      <button className={`btn small ghost ${actif ? 'active' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}
        style={actif ? { background: 'var(--primary-soft)', color: 'var(--primary)' } : undefined}>
        En savoir plus <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-deroulant">
          <button className="menu-item" onClick={() => { setOpen(false); ouvrirAvis() }}>Donner mon avis<small>Une idée, une erreur, un mot pas clair : le site s'améliore chaque jour</small></button>
          <button className="menu-item" onClick={() => { setOpen(false); onVisite() }}>Visite guidée<small>Revoir la prise en main du site, pas à pas</small></button>
          <Link to="/regles">Toutes les règles<small>Ce que dit la loi aujourd'hui, prouvé par les textes</small></Link>
          <Link to="/preuves">Ce que disent les études<small>Comment on estime les effets sur l'emploi, les prix…</small></Link>
          <Link to="/methode">Comment ça marche<small>La méthode et l'indice de confiance</small></Link>
          <Link to="/fiabilite">Nos chiffres sont-ils justes ?<small>Comparés aux chiffrages officiels des mêmes réformes</small></Link>
          <Link to="/glossaire">Le petit lexique<small>Tous les mots expliqués simplement</small></Link>
          <Link to="/sources">Les sources<small>Textes officiels, statistiques, études</small></Link>
          <Link to="/systeme">Les mises à jour automatiques<small>Comment la loi actuelle est tenue à jour (le « Système »)</small></Link>
          <Link to="/vos-avis">Ce que vos avis ont changé<small>Chaque jour, le site s'améliore grâce à vos idées</small></Link>
        </div>
      )}
    </div>
  )
}

/** « A+ » : agrandit tout le texte du site (mémorisé dans le navigateur), pour les personnes qui lisent mal les petits caractères. */
function TailleTexte() {
  const [grand, setGrand] = useState(() => { try { return localStorage.getItem('societe.texte') === 'grand' } catch { return false } })
  useEffect(() => {
    document.documentElement.classList.toggle('texte-grand', grand)
    try { localStorage.setItem('societe.texte', grand ? 'grand' : 'normal') } catch { /* navigation privée */ }
  }, [grand])
  return (
    <button className="icon-btn taille-texte" aria-pressed={grand} onClick={() => setGrand((g) => !g)}
      title={grand ? 'Revenir à la taille de texte normale' : 'Agrandir le texte'} aria-label={grand ? 'Taille de texte normale' : 'Agrandir le texte'}>A+</button>
  )
}

function Header({ onVisite }: { onVisite: () => void }) {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenu(false), [pathname])
  return (
    <>
    <a className="lien-evitement" href="#contenu">Aller au contenu</a>
    <header className="header">
      <div className="container">
        <Link to="/" className="logo" aria-label="Simulons notre société, accueil">
          <img src="/favicon.svg?v=3" alt="" width={30} height={30} /> Simulons notre société <span className="tag">bêta</span>
        </Link>
        <button className="icon-btn menu-mobile" onClick={() => setMenu((m) => !m)} aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menu}>{menu ? <X size={22} /> : <Menu size={22} />}<span className="menu-libelle" aria-hidden="true">{menu ? 'Fermer' : 'Menu'}</span></button>
        <nav className={`nav ${menu ? 'ouvert' : ''}`} aria-label="Navigation principale">
          <NavLink to="/mes-droits">Mes droits</NavLink>
          <NavLink to="/comprendre">Comprendre</NavLink>
          <NavLink to="/budget">Le budget</NavLink>
          <NavLink to="/atelier">Changer les règles</NavLink>
          <NavLink to="/societes">Les propositions</NavLink>
          <MenuPlus onVisite={onVisite} />
        </nav>
        <div className={`user ${menu ? 'ouvert' : ''}`}>
          <TailleTexte />
          {user ? (
            <>
              <Link to={`/societes?auteur=${encodeURIComponent(user.pseudo)}`} className="btn small ghost" title="Mes propositions"><User size={15} /> {user.pseudo}</Link>
              <button className="icon-btn" title="Se déconnecter" onClick={async () => { await api('/api/auth/deconnexion', { method: 'POST' }); setUser(null); nav('/') }}><LogOut size={17} /></button>
            </>
          ) : (
            <Link to="/connexion" className="btn small" title="Un compte sert seulement à enregistrer et partager vos propositions : tout le reste du site marche sans compte."><LogIn size={15} /> Se connecter <span className="facultatif">(facultatif)</span></Link>
          )}
        </div>
      </div>
    </header>
    </>
  )
}

function Footer() {
  const { meta } = useApp()
  return (
    <footer className="footer">
      <div className="container row between top">
        <div style={{ maxWidth: 560 }}>
          <div className="logo" style={{ marginBottom: 6 }}><GitFork size={18} /> Simulons notre société</div>
          <p className="small">Un bien commun numérique : code sous licence AGPL, données sous Licence Ouverte. Chaque chiffre est relié à ses sources.
            Visites comptées de façon anonyme, par le site lui-même : ni cookie, ni outil tiers.
            Simulons notre société est un projet indépendant ; il ne représente aucune administration.</p>
        </div>
        <div className="small liens-pied">
          <Link to="/qui-fait-ce-site">Qui fait ce site ?</Link>
          <Link to="/methode">Méthode et indice de confiance</Link>
          <Link to="/sources">Registre des sources</Link>
          <Link to="/systeme">Journal des mises à jour</Link>
          <button className="lien" style={{ textAlign: 'left', color: 'var(--ink-2)', textDecoration: 'none' }} onClick={ouvrirAvis}>Donner mon avis</button>
          <Link to="/vos-avis">Ce que vos avis ont changé</Link>
          <Link to="/tester">Tester le site en 10 minutes</Link>
          {meta?.soutien?.lien && <Link to="/soutenir">Soutenir le projet ☕</Link>}
          {meta && <span>Législation au {new Date(meta.date_reference).toLocaleDateString('fr-FR')} · moteur {meta.moteur.nom} {meta.moteur.version ?? ''}</span>}
        </div>
      </div>
    </footer>
  )
}

/** Mesure d'audience maison : à chaque page, un signal anonyme au serveur du site (aucun outil tiers, aucun cookie). */
function CompterVisite() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname.startsWith('/frequentation')) return
    const corps = JSON.stringify({ page: pathname, provenance: document.referrer })
    try {
      if (!navigator.sendBeacon?.('/api/visite', new Blob([corps], { type: 'application/json' }))) {
        fetch('/api/visite', { method: 'POST', body: corps, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
      }
    } catch { /* la mesure ne doit jamais gêner la visite */ }
  }, [pathname])
  return null
}

function ScrollTop() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) { window.scrollTo(0, 0); return }
    // la section visée peut n'exister qu'une fois les données chargées : on la guette quelques secondes
    let essais = 0
    const t = setInterval(() => {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)))
      if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); clearInterval(t) }
      else if (++essais > 40) clearInterval(t)
    }, 100)
    return () => clearInterval(t)
  }, [pathname, hash])
  return null
}

export default function App() {
  const [visite, setVisite] = useState(false)
  return (
    <>
      <ScrollTop />
      <CompterVisite />
      <Header onVisite={() => setVisite(true)} />
      {visite && <Bienvenue onClose={() => setVisite(false)} />}
      <main id="contenu" tabIndex={-1}>
        <Suspense fallback={<div className="container page"><Loading /></div>}>
          <Routes>
            <Route path="/" element={<Accueil />} />
            <Route path="/mes-droits" element={<MesDroits />} />
            <Route path="/budget" element={<Budget />} />
            <Route path="/regles" element={<Regles />} />
            <Route path="/regles/d/:domaine" element={<Domaine />} />
            <Route path="/regles/r/:id" element={<RegleDetail />} />
            <Route path="/atelier" element={<Atelier />} />
            <Route path="/societes" element={<Societes />} />
            <Route path="/societes/:id" element={<SocieteDetail />} />
            <Route path="/propositions/:id" element={<Proposition />} />
            <Route path="/comparer" element={<Comparer />} />
            <Route path="/preuves" element={<Preuves />} />
            <Route path="/preuves/:id" element={<PreuveDetail />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/sources/:id" element={<SourceDetail />} />
            <Route path="/systeme" element={<Systeme />} />
            <Route path="/methode" element={<Methode />} />
            <Route path="/fiabilite" element={<Fiabilite />} />
            <Route path="/comprendre" element={<Comprendre />} />
            <Route path="/comprendre/:id" element={<Comprendre />} />
            <Route path="/connexion" element={<Connexion />} />
            <Route path="/glossaire" element={<Glossaire />} />
            <Route path="/vos-avis" element={<VosAvis />} />
            <Route path="/soutenir" element={<Soutenir />} />
            <Route path="/tester" element={<Tester />} />
            <Route path="/qui-fait-ce-site" element={<QuiFait />} />
            <Route path="/frequentation" element={<Frequentation />} />
            <Route path="*" element={<div className="container page"><h1>Page introuvable</h1><Link to="/">Retour à l'accueil</Link></div>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
      <DonnerAvis />
    </>
  )
}
