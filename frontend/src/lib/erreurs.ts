// Les erreurs des scripts du site, signalées au journal du serveur (gardé 30 jours, lu chaque jour par la routine
// d'auto-amélioration). Rien de personnel : le message, la pile d'appels et la page, sans ses paramètres.
const deja = new Set<string>()

export function signalerErreur(message: string, detail = '') {
  const cle = message.slice(0, 200)
  if (deja.has(cle) || deja.size >= 10) return // une fois par erreur et au plus 10 par visite
  deja.add(cle)
  const corps = JSON.stringify({ message, detail: detail.slice(0, 6000), page: location.pathname })
  try {
    fetch('/api/erreur-navigateur', { method: 'POST', body: corps, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
  } catch { /* le signalement ne doit jamais provoquer d'erreur à son tour */ }
}

/** Écoute les erreurs non rattrapées des scripts du site (celles des extensions du navigateur sont ignorées). */
export function ecouterErreurs() {
  window.addEventListener('error', (e) => {
    if (e.filename && !e.filename.startsWith(location.origin)) return
    signalerErreur(e.message || 'Erreur', e.error?.stack ?? `${e.filename}:${e.lineno}`)
  })
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    // une requête refusée par l'API est déjà affichée au visiteur et notée par le serveur
    if (r && typeof r === 'object' && 'status' in r) return
    signalerErreur(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack ?? '' : '')
  })
}
