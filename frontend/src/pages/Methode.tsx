import { Link } from 'react-router-dom'
import { Bot, Calculator, GitFork, Scale, ShieldCheck } from 'lucide-react'

const NIVEAUX = [
  ['tres_eleve', 'Très élevé', '75 à 100', 'Sources officielles, calcul mécanique de la loi, ou études nombreuses, solides et concordantes.'],
  ['eleve', 'Élevé', '65 à 74', 'Fiable dans ses grandes lignes ; une marge d\'incertitude existe.'],
  ['faible', 'Faible', '25 à 64', 'Ordre de grandeur indicatif : peu d\'études, ou des études qui divergent.'],
  ['tres_faible', 'Très faible', '0 à 24', 'Hypothèse fragile, à prendre comme une piste et non comme une prévision.'],
]

export default function Methode() {
  return (
    <div className="container page" style={{ maxWidth: 900 }}>
      <h1>Méthode</h1>
      <p className="lead ink2">Comment Simulons notre société reproduit la loi actuelle, calcule les impacts et décide de l'indice de confiance. Tout est public et contestable : le code et les données sont ouverts.</p>

      <div className="card soft" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: '1.2rem', marginTop: 0 }}>En bref</h2>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>Les règles</strong> viennent des textes officiels (Légifrance, Journal officiel, impôts) : chaque valeur affiche sa source.</li>
          <li><strong>Votre foyer</strong> est calculé avec le même moteur que celui utilisé par l'Assemblée nationale : c'est le chiffre le plus sûr.</li>
          <li><strong>Les effets sur le pays</strong> (emploi, croissance…) s'appuient sur les études disponibles ; quand elles divergent, le site retient une valeur et le dit.</li>
          <li><strong>Chaque chiffre a une fiabilité</strong>, de « très faible » à « très élevée » : cliquez sur le badge pour savoir pourquoi.</li>
          <li><strong>Le site est vérifié</strong> : il chiffre des réformes déjà chiffrées par des institutions publiques, et les écarts sont publiés (<Link to="/fiabilite">nos chiffres face aux chiffrages officiels</Link>).</li>
        </ul>
        <p className="small muted" style={{ marginBottom: 0 }}>Le détail, pour les curieux, ci-dessous.</p>
      </div>

      <div className="card stack" id="societe">
        <h2><ShieldCheck size={22} /> 1. La loi actuelle : un miroir prouvé des textes</h2>
        <p>Chaque règle (un taux, un montant, une durée, un âge, un seuil…) est un paramètre avec sa valeur en vigueur, son historique et ses <strong>sources</strong>. Une valeur sans source n'est pas acceptée. Les règles fiscales et sociales sont adossées à <strong>OpenFisca-France</strong>, le modèle public de la législation socio-fiscale (utilisé par l'Assemblée nationale via LexImpact), dont le Système extrait automatiquement les valeurs et les références légales. Les autres domaines (justice, institutions, travail, retraites…) sont collectés par les agents du Système, qui lisent les textes officiels et marquent « à vérifier » ce qu'ils n'ont pas pu confirmer.</p>
        <p>Personne ne modifie à la main la loi actuelle du site : <Link to="/systeme">le Système</Link> publie une nouvelle version, datée, quand la loi ou les données changent.</p>
      </div>

      <div className="card stack" id="sources" style={{ marginTop: 16 }}>
        <h2>2. La hiérarchie des sources</h2>
        <p>Toutes les sources n'ont pas la même force probante. Par ordre de fiabilité intrinsèque : texte officiel (100 %) · statistique publique (95 %) · modèle de calcul public (90 %) · rapport institutionnel — Cour des comptes, DG Trésor, conseils d'analyse, OCDE (85 %) · étude académique relue par des pairs (80 %) · document de travail (60 %) · laboratoire d'idées, de toutes sensibilités (45 %) · presse (30 %).</p>
      </div>

      <div className="card stack" id="impacts" style={{ marginTop: 16 }}>
        <h2><Calculator size={22} /> 3. Les impacts</h2>
        <ul>
          <li><strong>Pour votre foyer et des ménages types</strong> : le moteur applique la loi actuelle, puis la loi modifiée, à comportements inchangés. C'est un calcul mécanique, très fiable dans son champ.</li>
          <li><strong>Budget et inégalités</strong> : le même calcul est appliqué à une population synthétique de ménages, calée sur les statistiques officielles ouvertes (INSEE, DGFiP, CNAF). La confiance dépend de l'écart entre la simulation de la situation actuelle et les chiffres officiels observés.</li>
          <li><strong>Effets économiques et comportementaux</strong> (emploi, prix, PIB, récidive…) : ils s'appuient sur la base de preuves (ci-dessous).</li>
          <li><strong>Règles sans modèle</strong> : le Système l'indique clairement et affiche les études disponibles plutôt qu'un chiffre inventé.</li>
        </ul>
      </div>

      <div className="card stack" id="preuves" style={{ marginTop: 16 }}>
        <h2><Scale size={22} /> 4. Trancher entre des études qui se contredisent</h2>
        <p>Pour chaque question (par exemple « une hausse du SMIC réduit-elle l'emploi ? »), le Système recense toutes les estimations crédibles. Chacune reçoit un <strong>poids</strong> :</p>
        <p style={{ fontFamily: 'var(--mono)', fontSize: '.9rem', background: 'var(--surface-2)', padding: 12, borderRadius: 8 }}>poids = qualité × pertinence pour la France × fraîcheur × précision</p>
        <ul>
          <li><strong>Qualité</strong> : méta-analyse (1), expérience contrôlée (0,95), quasi-expérience (0,85), modèle structurel (0,65), simulation institutionnelle (0,6), étude descriptive (0,5) ; × 0,8 si l'étude n'est pas relue par des pairs ; modulée par la fiabilité de l'éditeur.</li>
          <li><strong>Pertinence</strong> : France (1), autre pays européen (0,75), synthèse internationale (0,7), autre pays (0,55).</li>
          <li><strong>Fraîcheur</strong> : données de 2015 ou après (1), 2005-2014 (0,85), 1995-2004 (0,7), avant (0,55).</li>
          <li><strong>Précision</strong> : les études aux intervalles de confiance plus étroits pèsent jusqu'à deux fois plus (et au minimum moitié moins).</li>
        </ul>
        <p>La <strong>valeur retenue</strong> est la médiane pondérée des estimations : elle tranche, sans se laisser emporter par une étude extrême. La <strong>fourchette plausible</strong> va du 10e au 90e percentile pondéré.</p>
      </div>

      <div className="card stack" id="confiance" style={{ marginTop: 16 }}>
        <h2>5. L'indice de confiance</h2>
        <p>Chaque chiffre porte un score de 0 à 100 et l'un de ces quatre niveaux. Cliquez sur un badge pour voir les facteurs qui expliquent le score.</p>
        <table className="table">
          <thead><tr><th>Niveau</th><th>Score</th><th>Signification</th></tr></thead>
          <tbody>{NIVEAUX.map(([c, l, s, d]) => <tr key={c}><td><span className={`conf ${c}`}>{l}</span></td><td>{s}</td><td className="small">{d}</td></tr>)}</tbody>
        </table>
        <p>Pour une question d'études, le score combine quatre facteurs par une moyenne géométrique pondérée : <em>volume</em> (25 % — nombre effectif d'études, 6 ou plus = maximum), <em>qualité</em> moyenne (25 %), <em>accord</em> entre études (30 % — part du poids qui va dans le même sens, pénalisée par la largeur de la fourchette) et <em>pertinence</em> pour la France (20 %). Une moyenne géométrique fait qu'un seul facteur très faible — par exemple des études qui se contredisent — suffit à faire baisser l'indice. Une seule étude ne peut pas dépasser « Faible » (35/100), deux études non plus (49/100). Une estimation exprimée dans une autre unité que la question reste affichée mais n'entre pas dans le calcul.</p>
        <p>Pour un agrégat simulé (une recette, une dépense), la confiance dépend de l'écart entre la simulation de la situation actuelle et le chiffre officiel observé : 5 % d'écart donnent environ 80/100, 20 % d'écart environ 35/100.</p>
        <p>Pour un résultat obtenu en enchaînant plusieurs éléments (par exemple une élasticité appliquée à une statistique), la confiance est celle du <strong>maillon le plus faible</strong>, légèrement réduite quand la chaîne s'allonge.</p>
        <p>Pour un total qui additionne plusieurs composantes (par exemple l'effet global sur les comptes publics), la confiance est la <strong>moyenne des confiances de chaque composante, pondérée par son ampleur</strong> : une composante peu fiable mais minuscule ne disqualifie pas le total ; une composante peu fiable et massive le fait baisser fortement.</p>
      </div>

      <div className="card stack" id="equilibres" style={{ marginTop: 16 }}>
        <h2>6. Les équilibres et le bilan en quatre piliers</h2>
        <p>Chaque réforme est évaluée sur <strong>quatre dimensions</strong> : économie (finances publiques, activité, emploi), social (inégalités, pauvreté), écologie (émissions de gaz à effet de serre) et bien-être (satisfaction dans la vie, santé, sécurité, temps libre). Ces dimensions reposent sur des sources différentes : comptes publics, enquêtes de l'INSEE sur le bien-être, inventaires d'émissions du CITEPA et du SDES, études de santé publique. Aucune note globale n'est calculée : les arbitrages vous appartiennent.</p>
        <p>Deux <strong>équilibres</strong> doivent être respectés, car ils sont déjà « bloqués » : les <strong>finances publiques</strong> (le déficit dépasse la limite européenne de 3 % du PIB, et l'article 40 de la Constitution interdit de créer une charge publique sans compensation) et le <strong>budget carbone</strong> (les émissions de la France dépassent le budget légal de la stratégie nationale bas-carbone). Une réforme qui dégrade l'un d'eux doit être compensée ailleurs ; le Système propose des compensations chiffrées. Une proposition peut aussi assumer un déficit, de façon transparente : ce choix devient une règle de cette proposition.</p>
        <p>Un dépassement dont l'estimation est de confiance « Très faible » est signalé « à surveiller », sans bloquer l'enregistrement.</p>
      </div>

      <div className="card stack" id="mises-a-jour" style={{ marginTop: 16 }}>
        <h2>7. La mise à jour invisible</h2>
        <p>Chaque nuit, le Système vérifie le moteur de calcul (nouvelle version d'OpenFisca-France, installée seulement si elle passe les contrôles), les données, la cohérence du modèle et une partie des liens des sources. Si la loi a changé, il publie une nouvelle version de la loi actuelle. À minuit, les règles dont la date d'entrée en vigueur arrive s'appliquent d'elles-mêmes. Les propositions des utilisateurs sont mises à jour automatiquement pour toutes les règles qu'elles n'ont pas modifiées ; si la loi change une règle que l'auteur avait aussi changée, rien n'est imposé : c'est lui qui choisit.</p>
      </div>

      <div className="card stack" id="forks" style={{ marginTop: 16 }}>
        <h2><GitFork size={22} /> 8. Versions, variantes et suggestions</h2>
        <p>Une proposition, c'est la loi actuelle avec quelques règles changées. Chacun peut <strong>partir d'une proposition</strong> existante pour faire la sienne, l'original ne change pas. Chaque modification est enregistrée comme une nouvelle <strong>version</strong>, signée et datée : on peut toujours voir qui a changé quoi, et pourquoi. Une <strong>variante</strong> permet d'essayer une autre piste sans toucher à la version principale. Une <strong>suggestion</strong> permet de proposer ses changements à l'auteur d'une autre proposition, qui en discute puis décide de les intégrer ou non.</p>
        <p className="small muted">Pour les informaticiens : c'est le fonctionnement de git (fork, commit, branche, pull request), appliqué aux règles de la société.</p>
        <p>Tester est libre et anonyme. Proposer (enregistrer, publier, commenter) nécessite d'être identifié.</p>
      </div>

      <div className="card soft" style={{ marginTop: 16 }}>
        <h3><Bot size={18} /> Limites connues</h3>
        <ul className="small">
          <li>La population synthétique est construite à partir de marges publiques séparées (les données détaillées ERFS/POTE ne sont pas ouvertes) : les effets budgétaires et redistributifs sont des ordres de grandeur.</li>
          <li>Les calculs ne tiennent pas compte du non-recours aux aides pour votre foyer (droits théoriques) ; ils l'intègrent pour le budget quand une étude le mesure.</li>
          <li>Certains domaines n'ont pas encore de modèle d'impact quantitatif : ils s'enrichiront au fil des versions du Système.</li>
        </ul>
      </div>
    </div>
  )
}
