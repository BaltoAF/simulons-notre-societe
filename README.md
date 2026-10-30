# Simulons notre société

**Les règles de la société française, prouvées par leurs sources. Forkez-les, modifiez-les, mesurez les impacts.**

Simulons notre société numérise les règles qui régissent la France (impôts, prestations, travail, retraites, budget,
justice, droit civil, institutions, nationalité, santé, éducation, logement, énergie) sous forme de
paramètres vérifiables : la **loi actuelle**. Chacun peut en créer sa version (un *fork*, comme sur git),
la faire évoluer, la proposer aux autres, et voir ce que ça change, pour son foyer et pour le pays,
avec un **indice de confiance** sur chaque chiffre.

## Principes

- **Pas de chiffre sans source.** Chaque règle renvoie à son texte officiel (Légifrance, JO, BOFiP…),
  chaque mesure à sa statistique publique, chaque effet à ses études.
- **La loi actuelle est maintenue par le Système uniquement** : des programmes et des agents de
  recherche qui collectent, vérifient et publient. Les utilisateurs agissent sur des forks.
- **Trancher avec honnêteté.** Quand les études divergent, le Système calcule une valeur retenue
  (médiane pondérée) et un indice de confiance à 4 niveaux : Très faible, Faible, Élevé, Très élevé.
- **Quatre dimensions, deux équilibres.** Chaque réforme est évaluée sur l'économie, le social, l'écologie et le
  bien-être. Une hausse qui dégrade le budget public (article 40 de la Constitution) ou le budget carbone (SNBC)
  doit être compensée ailleurs.
- **Du national au particulier.** Le budget de la France, et la part de chaque ménage.
- **Mise à jour invisible.** Chaque nuit, le Système vérifie et publie ; les forks suivent la loi automatiquement.
- **Tester est libre et anonyme ; proposer nécessite d'être identifié.**
- **Bien commun** : code sous licence AGPL-3.0, données sous Licence Ouverte.

## Démarrer

Prérequis : Python 3.11, Node.js 20+.

```bash
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install -r requirements.txt
```

```bash
cd frontend && npm install && npm run build
```

```bash
backend/.venv/Scripts/python -m uvicorn app.main:app --app-dir backend --port 8000
```

Puis ouvrir http://localhost:8000. Le premier démarrage charge le moteur OpenFisca et précalcule la
situation de référence (environ 30 secondes).

Données de démonstration (comptes et sociétés d'exemple, mot de passe de test dans le fichier) :

```bash
backend/.venv/Scripts/python backend/seed_demo.py
```

Développement de l'interface avec rechargement à chaud (l'API doit tourner sur le port 8000) :

```bash
cd frontend && npm run dev
```

Tests de l'API :

```bash
cd backend && .venv/Scripts/python -m pytest -q
```

## Le Système : mettre à jour la loi actuelle

```bash
backend/.venv/Scripts/python system/mettre_a_jour.py --population
```

Synchronise les leviers depuis OpenFisca-France, contrôle la cohérence du modèle, recale la population
synthétique et publie un commit sur la loi actuelle (visible dans « Le Système » sur le site).

## En ligne, et amélioré chaque jour par ses visiteurs

Le site tourne sur un serveur qui suit ce dépôt : une version n'est mise en ligne que si les tests de GitHub l'ont validée.
Chaque nuit, le Système met à jour sur GitHub le moteur, les règles et la population (`.github/workflows/systeme-nuit.yml`).
Chaque matin, une routine Claude lit les avis laissés sur le site (« Donner mon avis ») et améliore le site en suivant une
charte publique : s'inspirer sans recopier, utilité, fiabilité, neutralité, refus des demandes partisanes ou hors cadre
(`system/auto_amelioration/CHARTE.md`). Ses décisions sont publiées sur la page « Ce que vos avis ont changé », et ses
journaux dans `system/auto_amelioration/journal/`. Mise en place : `docs/DEPLOIEMENT.md`.

## Organisation

| Dossier | Contenu |
|---|---|
| `model/` | La loi actuelle en YAML : règles, sources, métriques, preuves (voir `docs/FORMAT-DONNEES.md`) |
| `model/moteur/` | Liens entre règles et moteur de calcul, entre études et règles |
| `model/population/` | Population synthétique calée (générée par le Système) |
| `system/` | Les pipelines du Système (synchronisation, population, publication) et l'auto-amélioration (`auto_amelioration/`) |
| `deploy/` | Le serveur : Docker, HTTPS, suivi de GitHub, sauvegardes, script d'installation |
| `backend/` | API FastAPI : moteur OpenFisca, modules d'impact, versionnage façon git, comptes |
| `frontend/` | Site React (grand public) |
| `docs/` | Format des données, architecture, méthode de calage |

Voir `docs/ARCHITECTURE.md` pour le détail.
