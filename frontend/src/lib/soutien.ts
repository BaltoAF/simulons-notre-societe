// « Offrir un café » : proposer, rarement et avec tact, de soutenir le site après une action utile.
// Tout reste dans le navigateur (aucun traceur, rien n'est envoyé au serveur). Règles :
//  - pas avant 3 actions utiles (une par sorte et par jour : calculer ses droits, tester une réforme, comprendre une question) ;
//  - pas pendant la découverte guidée du site, qui a déjà ses propres invitations ;
//  - au plus une fois par mois ; jamais plus après « Ne plus me le proposer » ; six mois de tranquillité après un don.
import type { Parcours } from './state'

export type ActionUtile = 'droits' | 'reforme' | 'question'
type Etat = { actions: number; derniere: Partial<Record<ActionUtile, string>>; vue_le?: string; merci_le?: string; jamais?: boolean }

const CLE = 'societe.soutien'
const JOUR = 86_400_000
const SEUIL_ACTIONS = 3

function lire(): Etat {
  try {
    const s = localStorage.getItem(CLE)
    return s ? { actions: 0, derniere: {}, ...JSON.parse(s) } : { actions: 0, derniere: {} }
  } catch {
    return { actions: 0, derniere: {} }
  }
}

function ecrire(e: Etat) {
  try { localStorage.setItem(CLE, JSON.stringify(e)) } catch { /* navigation privée : on ne propose simplement rien */ }
}

const aujourdhui = () => new Date().toISOString().slice(0, 10)
const depuis = (d?: string) => (d ? (Date.now() - new Date(d).getTime()) / JOUR : Infinity)

export function noterActionUtile(type: ActionUtile) {
  const e = lire()
  if (e.derniere[type] === aujourdhui()) return
  ecrire({ ...e, actions: e.actions + 1, derniere: { ...e.derniere, [type]: aujourdhui() } })
}

export function peutProposer(parcours: Parcours): boolean {
  const e = lire()
  const decouverteEnCours = !parcours.masque && parcours.faites.length < 4
  return !e.jamais && e.actions >= SEUIL_ACTIONS && !decouverteEnCours && depuis(e.vue_le) >= 30 && depuis(e.merci_le) >= 182
}

export const marquerVue = () => ecrire({ ...lire(), vue_le: new Date().toISOString() })
export const remercier = () => ecrire({ ...lire(), merci_le: new Date().toISOString() })
export const neplusProposer = () => ecrire({ ...lire(), jamais: true })
