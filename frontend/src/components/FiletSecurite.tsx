// Si une page plante à l'affichage : un message clair et un bouton pour recharger, plutôt qu'un écran blanc.
// L'erreur est signalée au journal du serveur ; la routine d'auto-amélioration la corrige.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { signalerErreur } from '../lib/erreurs'

// Après une mise à jour du site, les fichiers de l'ancienne version n'existent plus : la page ouverte avant ne peut plus
// charger la suivante (test Odette : « Oups » en plein parcours). Ce n'est pas une panne : on recharge, une seule fois.
const VERSION_PERIMEE = /dynamically imported module|Importing a module script failed|error loading dynamically imported|ChunkLoadError/i
const CLE_RECHARGE = 'societe.rechargement_version'

export class FiletSecurite extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false }

  static getDerivedStateFromError() {
    return { erreur: true }
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
    if (VERSION_PERIMEE.test(e.message)) {
      let deja = false
      // pas de boucle : un seul rechargement par page en 30 secondes
      try {
        const [page, quand] = (sessionStorage.getItem(CLE_RECHARGE) ?? '').split('|')
        deja = page === location.pathname && Date.now() - Number(quand) < 30000
        sessionStorage.setItem(CLE_RECHARGE, `${location.pathname}|${Date.now()}`)
      } catch { /* rien */ }
      if (!deja) { location.reload(); return }
    }
    signalerErreur(e.message, `${e.stack ?? ''}\n${info.componentStack ?? ''}`)
  }

  render() {
    if (!this.state.erreur) return this.props.children
    return (
      <div className="container page" style={{ maxWidth: 640 }}>
        <h1>Oups, cette page a rencontré un problème</h1>
        <p className="ink2">Le problème a été signalé automatiquement et sera corrigé. En attendant, vous pouvez recharger la page ou revenir à l'accueil.</p>
        <div className="row">
          <button className="btn primary" onClick={() => location.reload()}>Recharger la page</button>
          <a className="btn" href="/">Revenir à l'accueil</a>
        </div>
      </div>
    )
  }
}
