// « Soutenir le projet » : pourquoi le site accepte des dons, à quoi ils servent, et ce qu'ils ne changent pas.
import { Coffee, Scale, Server, ShieldCheck } from 'lucide-react'
import { useApp } from '../lib/state'
import { remercier } from '../lib/soutien'

export default function Soutenir() {
  const { meta } = useApp()
  const lien = meta?.soutien?.lien
  return (
    <div className="container page" style={{ maxWidth: 820 }}>
      <h1><Coffee size={28} /> Soutenir le projet</h1>
      <p className="lead ink2">Simulons notre société est gratuit, sans publicité, sans traceur et sans compte obligatoire. Son code et ses données sont ouverts.
        Il le restera, que vous donniez ou non.</p>

      <div className="grid cols-3" style={{ marginBottom: 18 }}>
        <div className="card">
          <strong><Server size={16} /> À quoi sert un don</strong>
          <p className="small ink2">Payer le serveur et le nom de domaine, l'intelligence artificielle qui améliore le site chaque jour à partir de vos avis,
            et le temps passé à vérifier les sources.</p>
        </div>
        <div className="card">
          <strong><Scale size={16} /> Ce qu'il ne change pas</strong>
          <p className="small ink2">Un don n'achète aucune influence : ni sur les chiffres, ni sur les règles, ni sur le choix des avis retenus.
            Le site ne sait d'ailleurs pas qui a donné.</p>
        </div>
        <div className="card">
          <strong><ShieldCheck size={16} /> En toute clarté</strong>
          <p className="small ink2">Le paiement se fait sur une plateforme de dons extérieure : le site ne voit jamais vos coordonnées bancaires.
            Le projet n'est pas une association : le don n'ouvre pas droit à une réduction d'impôt.</p>
        </div>
      </div>

      {lien ? (
        <div className="card soft row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <div>Le prix d'un café suffit. Merci !</div>
          <a className="btn primary" href={lien} target="_blank" rel="noreferrer noopener" onClick={remercier}><Coffee size={16} /> Offrir un café</a>
        </div>
      ) : (
        <div className="card soft">Les dons ne sont pas encore ouverts. Revenez bientôt, et merci de votre intérêt !</div>
      )}
    </div>
  )
}
