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

// génération de chaque règle : première et dernière date de naissance (année-mois)
const BORNES: [string, string][] = [['1955-01', '1961-08'], ['1961-09', '1961-12'], ['1962-01', '1962-12'], ['1963-01', '1963-12'],
  ['1964-01', '1964-12'], ['1965-01', '1965-03'], ['1965-04', '1965-12'], ['1966-01', '1966-12'], ['1967-01', '1967-12'],
  ['1968-01', '1968-12'], ['1969-01', '9999-12']]
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** La règle d'âge légal qui s'applique à une date de naissance (null avant 1955 : génération déjà partie). */
export function generationDe(annee: number, mois: number): string | null {
  const ym = `${annee}-${String(mois).padStart(2, '0')}`
  const i = BORNES.findIndex(([a, b]) => a <= ym && ym <= b)
  return i < 0 ? null : GENERATIONS[i]
}

/** « juin 2027 » : le mois où l'on atteint un âge (en années, avec des mois). */
export function dateAge(annee: number, mois: number, age: number): string {
  const total = annee * 12 + (mois - 1) + Math.round(age * 12)
  return `${MOIS[total % 12]} ${Math.floor(total / 12)}`
}

export type Depart = { qui: string; avant: number; apres: number; dateAvant: string; dateApres: string }

/** Pour chaque adulte du foyer qui n'est pas encore à la retraite : son âge et sa date de départ, avant et après. */
export function departsDuFoyer(adultes: { age: number; activite: string }[], moisNaissance: number,
  avant: Record<string, Valeur | undefined>, apres: Record<string, Valeur | undefined>): Depart[] {
  const an = new Date().getFullYear()
  return adultes.flatMap((a, i) => {
    if (a.activite === 'retraite') return []
    const annee = an - a.age
    const g = generationDe(annee, moisNaissance)
    if (!g || typeof avant[g] !== 'number') return []
    const av = avant[g] as number, ap = (typeof apres[g] === 'number' ? apres[g] : av) as number
    return [{ qui: adultes.length > 1 ? (i === 0 ? 'Vous' : 'Votre conjoint(e)') : 'Vous', avant: av, apres: ap,
      dateAvant: dateAge(annee, moisNaissance, av), dateApres: dateAge(annee, moisNaissance, ap) }]
  })
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
