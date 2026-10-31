// Coût d'une assistante maternelle agréée, aides déduites (test Lucie : « combien me coûtera vraiment la nounou ? »).
// OpenFisca-France 176 ne connaît que l'ancien complément de la CAF (formule de 2017) : le CMG réformé au 1er septembre
// 2025 est donc calculé ici, avec les règles sourcées de model/regles/prestations/garde_enfants.yaml.
// CMG = heures × tarif horaire retenu × (1 − ressources mensuelles × taux d'effort ÷ coût horaire de référence).

export type ParamsGarde = {
  tauxEffort: [number, number, number, number] // en %, pour 1, 2, 3, 4 enfants et plus
  coutReference: number
  plafondHoraire: number
  ressourcesPlancher: number
  ressourcesPlafond: number
  creditPlafondDepenses: number // par enfant et par an
}

const IDS = {
  t1: 'prestations.garde.cmg_taux_effort_1_enfant',
  t2: 'prestations.garde.cmg_taux_effort_2_enfants',
  t3: 'prestations.garde.cmg_taux_effort_3_enfants',
  t4: 'prestations.garde.cmg_taux_effort_4_enfants_et_plus',
  ref: 'prestations.garde.cmg_cout_horaire_reference',
  plafondH: 'prestations.garde.cmg_plafond_horaire',
  plancher: 'prestations.garde.cmg_ressources_plancher',
  plafond: 'prestations.garde.cmg_ressources_plafond',
  credit: 'prestations.garde.credit_impot_plafond_depenses',
}
export const REGLES_GARDE = Object.values(IDS)

/** Les paramètres en vigueur, lus dans les règles du site ; null s'il en manque un. */
export function paramsGarde(valeurs: Record<string, unknown>): ParamsGarde | null {
  const v = Object.fromEntries(Object.entries(IDS).map(([k, id]) => [k, valeurs[id]]))
  if (Object.values(v).some((x) => typeof x !== 'number')) return null
  const n = v as Record<keyof typeof IDS, number>
  return {
    tauxEffort: [n.t1, n.t2, n.t3, n.t4], coutReference: n.ref, plafondHoraire: n.plafondH,
    ressourcesPlancher: n.plancher, ressourcesPlafond: n.plafond, creditPlafondDepenses: n.credit,
  }
}

export type EstimationGarde = {
  cout: number            // versé chaque mois à l'assistante maternelle
  cmg: number             // complément de la CAF, par mois
  ressourcesRetenues: number
  creditMensuel: number   // crédit d'impôt, ramené au mois (versé l'année suivante)
  resteACharge: number    // après le complément et le crédit d'impôt
  auDessusDuPlafond: boolean
}

/**
 * Estimation pour un enfant gardé : `heures` par mois, `cout` versé par mois (salaire net et indemnités),
 * `ressources` mensuelles du foyer, `enfants` à charge, `credit` si l'enfant a moins de 6 ans.
 * Les cotisations de l'assistante maternelle sont prises en charge à 100 % par la CAF : elles ne coûtent rien.
 */
export function estimerGarde(x: { heures: number; cout: number; ressources: number; enfants: number; credit: boolean }, p: ParamsGarde): EstimationGarde {
  const h = Math.max(0, x.heures), cout = Math.max(0, x.cout)
  const tarif = h > 0 ? cout / h : 0
  const r = Math.min(Math.max(x.ressources, p.ressourcesPlancher), p.ressourcesPlafond)
  const te = p.tauxEffort[Math.min(Math.max(x.enfants, 1), 4) - 1] / 100
  const cmg = Math.max(0, h * Math.min(tarif, p.plafondHoraire) * (1 - (r * te) / p.coutReference))
  const creditMensuel = x.credit ? (0.5 * Math.min(Math.max(0, cout - cmg) * 12, p.creditPlafondDepenses)) / 12 : 0
  return {
    cout, cmg, ressourcesRetenues: r, creditMensuel,
    resteACharge: Math.max(0, cout - cmg - creditMensuel), auDessusDuPlafond: tarif > p.plafondHoraire,
  }
}
