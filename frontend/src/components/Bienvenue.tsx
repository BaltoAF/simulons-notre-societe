// Première visite : une prise en main en quatre écrans courts, qu'on peut passer à tout moment, puis « par où commencer ».
// Rouvrable depuis le menu « Comprendre » (Visite guidée). Rien n'est enregistré ailleurs que dans le navigateur.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BadgeCheck, Calculator, GitFork, HelpCircle, Landmark, Sparkles, Users } from 'lucide-react'
import { useApp } from '../lib/state'
import { Modal } from './ui'

const ECRANS = [
  {
    Icone: Sparkles,
    titre: 'Bienvenue !',
    texte: "Simulons notre société explique les règles de la France (impôts, aides, retraites, climat…) avec des mots simples et des chiffres officiels. "
      + "Aucune connaissance n'est nécessaire : on vous guide. C'est gratuit, sans compte et sans publicité.",
  },
  {
    Icone: GitFork,
    titre: '1. Changez les règles',
    texte: "« Et si le salaire minimum augmentait ? Et si on baissait les impôts ? » Changez une règle, et le site calcule ce que cela changerait "
      + 'pour vous et pour le pays : argent public, pauvreté, climat, bien-être.',
  },
  {
    Icone: Users,
    titre: '2. Partez des idées des autres',
    texte: "Chacun peut enregistrer sa version des règles : une « proposition ». Comparez-les, partez de celle de quelqu'un, ou suggérez-lui un changement "
      + "qu'il acceptera ou non, comme un amendement. Un parti pourrait y écrire son programme, et ses adhérents l'amender.",
  },
  {
    Icone: Calculator,
    titre: '3. Voyez ce que ça change pour vous',
    texte: "Décrivez votre foyer en trois étapes : le site calcule vos aides, vos impôts, ce qui vous reste chaque mois et l'âge auquel vous pourrez partir à la retraite. "
      + 'Vos réponses restent sur votre appareil.',
  },
  {
    Icone: BadgeCheck,
    titre: '4. Chaque chiffre dit d\'où il vient',
    texte: "Chaque règle renvoie au texte de loi qui la fixe, chaque estimation à ses études. Une étiquette « Fiabilité » dit à quel point on peut s'y fier, "
      + "et nos calculs sont comparés à ceux des institutions publiques.",
    exemple: true,
  },
]

export function Bienvenue({ onClose }: { onClose: () => void }) {
  const [i, setI] = useState(0)
  const [grand, setGrand] = useState(() => document.documentElement.classList.contains('texte-grand'))
  const { setParcours } = useApp()
  const nav = useNavigate()
  const fin = i >= ECRANS.length
  const fermer = () => { setParcours((p) => ({ ...p, bienvenue_vue: true })); onClose() }
  const aller = (lien: string) => { fermer(); nav(lien) }

  return (
    <Modal title={fin ? 'Par où commencer ?' : 'Découvrir le site'} onClose={fermer} width={620} footer={
      <div className="row between" style={{ width: '100%', flexWrap: 'wrap', gap: 8 }}>
        <button className="btn ghost small" onClick={fermer}>{fin ? 'Je découvre par moi-même' : 'Passer la visite'}</button>
        <div className="row" style={{ flexWrap: 'nowrap', gap: 8 }}>
          {i > 0 && <button className="btn small" onClick={() => setI(i - 1)}><ArrowLeft size={14} /> Retour</button>}
          {!fin && <button className="btn primary small" onClick={() => setI(i + 1)}>{i === ECRANS.length - 1 ? 'Par où commencer ?' : 'Suivant'} <ArrowRight size={14} /></button>}
        </div>
      </div>
    }>
      {!fin ? (() => {
        const e = ECRANS[i]
        return (
          <div className="bienvenue">
            <div className="bienvenue-icone"><e.Icone size={34} /></div>
            <h3 style={{ margin: '12px 0 8px', fontSize: '1.25rem' }}>{e.titre}</h3>
            <p className="ink2" style={{ fontSize: '1.05rem', margin: 0 }}>{e.texte}</p>
            {i === 0 && (
              <button className="btn small" style={{ marginTop: 12 }} aria-pressed={grand} onClick={() => {
                window.dispatchEvent(new CustomEvent('societe:texte', { detail: !grand }))
                setGrand(!grand)
              }}>{grand ? 'Texte agrandi ✓ (revenir à la taille normale)' : 'A+ Texte trop petit ? Agrandir le texte'}</button>
            )}
            {e.exemple && (
              <div className="small" style={{ marginTop: 12 }}>Par exemple : <span className="conf tres_eleve">Fiabilité très élevée</span>{' '}
                <span className="conf faible">Fiabilité faible</span></div>
            )}
            <div className="points" aria-label={`Écran ${i + 1} sur ${ECRANS.length}`}>
              {ECRANS.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
            </div>
          </div>
        )
      })() : (
        <div className="stack" style={{ gap: 10 }}>
          <p className="ink2" style={{ marginTop: 0 }}>Choisissez ce qui vous intéresse. Vous pourrez revoir cette visite depuis le menu « En savoir plus ».</p>
          <button className="preset" onClick={() => aller('/atelier')}><strong><GitFork size={16} /> Changer une règle et voir ses effets</strong>
            <span className="small muted">L'expérience au cœur du site : partez d'une idée toute prête, ou de la règle de votre choix.</span></button>
          {/* dans les mots du visiteur (test Odette : « Est-ce que j'ai droit à des aides ? Ma retraite va-t-elle baisser ? ») */}
          <button className="preset" onClick={() => aller('/mes-droits')}><strong><Calculator size={16} /> Ai-je droit à des aides ? Combien me reste-t-il ?</strong>
            <span className="small muted">Le plus simple pour commencer : environ une minute. Vous saurez aussi à quel âge partir à la retraite, ou si votre retraite va baisser.</span></button>
          <button className="preset" onClick={() => aller('/comprendre')}><strong><HelpCircle size={16} /> Comprendre une grande question</strong>
            <span className="small muted">Où va l'argent public ? La dette, c'est grave ? Comment marchent les retraites ?</span></button>
          <button className="preset" onClick={() => aller('/societes')}><strong><Users size={16} /> Les propositions des autres</strong>
            <span className="small muted">Comparez-les, partez de l'une d'elles, ou suggérez un changement à son auteur.</span></button>
          <button className="preset" onClick={() => aller('/budget')}><strong><Landmark size={16} /> Voir le budget de la France</strong>
            <span className="small muted">D'où vient l'argent public, où il va, et votre part.</span></button>
        </div>
      )}
    </Modal>
  )
}
