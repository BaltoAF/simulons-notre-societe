// « Ce que vos avis ont changé » : les décisions de l'auto-amélioration quotidienne, avec leur raison, et la charte qui les guide.
import { Link } from 'react-router-dom'
import { MessageSquarePlus, Scale, ShieldCheck, Sparkles } from 'lucide-react'
import { dateCourte } from '../lib/format'
import { useFetch } from '../lib/state'
import { ErrorBox, Loading } from '../components/ui'
import { ouvrirAvis } from '../components/DonnerAvis'

type Decision = {
  id: number; categorie: string; categorie_libelle: string; statut: string; decision_le: string
  resume_public: string; motif_public: string; commit_ref: string | null
}
type Reponse = { decisions: Decision[]; compte: Record<string, number> }

const STATUTS: Record<string, { libelle: string; classe: string }> = {
  retenu: { libelle: 'Retenu', classe: 'gain' },
  adapte: { libelle: 'Adapté', classe: 'gain' },
  deja_fait: { libelle: 'Déjà sur le site', classe: 'primary' },
  a_l_etude: { libelle: "À l'étude", classe: 'warn' },
  ecarte: { libelle: 'Écarté', classe: '' },
  doublon: { libelle: 'Déjà reçu', classe: '' },
}

export default function VosAvis() {
  const { data, loading, error } = useFetch<Reponse>('/api/avis/decisions')
  const recus = Object.values(data?.compte ?? {}).reduce((a, n) => a + n, 0)
  const appliques = (data?.compte.retenu ?? 0) + (data?.compte.adapte ?? 0)
  return (
    <div className="container page" style={{ maxWidth: 900 }}>
      <h1>Ce que vos avis ont changé</h1>
      <p className="lead ink2">Chaque jour, les avis laissés sur le site sont lus et servent à l'améliorer, en suivant une charte publique
        (<Link to="/qui-fait-ce-site">comment c'est fait</Link>). Voici chaque décision, avec sa raison.</p>
      <div className="row" style={{ marginBottom: 18 }}>
        <button className="btn primary" onClick={ouvrirAvis}><MessageSquarePlus size={16} /> Donner mon avis</button>
        {data && recus > 0 && <span className="small muted">{recus} avis reçus · {appliques} ont déjà amélioré le site</span>}
      </div>

      <div className="card stack" style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Comment les avis sont choisis</h2>
        <div className="grid cols-3">
          <div>
            <strong><Sparkles size={16} /> S'inspirer, pas recopier</strong>
            <p className="small ink2">Derrière chaque avis, on cherche le besoin : ce qui aidera le plus de monde à comprendre. Plusieurs avis semblables donnent une seule amélioration.</p>
          </div>
          <div>
            <strong><Scale size={16} /> Utile, fiable, neutre</strong>
            <p className="small ink2">Une idée est retenue si elle sert le bien commun, s'appuie sur des sources officielles et ne favorise aucun camp. Le nombre d'avis n'est pas un vote.</p>
          </div>
          <div>
            <strong><ShieldCheck size={16} /> Des garde-fous</strong>
            <p className="small ink2">Les demandes partisanes, illégales, hors sujet ou trop personnelles sont écartées. La loi actuelle ne change que par les textes officiels.</p>
          </div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Au plus trois améliorations par jour, toutes vérifiées par les tests du site et enregistrées dans une version
          que le responsable du projet relit et peut annuler. Votre texte n'est jamais publié : seul un résumé neutre l'est.</p>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && data.decisions.length === 0 && (
        <div className="card soft">
          <p style={{ margin: 0 }}>Aucun avis n'a encore été examiné. Le vôtre sera peut-être le premier à améliorer le site !</p>
        </div>
      )}
      {data && data.decisions.length > 0 && (
        <ul className="list card">
          {data.decisions.map((d) => {
            const st = STATUTS[d.statut] ?? { libelle: d.statut, classe: '' }
            return (
              <li key={d.id}>
                <div className="list-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <strong>{d.resume_public}</strong>
                  <span className={`badge ${st.classe}`}>{st.libelle}</span>
                </div>
                <p className="small ink2" style={{ margin: '4px 0 0' }}>{d.motif_public}</p>
                <div className="small muted" style={{ marginTop: 4 }}>
                  {d.categorie_libelle}{d.decision_le && <> · décidé le {dateCourte(d.decision_le)}</>}{d.commit_ref && <> · version {d.commit_ref}</>}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
