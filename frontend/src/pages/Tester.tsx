// « Tester le site en 10 minutes » : une page à envoyer à un proche, pour que de vraies personnes, sans connaissances
// particulières, essaient le site et disent ce qui coince. Leurs remarques arrivent par « Donner mon avis », que la
// routine quotidienne lit chaque matin.
import { Link } from 'react-router-dom'
import { Clock, Landmark, MessageSquare, Shuffle, Wallet } from 'lucide-react'
import { ouvrirAvis } from '../components/DonnerAvis'
import { Beta } from '../components/Beta'

const MISSIONS = [
  { icone: Wallet, titre: 'Vos droits', lien: '/mes-droits', bouton: 'Calculer mes droits',
    consigne: "Calculez vos aides et votre impôt avec votre vraie situation (rien n'est enregistré).",
    questions: ["Avez-vous trouvé facilement où cliquer ?", "Le résultat correspond-il à ce que vous touchez vraiment ?", "Y a-t-il un mot que vous n'avez pas compris ?"] },
  { icone: Landmark, titre: "Où va l'argent public", lien: '/budget', bouton: 'Voir le budget',
    consigne: "Regardez où vont les impôts, puis « Et vous ? » pour voir votre part.",
    questions: ["Avez-vous appris quelque chose ?", "Un chiffre vous a-t-il paru faux ou bizarre ?"] },
  { icone: Shuffle, titre: 'Changer une règle', lien: '/atelier', bouton: 'Essayer une idée',
    consigne: "Choisissez une idée toute prête (ou une règle qui vous tient à cœur), puis « Voir les effets ».",
    questions: ["Avez-vous compris ce que votre changement coûterait, et à qui ?", "À quel moment avez-vous hésité ou eu envie d'abandonner ?"] },
]

export default function Tester() {
  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <h1><Clock size={28} /> Tester le site en 10 minutes <Beta /></h1>
      <p className="lead ink2">Ce site veut que chacun, sans connaissances en économie, comprenne les règles de la France et leurs effets.
        Pour savoir s'il y arrive, rien ne vaut votre regard. Faites ces trois petites missions, à votre rythme, sur téléphone ou sur ordinateur.</p>
      <div className="notice" style={{ marginBottom: 18 }}><div>Il n'y a pas de bonne ou de mauvaise réponse : <strong>si quelque chose vous
        bloque, c'est le site qu'il faut changer, pas vous.</strong> Aucun compte n'est nécessaire, et votre situation n'est jamais enregistrée.</div></div>
      <div className="stack">
        {MISSIONS.map((m, i) => (
          <div key={m.titre} className="card">
            <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}><m.icone size={20} /> Mission {i + 1} : {m.titre}</h2>
            <p style={{ marginTop: 0 }}>{m.consigne}</p>
            <div className="small ink2" style={{ marginBottom: 10 }}>Ensuite, demandez-vous :
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>{m.questions.map((q) => <li key={q}>{q}</li>)}</ul></div>
            <Link className="btn primary" to={m.lien}>{m.bouton}</Link>
          </div>
        ))}
      </div>
      <div className="card soft" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}><MessageSquare size={20} /> Dites-nous ce qui coince</h2>
        <p style={{ marginTop: 0 }}>Une phrase suffit : « Je n'ai pas compris tel mot », « Je cherchais tel bouton », « Ce chiffre m'étonne ».
          Chaque matin, les avis sont lus et le site est amélioré ; vous verrez la réponse dans <Link to="/vos-avis">Ce que vos avis ont changé</Link>.</p>
        <button className="btn primary" onClick={ouvrirAvis}><MessageSquare size={16} /> Donner mon avis</button>
      </div>
    </div>
  )
}
