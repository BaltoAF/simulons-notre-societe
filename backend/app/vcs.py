"""Gestion de versions des sociétés, sur le modèle de git.

- La Société 1.0 (« france ») est une société de référence, en lecture seule pour les utilisateurs :
  seul le Système y crée des commits, chaque fois que le modèle (model/) change.
- Un fork est une société dont l'état = un instantané de la Société 1.0 + des « surcharges »
  (règle -> nouvelle valeur). Chaque commit stocke l'état complet de ses surcharges et la liste
  des changements par rapport à son parent.
- Les branches pointent vers un commit. Les propositions (pull requests) fusionnent une branche
  dans une autre société par fusion à trois voies, au niveau de chaque règle.
"""
from __future__ import annotations

import hashlib
import re
import secrets
import time
import unicodedata
from functools import lru_cache

from fastapi import HTTPException

from . import db
from .config import REFERENCE_SOCIETY_ID

BRANCHE_PRINCIPALE = "principale"


# ───────────────────────── utilitaires ─────────────────────────
def _same(a, b) -> bool:
    return db.dumps(a) == db.dumps(b)


def slugify(text: str) -> str:
    t = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "-", t).strip("-").lower()
    return t[:40] or "societe"


def _commit_id(*parts) -> str:
    h = hashlib.sha1("|".join(str(p) for p in parts).encode("utf-8"))
    return h.hexdigest()[:12]


# ───────────────────────── instantanés ─────────────────────────
def save_snapshot(snapshot: dict) -> str:
    content = db.dumps(snapshot)
    h = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
    conn = db.connect()
    if not conn.execute("SELECT 1 FROM snapshots WHERE hash = ?", (h,)).fetchone():
        with db.transaction() as c:
            c.execute("INSERT INTO snapshots (hash, content) VALUES (?, ?)", (h, content))
    return h


@lru_cache(maxsize=64)
def _snapshot_json(h: str) -> str:
    r = db.connect().execute("SELECT content FROM snapshots WHERE hash = ?", (h,)).fetchone()
    if not r:
        raise HTTPException(500, f"Instantané {h} introuvable")
    return r["content"]


def get_snapshot(h: str) -> dict:
    return db.loads(_snapshot_json(h))


# ───────────────────────── commits ─────────────────────────
def get_commit(cid: str) -> dict:
    r = db.row(db.connect().execute("SELECT * FROM commits WHERE id = ?", (cid,)).fetchone())
    if not r:
        raise HTTPException(404, f"Commit {cid} introuvable")
    r["overrides"] = db.loads(r["overrides"]) or {}
    r["changes"] = db.loads(r["changes"]) or []
    return r


def state_of(cid: str) -> dict:
    c = get_commit(cid)
    state = dict(get_snapshot(c["base_snapshot"]))
    state.update(c["overrides"])
    return state


def _insert_commit(society_id, parent_id, author_id, message, base_snapshot, overrides, changes,
                   second_parent=None, systeme=False) -> str:
    cid = _commit_id(society_id, parent_id, second_parent, author_id, message, base_snapshot,
                     db.dumps(overrides), time.time_ns(), secrets.token_hex(4))
    with db.transaction() as c:
        c.execute(
            "INSERT INTO commits (id, society_id, parent_id, second_parent_id, author_id, auteur_systeme, message,"
            " base_snapshot, overrides, changes) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (cid, society_id, parent_id, second_parent, author_id, 1 if systeme else 0, message, base_snapshot,
             db.dumps(overrides), db.dumps(changes)))
    return cid


def _set_head(society_id: str, branch: str, cid: str):
    with db.transaction() as c:
        c.execute("UPDATE branches SET head = ? WHERE society_id = ? AND nom = ?", (cid, society_id, branch))
        c.execute("UPDATE societies SET updated_at = datetime('now') WHERE id = ?", (society_id,))


