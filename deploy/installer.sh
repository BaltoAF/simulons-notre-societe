#!/usr/bin/env bash
# Installe « Simulons notre société » sur un serveur Ubuntu ou Debian neuf (Scaleway, OVH…). À lancer une seule fois, en root :
#
#   curl -fsSL https://raw.githubusercontent.com/BaltoAF/simulons-notre-societe/main/deploy/installer.sh | bash -s -- mon-domaine.fr
#
# Sans nom de domaine, le site prend une adresse gratuite du type 51-15-12-34.sslip.io (HTTPS compris).
# Le script : installe Docker, ferme le pare-feu sauf SSH/HTTP/HTTPS, récupère le code, crée deploy/.env avec un jeton secret
# tiré au hasard (pour la routine d'auto-amélioration), met le site en ligne et le fait suivre GitHub toutes les 5 minutes.
set -euo pipefail
DEPOT="${DEPOT:-https://github.com/BaltoAF/simulons-notre-societe.git}"
DOSSIER=/opt/simulons
DOMAINE="${1:-}"

[ "$(id -u)" = 0 ] || { echo "À lancer en root (sudo -i)."; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -yq git curl ca-certificates python3 ufw openssl

if [ -z "$DOMAINE" ]; then
  IP=$(curl -fsS https://api.ipify.org)
  DOMAINE="$(echo "$IP" | tr . -).sslip.io"
  echo "Pas de nom de domaine indiqué : le site sera à l'adresse https://$DOMAINE"
fi

command -v docker >/dev/null || curl -fsSL https://get.docker.com | sh

# mémoire d'appoint : chaque mise à jour reconstruit le site pendant qu'il tourne (1,4 à 1,9 Go) ; utile jusqu'à 8 Go
if [ ! -f /swapfile ] && [ "$(awk '/MemTotal/ {print $2}' /proc/meminfo)" -lt 7500000 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

ufw allow OpenSSH >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null

[ -d "$DOSSIER/.git" ] || git clone -q "$DEPOT" "$DOSSIER"
cd "$DOSSIER/deploy"
if [ ! -f .env ]; then
  umask 077
  cat > .env <<FIN
# Réglages du site en ligne (jamais versionnés). Voir docs/DEPLOIEMENT.md.
DOMAINE=$DOMAINE
# jeton de la routine d'auto-amélioration : à recopier, à l'identique, dans l'environnement de la routine sur claude.ai
SOCIETE_JETON_AVIS=$(openssl rand -hex 32)
FIN
fi
mkdir -p donnees && chown 1000:1000 donnees
chmod +x suivre_github.sh

cp suivre-github.service suivre-github.timer /etc/systemd/system/
systemctl daemon-reload
echo "Construction et mise en ligne du site (5 à 10 minutes la première fois)…"
./suivre_github.sh --forcer
systemctl enable --now suivre-github.timer >/dev/null

# propositions d'exemple (comptes au mot de passe aléatoire : personne ne peut s'y connecter)
sleep 20
docker compose -f docker-compose.yml exec -T site python backend/seed_demo.py >/dev/null 2>&1 || true

source .env
echo
echo "C'est en ligne : https://$DOMAINE (le certificat HTTPS peut prendre une minute)."
echo
echo "Pour la routine d'auto-amélioration, sur claude.ai (voir docs/DEPLOIEMENT.md), recopie ces deux valeurs :"
echo "  SOCIETE_SITE_URL=https://$DOMAINE"
echo "  SOCIETE_JETON_AVIS=$SOCIETE_JETON_AVIS"
echo "(Pour les revoir plus tard : cat $DOSSIER/deploy/.env)"
