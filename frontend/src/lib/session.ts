// Conserver des résultats le temps de la visite (le navigateur peut refuser : on fait alors sans)
export function lireSession<T>(cle: string): T | null {
  try { const v = sessionStorage.getItem(cle); return v ? JSON.parse(v) as T : null } catch { return null }
}

export function ecrireSession(cle: string, v: unknown) {
  try { if (v === null || v === undefined) sessionStorage.removeItem(cle); else sessionStorage.setItem(cle, JSON.stringify(v)) } catch { /* espace plein ou stockage bloqué */ }
}