def diff_states(a: dict, b: dict, store=None) -> list[dict]:
    """Règles dont la valeur diffère entre deux états (a = avant, b = après)."""
    out = []
    for k in sorted(set(a) | set(b)):
        if not _same(a.get(k), b.get(k)):
            item = {"regle": k, "avant": a.get(k), "apres": b.get(k)}
            if store is not None and k in store.regles:
                r = store.regles[k]
                item.update({"titre": r["titre"], "unite": r["unite"], "domaine": r["domaine"], "type": r["type"]})
            out.append(item)
    return out


# ───────────────────────── Société 1.0 (référence) ─────────────────────────
def ensure_reference(store) -> dict:
    """Crée la Société 1.0 si besoin et enregistre un commit du Système si le modèle a changé."""
    conn = db.connect()
    snap = store.snapshot()
    h = save_snapshot(snap)
    soc = conn.execute("SELECT * FROM societies WHERE id = ?", (REFERENCE_SOCIETY_ID,)).fetchone()
    if not soc:
        with db.transaction() as c:
            c.execute("INSERT INTO societies (id, nom, description, reference) VALUES (?, ?, ?, 1)",
                      (REFERENCE_SOCIETY_ID, "Société 1.0 — la France d'aujourd'hui",
                       "Les règles en vigueur, prouvées par les textes officiels et les statistiques publiques. "
                       "Maintenue uniquement par le Système : forkez-la pour proposer vos changements."))
        cid = _insert_commit(REFERENCE_SOCIETY_ID, None, None,
                             f"Création de la Société 1.0 ({len(snap)} règles)", h, {}, [], systeme=True)
        with db.transaction() as c:
            c.execute("INSERT INTO branches (society_id, nom, head) VALUES (?, ?, ?)",
                      (REFERENCE_SOCIETY_ID, BRANCHE_PRINCIPALE, cid))
        return {"cree": True, "commit": cid}
    head = branch_head(REFERENCE_SOCIETY_ID, BRANCHE_PRINCIPALE)
    hc = get_commit(head)
    if hc["base_snapshot"] == h:
        return {"cree": False, "commit": head}
    changes = diff_states(get_snapshot(hc["base_snapshot"]), snap, store)
    ajout = sum(1 for c in changes if c["avant"] is None)
    retrait = sum(1 for c in changes if c["apres"] is None)
    modif = len(changes) - ajout - retrait
    parts = [f"{n} {lbl}" for n, lbl in ((ajout, "règle(s) ajoutée(s)"), (modif, "valeur(s) mise(s) à jour"),
                                         (retrait, "règle(s) retirée(s)")) if n]
    msg = "Mise à jour du Système : " + (", ".join(parts) or "métadonnées")
    for ch in changes:
        r = store.regles.get(ch["regle"])
        if r:
            ch["sources"] = r.get("valeur_sources", [])
    cid = _insert_commit(REFERENCE_SOCIETY_ID, head, None, msg, h, {}, changes, systeme=True)
    _set_head(REFERENCE_SOCIETY_ID, BRANCHE_PRINCIPALE, cid)
    return {"cree": False, "commit": cid, "message": msg}


def reference_head() -> str:
    return branch_head(REFERENCE_SOCIETY_ID, BRANCHE_PRINCIPALE)


def reference_state() -> dict:
    return state_of(reference_head())


# ───────────────────────── sociétés et branches ─────────────────────────
def get_society(sid: str) -> dict:
    r = db.row(db.connect().execute(
        "SELECT s.*, u.pseudo AS owner_pseudo, p.nom AS parent_nom FROM societies s "
        "LEFT JOIN users u ON u.id = s.owner_id LEFT JOIN societies p ON p.id = s.parent_id WHERE s.id = ?",
        (sid,)).fetchone())
    if not r:
        raise HTTPException(404, "Société introuvable")
    r["reference"] = bool(r["reference"])
    r["etoiles"] = db.connect().execute("SELECT COUNT(*) FROM stars WHERE society_id = ?", (sid,)).fetchone()[0]
    return r


