// Invitation discrète à « offrir un café », placée sous un résultat utile (voir lib/soutien.ts pour les règles de rareté).
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Coffee } from 'lucide-react'
import { useApp } from '../lib/state'
import { marquerVue, neplusProposer, peutProposer, remercier } from '../lib/soutien'

export function ProposerSoutien({ masquer = false }: { masquer?: boolean }) {
  const { meta, parcours } = useApp()
  const lien = meta?.soutien?.lien
  // décidé une seule fois à l'affichage de la page : l'invitation ne surgit pas en cours de lecture
  const [visible, setVisible] = useState(() => !masquer && peutProposer(parcours))
  const [merci, setMerci] = useState(false)
  useEffect(() => { if (visible && lien) marquerVue() }, [visible, lien])
  if (!lien || (!visible && !merci)) return null
  if (merci) {
    return <div className="soutien small" role="status"><Coffee size={18} aria-hidden="true" /> Merci, du fond du cœur ! Votre café aide le site à rester gratuit, sans publicité et indépendant.</div>
  }
  return (
    <aside className="soutien" aria-label="Soutenir le site">
      <Coffee size={20} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
      <div className="grow">
        <div className="small"><strong>Ce site vous a été utile ?</strong> Il est gratuit, sans publicité ni traceur, et le restera.
          Si vous le pouvez, offrez-lui un café : cela aide à payer le serveur et à l'améliorer chaque jour. <Link to="/soutenir">Pourquoi ?</Link></div>
        <div className="row" style={{ gap: 8, marginTop: 8 }}>
          <a className="btn small primary" href={lien} target="_blank" rel="noreferrer noopener" onClick={() => { remercier(); setMerci(true); setVisible(false) }}>
            <Coffee size={14} /> Offrir un café</a>
          <button className="btn small ghost" onClick={() => setVisible(false)}>Pas maintenant</button>
          <button className="lien small muted" onClick={() => { neplusProposer(); setVisible(false) }}>Ne plus me le proposer</button>
        </div>
      </div>
    </aside>
  )
}
