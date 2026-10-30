# Mettre le site en ligne et l'améliorer chaque jour, ordinateur éteint

```
 Visiteurs ──avis──► Site en ligne (serveur français) ◄──── met en ligne les versions validées (toutes les 5 min)
                         ▲  │ jeton secret                           │
                         │  ▼                                        │
 Routine Claude (cloud, chaque matin) ──branche──► GitHub ──tests──► main
 Le Système (GitHub Actions, chaque nuit) ─────────────────────────► main (nouvelle loi, moteur, population)
```

- **GitHub** est la seule source de vérité : chaque changement y est une version publique, réversible.
- **Le serveur** suit `main`, mais ne met en ligne une version que si les tests de GitHub l'ont validée. Il garde la base
  (comptes, propositions, avis), la sauvegarde chaque jour et vérifie les liens des sources.
- **La routine Claude** lit les avis sur le site avec un jeton secret, améliore le code en suivant
  `system/auto_amelioration/CHARTE.md`, puis pousse une branche. GitHub la fusionne si les tests passent et si aucun fichier
  protégé n'est touché.
- **Le Système** met à jour chaque nuit sur GitHub le moteur OpenFisca, les règles, la population et le banc d'essai. Il ne
  publie que si les tests passent.

## 1. Le serveur (une fois, environ 20 minutes)

1. Louez un serveur virtuel (VPS) sous **Ubuntu 24.04**, avec **au moins 4 Go de mémoire** et 2 processeurs, chez OVHcloud
   (gamme VPS) ou Scaleway (Instances). Notez son adresse IP. Le site occupe environ 1,4 Go au repos et près de 2 Go pendant
   une simulation de réforme. Sur un serveur de 8 Go, ajoutez `SOCIETE_WORKERS=3` dans `/opt/simulons/deploy/.env` : les
   réformes se calculent alors environ trois fois plus vite.
2. *Facultatif :* achetez un nom de domaine (par exemple chez OVHcloud), puis créez un enregistrement DNS **A** qui pointe vers
   l'IP du serveur. Sans domaine, le site aura une adresse gratuite du type `https://51-15-12-34.sslip.io`.
3. Connectez-vous au serveur (`ssh root@IP`, ou `ssh ubuntu@IP` puis `sudo -i`) et lancez, en remplaçant le domaine (ou en
   l'omettant) :

   ```bash
   curl -fsSL https://raw.githubusercontent.com/BaltoAF/simulons-notre-societe/main/deploy/installer.sh | bash -s -- mon-domaine.fr
   ```

   Le script installe tout et met le site en ligne. À la fin, il affiche **deux valeurs à garder pour l'étape 2** :
   `SOCIETE_SITE_URL` et `SOCIETE_JETON_AVIS`. Le jeton est secret : ne le publiez nulle part ailleurs que sur claude.ai.

## 2. La routine Claude (une fois, environ 5 minutes, sur claude.ai)

1. **Accès au dépôt** : sur https://claude.ai/code, connectez GitHub et autorisez l'application Claude sur le dépôt
   `BaltoAF/simulons-notre-societe`.
2. **Environnement** : dans les réglages de l'environnement cloud utilisé par la routine, ajoutez :
   - les variables `SOCIETE_SITE_URL` et `SOCIETE_JETON_AVIS`, avec les valeurs affichées par le script ;
   - un accès réseau qui autorise l'adresse du site, ainsi que PyPI et npm pour installer les dépendances.
3. **Activation** : activez la routine « Auto-amélioration quotidienne » sur https://claude.ai/code/routines, ou demandez à
   Claude de le faire.

## Au quotidien

| Pour… | Où regarder |
|---|---|
| Voir ce que les avis ont changé | la page « Ce que vos avis ont changé » du site (`/vos-avis`) |
| Lire le journal détaillé (alertes, points soumis) | `system/auto_amelioration/journal/` sur GitHub |
| Voir les tests et les mises à jour de nuit | l'onglet **Actions** du dépôt ; GitHub vous écrit en cas d'échec |
| Annuler une amélioration | `git revert <version>` puis `git push` : le serveur suit en quelques minutes |
| Mettre la routine en pause | https://claude.ai/code/routines |
| Suivre les mises en ligne sur le serveur | `journalctl -u suivre-github -n 50` |
| Retrouver une sauvegarde de la base | `/opt/simulons-sauvegardes/` (14 jours) |

Ce qui reste à décider par le responsable du projet, et que la routine ne fait jamais seule : la charte, les valeurs de la loi
actuelle, les méthodes de calcul, la sécurité, les dépendances. Ces sujets apparaissent dans la rubrique « À soumettre au
responsable » du journal.