def branch_head(sid: str, branch: str) -> str:
    r = db.connect().execute("SELECT head FROM branches WHERE society_id = ? AND nom = ?", (sid, branch)).fetchone()
    if not r:
        raise HTTPException(404, f"Branche « {branch} » introuvable")
    return r["head"]


def list_branches(sid: str) -> list[dict]:
    return db.rows(db.connect().execute(
        "SELECT b.nom, b.head, b.created_at, c.message, c.created_at AS commit_date FROM branches b "
        "JOIN commits c ON c.id = b.head WHERE b.society_id = ? ORDER BY b.nom = ? DESC, b.nom",
        (sid, BRANCHE_PRINCIPALE)))


def _check_owner(sid: str, user: dict):
    soc = get_society(sid)
    if soc["reference"]:
        raise HTTPException(403, "La Société 1.0 est maintenue uniquement par le Système. Forkez-la pour la modifier.")
    if soc["owner_id"] != user["id"]:
        raise HTTPException(403, "Seul le créateur de cette société peut la modifier directement. "
                                 "Forkez-la ou ouvrez une proposition.")
    return soc


def fork(user: dict, source_id: str, source_branch: str, nom: str, description: str = "",
         visibilite: str = "publique") -> dict:
    src = get_society(source_id)
    head = branch_head(source_id, source_branch)
    nom = (nom or "").strip() or f"Ma version de « {src['nom']} »"
    sid = f"{slugify(nom)}-{secrets.token_hex(3)}"
    with db.transaction() as c:
        c.execute("INSERT INTO societies (id, nom, description, owner_id, parent_id, parent_commit, visibilite)"
                  " VALUES (?,?,?,?,?,?,?)",
                  (sid, nom[:120], (description or "")[:4000], user["id"], source_id, head,
                   "privee" if visibilite == "privee" else "publique"))
        c.execute("INSERT INTO branches (society_id, nom, head) VALUES (?, ?, ?)", (sid, BRANCHE_PRINCIPALE, head))
    return get_society(sid)


def create_branch(user: dict, sid: str, nom: str, depuis: str = BRANCHE_PRINCIPALE) -> dict:
    _check_owner(sid, user)
    nom = slugify(nom)
    head = branch_head(sid, depuis)
    if db.connect().execute("SELECT 1 FROM branches WHERE society_id = ? AND nom = ?", (sid, nom)).fetchone():
        raise HTTPException(409, "Cette branche existe déjà.")
    with db.transaction() as c:
        c.execute("INSERT INTO branches (society_id, nom, head) VALUES (?, ?, ?)", (sid, nom, head))
    return {"nom": nom, "head": head}


def update_society(user: dict, sid: str, nom: str | None, description: str | None, visibilite: str | None):
    _check_owner(sid, user)
    with db.transaction() as c:
        if nom is not None:
            c.execute("UPDATE societies SET nom = ? WHERE id = ?", (nom.strip()[:120] or "Sans nom", sid))
        if description is not None:
            c.execute("UPDATE societies SET description = ? WHERE id = ?", (description[:4000], sid))
        if visibilite in ("publique", "privee"):
            c.execute("UPDATE societies SET visibilite = ? WHERE id = ?", (visibilite, sid))
    return get_society(sid)


