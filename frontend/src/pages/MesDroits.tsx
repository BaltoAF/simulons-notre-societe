import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Calculator, GitFork, Lock, Minus, Plus, RotateCcw } from 'lucide-react'
import { api, type Confiance, type Regle } from '../lib/api'
import { euros, insecable, valeur } from '../lib/format'
import { estRattache } from '../lib/aidesOubliees'
import { departsDuFoyer, estAgeLegal, type Depart } from '../lib/retraite'
import { PRESETS, resoudrePreset } from '../lib/presets'
import { resumeSituation, situationVersMenage, useApp, useFetch, type AdulteSaisie, type SituationSaisie } from '../lib/state'
import { ConfidenceBadge, ErrorBox, Loading, Notice } from '../components/ui'
import { DroitsNonMonetaires } from '../components/DroitsNonMonetaires'
import { ProchaineEtape } from '../components/Parcours'
import { OuJeMeSitue } from '../components/OuJeMeSitue'
import { AvezVousPense } from '../components/AvezVousPense'
import { ProposerSoutien } from '../components/Soutien'
import { noterActionUtile } from '../lib/soutien'
import { Terme } from '../components/Terme'
import { PROFILS } from '../lib/profils'

type Resultat = {
  revenu_disponible: number
  niveau_de_vie: number
  lignes: { id: string; libelle: string; montant: number; nature: string }[]
  confiance: Confiance
  decote_annuelle?: number
  taux_csg_pension?: number | null
}

/** Le taux de CSG vraiment appliqué à une pension, dit en clair (il dépend du revenu du foyer). */
function phraseCsgPension(t: number): ReactNode {
  if (t < 1) return <>Votre pension n'est soumise ni à la <Terme id="csg">CSG</Terme>, ni à la <Terme id="crds">CRDS</Terme>, ni à la <Terme id="casa">Casa</Terme> : les revenus de votre foyer sont sous le seuil d'exonération.</>
  const nom = t < 5 ? 'le taux réduit (3,8 %)' : t < 7.5 ? 'le taux médian (6,6 %)' : 'le taux plein (8,3 %)'
  // la Casa ne s'applique qu'aux pensions soumises à la CSG au taux médian ou plein
  return <>Votre pension est soumise à la <Terme id="csg">CSG</Terme> à {nom}, qui dépend du revenu de votre foyer, plus la <Terme id="crds">CRDS</Terme>
    {t >= 5 && <> et la <Terme id="casa">Casa</Terme></>} : c'est la différence entre votre pension brute et votre pension nette.</>
}

/** Ce qu'il faut saisir pour chaque situation, dit avec les mots du document que la personne a sous les yeux. */
const AIDE_MONTANT: Record<string, string> = {
  salarie: 'Le montant qui figure en bas de votre fiche de paie, avant prélèvement à la source.',
  independant: "Ce que vous facturez en moyenne par mois, celui que vous déclarez à l'Urssaf, avant de payer vos cotisations. Le site calcule vos cotisations, votre impôt et vos aides.",
  chomeur: 'Le montant versé chaque mois par France Travail, avant prélèvement à la source.',
  retraite: 'Le montant versé chaque mois sur votre compte, toutes vos retraites additionnées (base et complémentaire), avant prélèvement à la source.',
  etudiant: "Une personne étudiante n'a droit à la prime d'activité que si elle gagne au moins 78 % du SMIC environ. Les bourses ne sont pas calculées par le site, mais le résultat vous dira comment les demander.",
}

// âge et montant vides (un exemple grisé les illustre) : pré-remplis, on pouvait valider sans les changer, et le calcul était faux
const ADULTE: AdulteSaisie = { age: 0, activite: 'salarie', montant_net: 0, cadre: false, handicap: false }
const DEFAUT: SituationSaisie = { couple: 'seul', adultes: [ADULTE], enfants: [], logement: 'locataire_prive', loyer_mensuel: 0, zone: 2, revenus_capital_annuels: 0 }

// Règles qui « expliquent » chaque ligne du résultat.
// À qui demander chaque aide (le site calcule des droits théoriques ; la demande se fait auprès de l'organisme)
const DEMANDER: Record<string, string> = {
  rsa: 'auprès de la CAF (caf.fr), ou de la MSA si vous êtes agriculteur', prime_activite: 'auprès de la CAF (caf.fr), ou de la MSA si vous êtes agriculteur',
  aides_logement: 'auprès de la CAF (caf.fr), ou de la MSA si vous êtes agriculteur', allocations_familiales: 'auprès de la CAF : elles sont en général versées automatiquement',
  aspa: 'auprès de votre caisse de retraite', aah: 'auprès de la MDPH de votre département, puis de la CAF',
  complement_familial: 'auprès de la CAF', asf: 'auprès de la CAF', paje: 'auprès de la CAF', ars: 'auprès de la CAF : elle est en général versée automatiquement',
}

