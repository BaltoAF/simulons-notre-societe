// Typographie française à l'écran : espace insécable avant « : ; ! ? % € » et après « « », et entre les groupes de chiffres
// d'un nombre (« 3 000 »). Sans elle, une ligne commençait par « : » ou coupait « 11 | % » et « 3 | 000 milliards »
// (test Nadia, téléphone). Appliquée à tout le texte affiché, au fil des rendus, sauf là où l'on écrit.
const FINE = ' '
const EXCLUS = 'input, textarea, [contenteditable], code, pre, script, style'

export function insecables(s: string): string {
  return s.replace(/ ([:;!?%»€])/g, `${FINE}$1`).replace(/« /g, `«${FINE}`).replace(/(\d) (?=\d{3}(?!\d))/g, `$1${FINE}`)
}

function corriger(n: Node) {
  const t = n.nodeValue
  if (!t || !/[ «]/.test(t) || n.parentElement?.closest(EXCLUS)) return
  const u = insecables(t)
  if (u !== t) n.nodeValue = u // idempotent : la mutation qu'elle déclenche ne change plus rien
}

function parcourir(n: Node) {
  if (n.nodeType === Node.TEXT_NODE) return corriger(n)
  if (!(n instanceof Element) || n.closest(EXCLUS)) return
  const w = document.createTreeWalker(n, NodeFilter.SHOW_TEXT)
  while (w.nextNode()) corriger(w.currentNode)
}

export function typographieAuto(racine: Node = document.body) {
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'characterData') corriger(m.target)
      else m.addedNodes.forEach(parcourir)
    }
  }).observe(racine, { childList: true, subtree: true, characterData: true })
  parcourir(racine)
}