# ───────────────────────── validation des valeurs ─────────────────────────
def validate_value(rule: dict, value):
    t = rule.get("type", "nombre")
    if t == "nombre":
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise HTTPException(400, f"« {rule['titre']} » attend un nombre.")
        return float(value) if isinstance(value, float) else value
    if t == "booleen":
        if not isinstance(value, bool):
            raise HTTPException(400, f"« {rule['titre']} » attend oui/non.")
        return value
    if t == "choix":
        if rule.get("choix") and value not in rule["choix"]:
            raise HTTPException(400, f"Valeur non prévue pour « {rule['titre']} ».")
        return value
    if t == "texte":
        return str(value)[:2000]
    if t == "bareme":
        if not isinstance(value, list) or not value:
            raise HTTPException(400, "Un barème doit contenir au moins une tranche.")
        out = []
        for b in value:
            try:
                out.append({"seuil": float(b["seuil"]), "taux": float(b["taux"])})
            except (KeyError, TypeError, ValueError):
                raise HTTPException(400, "Chaque tranche doit avoir un seuil et un taux numériques.")
        out.sort(key=lambda b: b["seuil"])
        return out
    return value


# ───────────────────────── commits utilisateur ─────────────────────────
def commit(user: dict, store, sid: str, branch: str, changes: list[dict], message: str) -> dict:
    _check_owner(sid, user)
    if not changes:
        raise HTTPException(400, "Aucun changement à enregistrer.")
    head = branch_head(sid, branch)
    hc = get_commit(head)
    base = get_snapshot(hc["base_snapshot"])
    before = dict(base)
    before.update(hc["overrides"])
    overrides = dict(hc["overrides"])
    recorded = []
    for ch in changes:
        rid = ch.get("regle")
        rule = store.regles.get(rid)
        if not rule:
            raise HTTPException(400, f"Règle inconnue : {rid}")
        if ch.get("retablir"):
            value = base.get(rid)
        else:
            value = validate_value(rule, ch.get("valeur"))
        if _same(value, before.get(rid)):
            continue
        if _same(value, base.get(rid)):
            overrides.pop(rid, None)
        else:
            overrides[rid] = value
        recorded.append({"regle": rid, "titre": rule["titre"], "unite": rule["unite"], "domaine": rule["domaine"],
                         "type": rule["type"], "avant": before.get(rid), "apres": value,
                         "justification": (ch.get("justification") or "")[:2000],
                         "sources": [str(s)[:500] for s in (ch.get("sources") or [])][:10]})
    if not recorded:
        raise HTTPException(400, "Ces valeurs sont identiques à l'état actuel de la branche.")
    message = (message or "").strip() or ("Modifie " + ", ".join(c["titre"] for c in recorded[:3]))
    cid = _insert_commit(sid, head, user["id"], message[:500], hc["base_snapshot"], overrides, recorded)
    _set_head(sid, branch, cid)
    return commit_view(cid)


def commit_view(cid: str) -> dict:
    c = get_commit(cid)
    author = None
    if c["author_id"]:
        u = db.connect().execute("SELECT pseudo FROM users WHERE id = ?", (c["author_id"],)).fetchone()
        author = u["pseudo"] if u else None
    return {"id": c["id"], "society_id": c["society_id"], "parent_id": c["parent_id"],
            "second_parent_id": c["second_parent_id"], "auteur": "Le Système" if c["auteur_systeme"] else author,
            "auteur_systeme": bool(c["auteur_systeme"]), "message": c["message"], "created_at": c["created_at"],
            "base_snapshot": c["base_snapshot"], "changes": c["changes"], "nb_surcharges": len(c["overrides"])}


def log(sid: str, branch: str, limit: int = 100) -> list[dict]:
    cid = branch_head(sid, branch)
    out = []
    while cid and len(out) < limit:
        v = commit_view(cid)
        out.append(v)
        cid = v["parent_id"]
    return out


# ───────────────────────── fusion à trois voies ─────────────────────────
def _ancestors(cid: str) -> list[str]:
    seen, order, stack = set(), [], [cid]
    conn = db.connect()
    while stack:
        x = stack.pop(0)
        if not x or x in seen:
            continue
        seen.add(x)
        order.append(x)
        r = conn.execute("SELECT parent_id, second_parent_id FROM commits WHERE id = ?", (x,)).fetchone()
        if r:
            stack.extend([r["parent_id"], r["second_parent_id"]])
    return order


