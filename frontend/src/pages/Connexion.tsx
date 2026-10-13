import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import { api, type Utilisateur } from '../lib/api'
import { useApp } from '../lib/state'
import { ErrorBox, Notice } from '../components/ui'

export default function Connexion() {
  const { setUser } = useApp()
  const [p] = useSearchParams()
  const nav = useNavigate()
  const [mode, setMode] = useState<'connexion' | 'inscription'>('connexion')
  const [pseudo, setPseudo] = useState('')
  const [email, setEmail] = useState('')
  const [mdp, setMdp] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      const r = mode === 'connexion'
        ? await api<{ utilisateur: Utilisateur }>('/api/auth/connexion', { body: { identifiant: pseudo, mot_de_passe: mdp } })
        : await api<{ utilisateur: Utilisateur }>('/api/auth/inscription', { body: { pseudo, email, mot_de_passe: mdp } })
      setUser(r.utilisateur)
      nav(p.get('retour') || '/atelier')
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div className="container page" style={{ maxWidth: 480 }}>
      <h1>{mode === 'connexion' ? 'Se connecter' : 'Créer un compte'}</h1>
      <Notice>Un compte sert uniquement à <strong>proposer</strong> : enregistrer et partager vos sociétés, commenter, ouvrir des propositions. Tout le reste est accessible sans compte.</Notice>
      <form className="card" style={{ marginTop: 16 }} onSubmit={go}>
        <label className="field"><span>{mode === 'connexion' ? 'Pseudo ou e-mail' : 'Pseudo (public)'}</span><input type="text" value={pseudo} onChange={(e) => setPseudo(e.target.value)} autoComplete="username" required /></label>
        {mode === 'inscription' && <label className="field"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /><span className="hint">Jamais affiché publiquement.</span></label>}
        <label className="field"><span>Mot de passe</span><input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete={mode === 'connexion' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        {err && <ErrorBox message={err} />}
        <button className="btn primary" style={{ width: '100%', marginTop: 8 }} disabled={busy}>
          {mode === 'connexion' ? <><LogIn size={16} /> Se connecter</> : <><UserPlus size={16} /> Créer mon compte</>}
        </button>
        <div className="small" style={{ marginTop: 14, textAlign: 'center' }}>
          {mode === 'connexion' ? <>Pas encore de compte ? <button type="button" className="btn ghost small" onClick={() => setMode('inscription')}>Créer un compte</button></>
            : <>Déjà inscrit ? <button type="button" className="btn ghost small" onClick={() => setMode('connexion')}>Se connecter</button></>}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>L'identification via FranceConnect est prévue pour les rôles qui exigent une identité vérifiée.</p>
      </form>
    </div>
  )
}
