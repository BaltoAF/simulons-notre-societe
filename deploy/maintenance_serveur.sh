#!/usr/bin/env bash
# Sécurité du serveur, sans intervention humaine. Lancé par deploy/suivre_github.sh toutes les 5 minutes, il n'agit qu'une
# fois par jour (configuration) ou par demi-heure (état) :
#  - les mises à jour de sécurité d'Ubuntu et de Docker s'installent seules chaque nuit (unattended-upgrades) ; quand l'une
#    d'elles l'exige (noyau), le serveur redémarre à 4 h 30, heure de Paris, et le site repart tout seul ;
#  - fail2ban bloque les adresses qui essaient des mots de passe SSH à la chaîne ;
#  - l'état du serveur est écrit dans deploy/donnees/etat_serveur.json. Le site l'affiche sur la page privée
#    « Fréquentation », et la routine quotidienne le lit avec son jeton pour signaler ce qui coince. Elle n'a aucun accès au
#    serveur : elle prévient, elle n'agit pas.
# Usage : deploy/maintenance_serveur.sh [--forcer]   (--forcer : refait la configuration et l'état tout de suite)
set -euo pipefail
cd "$(dirname "$0")"
export DEBIAN_FRONTEND=noninteractive LC_ALL=C
REPERES=/var/lib/simulons
mkdir -p "$REPERES"

# ── configuration, une fois par jour (rattrape un serveur installé avant ce script, ou un réglage effacé) ──
if [ "${1:-}" = "--forcer" ] || [ ! -f "$REPERES/maintenance-$(date +%F)" ]; then
  if ! dpkg -s unattended-upgrades fail2ban >/dev/null 2>&1; then
    apt-get -o DPkg::Lock::Timeout=600 update -q
    apt-get -o DPkg::Lock::Timeout=600 install -yq unattended-upgrades fail2ban
  fi
  cat > /etc/apt/apt.conf.d/20auto-upgrades <<'FIN'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
FIN
  cat > /etc/apt/apt.conf.d/52simulons <<'FIN'
// Simulons notre société (deploy/maintenance_serveur.sh) : en plus des mises à jour de sécurité d'Ubuntu, celles de
// Docker ; redémarrage automatique à 4 h 30 quand une mise à jour l'exige.
Unattended-Upgrade::Allowed-Origins { "Docker:${distro_codename}"; };
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
FIN
  [ "$(timedatectl show -p Timezone --value 2>/dev/null)" = Europe/Paris ] || timedatectl set-timezone Europe/Paris
  systemctl enable --now apt-daily.timer apt-daily-upgrade.timer unattended-upgrades fail2ban >/dev/null 2>&1
  # la toute première fois, les mises à jour de sécurité en retard s'installent tout de suite, en arrière-plan
  if [ ! -f "$REPERES/premiere-maj" ]; then
    touch "$REPERES/premiere-maj"
    systemd-run --quiet --unit="simulons-premiere-maj-$(date +%s)" sh -c 'apt-get -o DPkg::Lock::Timeout=600 update -q && unattended-upgrade' || true
  fi
  rm -f "$REPERES"/maintenance-*
  touch "$REPERES/maintenance-$(date +%F)"
  echo "$(date '+%F %T') maintenance du serveur : mises à jour automatiques et fail2ban vérifiés"
fi

# ── état du serveur, au plus toutes les 30 minutes ──
ETAT=donnees/etat_serveur.json
if [ "${1:-}" = "--forcer" ] || [ ! -f "$ETAT" ] || [ -n "$(find "$ETAT" -mmin +30)" ]; then
  python3 - "$ETAT" <<'FIN'
"""Écrit l'état du serveur, lu par le site (backend/app/serveur.py). Aucune donnée personnelle."""
import datetime as dt
import glob
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


def sortie(*cmd):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        return (r.stdout + r.stderr).strip(), r.returncode
    except (OSError, subprocess.TimeoutExpired):
        return "", -1


def date_fichier(chemin):
    try:
        return dt.datetime.fromtimestamp(os.path.getmtime(chemin)).astimezone().isoformat(timespec="seconds")
    except OSError:
        return None


systeme = {}
for ligne in Path("/etc/os-release").read_text().splitlines():
    if "=" in ligne:
        cle, val = ligne.split("=", 1)
        systeme[cle] = val.strip('"')