const POURQUOI: Record<string, { regles: string[]; texte: ReactNode }> = {
  aides_logement_zero: { regles: ['prestations.aides_logement.forfait_charges'], texte: 'L\'aide au logement baisse quand les ressources du foyer augmentent : pour votre loyer, votre zone et vos revenus, elle tombe à zéro.' },
  rsa: { regles: ['prestations.rsa.montant_forfaitaire'], texte: 'Le RSA complète vos ressources jusqu\'à un montant garanti qui dépend de la composition du foyer.' },
  prime_activite: { regles: ['prestations.prime_activite.montant_forfaitaire', 'prestations.prime_activite.part_revenus_activite', 'prestations.prime_activite.bonification_max'], 
    texte: "Elle complète les revenus des personnes qui travaillent et gagnent peu. Son calcul : une somme de base, plus une part de ce que vous gagnez en travaillant, plus un bonus quand vous gagnez au moins la moitié du SMIC environ, moins vos autres ressources (dont une partie de l'aide au logement). Plus vous gagnez, plus elle baisse, jusqu'à s'arrêter. Elle se redemande tous les trois mois." },
  aides_logement: { regles: ['prestations.aides_logement.forfait_charges'], texte: 'L\'aide au logement dépend du loyer, de la zone, de la composition du foyer et des ressources.' },
  allocations_familiales: { regles: ['prestations.famille.bmaf', 'prestations.famille.af_taux_deux_enfants', 'prestations.famille.af_nombre_enfants_minimum'], texte: 'Versées à partir de 2 enfants, modulées selon les revenus.' },
  impot_revenu: { regles: ['fiscalite.impot_revenu.bareme', 'fiscalite.impot_revenu.decote.taux', 'fiscalite.impot_revenu.quotient_familial.plafond_demi_part'], texte: 'Impôt progressif calculé sur le revenu du foyer, divisé par le nombre de parts.' },
  aspa: { regles: ['prestations.aspa.montant_personne_seule'], texte: 'Le minimum vieillesse garantit un revenu minimal aux personnes âgées.' },
  aah: { regles: ['prestations.aah.montant'], texte: 'Allocation pour les personnes en situation de handicap aux ressources modestes.' },
  salaire_net: { regles: ['fiscalite.csg.salaires_taux'], texte: 'Salaire brut moins les cotisations sociales, la CSG et la CRDS.' },
  revenu_micro: { regles: ['travail.micro_entreprise.cotisations_services', 'travail.micro_entreprise.cotisations_vente', 'travail.micro_entreprise.cotisations_liberal'],
    texte: "Votre chiffre d'affaires moins vos cotisations sociales, qui sont un pourcentage fixe de ce que vous facturez, selon votre activité (voir les règles). Vos frais (vélo, téléphone, carburant…) ne sont pas déduits : à vous de les retirer. Pour l'impôt et les aides, l'administration retire elle-même une part forfaitaire de votre chiffre d'affaires pour tenir compte de vos frais." },
  retraite_nette: { regles: ['fiscalite.csg.retraites_taux_plein'], texte: 'Pension brute moins la CSG, la CRDS et la Casa.' },
  pfu: { regles: ['fiscalite.capital.pfu_taux_ir'], texte: 'Impôt forfaitaire de 12,8 % sur les intérêts et dividendes.' },
  epargne: { regles: ['fiscalite.capital.pfu_taux_ir'], texte: 'Sur les intérêts et dividendes de votre épargne (hors livret A et autres livrets réglementés) : un impôt de 12,8 % et des prélèvements sociaux de 17,2 %.' },
  impot_revenu_zero: { regles: ['fiscalite.impot_revenu.bareme', 'fiscalite.impot_revenu.decote.taux'], texte: <>Le revenu du foyer est divisé en <Terme id="part_fiscale">parts</Terme> (une part par adulte, une demi-part par enfant). Par part, il reste sous le seuil où l'impôt commence, ou bien l'impôt calculé est si faible qu'une réduction automatique, la <Terme id="decote">décote</Terme>, l'annule. C'est le cas d'environ la moitié des foyers.</> },
}

function Stepper({ step }: { step: number }) {
  const etapes = ['Votre foyer', 'Vos revenus', 'Votre logement']
  return (
    <>
    <div className="etape-mobile" aria-hidden="true">Étape {Math.min(step + 1, 3)} sur 3 : <strong>{etapes[Math.min(step, 2)]}</strong></div>
    <ol className="etapes" aria-label="Les étapes">
      {etapes.map((e, i) => (
        <li key={e} className={i < step ? 'fait' : i === step ? 'actif' : ''} aria-current={i === step ? 'step' : undefined}>
          <span className="n">{i < step ? '✓' : i + 1}</span><span className="lib">{e}</span>
        </li>
      ))}
    </ol>
    </>
  )
}

/** Aucune aide calculée : dire pourquoi, plutôt que laisser croire à un oubli (test débutants : « rien, et aucune explication »). */
function AucuneAide({ s, totalRevenus, plafondAspa }: { s: SituationSaisie; totalRevenus: number; plafondAspa: number | null }) {
  const retraite = s.adultes.every((a) => a.activite === 'retraite')
  return (
    <div className="card">
      <h3 style={{ marginBottom: 6 }}>Pourquoi aucune aide ?</h3>
      {retraite && s.adultes.length === 1 && plafondAspa != null && totalRevenus > plafondAspa ? (
        <p className="small ink2" style={{ margin: 0 }}>Votre pension ({euros(totalRevenus)} par mois) dépasse le plafond du minimum vieillesse
          ({euros(plafondAspa, 2)} pour une personne seule) : il ne s'ajoute donc pas.{s.logement === 'proprietaire'
            ? " Les aides au logement aident à payer un loyer (ou, dans certains cas, un prêt immobilier) : un propriétaire qui ne rembourse plus de prêt n'y a pas droit."
            : ' Pour les aides au logement, vos ressources dépassent le plafond qui correspond à votre loyer.'}</p>
      ) : (
        <p className="small ink2" style={{ margin: 0 }}>Les aides calculées par le site (RSA, prime d'activité, aides au logement, allocations familiales,
          minimum vieillesse…) dépendent des revenus, du loyer et de la composition du foyer : pour votre situation, vous dépassez leurs plafonds.</p>
      )}
      <p className="small muted" style={{ margin: '6px 0 0' }}>D'autres aides, que le site ne calcule pas, peuvent vous concerner : voyez « Avez-vous pensé à… ? » ci-dessous.</p>
    </div>
  )
}