def merge_base(a: str, b: str) -> str | None:
    anc_a = set(_ancestors(a))
    for x in _ancestors(b):
        if x in anc_a:
            return x
    return None


def three_way(base: dict, ours: dict, theirs: dict) -> tuple[dict, list[dict]]:
    merged, conflicts = {}, []
    for k in set(base) | set(ours) | set(theirs):
        b, o, t = base.get(k), ours.get(k), theirs.get(k)
        if _same(o, t):
            merged[k] = o
        elif _same(o, b):
            merged[k] = t
        elif _same(t, b):
            merged[k] = o
        else:
            conflicts.append({"regle": k, "base": b, "cible": o, "source": t})
            merged[k] = o
    return merged, conflicts


def _commit_merged_state(sid, branch, merged_state, base_snapshot, message, author_id, second_parent, store,
                         systeme=False):
    head = branch_head(sid, branch)
    before = state_of(head)
    snap = get_snapshot(base_snapshot)
    overrides = {k: v for k, v in merged_state.items() if not _same(v, snap.get(k)) and k in snap}
    changes = diff_states(before, merged_state, store)
    cid = _insert_commit(sid, head, author_id, message, base_snapshot, overrides, changes,
                         second_parent=second_parent, systeme=systeme)
    _set_head(sid, branch, cid)
    return cid, changes


def sync_with_reference(user: dict, store, sid: str, branch: str, resolutions: dict | None = None) -> dict:
    """Intègre dans un fork les dernières mises à jour de la Société 1.0 (évolutions de la loi)."""
    _check_owner(sid, user)
    head = branch_head(sid, branch)
    ref = reference_head()
    if ref in set(_ancestors(head)):
        return {"statut": "a_jour", "message": "Cette branche intègre déjà la dernière version de la Société 1.0."}
    base_cid = merge_base(head, ref)
    base = state_of(base_cid) if base_cid else {}
    merged, conflicts = three_way(base, state_of(head), state_of(ref))
    resolutions = resolutions or {}
    unresolved = []
    for c in conflicts:
        choice = resolutions.get(c["regle"])
        if choice == "source":
            merged[c["regle"]] = c["source"]
        elif choice != "cible":
            unresolved.append(c)
    if unresolved:
        for c in unresolved:
            r = store.regles.get(c["regle"])
            c["titre"] = r["titre"] if r else c["regle"]
        raise HTTPException(409, {"message": "La loi a changé sur des règles que vous avez modifiées. "
                                             "Choisissez pour chacune : garder votre valeur ou adopter la nouvelle loi.",
                                  "conflits": unresolved})
    ref_commit = get_commit(ref)
    cid, changes = _commit_merged_state(sid, branch, merged, ref_commit["base_snapshot"],
                                        "Intègre les dernières mises à jour de la Société 1.0", user["id"], ref, store)
    return {"statut": "fusionne", "commit": commit_view(cid), "changements": changes}


# ───────────────────────── propositions (pull requests) ─────────────────────────
def create_proposal(user: dict, source: str, source_branch: str, target: str, target_branch: str,
                    titre: str, description: str) -> dict:
    tgt = get_society(target)
    if tgt["reference"]:
        raise HTTPException(403, "La Société 1.0 ne reçoit pas de propositions : elle reflète la loi en vigueur. "
                                 "Proposez vos changements à un fork.")
    get_society(source)
    branch_head(source, source_branch)
    branch_head(target, target_branch)
    if source == target and source_branch == target_branch:
        raise HTTPException(400, "La source et la cible sont identiques.")
    with db.transaction() as c:
        cur = c.execute("INSERT INTO proposals (source_society, source_branch, target_society, target_branch, titre,"
                        " description, author_id) VALUES (?,?,?,?,?,?,?)",
                        (source, source_branch, target, target_branch, (titre or "Proposition").strip()[:200],
                         (description or "")[:8000], user["id"]))
        pid = cur.lastrowid
    return get_proposal(pid)