# fin des mises à jour de sécurité de cette version d'Ubuntu (paquet distro-info-data)
fin_support = None
csv = Path("/usr/share/distro-info/ubuntu.csv")
if csv.exists() and systeme.get("VERSION_CODENAME"):
    lignes = csv.read_text().splitlines()
    tete = lignes[0].split(",")
    for ligne in lignes[1:]:
        d = dict(zip(tete, ligne.split(",")))
        if d.get("series") == systeme["VERSION_CODENAME"]:
            fin_support = d.get("eol-server") or d.get("eol") or None

# mises à jour en attente (outil d'Ubuntu, sinon simulation d'apt)
en_attente = securite = None
txt, _ = sortie("/usr/lib/update-notifier/apt-check")
m = re.search(r"(\d+);(\d+)", txt)
if m:
    en_attente, securite = int(m[1]), int(m[2])
else:
    txt, code = sortie("apt-get", "-s", "-o", "Debug::NoLocking=1", "dist-upgrade")
    if code == 0:
        inst = [l for l in txt.splitlines() if l.startswith("Inst ")]
        en_attente, securite = len(inst), sum("-security" in l for l in inst)

journal_maj = "/var/log/unattended-upgrades/unattended-upgrades.log"
erreurs = []
try:
    limite = (dt.datetime.now() - dt.timedelta(days=7)).strftime("%Y-%m-%d")
    for ligne in Path(journal_maj).read_text(errors="replace").splitlines()[-2000:]:
        if " ERROR " in ligne and ligne[:10] >= limite:
            erreurs.append(ligne[:300])
except OSError:
    pass
config_apt, _ = sortie("apt-config", "dump")
timer, _ = sortie("systemctl", "is-active", "apt-daily-upgrade.timer")

redemarrage = Path("/run/reboot-required")
paquets = Path("/run/reboot-required.pkgs")
f2b_actif, _ = sortie("systemctl", "is-active", "fail2ban")
f2b, _ = sortie("fail2ban-client", "status", "sshd")
bloquees = re.search(r"Currently banned:\s*(\d+)", f2b)
ufw, _ = sortie("ufw", "status")
docker, _ = sortie("docker", "version", "--format", "{{.Server.Version}}")
conteneurs, _ = sortie("docker", "ps", "--format", "{{.Names}}: {{.Status}}")
version, _ = sortie("git", "-C", "..", "rev-parse", "--short", "HEAD")
sauvegardes = sorted(glob.glob("/opt/simulons-sauvegardes/societe-*.sqlite3"))
disque = shutil.disk_usage("/")
memoire = {l.split(":")[0]: int(l.split()[1]) for l in Path("/proc/meminfo").read_text().splitlines() if l.split()[1:2]}

etat = {
    "date": dt.datetime.now().astimezone().isoformat(timespec="seconds"),
    "systeme": {"nom": systeme.get("PRETTY_NAME"), "noyau": os.uname().release, "fin_support": fin_support},
    "mises_a_jour": {
        "automatiques": timer == "active" and 'APT::Periodic::Unattended-Upgrade "1"' in config_apt,
        "en_attente": en_attente, "securite": securite,
        "derniere_execution": date_fichier(journal_maj), "erreurs": erreurs[-5:],
    },
    "redemarrage": {"requis": redemarrage.exists(), "depuis": date_fichier(redemarrage),
                    "paquets": paquets.read_text().split() if paquets.exists() else []},
    "pare_feu_actif": ufw.startswith("Status: active"),
    "fail2ban": {"actif": f2b_actif == "active", "adresses_bloquees": int(bloquees[1]) if bloquees else None},
    "disque_utilise_pct": round(100 * disque.used / disque.total, 1),
    "memoire_disponible_mo": memoire.get("MemAvailable", 0) // 1024,
    "demarre_depuis_jours": round(float(Path("/proc/uptime").read_text().split()[0]) / 86400, 1),
    "docker": docker or None,
    "conteneurs": conteneurs.splitlines(),
    "images_rafraichies_le": date_fichier("/var/lib/simulons/images-rafraichies"),
    "derniere_sauvegarde": date_fichier(sauvegardes[-1]) if sauvegardes else None,
    "version_site": version or None,
}
cible = Path(sys.argv[1])
provisoire = cible.with_suffix(".tmp")
provisoire.write_text(json.dumps(etat, ensure_ascii=False, indent=1), encoding="utf-8")
os.chmod(provisoire, 0o644)
os.replace(provisoire, cible)
FIN
fi
