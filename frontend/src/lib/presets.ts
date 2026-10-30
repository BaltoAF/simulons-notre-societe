// Idées de réformes prêtes à tester : chacune est un ensemble de valeurs de règles.
// Elles illustrent des propositions qui circulent dans le débat public, sans prendre parti.
import type { Valeur } from './api'
import { AGE_TERME, GENERATIONS } from './retraite'

export type Preset = {
  id: string
  titre: string
  description: string
  overrides: Record<string, Valeur | ((v: any) => Valeur)>
  tags: string[]
}

const IR_BAREME = 'fiscalite.impot_revenu.bareme'

export const PRESETS: Preset[] = [
  {
    id: 'retraite-62',
    titre: 'Retour de la retraite à 62 ans',
    description: "L'âge légal de départ revient à 62 ans pour toutes les générations.",
    overrides: Object.fromEntries(GENERATIONS.map((id) => [id, (v: number) => Math.min(v, 62)])),
    tags: ['retraites'],
  },
  {
    id: 'rsa-800',
    titre: 'Porter le RSA à 800 € par mois',
    description: 'Hausse du montant forfaitaire du RSA pour une personne seule.',
    overrides: { 'prestations.rsa.montant_forfaitaire': 800 },
    tags: ['pauvreté', 'minima sociaux'],
  },
  {
    id: 'af-premier-enfant',
    titre: 'Allocations familiales dès le premier enfant',
    description: "Aujourd'hui, elles ne sont versées qu'à partir du deuxième enfant.",
    overrides: { 'prestations.famille.af_nombre_enfants_minimum': 1 },
    tags: ['famille'],
  },
  {
    id: 'tranche-50',
    titre: 'Nouvelle tranche d\'impôt à 50 % au-delà de 250 000 €',
    description: 'Une tranche d\'impôt de plus, réservée aux revenus les plus élevés (au-delà de 250 000 € par an pour une personne seule).',
    overrides: {
      [IR_BAREME]: (b: { seuil: number; taux: number }[]) => [...b.filter((t) => t.seuil < 250000), { seuil: 250000, taux: 50 }],
    },
    tags: ['impôt', 'hauts revenus'],
  },
  {
    id: 'baisse-ir-premiere-tranche',
    titre: 'Baisser la première tranche d\'impôt de 11 % à 9 %',
    description: 'Allègement ciblé sur les classes moyennes imposables.',
    overrides: {
      [IR_BAREME]: (b: { seuil: number; taux: number }[]) => b.map((t) => (t.taux === 11 ? { ...t, taux: 9 } : t)),
    },
    tags: ['impôt', 'classes moyennes'],
  },
  {
    id: 'tva-21',
    titre: 'Relever la TVA normale de 20 % à 21 %',
    description: 'Une piste souvent citée pour financer la protection sociale (« TVA sociale »).',
    overrides: { 'fiscalite.tva.taux_normal': 21 },
    tags: ['TVA', 'consommation'],
  },
  {
    id: 'revenu-universel',
    titre: 'Revenu universel de 600 € remplaçant RSA et prime d\'activité',
    description: 'Versé à chaque adulte, sans condition de ressources.',
    overrides: {
      'prestations.revenu_universel.montant': 600,
      'prestations.revenu_universel.remplace_rsa_prime_activite': true,
    },
    tags: ['proposition', 'revenu universel'],
  },
  {
    id: 'prime-activite-plus',
    titre: 'Prime d\'activité : +100 € sur le montant de base',
    description: 'Le montant de base est celui d\'une personne seule : un couple ou une famille avec enfants reçoit davantage.',
    overrides: { 'prestations.prime_activite.montant_forfaitaire': (v: number) => Math.round((v + 100) * 100) / 100 },
    tags: ['travail', 'pouvoir d\'achat'],
  },
  {
    id: 'csg-salaires-moins-1',
    titre: 'Baisser la CSG sur les salaires d\'un point',
    description: 'De 9,2 % à 8,2 % sur les revenus d\'activité.',
    overrides: { 'fiscalite.csg.salaires_taux': (v: number) => Math.round((v - 1) * 100) / 100 },
    tags: ['pouvoir d\'achat', 'Sécurité sociale'],
  },
  {
    id: 'aspa-plus-100',
    titre: 'Minimum vieillesse : +100 € par mois',
    description: "Hausse du minimum vieillesse (Aspa) d'une personne seule, versé aux retraités qui ont les plus petites ressources.",
    overrides: { 'prestations.aspa.montant_personne_seule': (v: number) => Math.round((v + 1200) * 100) / 100 },
    tags: ['retraités', 'pauvreté'],
  },
  {
    id: 'csg-retraites-6-6',
    titre: 'CSG des retraités : le taux plein ramené de 8,3 % à 6,6 %',
    description: "Le taux de CSG le plus élevé sur les pensions revient à son niveau d'avant 2018.",
    overrides: { 'fiscalite.csg.retraites_taux_plein': (v: number) => Math.min(v, 6.6) },
    tags: ['retraités', "pouvoir d'achat"],
  },
  {
    id: 'csg-retraites-9-2',
    titre: 'CSG des retraités : le taux plein aligné sur celui des salaires (9,2 %)',
    description: 'Le taux plein, payé par les retraités dont les revenus dépassent un plafond, passe de 8,3 % à 9,2 %.',
    overrides: { 'fiscalite.csg.retraites_taux_plein': (v: number) => Math.max(v, 9.2) },
    tags: ['retraités', 'Sécurité sociale'],
  },
  {
    id: 'flat-tax-30',
    titre: 'Relever la « flat tax » sur le capital (part IR de 12,8 % à 17,8 %)',
    description: 'Hausse de 5 points de la part impôt sur le revenu du prélèvement forfaitaire unique.',
    overrides: { 'fiscalite.capital.pfu_taux_ir': 17.8 },
    tags: ['capital', 'hauts revenus'],
  },
]

export function resoudrePreset(p: Preset, valeursActuelles: Record<string, Valeur>): Record<string, Valeur> {
  const out: Record<string, Valeur> = {}
  for (const [k, v] of Object.entries(p.overrides)) {
    const nv = typeof v === 'function' ? (v as (x: any) => Valeur)(valeursActuelles[k]) : v
    // une valeur identique à la loi actuelle ne change rien : on ne l'ajoute pas (sauf l'âge à terme, qui porte le réglage)
    if (k === AGE_TERME || JSON.stringify(nv) !== JSON.stringify(valeursActuelles[k])) out[k] = nv
  }
  return out
}
