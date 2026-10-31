// « Qui fait ce site ? » : qui est derrière, d'où viennent les chiffres, ce que fait l'IA et ce qu'elle ne peut pas faire.
// Test Gérard (lecteur méfiant) : « on ne sait pas qui est derrière », et le mot « IA » n'apparaissait nulle part.
// L'IA est dite ici, mais pas en titre ni en vitrine ailleurs : le sujet clive (choix du responsable).
import { Link } from 'react-router-dom'
import { Calculator, Coins, FileText, RefreshCw, Scale, ShieldCheck } from 'lucide-react'

const DEPOT = 'https://github.com/BaltoAF/simulons-notre-societe'

export default function QuiFait() {
  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <h1>Qui fait ce site ?</h1>
      <p className="lead ink2">Simulons notre société est un projet indépendant : il ne dépend d'aucun parti, d'aucune administration ni d'aucune
        entreprise. Voici, sans détour, comment il est fait.</p>
      <div className="stack">
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}><Calculator size={20} /> D'où viennent les chiffres</h2>
          <p style={{ marginTop: 0 }}>Les impôts et les aides de chaque foyer sont calculés par <strong>OpenFisca-France</strong>, un modèle public de la
            loi française, aussi utilisé par l'Assemblée nationale. Les autres chiffres viennent de sources officielles (Insee, DREES, DGFiP,
            ministères…) ou d'études publiées : chacun est relié à sa source, dans le <Link to="/sources">registre des sources</Link>.</p>
          <p style={{ marginBottom: 0 }}>Le site compare ses calculs aux chiffrages officiels des mêmes réformes et publie les écarts, même quand ils ne
            l'arrangent pas : <Link to="/fiabilite">Nos chiffres sont-ils justes ?</Link></p>
        </div>
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}><RefreshCw size={20} /> Le site s'améliore chaque jour grâce à vos avis</h2>
          <p style={{ marginTop: 0 }}>Chaque matin, les avis laissés par les visiteurs sont lus, les erreurs corrigées et le site amélioré. Ce travail est
            fait avec l'aide d'un outil d'intelligence artificielle (Claude, de l'entreprise Anthropic), qui suit une{' '}
            <a href={`${DEPOT}/blob/main/system/auto_amelioration/CHARTE.md`} target="_blank" rel="noreferrer">charte publique</a> : le bien commun, des
            sources officielles et la neutralité passent avant toute demande, et les demandes partisanes sont écartées.</p>
          <p style={{ marginBottom: 0 }}><strong>Ce que cet outil ne peut pas faire :</strong> changer seul une valeur de la loi actuelle, modifier sa propre
            charte, toucher aux comptes ou aux avis, ni mettre en ligne quoi que ce soit sans que des tests automatiques soient passés. Chaque
            décision est publiée : <Link to="/vos-avis">Ce que vos avis ont changé</Link>.</p>
        </div>
        <div className="card">
          <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}><FileText size={20} /> Tout est ouvert</h2>
          <p style={{ margin: 0 }}>Le code du site est public (licence AGPL) et ses données aussi (Licence Ouverte) : chacun peut vérifier comment un
            chiffre est calculé, ou reprendre le site. <a href={DEPOT} target="_blank" rel="noreferrer">Voir le code</a> ·{' '}
            <Link to="/systeme">Journal des mises à jour</Link> · <Link to="/methode">Méthode et indice de confiance</Link></p>
        </div>
        <div className="grid cols-2">
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}><ShieldCheck size={18} /> Ce que le site ne fait pas</h2>
            <p className="small" style={{ margin: 0 }}>Pas de publicité, pas de traceur, pas de cookie publicitaire, pas de revente de données. Votre situation
              reste dans votre navigateur ; les visites sont comptées de façon anonyme, par le site lui-même.</p>
          </div>
          <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}><Coins size={18} /> Qui le finance</h2>
            <p className="small" style={{ margin: 0 }}>Le serveur, le nom de domaine et les outils ont un coût. Le site ne vit d'aucune subvention ni
              d'aucune entreprise : il compte sur des dons volontaires, qui n'achètent aucune influence (<Link to="/soutenir">Soutenir le projet</Link>).</p>
          </div>
        </div>
        <div className="notice"><Scale size={18} style={{ flexShrink: 0 }} /><div>Une erreur, un chiffre qui vous semble faux, un parti pris ?
          Dites-le avec « Donner mon avis » : c'est lu chaque matin, et la réponse est publiée.</div></div>
      </div>
    </div>
  )
}
