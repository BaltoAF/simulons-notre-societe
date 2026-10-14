// L'âge légal de départ à la retraite est fixé génération par génération (11 règles) : pour le grand public, c'est une
// seule mesure, réglée par l'âge des plus jeunes (nés à partir de 1969, l'âge « à terme »).
import type { Valeur } from './api'

export const AGE_LEGAL = 'retraites.age_legal.generation_'
export const AGE_TERME = AGE_LEGAL + '1969_et_apres'
// de la plus ancienne à la plus jeune (même ordre que backend/app/droits.py)
export const GENERATIONS = ['1955_aout_1961', 'sept_dec_1961', '1962', '1963', '1964', 'janv_mars_1965', 'avril_dec_1965',
  '1966', '1967', '1968', '1969_et_apres'].map((g) => AGE_LEGAL + g)

export const estAgeLegal = (id: string) => id.startsWith(AGE_LEGAL)

/** « Âge légal de départ : nés en 1964 » → « Nés en 1964 ». */
export const nomGeneration = (titre: string) => {
  const g = titre.split(' : ').slice(1).join(' : ') || titre
  return g.charAt(0).toUpperCase() + g.slice(1)
}

/** L'âge choisi vaut pour toutes les générations : aucune ne part plus tard que lui. Un relèvement ne touche que les plus
 *  jeunes (les générations en transition gardent leur âge actuel). Renvoie seulement les générations qui changent, plus
 *  celle des plus jeunes, qui porte le réglage. */
export function agesPourTous(x: number, actuelles: Record<string, Valeur | undefined>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const id of GENERATIONS) {
    const cur = actuelles[id]
    if (typeof cur !== 'number') continue
    const nv = id === AGE_TERME ? x : Math.min(cur, x)
    if (id === AGE_TERME || nv !== cur) out[id] = nv
  }
  return out
}
