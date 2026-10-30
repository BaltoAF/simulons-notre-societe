// Fréquentation du site (page privée : le lien contient la clé du serveur). Mesure maison, anonyme, sans cookie.
import { useLocation } from 'react-router-dom'
import { BarChart3, Lock, Monitor, Server, Smartphone } from 'lucide-react'
import { nombre } from '../lib/format'
import { useFetch } from '../lib/state'
import { Loading } from '../components/ui'

type Bilan = {
  jours: { jour: string; vues: number; visiteurs: number }[]
  pages: { page: string; vues: number }[]
  appareils: Record<string, number>
  provenances: { domaine: string; visites: number }[]
  total_vues: number
  serveur: Serveur
}
type Serveur = {
  statut: 'ok' | 'a_surveiller' | 'a_traiter' | 'inconnu'
  alertes: { niveau: 'info' | 'a_surveiller' | 'a_traiter'; texte: string }[]
  date?: string
  systeme?: { nom: string | null }
  mises_a_jour?: { securite: number | null; derniere_execution: string | null }
  disque_utilise_pct?: number
  derniere_sauvegarde?: string | null
  version_site?: string | null
}
const STATUTS = { ok: ['gain', 'Tout va bien'], a_surveiller: ['warn', 'À surveiller'], a_traiter: ['accent', 'À traiter'], inconnu: ['', 'Inconnu'] } as const
const quand = (iso?: string | null) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : 'jamais'

// Santé du serveur : relevée toutes les 30 minutes par deploy/maintenance_serveur.sh ; la routine quotidienne la lit aussi.
function SanteServeur({ s }: { s: Serveur }) {
  const [classe, libelle] = STATUTS[s.statut] ?? STATUTS.inconnu
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-head"><h3 style={{ margin: 0 }}><Server size={18} /> Santé du serveur</h3><span className={`badge ${classe}`}>{libelle}</span></div>
      {s.alertes.length > 0
        ? <ul className="list">{s.alertes.map((a) => <li key={a.texte} className="list-row small"><span>{a.texte}</span>
            {a.niveau !== 'info' && <span className={`badge ${STATUTS[a.niveau][0]}`}>{STATUTS[a.niveau][1]}</span>}</li>)}</ul>
        : <p className="small" style={{ margin: '8px 0' }}>Les mises à jour de sécurité s'installent seules chaque nuit ; pare-feu, protection des connexions et sauvegarde du jour : en place.</p>}
      {s.date && <div className="small muted">{s.systeme?.nom} · dernière mise à jour automatique : {quand(s.mises_a_jour?.derniere_execution)}
        {' '}· sauvegarde : {quand(s.derniere_sauvegarde)} · disque utilisé : {nombre(s.disque_utilise_pct ?? 0, 0)} % · version {s.version_site} · relevé le {quand(s.date)}</div>}
    </div>
  )
}

const NOMS: [RegExp, string][] = [
  [/^\/$/, 'Accueil'], [/^\/mes-droits/, 'Mes droits'], [/^\/comprendre\/(.+)/, 'Grande question : $1'], [/^\/comprendre$/, 'Les grandes questions'],
  [/^\/budget/, 'Le budget'], [/^\/atelier/, 'Changer les règles'], [/^\/societes/, 'Les propositions'], [/^\/regles\/r\/(.+)/, 'Règle : $1'],
  [/^\/regles/, 'Les règles'], [/^\/vos-avis/, 'Ce que vos avis ont changé'], [/^\/soutenir/, 'Soutenir le projet'], [/^\/tester/, 'Tester le site'], [/^\/qui-fait-ce-site/, 'Qui fait ce site ?'],
]
const nomPage = (p: string) => { for (const [re, nom] of NOMS) if (re.test(p)) return p.replace(re, nom); return p }

export default function Frequentation() {
  const cle = new URLSearchParams(useLocation().search).get('cle') ?? ''
  const { data, loading, error } = useFetch<Bilan>(cle ? `/api/frequentation?cle=${encodeURIComponent(cle)}` : null)
  if (!cle || error) {
    return <div className="container page" style={{ maxWidth: 700 }}><h1>Fréquentation</h1>
      <p className="ink2"><Lock size={16} /> Cette page est privée : ouvrez-la avec le lien complet donné à l'installation du serveur.</p></div>
  }
  if (loading || !data) return <div className="container page"><Loading /></div>
  const auj = data.jours[data.jours.length - 1]
  const sept = data.jours.slice(-7)
  const max = Math.max(1, ...data.jours.map((d) => d.visiteurs))
  const tel = data.appareils.telephone ?? 0, ordi = data.appareils.ordinateur ?? 0
  return (
    <div className="container page" style={{ maxWidth: 1000 }}>
      <h1><BarChart3 size={28} /> Fréquentation du site</h1>
      <p className="small muted">Mesure maison, anonyme et sans cookie : aucune adresse IP n'est conservée, les robots et les navigateurs qui demandent
        à ne pas être suivis ne sont pas comptés. Un « visiteur » est compté une fois par jour.</p>
      <div className="grid cols-4" style={{ margin: '16px 0' }}>
        <div className="card"><div className="kpi-label">Visiteurs aujourd'hui</div><div className="kpi">{nombre(auj.visiteurs, 0)}</div></div>
        <div className="card"><div className="kpi-label">Visiteurs, 7 derniers jours</div><div className="kpi">{nombre(sept.reduce((a, d) => a + d.visiteurs, 0), 0)}</div></div>
        <div className="card"><div className="kpi-label">Pages vues, 30 jours</div><div className="kpi">{nombre(data.total_vues, 0)}</div></div>
        <div className="card"><div className="kpi-label">Sur téléphone</div><div className="kpi">{tel + ordi ? nombre((tel / (tel + ordi)) * 100, 0) : 0} %</div>
          <div className="small muted"><Smartphone size={13} /> {nombre(tel, 0)} · <Monitor size={13} /> {nombre(ordi, 0)} pages vues</div></div>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>Visiteurs par jour (30 derniers jours)</h3>
        <div className="frequentation-barres" role="img" aria-label="Visiteurs par jour sur 30 jours">
          {data.jours.map((d) => (
            <div key={d.jour} className="frequentation-barre" title={`${new Date(d.jour).toLocaleDateString('fr-FR')} : ${d.visiteurs} visiteurs, ${d.vues} pages vues`}>
              <span style={{ height: `${(d.visiteurs / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="grid cols-2">
        <div className="card">
          <h3>Pages les plus vues</h3>
          <ul className="list">{data.pages.map((p) => <li key={p.page} className="list-row small"><span>{nomPage(p.page)}</span><strong>{nombre(p.vues, 0)}</strong></li>)}</ul>
        </div>
        <div className="card">
          <h3>D'où viennent les visiteurs</h3>
          {data.provenances.length ? <ul className="list">{data.provenances.map((p) => <li key={p.domaine} className="list-row small"><span>{p.domaine}</span><strong>{nombre(p.visites, 0)}</strong></li>)}</ul>
            : <p className="small muted">Pas encore de visiteur venu d'un autre site (lien direct ou favori).</p>}
        </div>
      </div>
      <div style={{ marginTop: 16 }}>{data.serveur && <SanteServeur s={data.serveur} />}</div>
    </div>
  )
}