def get_proposal(pid: int, store=None) -> dict:
    p = db.row(db.connect().execute(
        "SELECT p.*, u.pseudo AS auteur, s1.nom AS source_nom, s2.nom AS target_nom FROM proposals p "
        "JOIN users u ON u.id = p.author_id JOIN societies s1 ON s1.id = p.source_society "
        "JOIN societies s2 ON s2.id = p.target_society WHERE p.id = ?", (pid,)).fetchone())
    if not p:
        raise HTTPException(404, "Proposition introuvable")
    if p["statut"] == "ouverte":
        src_head = branch_head(p["source_society"], p["source_branch"])
        tgt_head = branch_head(p["target_society"], p["target_branch"])
        base_cid = merge_base(src_head, tgt_head)
        base = state_of(base_cid) if base_cid else {}
        tgt_state, src_state = state_of(tgt_head), state_of(src_head)
        merged, conflicts = three_way(base, tgt_state, src_state)
        p["changements"] = diff_states(tgt_state, merged, store)
        p["conflits"] = conflicts
    return p


def list_proposals(sid: str) -> list[dict]:
    return db.rows(db.connect().execute(
        "SELECT p.id, p.titre, p.statut, p.created_at, p.source_society, p.source_branch, p.target_society,"
        " p.target_branch, u.pseudo AS auteur, s1.nom AS source_nom, s2.nom AS target_nom FROM proposals p "
        "JOIN users u ON u.id = p.author_id JOIN societies s1 ON s1.id = p.source_society "
        "JOIN societies s2 ON s2.id = p.target_society "
        "WHERE p.target_society = ? OR p.source_society = ? ORDER BY p.created_at DESC", (sid, sid)))


def merge_proposal(user: dict, store, pid: int, resolutions: dict | None = None) -> dict:
    p = get_proposal(pid, store)
    if p["statut"] != "ouverte":
        raise HTTPException(400, "Cette proposition n'est plus ouverte.")
    _check_owner(p["target_society"], user)
    src_head = branch_head(p["source_society"], p["source_branch"])
    tgt_head = branch_head(p["target_society"], p["target_branch"])
    base_cid = merge_base(src_head, tgt_head)
    base = state_of(base_cid) if base_cid else {}
    merged, conflicts = three_way(base, state_of(tgt_head), state_of(src_head))
    resolutions = resolutions or {}
    unresolved = []
    for c in conflicts:
        if resolutions.get(c["regle"]) == "source":
            merged[c["regle"]] = c["source"]
        elif resolutions.get(c["regle"]) != "cible":
            unresolved.append(c)
    if unresolved:
        raise HTTPException(409, {"message": "Conflits à résoudre avant fusion.", "conflits": unresolved})
    # on se cale sur l'instantané de référence le plus récent des deux branches
    tc, sc = get_commit(tgt_head), get_commit(src_head)
    snaps = sorted([tc, sc], key=lambda c: c["created_at"])
    base_snapshot = snaps[-1]["base_snapshot"]
    cid, changes = _commit_merged_state(p["target_society"], p["target_branch"], merged, base_snapshot,
                                        f"Fusionne la proposition n°{pid} : {p['titre']}", user["id"], src_head, store)
    with db.transaction() as c:
        c.execute("UPDATE proposals SET statut = 'fusionnee', merge_commit = ?, updated_at = datetime('now') WHERE id = ?",
                  (cid, pid))
    return {"statut": "fusionnee", "commit": commit_view(cid), "changements": changes}


def close_proposal(user: dict, pid: int) -> dict:
    p = get_proposal(pid)
    soc = get_society(p["target_society"])
    if user["id"] not in (p["author_id"], soc["owner_id"]):
        raise HTTPException(403, "Seuls l'auteur et le propriétaire de la société cible peuvent fermer la proposition.")
    with db.transaction() as c:
        c.execute("UPDATE proposals SET statut = 'fermee', updated_at = datetime('now') WHERE id = ?", (pid,))
    return get_proposal(pid)


