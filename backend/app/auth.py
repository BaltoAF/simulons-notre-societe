"""Comptes utilisateurs.

Principe : on peut TOUT tester sans compte ; il faut être identifié pour PROPOSER (créer un fork,
committer, ouvrir une proposition, commenter). L'identification par FranceConnect pourra remplacer
ou compléter le couple pseudo / mot de passe (champ identite_verifiee).
"""
from __future__ import annotations

import base64
import datetime as dt
import hashlib
import hmac
import re
import secrets

from fastapi import Depends, Header, HTTPException, Request

from . import db
from .config import SESSION_DAYS

PSEUDO_RE = re.compile(r"^[A-Za-z0-9_\-\.]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    h = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
    return "scrypt$" + base64.b64encode(salt).decode() + "$" + base64.b64encode(h).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        _, salt_b64, h_b64 = stored.split("$")
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(h_b64)
        h = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)
        return hmac.compare_digest(h, expected)
    except Exception:
        return False


def public_user(u: dict | None) -> dict | None:
    if not u:
        return None
    return {"id": u["id"], "pseudo": u["pseudo"], "identite_verifiee": bool(u["identite_verifiee"]),
            "created_at": u["created_at"]}


def register(pseudo: str, email: str, password: str) -> tuple[dict, str]:
    pseudo, email = pseudo.strip(), email.strip().lower()
    if not PSEUDO_RE.match(pseudo):
        raise HTTPException(400, "Pseudo invalide : 3 à 30 caractères (lettres, chiffres, _ - .).")
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Adresse e-mail invalide.")
    if len(password) < 8:
        raise HTTPException(400, "Le mot de passe doit faire au moins 8 caractères.")
    conn = db.connect()
    if conn.execute("SELECT 1 FROM users WHERE pseudo = ? OR email = ?", (pseudo, email)).fetchone():
        raise HTTPException(409, "Ce pseudo ou cette adresse e-mail est déjà utilisé.")
    with db.transaction() as c:
        cur = c.execute("INSERT INTO users (pseudo, email, password_hash) VALUES (?, ?, ?)",
                        (pseudo, email, hash_password(password)))
        uid = cur.lastrowid
    user = db.row(conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone())
    return public_user(user), create_session(uid)


def login(identifiant: str, password: str) -> tuple[dict, str]:
    conn = db.connect()
    u = db.row(conn.execute("SELECT * FROM users WHERE pseudo = ? OR email = ?",
                            (identifiant.strip(), identifiant.strip().lower())).fetchone())
    if not u or not verify_password(password, u["password_hash"]):
        raise HTTPException(401, "Identifiant ou mot de passe incorrect.")
    return public_user(u), create_session(u["id"])


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires = (dt.datetime.utcnow() + dt.timedelta(days=SESSION_DAYS)).isoformat(timespec="seconds")
    with db.transaction() as c:
        c.execute("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", (token, user_id, expires))
    return token


def logout(token: str):
    with db.transaction() as c:
        c.execute("DELETE FROM sessions WHERE token = ?", (token,))


def _token_from(request: Request, authorization: str | None) -> str | None:
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return request.cookies.get("societe_session")


def current_user(request: Request, authorization: str | None = Header(default=None)) -> dict | None:
    token = _token_from(request, authorization)
    if not token:
        return None
    conn = db.connect()
    r = conn.execute(
        "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?",
        (token, dt.datetime.utcnow().isoformat(timespec="seconds"))).fetchone()
    return db.row(r)


def require_user(user: dict | None = Depends(current_user)) -> dict:
    if not user:
        raise HTTPException(401, "Identifiez-vous pour proposer des changements (tester reste libre, sans compte).")
    return user
