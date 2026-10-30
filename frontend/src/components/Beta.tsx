// Badge « Bêta » : une nouveauté en test. La routine d'auto-amélioration fait le point au bout de 14 jours, d'après les avis
// (system/auto_amelioration/CHARTE.md, règle 6). Un clic ouvre « Donner mon avis ».
import { ouvrirAvis } from './DonnerAvis'

export function Beta() {
  return (
    <button type="button" className="badge beta" onClick={ouvrirAvis}
      title="Nouveauté en test : dites-nous si elle vous aide (Donner mon avis)">Bêta</button>
  )
}