# ───────────────────────── listes, étoiles, commentaires ─────────────────────────
def list_societies(store, user: dict | None = None, tri: str = "recent", q: str = "", owner: str | None = None,
                   limit: int = 60) -> list[dict]:
    conn = db.connect()
    sql = ("SELECT s.*, u.pseudo AS owner_pseudo, (SELECT COUNT(*) FROM stars st WHERE st.society_id = s.id) AS etoiles,"
           " (SELECT COUNT(*) FROM proposals p WHERE p.target_society = s.id AND p.statut = 'ouverte') AS propositions_ouvertes"
           " FROM societies s LEFT JOIN users u ON u.id = s.owner_id WHERE (s.visibilite = 'publique' OR s.owner_id = ?)")
    params: list = [user["id"] if user else -1]
    if q:
        sql += " AND (s.nom LIKE ? OR s.description LIKE ?)"
        params += [f"%{q}%", f"%{q}%"]
    if owner:
        sql += " AND u.pseudo = ?"
        params.append(owner)
    sql += " ORDER BY s.reference DESC, " + ("etoiles DESC, s.updated_at DESC" if tri == "populaire" else "s.updated_at DESC")
    sql += " LIMIT ?"
    params.append(limit)
    out = db.rows(conn.execute(sql, params))
    ref = reference_state()
    for s in out:
        s["reference"] = bool(s["reference"])
        try:
            st = state_of(branch_head(s["id"], BRANCHE_PRINCIPALE))
            s["nb_differences"] = len(diff_states(ref, st))
        except HTTPException:
            s["nb_differences"] = None
    return out


def toggle_star(user: dict, sid: str) -> dict:
    get_society(sid)
    conn = db.connect()
    exists = conn.execute("SELECT 1 FROM stars WHERE user_id = ? AND society_id = ?", (user["id"], sid)).fetchone()
    with db.transaction() as c:
        if exists:
            c.execute("DELETE FROM stars WHERE user_id = ? AND society_id = ?", (user["id"], sid))
        else:
            c.execute("INSERT INTO stars (user_id, society_id) VALUES (?, ?)", (user["id"], sid))
    n = conn.execute("SELECT COUNT(*) FROM stars WHERE society_id = ?", (sid,)).fetchone()[0]
    return {"etoile": not exists, "etoiles": n}


def has_star(user: dict | None, sid: str) -> bool:
    if not user:
        return False
    return bool(db.connect().execute("SELECT 1 FROM stars WHERE user_id = ? AND society_id = ?",
                                     (user["id"], sid)).fetchone())


def add_comment(user: dict, cible_type: str, cible_id: str, corps: str) -> dict:
    if cible_type not in ("societe", "proposition", "commit"):
        raise HTTPException(400, "Type de cible inconnu.")
    corps = (corps or "").strip()
    if not corps:
        raise HTTPException(400, "Commentaire vide.")
    with db.transaction() as c:
        cur = c.execute("INSERT INTO comments (cible_type, cible_id, author_id, corps) VALUES (?,?,?,?)",
                        (cible_type, str(cible_id), user["id"], corps[:5000]))
        cid = cur.lastrowid
    return db.row(db.connect().execute(
        "SELECT c.*, u.pseudo AS auteur FROM comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?",
        (cid,)).fetchone())


def list_comments(cible_type: str, cible_id: str) -> list[dict]:
    return db.rows(db.connect().execute(
        "SELECT c.*, u.pseudo AS auteur FROM comments c JOIN users u ON u.id = c.author_id"
        " WHERE c.cible_type = ? AND c.cible_id = ? ORDER BY c.created_at", (cible_type, str(cible_id))))


