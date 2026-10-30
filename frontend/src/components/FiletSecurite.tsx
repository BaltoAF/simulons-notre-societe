// Si une page plante à l'affichage : un message clair et un bouton pour recharger, plutôt qu'un écran blanc.
// L'erreur est signalée au journal du serveur ; la routine d'auto-amélioration la corrige.
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { signalerErreur } from '../lib/erreurs'

export class FiletSecurite extends Component<{ children: ReactNode }, { erreur: boolean }> {
  state = { erreur: false }

  static getDerivedStateFromError() {
    return { erreur: true }
  }

  componentDidCatch(e: Error, info: ErrorInfo) {
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