export default function MesDroits() {
  const { situation, setSituation, setDraft, marquer } = useApp()
  const [s, setS] = useState<SituationSaisie>(situation ?? DEFAUT)
  const [step, setStep] = useState(situation ? 3 : 0)
  const [res, setRes] = useState<Resultat | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [etSi, setEtSi] = useState<Record<string, { delta: number; loading?: boolean; departs?: Depart[] }>>({})
  const [exemple, setExemple] = useState<string | null>(null) // résultat d'un foyer exemple, pas encore ajusté par la personne
  // toutes les règles (et pas seulement celles que le moteur sait faire varier) : « Pourquoi ce montant ? » cite par leur titre
  // des règles du site comme les cotisations des auto-entrepreneurs, au lieu de leur identifiant technique
  const { data: regles } = useFetch<{ regles: Regle[] }>('/api/regles?limit=5000')
  const nav = useNavigate()
  const [params] = useSearchParams()
  // venu de l'atelier pour décrire son foyer : un bouton y ramène, la réforme est gardée
  const retourAtelier = params.get('retour') === 'atelier' && (
    <div style={{ marginBottom: 10 }}><Link className="btn small" to="/atelier"><ArrowLeft size={15} /> Revenir à ma réforme</Link></div>
  )

  const up = (patch: Partial<SituationSaisie>) => setS((x) => ({ ...x, ...patch }))
  const upA = (i: number, patch: Partial<AdulteSaisie>) => setS((x) => ({ ...x, adultes: x.adultes.map((a, j) => (j === i ? { ...a, ...patch } : a)) }))

  const calculer = async (sit = s) => {
    setLoading(true); setErr(null); setEtSi({}); setStep(3); window.scrollTo(0, 0)
    try {
      setSituation(sit)
      const r = await api<Resultat>('/api/simulation/menage', { body: { menage: situationVersMenage(sit), montants: 'net' } })
      setRes(r); setStep(3); marquer('droits'); noterActionUtile('droits')
    } catch (e: any) { setErr(e.message) } finally { setLoading(false) }
  }

  // De retour sur la page avec une situation déjà saisie : on affiche directement le résultat
  useEffect(() => {
    if (params.get('modifier')) { setStep(0); return }   // venu pour changer sa situation : le questionnaire, pas le résultat
    if (situation && !res && !loading) calculer(situation)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tester = async (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!
    const actuelles = Object.fromEntries((regles?.regles ?? []).map((r) => [r.id, r.valeur]))
    // l'âge de départ ne change pas le budget du mois : on montre ce qui compte, la date de départ
    if (Object.keys(p.overrides).some(estAgeLegal)) {
      const departs = departsDuFoyer(s.adultes, s.mois_naissance ?? 1, actuelles, { ...actuelles, ...resoudrePreset(p, actuelles) })
      setEtSi((x) => ({ ...x, [pid]: { delta: 0, departs } }))
      return
    }
    setEtSi((x) => ({ ...x, [pid]: { delta: 0, loading: true } }))
    try {
      const rap = await api<any>('/api/simulation/reforme', { body: { overrides: resoudrePreset(p, actuelles), menage: situationVersMenage(s), montants: 'net', modules: ['menage'] } })
      const m = rap.sections.find((x: any) => x.id === 'menage')
      setEtSi((x) => ({ ...x, [pid]: { delta: m?.indicateurs?.[0]?.valeur ?? 0 } }))
    } catch {
      setEtSi((x) => ({ ...x, [pid]: { delta: NaN } }))
    }
  }

  const ouvrirAtelier = (pid: string) => {
    const p = PRESETS.find((x) => x.id === pid)!
    const actuelles = Object.fromEntries((regles?.regles ?? []).map((r) => [r.id, r.valeur]))
    setDraft({ overrides: resoudrePreset(p, actuelles), justifications: {}, societe: null, branche: 'principale', nomSociete: p.titre })
    nav('/atelier?lancer=1')
  }

  if (step === 3 && (res || loading || err)) {
    const revenus = res?.lignes.filter((l) => l.nature === 'revenu') ?? []
    const prestBrut = res?.lignes.filter((l) => l.nature === 'prestation') ?? []
    const prest: Resultat['lignes'] = s.logement.startsWith('locataire') && !prestBrut.some((l) => l.id === 'aides_logement')
      ? [...prestBrut, { id: 'aides_logement_zero', libelle: 'Aides au logement', montant: 0, nature: 'prestation' }] : prestBrut
    // Impôts : toujours une ligne « Impôt sur le revenu » (même à 0 €), et les petits impôts sur l'épargne regroupés
    const brut = res?.lignes.filter((l) => l.nature === 'prelevement') ?? []
    const ir = brut.find((l) => l.id === 'impot_revenu')
    const epargne = brut.filter((l) => l.id === 'pfu' || l.id === 'prelevements_sociaux_capital')
    const prel: Resultat['lignes'] = res ? [
      ir ?? { id: 'impot_revenu_zero', libelle: 'Impôt sur le revenu', montant: 0, nature: 'prelevement' },
      ...(epargne.length ? [{ id: 'epargne', libelle: 'Impôts sur votre épargne', montant: epargne.reduce((a, l) => a + l.montant, 0), nature: 'prelevement' }] : []),
      ...brut.filter((l) => l.id !== 'impot_revenu' && !epargne.includes(l)),
    ] : []
    // ce que le chiffre principal contient : des aides peut-être pas encore demandées, et le loyer pas encore payé
    const totalAides = prestBrut.reduce((a, l) => a + l.montant, 0)
    const loyer = s.logement.startsWith('locataire') ? s.loyer_mensuel : 0
    const apresLoyer = (res?.revenu_disponible ?? 0) - loyer
    const totalRevenus = revenus.reduce((a, l) => a + l.montant, 0)
    const etudiantRattache = s.adultes.length === 1 && estRattache(s.adultes[0])
    // la règle donne le plafond annuel : ramené au mois, tronqué au centime comme dans les barèmes (1 043,59 €)
    const aspaAn = regles?.regles.find((r) => r.id === 'prestations.aspa.montant_personne_seule')?.valeur
    const plafondAspa = typeof aspaAn === 'number' ? Math.floor((aspaAn / 12) * 100) / 100 : null
    /** « Pourquoi ce montant ? » avec le calcul de la personne quand on sait le faire en une ligne. */
    const pourquoi = (l: Resultat['lignes'][number]): ReactNode => {
      if (l.id === 'impot_revenu_zero') {
        if (totalRevenus < 1) return "Vous n'avez pas de revenus imposables : il n'y a pas d'impôt à payer."
        return (res?.decote_annuelle ?? 0) > 0
          ? <>Votre impôt aurait été d'environ {euros(res!.decote_annuelle!, 0)} par an, mais la <Terme id="decote">décote</Terme>, une réduction automatique pour les petits impôts, l'annule entièrement.</>
          : <>Le revenu du foyer est divisé en <Terme id="part_fiscale">parts</Terme> (une part par adulte, une demi-part par enfant) : par part, il reste sous le seuil où l'impôt commence.</>
      }
      if (l.id === 'revenu_micro') {
        const ca = s.adultes.filter((a) => a.activite === 'independant').reduce((t, a) => t + a.montant_net, 0)
        if (ca > 0) return <>Votre chiffre d'affaires ({euros(ca, 0)}) moins vos cotisations sociales : {euros(ca - l.montant, 0)} par mois,
          soit {(Math.round(((ca - l.montant) / ca) * 1000) / 10).toLocaleString('fr-FR')} % de ce que vous facturez (retraite, maladie, CSG et CRDS comprises).
          Vos frais (vélo, téléphone, carburant…) ne sont pas déduits : à vous de les retirer. Pour l'impôt et les aides, l'administration
          retire elle-même une part forfaitaire de votre chiffre d'affaires pour tenir compte de ces frais.</>
      }
      if (l.id === 'impot_revenu' && (res?.decote_annuelle ?? 0) > 0) {
        const paye = Math.round(l.montant * 12)
        return <>Le revenu du foyer est divisé en <Terme id="part_fiscale">parts</Terme> (une part par adulte, une demi-part par enfant),
          ce qui donne un impôt d'environ {euros(paye + res!.decote_annuelle!, 0)} par an. La <Terme id="decote">décote</Terme>, une réduction
          automatique pour les petits impôts, le ramène à environ <strong>{euros(paye, 0)} par an</strong>, soit {euros(l.montant)} par mois.</>
      }
      if (l.id === 'retraite_nette' && res?.taux_csg_pension != null) return phraseCsgPension(res.taux_csg_pension)
      if (l.id === 'aspa' && s.adultes.length === 1 && typeof plafondAspa === 'number') {
        return <>Le minimum vieillesse complète vos ressources jusqu'à {euros(plafondAspa, 2)} par mois pour une personne seule.
          Pour vous : {euros(plafondAspa, 2)} − {euros(totalRevenus)} de revenus ≈ <strong>{euros(l.montant)}</strong>.</>
      }
      if (l.id === 'aides_logement' && loyer > 0) {
        return <>Pour un loyer de {euros(loyer)}, l'aide est de {euros(l.montant)} : il vous reste <strong>{euros(Math.max(0, loyer - l.montant))}</strong> de loyer à payer chaque mois.
          Elle dépend du loyer (retenu jusqu'à un plafond selon la zone), de la taille du foyer et de ses ressources.</>
      }
      return POURQUOI[l.id].texte
    }
    return (
      <div className="container page">
        {retourAtelier}
        <div className="row between" style={{ marginBottom: 10 }}>
          <h1 style={{ margin: 0 }}>Vos droits aujourd'hui</h1>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn" onClick={() => { setStep(0); setRes(null) }}><RotateCcw size={16} /> Modifier ma situation</button>
            <button className="btn ghost small" title="Sur un ordinateur partagé : rien de votre situation ne reste dans ce navigateur"
              onClick={() => { setSituation(null); setS(DEFAUT); setRes(null); setExemple(null); setStep(0); window.scrollTo(0, 0) }}>Effacer mes réponses</button>
          </div>
        </div>
        {exemple && res && (
          <Notice>C'est le résultat de l'exemple « {exemple} » ({resumeSituation(s)}). Pour votre propre situation :{' '}
            <button className="lien" onClick={() => { setStep(1); setRes(null) }}>mettre vos vrais montants</button>.</Notice>
        )}
        {loading && <Loading label="Calcul de vos droits en cours…" />}
        {err && <ErrorBox message={err} />}
        {res && (
          <div className="split aside-380">
            <div className="stack">
              <div className="card">
                {/* la réponse à la question qu'on se pose en venant (« ai-je droit à des aides ? ») passe avant le total */}
                {prestBrut.some((l) => l.montant > 0.5) && (
                  <div className="notice ok" style={{ marginBottom: 14 }}><div>
                    <strong>Vous avez sans doute droit à :</strong>{' '}
                    {prestBrut.filter((l) => l.montant > 0.5).map((l) => `${l.libelle} ${euros(l.montant, 0)} par mois`).join(' · ')}.
                    {' '}<a href="#vos-aides">Comment les demander ↓</a>
                  </div></div>
                )}
                <div className="card-head">
                  <div>
                    <div className="kpi-label">Ce que le foyer touche chaque mois</div>
                    <div className="kpi big">{euros(res.revenu_disponible)} <span className="muted" style={{ fontSize: '1rem', fontWeight: 600 }}>/ mois</span></div>
                    <div className="small muted">Revenus nets (cotisations et CSG déjà retirées) + aides − impôt sur le revenu. C'est avant les dépenses :
                      loyer ou crédit, taxe foncière, courses (dont la TVA)…{s.adultes.length + s.enfants.length > 1 && <> Votre foyer vit aussi bien qu'une personne seule qui aurait {euros(res.niveau_de_vie)} par mois (c'est votre <Terme id="niveau_vie">niveau de vie</Terme> : à plusieurs, on partage le logement et les dépenses).</>}</div>
                    {totalAides > 0.5 && (
                      <div className="small" style={{ marginTop: 6 }}>Dont <strong>{euros(totalAides)}</strong> d'aides. La plupart ne sont versées que si on les demande :
                        si vous ne les touchez pas encore, il vous reste aujourd'hui {euros(res.revenu_disponible - totalAides)}. Comment les obtenir est indiqué sous chaque aide.</div>
                    )}
                    {loyer > 0 && (
                      <div className="small" style={{ marginTop: 4 }}>Après avoir payé le loyer ({euros(loyer)}) : {apresLoyer >= 0
                        ? <>il reste <strong>{euros(apresLoyer)}</strong> par mois pour tout le reste.</>
                        : <><strong className="delta neg">il manque {euros(-apresLoyer)}</strong> chaque mois.</>}</div>
                    )}
                    <div className="small" style={{ marginTop: 6 }}>Calcul pour : {resumeSituation(s)} · <button className="lien" onClick={() => setStep(0)}>modifier</button></div>
                  </div>
                  <ConfidenceBadge c={res.confiance} align="right" />
                </div>
                <OuJeMeSitue niveauVieMensuel={res.niveau_de_vie}
                  note={etudiantRattache ? "Vous êtes rattaché(e) à la déclaration d'impôt de vos parents : ce classement ne compte que vos propres revenus, pas l'aide de votre famille." : undefined} />
                <hr className="divider" />
                {[['Vos revenus nets', revenus, 1], ['Aides et prestations', prest, 1], ['Impôts payés', prel, -1]].map(([titre, lignes, sg]) => (
                  (lignes as any[]).length > 0 && (
                    <div key={titre as string} id={titre === 'Aides et prestations' ? 'vos-aides' : undefined} style={{ marginBottom: 14, scrollMarginTop: 80 }}>
                      <div className="kpi-label" style={{ marginBottom: 6 }}>{titre as string}</div>
                      <ul className="list">
                        {(lignes as Resultat['lignes']).map((l) => (
                          <li key={l.id}>
                            <div className="list-row">
                              <span>{l.libelle}</span>
                              <strong className={`delta ${(sg as number) > 0 ? (l.nature === 'prestation' ? 'pos' : '') : l.montant > 0 ? 'neg' : ''}`}>{(sg as number) > 0 || l.montant === 0 ? '' : '−'}{euros(l.montant)}</strong>
                            </div>
                            {/* où la demander, et pourquoi pas d'aide au logement : visible tout de suite, sans ouvrir le détail */}
                            {DEMANDER[l.id] && l.montant > 0 && <div className="small muted" style={{ marginTop: 2 }}>À demander {DEMANDER[l.id]}.</div>}
                            {l.id === 'aides_logement_zero' && <div className="small muted" style={{ marginTop: 2 }}>Vos revenus dépassent le plafond pour votre loyer et votre zone.</div>}
                            {/* versée une fois par an : le montant mensuel est une moyenne, à ne pas attendre chaque mois */}
                            {l.id === 'ars' && l.montant > 0 && <div className="small muted" style={{ marginTop: 2 }}>Moyenne par mois : elle est versée en une fois, fin août, soit environ {euros(l.montant * 12)} par an.</div>}
                            {POURQUOI[l.id] && (
                              <details className="explain" style={{ marginTop: 6, paddingTop: 6 }}>
                                <summary>{l.montant === 0 ? 'Pourquoi 0 € ?' : 'Pourquoi ce montant ?'}</summary>
                                <p className="small ink2" style={{ marginBottom: 6 }}>{pourquoi(l)}</p>
                                <div className="small">Les règles qui fixent ce montant : {POURQUOI[l.id].regles.map((r, i) => <span key={r}>{i ? ' · ' : ''}<Link to={`/regles/r/${r}`}>{regles?.regles.find((x) => x.id === r)?.titre ?? r}</Link></span>)}</div>
                              </details>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                ))}
                <Notice>Ce sont vos <strong>droits théoriques</strong> selon la législation en vigueur, calculés par le moteur public OpenFisca-France. Pour une démarche officielle, utilisez les simulateurs de l'administration (mesdroitssociaux.gouv.fr, impots.gouv.fr).</Notice>
              </div>
              {prestBrut.length === 0 && <AucuneAide s={s} totalRevenus={totalRevenus} plafondAspa={plafondAspa} />}
              <AvezVousPense s={s} lignes={res.lignes} />
              {/* pas de demande d'argent à un foyer qui vient d'apprendre ses droits aux minima ou aux aides */}
              <ProposerSoutien masquer={prestBrut.length > 0} />
              <ProchaineEtape apres="droits" />
              <DroitsNonMonetaires age={s.adultes[0]?.age ?? 35} mois={s.mois_naissance ?? 1}
                onMois={(m) => { const sit = { ...s, mois_naissance: m }; setS(sit); setSituation(sit) }} />
            </div>
            <div className="stack sticky">
              <div className="card">
                <h3>Et si les règles changeaient ?</h3>
                <p className="small muted">Testez des propositions du débat public sur <strong>votre</strong> foyer.</p>
                <ul className="list">
                  {PRESETS.map((p) => {
                    const r = etSi[p.id]
                    return (
                      <li key={p.id}>
                        <div className="small" style={{ fontWeight: 650 }}>{insecable(p.titre)}</div>
                        {r?.departs && (
                          <div className="small" style={{ marginTop: 4 }}>
                            {r.departs.length === 0 ? <span className="muted">Ne change rien pour vous : personne dans votre foyer n'est concerné (déjà à la retraite).</span>
                              : r.departs.map((d) => <div key={d.qui}>{d.apres === d.avant
                                ? <>{d.qui} : rien ne change, départ à {valeur(d.avant, 'ans')} ({d.dateAvant}).</>
                                : <><strong>{d.qui} : départ possible à {valeur(d.apres, 'ans')}, en {d.dateApres}</strong> <span className="muted">(au lieu de {valeur(d.avant, 'ans')}, en {d.dateAvant})</span>.</>}</div>)}
                            {r.departs.length > 0 && !s.mois_naissance && <div className="muted">Pour une date exacte, indiquez votre mois de naissance plus bas (« Vos droits au-delà de l'argent »).</div>}
                          </div>
                        )}
                        <div className="row between" style={{ marginTop: 4 }}>
                          {r?.departs ? <span /> : r ? (r.loading ? <span className="small muted"><span className="spinner" style={{ width: 14, height: 14, verticalAlign: -2 }} /> calcul…</span>
                            : Number.isNaN(r.delta) ? <span className="small muted">indisponible</span>
                              : <span className={`delta ${r.delta > 0.5 ? 'pos' : r.delta < -0.5 ? 'neg' : 'zero'}`}>{r.delta > 0.5 ? '+' : r.delta < -0.5 ? '−' : '±'}{euros(Math.abs(r.delta))} / mois</span>)
                            : <button className="btn small" onClick={() => tester(p.id)}>Tester sur mon foyer</button>}
                          {r && !r.loading && <button className="btn small ghost" onClick={() => ouvrirAtelier(p.id)}>Effets sur le pays <ArrowRight size={13} /></button>}
                        </div>
                        {/* +100 € sur le montant de base, mais davantage pour un foyer : le dire, sinon l'écart semble une erreur */}
                        {p.id === 'prime-activite-plus' && r && !r.loading && r.delta > 110 && (
                          <div className="small muted" style={{ marginTop: 4 }}>Plus que 100 € pour votre foyer : le montant de base est majoré pour chaque personne du foyer (conjoint, enfants),
                            et le bonus de chaque personne qui travaille, calculé sur ce montant, augmente aussi.</div>
                        )}
                      </li>
                    )
                  })}
                </ul>
                <Link to="/atelier" className="btn primary" style={{ width: '100%', marginTop: 8 }}><GitFork size={16} /> Imaginer ma propre réforme</Link>
              </div>
              <div className="small muted"><Lock size={13} /> Votre situation reste dans votre navigateur. Elle sert uniquement au calcul et n'est jamais enregistrée par le site.</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  const enCouple = s.adultes.length > 1
  // un salaire, une allocation chômage ou une pension à 0 € : presque toujours un oubli
  const montantManquant = s.adultes.some((a) => ['salarie', 'independant', 'chomeur', 'retraite'].includes(a.activite) && !(a.montant_net > 0))
  const ageManquant = s.adultes.some((a) => !(a.age >= 16 && a.age <= 110))
  return (
    <div className="container page" style={{ maxWidth: 760 }}>
      {retourAtelier}
      <h1>Calculer mes droits</h1>
      <p className="lead ink2">En trois étapes, vos aides, votre impôt et ce qui vous reste chaque mois selon les règles actuelles. Sans compte, sans enregistrement.</p>
      <Stepper step={step} />
      {step === 0 && (
        <div className="card soft" style={{ marginBottom: 14, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Le plus rapide : choisissez un foyer qui vous ressemble</div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
            {PROFILS.map((p) => (
              <button key={p.titre} className="preset" onClick={() => { setS(p.s); setExemple(p.titre); calculer(p.s) }}>
                <strong>{p.titre}</strong><span className="small muted">{resumeSituation(p.s)}</span>
              </button>
            ))}
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>… ou répondez aux 3 questions ci-dessous pour un calcul à votre mesure.</div>
        </div>
      )}
      <div className="card">
        {step === 0 && (
          <div>
            <label className="field"><span>Vous vivez…</span></label>
            <div className="choices" style={{ marginBottom: 16 }}>
              <button className={`choice ${!enCouple ? 'on' : ''}`} aria-pressed={!enCouple} onClick={() => up({ couple: 'seul', adultes: [s.adultes[0]] })}>Seul(e)</button>
              <button className={`choice ${enCouple ? 'on' : ''}`} aria-pressed={enCouple} onClick={() => up({ couple: s.couple === 'seul' ? 'marie' : s.couple, adultes: [s.adultes[0], s.adultes[1] ?? ADULTE] })}>En couple</button>
            </div>
            {enCouple && (
              <>
                <label className="field"><span>Votre union</span></label>
                <div className="choices" style={{ marginBottom: 16 }}>
                  {([['marie', 'Mariés'], ['pacse', 'Pacsés'], ['concubin', 'Union libre']] as const).map(([v, l]) => (
                    <button key={v} className={`choice ${s.couple === v ? 'on' : ''}`} aria-pressed={s.couple === v} onClick={() => up({ couple: v })}>{l}</button>
                  ))}
                </div>
              </>
            )}
            <label className="field"><span>Enfants à charge</span></label>
            <div className="row" style={{ marginBottom: 10 }}>
              <button className="btn small" disabled={!s.enfants.length} onClick={() => up({ enfants: s.enfants.slice(0, -1) })} aria-label="Retirer un enfant"><Minus size={15} /></button>
              <strong style={{ minWidth: 30, textAlign: 'center' }}>{s.enfants.length}</strong>
              <button className="btn small" disabled={s.enfants.length >= 8} onClick={() => up({ enfants: [...s.enfants, 5] })} aria-label="Ajouter un enfant"><Plus size={15} /></button>
            </div>
            {s.enfants.length > 0 && (
              <div className="grid cols-4">
                {s.enfants.map((a, i) => (
                  <label key={i} className="field"><span>Âge enfant {i + 1}</span>
                    <input type="number" min={0} max={25} value={a} onChange={(e) => up({ enfants: s.enfants.map((x, j) => (j === i ? Number(e.target.value) : x)) })} /></label>
                ))}
              </div>
            )}
          </div>
        )}
        {step === 1 && (
          <div className="stack">
            {s.adultes.map((a, i) => (
              <div key={i}>
                {enCouple && <h3>{i === 0 ? 'Vous' : 'Votre conjoint(e)'}</h3>}
                <div className="grid cols-2">
                  <label className="field"><span>Âge</span><input type="number" min={16} max={110} value={a.age || ''} placeholder="ex. 35" onChange={(e) => upA(i, { age: Number(e.target.value) })} /></label>
                  <label className="field"><span>Situation</span>
                    {/* changer de situation vide le montant : une pension de 850 € ne doit pas devenir un salaire d'étudiant */}
                    <select value={a.activite} onChange={(e) => {
                      const activite = e.target.value as AdulteSaisie['activite']
                      upA(i, { activite, montant_net: 0, rattache: activite === 'etudiant' ? a.age < 25 : undefined })
                    }}>
                      <option value="salarie">Salarié(e)</option>
                      <option value="independant">Auto-entrepreneur (micro-entreprise)</option>
                      <option value="chomeur">Au chômage, indemnisé(e)</option>
                      <option value="retraite">Retraité(e)</option>
                      <option value="etudiant">Étudiant(e)</option>
                      <option value="inactif">Sans activité</option>
                    </select></label>
                </div>
                {a.activite === 'independant' && (
                  <label className="field"><span>Votre activité</span>
                    <select value={a.activite_micro ?? 'services'} onChange={(e) => upA(i, { activite_micro: e.target.value as AdulteSaisie['activite_micro'] })}>
                      <option value="services">Services : livraison, VTC, ménage, artisanat…</option>
                      <option value="vente">Vente de marchandises</option>
                      <option value="liberal">Profession libérale : conseil, formation, graphisme, informatique…</option>
                    </select></label>
                )}
                {['salarie', 'independant', 'chomeur', 'retraite', 'etudiant'].includes(a.activite) && (
                  <label className="field">
                    <span>{a.activite === 'salarie' ? 'Salaire net mensuel (avant impôt)' : a.activite === 'independant' ? "Chiffre d'affaires moyen par mois"
                      : a.activite === 'chomeur' ? 'Allocation chômage nette mensuelle'
                      : a.activite === 'etudiant' ? "Salaire d'un petit boulot, net par mois (0 si vous n'en avez pas)" : 'Pension de retraite nette mensuelle'}</span>
                    <div className="input-suffix"><input type="number" min={0} step={50} value={a.montant_net || ''} placeholder={a.activite === 'etudiant' ? '0' : 'ex. 1 200'}
                      onChange={(e) => upA(i, { montant_net: Number(e.target.value) })} /><span className="suffix">€ / mois</span></div>
                    <span className="hint">{AIDE_MONTANT[a.activite]}</span>
                  </label>
                )}
                <div className="row" style={{ gap: 18 }}>
                  {a.activite === 'salarie' && <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={a.cadre} onChange={(e) => upA(i, { cadre: e.target.checked })} /> Cadre</label>}
                  {a.activite === 'etudiant' && !enCouple && <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={estRattache(a)} onChange={(e) => upA(i, { rattache: e.target.checked })} /> Mes parents me comptent encore dans leur déclaration d'impôt</label>}
                  <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" checked={a.handicap} onChange={(e) => upA(i, { handicap: e.target.checked })} /> Handicap reconnu (taux ≥ 80 %)</label>
                </div>
              </div>
            ))}
            {!enCouple && s.enfants.length > 0 && (
              <label className="field"><span>Pension alimentaire versée par l'autre parent, par mois</span>
                <div className="input-suffix"><input type="number" min={0} step={10} value={s.pension_alimentaire || ''} placeholder="0"
                  onChange={(e) => up({ pension_alimentaire: Number(e.target.value) })} /><span className="suffix">€ / mois</span></div>
                <span className="hint">0 si l'autre parent ne verse rien ou pas régulièrement : la CAF peut alors verser l'allocation de soutien familial.</span></label>
            )}
            <label className="field"><span>Revenus de l'épargne (intérêts, dividendes) par an</span>
              <div className="input-suffix"><input type="number" min={0} step={100} value={s.revenus_capital_annuels} onChange={(e) => up({ revenus_capital_annuels: Number(e.target.value) })} /><span className="suffix">€ / an</span></div>
              <span className="hint">Hors livrets réglementés (livret A…), qui ne sont pas imposés.</span></label>
          </div>
        )}
        {step === 2 && (
          <div>
            <label className="field"><span>Votre logement</span></label>
            <div className="choices" style={{ marginBottom: 16 }}>
              {([['locataire_prive', 'Locataire (parc privé)'], ['locataire_social', 'Locataire HLM'], ['proprietaire', 'Propriétaire'], ['heberge', 'Hébergé(e) gratuitement']] as const).map(([v, l]) => (
                <button key={v} className={`choice ${s.logement === v ? 'on' : ''}`} aria-pressed={s.logement === v} onClick={() => up({ logement: v })}>{l}</button>
              ))}
            </div>
            {s.logement.startsWith('locataire') && (
              <label className="field"><span>Loyer mensuel (hors charges)</span>
                <div className="input-suffix"><input type="number" min={0} step={10} placeholder="ex. 600" value={s.loyer_mensuel || ''} onChange={(e) => up({ loyer_mensuel: Number(e.target.value) })} /><span className="suffix">€ / mois</span></div></label>
            )}
            <label className="field"><span>Vous habitez…</span></label>
            <div className="choices">
              {([[1, 'Paris et sa proche banlieue'], [2, 'Une grande ville'], [3, 'Une ville moyenne ou la campagne']] as const).map(([v, l]) => (
                <button key={v} className={`choice ${s.zone === v ? 'on' : ''}`} aria-pressed={s.zone === v} onClick={() => up({ zone: v })}>{l}</button>
              ))}
            </div>
          </div>
        )}
        <div className="row between" style={{ marginTop: 22 }}>
          {step > 0 ? <button className="btn" onClick={() => { setStep(step - 1); window.scrollTo(0, 0) }}><ArrowLeft size={16} /> Précédent</button> : <span />}
          {step < 2 ? <span className="row" style={{ gap: 10 }}>
              {step === 1 && (ageManquant || montantManquant) && <span className="small muted">Indiquez {ageManquant ? "l'âge" : 'le montant'} pour continuer.</span>}
              <button className="btn primary" disabled={step === 1 && (ageManquant || montantManquant)} onClick={() => { setStep(step + 1); window.scrollTo(0, 0) }}>Suivant <ArrowRight size={16} /></button>
            </span>
            : <span className="row" style={{ gap: 10 }}>
                {s.logement.startsWith('locataire') && !s.loyer_mensuel && <span className="small muted">Indiquez votre loyer pour continuer.</span>}
                <button className="btn primary" onClick={() => { setExemple(null); calculer() }} disabled={loading || (s.logement.startsWith('locataire') && !s.loyer_mensuel)}>
                  <Calculator size={16} /> {loading ? 'Calcul…' : 'Calculer mes droits'}</button>
              </span>}
        </div>
      </div>
      <p className="small muted" style={{ marginTop: 14 }}><Lock size={13} /> Vos réponses restent dans votre navigateur. Le calcul applique la législation du mois en cours.</p>
    </div>
  )
}
