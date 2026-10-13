import { lazy, Suspense, useEffect } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { GitFork, LogIn, LogOut, User } from 'lucide-react'
import { api } from './lib/api'
import { useApp } from './lib/state'
import { Loading } from './components/ui'
import Accueil from './pages/Accueil'

const MesDroits = lazy(() => import('./pages/MesDroits'))
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
const Connexion = lazy(() => import('./pages/Connexion'))

function Header() {
  const { user, setUser } = useApp()
  const nav = useNavigate()
  return (
    <header className="header">
      <div className="container">
        <Link to="/" className="logo" aria-label="Société 2.0, accueil">
          <img src="/favicon.svg" alt="" width={30} height={30} /> Société 2.0 <span className="tag">bêta</span>
        </Link>
        <nav className="nav" aria-label="Navigation principale">
          <NavLink to="/mes-droits">Mes droits</NavLink>
          <NavLink to="/atelier">Tester une réforme</NavLink>
          <NavLink to="/regles">Les règles</NavLink>
          <NavLink to="/societes">Les sociétés</NavLink>
          <NavLink to="/preuves">Les preuves</NavLink>
          <NavLink to="/systeme">Le Système</NavLink>
        </nav>
        <div className="user">
          {user ? (
            <>
              <Link to={`/societes?auteur=${encodeURIComponent(user.pseudo)}`} className="btn small ghost"><User size={15} /> {user.pseudo}</Link>
              <button className="icon-btn" title="Se déconnecter" onClick={async () => { await api('/api/auth/deconnexion', { method: 'POST' }); setUser(null); nav('/') }}><LogOut size={17} /></button>
            </>
          ) : (
            <Link to="/connexion" className="btn small"><LogIn size={15} /> Se connecter</Link>
          )}
        </div>
      </div>
    </header>
  )
}

function Footer() {
  const { meta } = useApp()
  return (
    <footer className="footer">
      <div className="container row between top">
        <div style={{ maxWidth: 560 }}>
          <div className="logo" style={{ marginBottom: 6 }}><GitFork size={18} /> Société 2.0</div>
          <p className="small">Un bien commun numérique : code sous licence AGPL, données sous Licence Ouverte. Chaque chiffre est relié à ses sources.
            Société 2.0 est un projet indépendant ; il ne représente aucune administration.</p>
        </div>
        <div className="small" style={{ display: 'grid', gap: 4 }}>
          <Link to="/methode">Méthode et indice de confiance</Link>
          <Link to="/sources">Registre des sources</Link>
          <Link to="/systeme">Journal du Système</Link>
          {meta && <span>Législation au {new Date(meta.date_reference).toLocaleDateString('fr-FR')} · moteur {meta.moteur.nom} {meta.moteur.version ?? ''}</span>}
        </div>
      </div>
    </footer>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollTop />
      <Header />
      <main>
        <Suspense fallback={<div className="container page"><Loading /></div>}>
          <Routes>
            <Route path="/" element={<Accueil />} />
            <Route path="/mes-droits" element={<MesDroits />} />
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
            <Route path="/connexion" element={<Connexion />} />
            <Route path="*" element={<div className="container page"><h1>Page introuvable</h1><Link to="/">Retour à l'accueil</Link></div>} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </>
  )
}
