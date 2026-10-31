// « Où je me situe ? » : le niveau de vie du foyer placé parmi les Français, sur une règle graduée (seuil de pauvreté,
// niveau du milieu, 10 % les plus aisés), d'après les déciles de niveau de vie de l'Insee.
import type { ReactNode } from 'react'
import { euros, nombre } from '../lib/format'
import { useFetch } from '../lib/state'
import { Terme } from './Terme'

type Stat = { id: string; derniere: { date: string; valeur: number } | null; source: { editeur?: string } | null }
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `revenus.niveau_vie.d${k}`).concat('revenus.pauvrete.seuil_60_mensuel')

/** Part de la population dont le niveau de vie est inférieur à v (interpolation entre les déciles). */
function rang(v: number, deciles: number[]): number {
  if (v <= deciles[0]) return Math.max(1, (v / deciles[0]) * 10)
  for (let k = 1; k < deciles.length; k++) {
    if (v <= deciles[k]) return 10 * k + 10 * (v - deciles[k - 1]) / (deciles[k] - deciles[k - 1])
  }
  return Math.min(99, 90 + 10 * (v - deciles[8]) / deciles[8]) // au-delà du 9e décile : simple ordre de grandeur
}

export function OuJeMeSitue({ niveauVieMensuel, note, retraite = false }: { niveauVieMensuel: number; note?: ReactNode; retraite?: boolean }) {
  const { data } = useFetch<{ metriques: Stat[] }>(`/api/metriques?ids=${IDS.join(',')}`)
  const val = (id: string) => data?.metriques.find((m) => m.id === id)?.derniere?.valeur
  const deciles = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => val(`revenus.niveau_vie.d${k}`))
  const seuil = val('revenus.pauvrete.seuil_60_mensuel')
  if (deciles.some((d) => d == null) || !seuil) return null
  const d = deciles as number[]
  const annuel = niveauVieMensuel * 12
  const r = rang(annuel, d)
  const pos = (x: number) => `${Math.max(0, Math.min(100, rang(x, d)))}%`
  const annee = data?.metriques.find((m) => m.id === 'revenus.niveau_vie.d5')?.derniere?.date?.slice(0, 4)
  const phrase = r < 10 ? 'Votre foyer fait partie des 10 % les plus modestes.'
    : r > 90 ? 'Votre foyer fait partie des 10 % les plus aisés.'
      : `Votre niveau de vie est plus élevé que celui d'environ ${nombre(Math.round(r / 5) * 5, 0)} % des Français.`
  return (
    <div className="situe">
      <div className="kpi-label">Où vous situez-vous ?</div>
      <p style={{ margin: '4px 0 10px', fontWeight: 650 }}>{phrase}</p>
      {note && <p className="small muted" style={{ margin: '-4px 0 10px' }}>{note}</p>}
      <div className="situe-regle" aria-hidden="true">
        <span className="situe-zone pauvre" style={{ width: pos(seuil * 12) }} />
        <span className="situe-repere" style={{ left: pos(seuil * 12) }}><span>Seuil de pauvreté<br />{euros(seuil, 0)}</span></span>
        <span className="situe-repere" style={{ left: '50%' }}><span>Milieu<br />{euros(d[4] / 12, 0)}</span></span>
        <span className="situe-repere" style={{ left: '90%' }}><span>10 % les plus aisés<br />{euros(d[8] / 12, 0)}</span></span>
        <span className="situe-vous" style={{ left: pos(annuel) }}><span>Vous<br />{euros(niveauVieMensuel, 0)}</span></span>
      </div>
      {/* sous le seuil, une retraitée comprenait « je suis pauvre ? » sans savoir à qui s'adresser (test Odette) : le dire
          doucement, et dire qui peut aider */}
      {niveauVieMensuel < seuil && (
        <div className="notice small" style={{ marginTop: 34 }}><div>
          <strong>Votre niveau de vie est sous le seuil de pauvreté,</strong> une mesure statistique (60 % du niveau de vie du milieu) qui ne
          dit pas tout de votre situation. Si vous avez du mal à faire face, des aides existent, au-delà de celles calculées ici. Pour en parler :
          le centre communal d'action sociale (CCAS) de votre mairie, un espace France services près de chez vous{retraite
            ? ", ou le service d'action sociale de votre caisse de retraite"
            : ", ou votre caisse d'allocations familiales (CAF)"}. Voyez aussi « Avez-vous pensé à… ? » plus bas.
        </div></div>
      )}
      <p className="small muted" style={{ margin: niveauVieMensuel < seuil ? '12px 0 0' : '34px 0 0' }}>Niveaux de vie mensuels pour une personne seule, d'après l'Insee ({annee}). Le <Terme id="niveau_vie">niveau de vie</Terme> tient compte
        de la taille du foyer : c'est ce qui permet de comparer des foyers différents.</p>
    </div>
  )
}
