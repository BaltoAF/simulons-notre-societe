#!/usr/bin/env bash
# Sur le serveur, toutes les 5 minutes (deploy/suivre-github.timer) :
#  - si une nouvelle version est arrivée sur la branche main de GitHub ET que les tests de GitHub l'ont validée,
#    le site est reconstruit et remis en ligne (quelques secondes de coupure) ;
#  - une fois par jour, la base (comptes, propositions, avis) est sauvegardée (14 jours gardés) ;
#  - la sécurité du serveur est entretenue (deploy/maintenance_serveur.sh : mises à jour automatiques, état du serveur) ;
#  - une fois par semaine, la nuit, les images de base (Python, Caddy) sont rafraîchies pour leurs correctifs de sécurité.
# Usage : deploy/suivre_github.sh [--forcer]   (--forcer : reconstruit même sans nouvelle version)
set -euo pipefail
exec 9>/tmp/simulons-suivi.lock
flock -n 9 || exit 0   # une mise en ligne est déjà en cours

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f deploy/docker-compose.yml"
journal() { echo "$(date '+%F %T') $*"; }

# ── sauvegarde quotidienne de la base ──
SAUV=/opt/simulons-sauvegardes
mkdir -p "$SAUV"
if [ ! -f "$SAUV/societe-$(date +%F).sqlite3" ] && [ -f deploy/donnees/societe.sqlite3 ]; then
  $COMPOSE exec -T site python -c "
import sqlite3
src = sqlite3.connect('/app/backend/data/societe.sqlite3')
dst = sqlite3.connect('/app/backend/data/sauvegarde.sqlite3')
src.backup(dst); dst.close()" && mv deploy/donnees/sauvegarde.sqlite3 "$SAUV/societe-$(date +%F).sqlite3" \
    && journal "sauvegarde de la base faite"
  find "$SAUV" -name 'societe-*.sqlite3' -mtime +14 -delete
fi

# ── sécurité du serveur : mises à jour automatiques, état lu par le site et la routine ──
bash deploy/maintenance_serveur.sh || journal "maintenance du serveur : échec (voir ci-dessus)"

# ── une fois par semaine, entre 2 h et 4 h (avant le redémarrage éventuel de 4 h 30) : images de base rafraîchies ──
REPERE_IMAGES=/var/lib/simulons/images-rafraichies
RAFRAICHIR=""
if [ "$(date +%H)" -ge 2 ] && [ "$(date +%H)" -lt 4 ] && { [ ! -f "$REPERE_IMAGES" ] || [ -n "$(find "$REPERE_IMAGES" -mtime +6)" ]; }; then
  RAFRAICHIR=1
fi

# ── nouvelle version sur GitHub ? ──
DEPOT=$(git remote get-url origin | sed -E 's#^(https://github.com/|git@github.com:)##; s#\.git$##')
git fetch -q origin main
LOCAL=$(git rev-parse HEAD)
DISTANT=$(git rev-parse origin/main)
if [ "$LOCAL" = "$DISTANT" ] && [ "${1:-}" != "--forcer" ] && [ -z "$RAFRAICHIR" ]; then
  exit 0
fi

if [ "$LOCAL" != "$DISTANT" ]; then
  # les tests de GitHub (workflow « tests ») doivent avoir réussi sur exactement cette version
  ETAT=$(curl -fsS -H "Accept: application/vnd.github+json" "https://api.github.com/repos/$DEPOT/commits/$DISTANT/check-runs" | python3 -c '
import json, sys
runs = [r for r in json.load(sys.stdin).get("check_runs", []) if r["name"] == "tests"]
if not runs or any(r["status"] != "completed" for r in runs):
    print("attente")
else:
    print("ok" if any(r["conclusion"] == "success" for r in runs) else "echec")')
  if [ "$ETAT" = "ok" ]; then
    git merge -q --ff-only origin/main
    journal "nouvelle version ${DISTANT:0:7} validée par les tests : mise en ligne"
  else
    [ "$ETAT" = "echec" ] && journal "version ${DISTANT:0:7} refusée : les tests de GitHub ont échoué"
    # la version actuelle est tout de même reconstruite si on le demande (installation, images à rafraîchir)
    [ "${1:-}" = "--forcer" ] || [ -n "$RAFRAICHIR" ] || exit 0
  fi
fi

mkdir -p "$(dirname "$REPERE_IMAGES")"
if [ -n "$RAFRAICHIR" ] || [ ! -f "$REPERE_IMAGES" ]; then
  # images de base à jour : la première construction les télécharge, puis chaque semaine
  $COMPOSE pull -q caddy
  $COMPOSE build -q --pull site
  touch "$REPERE_IMAGES"
  journal "images de base rafraîchies (correctifs de sécurité de Debian, Python et Caddy)"
fi
$COMPOSE up -d --build --remove-orphans
$COMPOSE exec -T caddy caddy reload --config /etc/caddy/Caddyfile >/dev/null 2>&1 || true   # Caddyfile modifié
docker image prune -f >/dev/null
docker builder prune -f --filter until=72h >/dev/null   # le disque ne se remplit pas au fil des reconstructions
journal "site en ligne : version $(git rev-parse --short HEAD)"
