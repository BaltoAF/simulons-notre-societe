# Société 2.0

**Les règles de la société française, prouvées par leurs sources. Forkez-les, modifiez-les, mesurez les impacts.**

Société 2.0 numérise les règles qui régissent la France (impôts, prestations, travail, retraites, budget,
justice, droit civil, institutions, nationalité, santé, éducation, logement, énergie) sous forme de
paramètres vérifiables : la **Société 1.0**. Chacun peut en créer sa version (un *fork*, comme sur git),
la faire évoluer, la proposer aux autres, et voir ce que ça change, pour son foyer et pour le pays,
avec un **indice de confiance** sur chaque chiffre.

## Principes

- **Pas de chiffre sans source.** Chaque règle renvoie à son texte officiel (Légifrance, JO, BOFiP…),
  chaque mesure à sa statistique publique, chaque effet à ses études.
- **La Société 1.0 est maintenue par le Système uniquement** : des programmes et des agents de
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
cd backend && python -m venv .venv && .venv/Scripts/python -m pip install openfisca-france==176.1.2 fastapi "uvicorn[standard]" pyyaml pydantic httpx pytest
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

## Le Système : mettre à jour la Société 1.0

```bash
backend/.venv/Scripts/python system/mettre_a_jour.py --population
```

Synchronise les leviers depuis OpenFisca-France, contrôle la cohérence du modèle, recale la population
synthétique et publie un commit sur la Société 1.0 (visible dans « Le Système » sur le site).

## Organisation

| Dossier | Contenu |
|---|---|
| `model/` | La Société 1.0 en YAML : règles, sources, métriques, preuves (voir `docs/FORMAT-DONNEES.md`) |
| `model/moteur/` | Liens entre règles et moteur de calcul, entre études et règles |
| `model/population/` | Population synthétique calée (générée par le Système) |
| `system/` | Les pipelines du Système (synchronisation, population, publication) |
| `backend/` | API FastAPI : moteur OpenFisca, modules d'impact, versionnage façon git, comptes |
| `frontend/` | Site React (grand public) |
| `docs/` | Format des données, architecture, méthode de calage |

Voir `docs/ARCHITECTURE.md` pour le détail.
