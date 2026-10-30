"""État du serveur, écrit par deploy/maintenance_serveur.sh : mises à jour de sécurité, redémarrage, pare-feu, disque,
sauvegardes. Lu par la page privée « Fréquentation » et par la routine quotidienne, qui signale ce qui coince : elle n'a
aucun accès au serveur. Les seuils d'alerte sont ici, en un seul endroit."""
import datetime as dt
import json

from .config import DATA_DIR

FICHIER = DATA_DIR / "etat_serveur.json"


def _date(texte: str | None) -> dt.datetime | None:
    try:
        d = dt.datetime.fromisoformat(texte) if texte else None
    except ValueError:
        return None
    return d.replace(tzinfo=dt.timezone.utc) if d and d.tzinfo is None else d


def _jours_depuis(texte: str | None, maintenant: dt.datetime) -> float | None:
    d = _date(texte)
    return (maintenant - d).total_seconds() / 86400 if d else None


def etat(maintenant: dt.datetime | None = None) -> dict:
    """L'état relevé sur le serveur, avec un statut (« ok », « a_surveiller », « a_traiter » ou « inconnu ») et les alertes,
    en phrases simples. Une alerte « info » ne change pas le statut."""
    maintenant = maintenant or dt.datetime.now(dt.timezone.utc)
    try:
        e = json.loads(FICHIER.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {"statut": "inconnu", "alertes": [{"niveau": "info", "texte": "Le serveur n'a encore relevé aucun état "
                "(deploy/maintenance_serveur.sh, lancé toutes les 5 minutes par deploy/suivre_github.sh)."}]}
    alertes: list[dict] = []

    def alerte(niveau: str, texte: str) -> None:
        alertes.append({"niveau": niveau, "texte": texte})

    age = _jours_depuis(e.get("date"), maintenant)
    if age is None or age > 0.25:
        alerte("a_traiter", "L'état du serveur n'a pas été relevé depuis plus de 6 heures : le suivi automatique "
                            "(suivre-github.timer) semble arrêté.")
    maj = e.get("mises_a_jour") or {}
    if not maj.get("automatiques"):
        alerte("a_traiter", "Les mises à jour automatiques de sécurité sont désactivées.")
    depuis_maj = _jours_depuis(maj.get("derniere_execution"), maintenant)
    if maj.get("securite") and (depuis_maj is None or depuis_maj > 2):
        alerte("a_traiter", f"{maj['securite']} mise(s) à jour de sécurité en attente, et les mises à jour automatiques "
                            "n'ont pas tourné depuis plus de 2 jours.")
    if maj.get("erreurs"):
        alerte("a_traiter", "Les mises à jour automatiques ont signalé des erreurs cette semaine : " + " | ".join(maj["erreurs"][-2:]))
    red = e.get("redemarrage") or {}
    if red.get("requis"):
        paquets = ", ".join(red.get("paquets") or []) or "système"
        depuis = _jours_depuis(red.get("depuis"), maintenant)
        if depuis is not None and depuis > 2:
            alerte("a_traiter", f"Un redémarrage est attendu depuis plus de 2 jours ({paquets}) : le redémarrage "
                                "automatique de 4 h 30 n'a pas eu lieu.")
        else:
            alerte("info", f"Redémarrage prévu à 4 h 30 pour terminer une mise à jour ({paquets}).")
    if not e.get("pare_feu_actif"):
        alerte("a_traiter", "Le pare-feu (ufw) est désactivé.")
    if not (e.get("fail2ban") or {}).get("actif"):
        alerte("a_surveiller", "fail2ban ne tourne pas : les essais de mots de passe SSH à répétition ne sont plus bloqués.")
    disque = e.get("disque_utilise_pct") or 0
    if disque >= 95:
        alerte("a_traiter", f"Disque presque plein ({disque:.0f} %) : le site risque de s'arrêter.")
    elif disque >= 85:
        alerte("a_surveiller", f"Disque rempli à {disque:.0f} %.")
    fin = _date((e.get("systeme") or {}).get("fin_support"))
    if fin:
        reste = (fin - maintenant).days
        nom = (e.get("systeme") or {}).get("nom") or "Le système"
        if reste < 0:
            alerte("a_traiter", f"{nom} ne reçoit plus de mises à jour de sécurité : passer à la version suivante.")
        elif reste < 365:
            alerte("a_surveiller", f"{nom} ne recevra plus de mises à jour de sécurité après le {fin:%d/%m/%Y} : "
                                   "prévoir le passage à la version suivante.")
    images = _jours_depuis(e.get("images_rafraichies_le"), maintenant)
    if images is None or images > 14:
        alerte("a_surveiller", "Les images de base du site (Python, Caddy) n'ont pas été rafraîchies depuis plus de 14 jours.")
    sauvegarde = _jours_depuis(e.get("derniere_sauvegarde"), maintenant)
    if sauvegarde is None or sauvegarde > 2:
        alerte("a_traiter", "Aucune sauvegarde de la base depuis plus de 2 jours.")

    niveaux = {a["niveau"] for a in alertes}
    statut = "a_traiter" if "a_traiter" in niveaux else "a_surveiller" if "a_surveiller" in niveaux else "ok"
    return {**e, "statut": statut, "alertes": alertes}