# ───────────────────────── mise à jour automatique des forks ─────────────────────────
def auto_sync_forks(store) -> dict:
    """Après une nouvelle version de la Société 1.0, met à jour en silence toutes les branches des forks.

    Sans conflit, le Système intègre les évolutions de la loi par un commit automatique. En cas de conflit
    (le fork a modifié une règle que la loi vient aussi de changer), rien n'est imposé : le conflit est
    enregistré et le propriétaire choisit, règle par règle.
    """
    conn = db.connect()
    ref = reference_head()
    ref_commit = get_commit(ref)
    bilan = {"mises_a_jour": 0, "conflits": 0, "deja_a_jour": 0}
    rows_ = conn.execute("SELECT b.society_id, b.nom, b.head FROM branches b JOIN societies s ON s.id = b.society_id "
                         "WHERE s.reference = 0").fetchall()
    for r in rows_:
        sid, branch, head = r["society_id"], r["nom"], r["head"]
        if ref in set(_ancestors(head)):
            bilan["deja_a_jour"] += 1
            with db.transaction() as c:
                c.execute("DELETE FROM synchronisations WHERE society_id = ? AND branche = ?", (sid, branch))
            continue
        base_cid = merge_base(head, ref)
        base = state_of(base_cid) if base_cid else {}
        merged, conflicts = three_way(base, state_of(head), state_of(ref))
        if conflicts:
            for c_ in conflicts:
                rule = store.regles.get(c_["regle"])
                c_["titre"] = rule["titre"] if rule else c_["regle"]
            with db.transaction() as c:
                c.execute("INSERT OR REPLACE INTO synchronisations (society_id, branche, ref_commit, conflits, created_at)"
                          " VALUES (?, ?, ?, ?, datetime('now'))", (sid, branch, ref, db.dumps(conflicts)))
            bilan["conflits"] += 1
            continue
        n = len(diff_states(state_of(head), merged))
        _commit_merged_state(sid, branch, merged, ref_commit["base_snapshot"],
                             f"Mise à jour automatique : la loi a évolué ({n} règle(s) actualisée(s))" if n else
                             "Mise à jour automatique : nouvelle version de la Société 1.0",
                             None, ref, store, systeme=True)
        with db.transaction() as c:
            c.execute("DELETE FROM synchronisations WHERE society_id = ? AND branche = ?", (sid, branch))
        bilan["mises_a_jour"] += 1
    return bilan


def conflits_en_attente(sid: str) -> list[dict]:
    out = []
    for r in db.rows(db.connect().execute("SELECT * FROM synchronisations WHERE society_id = ?", (sid,))):
        r["conflits"] = db.loads(r["conflits"]) or []
        out.append(r)
    return out


# ───────────────────────── provenance des changements ─────────────────────────
def provenance(sid: str, branch: str, regles: set[str], limit: int = 500) -> dict[str, dict]:
    """Pour chaque règle modifiée, le commit le plus récent qui l'a changée (auteur, date, message, justification)."""
    out: dict[str, dict] = {}
    cid = branch_head(sid, branch)
    n = 0
    while cid and n < limit and len(out) < len(regles):
        c = commit_view(cid)
        for ch in c["changes"]:
            rid = ch.get("regle")
            if rid in regles and rid not in out:
                out[rid] = {"commit": c["id"], "auteur": c["auteur"], "auteur_systeme": c["auteur_systeme"],
                            "date": c["created_at"], "message": c["message"], "justification": ch.get("justification") or "",
                            "society_id": c["society_id"]}
        cid = c["parent_id"]
        n += 1
    return out


def log_executions(limit: int = 30) -> list[dict]:
    out = []
    for r in db.rows(db.connect().execute("SELECT * FROM systeme_executions ORDER BY debut DESC LIMIT ?", (limit,))):
        r["resume"] = db.loads(r["resume"]) or {}
        out.append(r)
    return out
