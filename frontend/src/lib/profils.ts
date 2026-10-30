// Profils types pour explorer sans saisir sa situation.
import type { SituationSaisie } from './state'

export const PROFILS: { titre: string; s: SituationSaisie }[] = [
  { titre: 'Personne seule au SMIC', s: { couple: 'seul', adultes: [{ age: 30, activite: 'salarie', montant_net: 1478, cadre: false, handicap: false }], enfants: [], logement: 'locataire_prive', loyer_mensuel: 550, zone: 2, revenus_capital_annuels: 0 } },
  // même foyer que le ménage type « Couple aux revenus médians, 2 enfants » des rapports (2 700 € et 2 400 € bruts)
  { titre: 'Couple aux revenus médians, 2 enfants', s: { couple: 'marie', adultes: [{ age: 42, activite: 'salarie', montant_net: 2137, cadre: false, handicap: false }, { age: 40, activite: 'salarie', montant_net: 1900, cadre: false, handicap: false }], enfants: [8, 12], logement: 'proprietaire', loyer_mensuel: 0, zone: 2, revenus_capital_annuels: 0 } },
  { titre: 'Parent seul, 2 enfants', s: { couple: 'seul', adultes: [{ age: 38, activite: 'salarie', montant_net: 1400, cadre: false, handicap: false }], enfants: [6, 11], logement: 'locataire_social', loyer_mensuel: 520, zone: 2, revenus_capital_annuels: 0 } },
  { titre: 'Retraité seul', s: { couple: 'seul', adultes: [{ age: 72, activite: 'retraite', montant_net: 1500, cadre: false, handicap: false }], enfants: [], logement: 'proprietaire', loyer_mensuel: 0, zone: 3, revenus_capital_annuels: 500 } },
  { titre: 'Cadre, hauts revenus', s: { couple: 'seul', adultes: [{ age: 48, activite: 'salarie', montant_net: 6500, cadre: true, handicap: false }], enfants: [], logement: 'proprietaire', loyer_mensuel: 0, zone: 1, revenus_capital_annuels: 8000 } },
]
