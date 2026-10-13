"""Stockage SQLite : comptes, sociétés (forks), branches, commits, propositions, discussions."""
from __future__ import annotations

import json
import sqlite3
import threading
from contextlib import contextmanager

from .config import DB_PATH

SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pseudo TEXT NOT NULL UNIQUE COLLATE NOCASE,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    identite_verifiee INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
);

-- Instantanés de la Société 1.0 (valeurs de toutes les règles), adressés par leur hash.
CREATE TABLE IF NOT EXISTS snapshots (
    hash TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS societies (
    id TEXT PRIMARY KEY,
    nom TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_id INTEGER REFERENCES users(id),
    parent_id TEXT REFERENCES societies(id),
    parent_commit TEXT,
    visibilite TEXT NOT NULL DEFAULT 'publique',
    reference INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commits (
    id TEXT PRIMARY KEY,
    society_id TEXT NOT NULL REFERENCES societies(id),
    parent_id TEXT REFERENCES commits(id),
    second_parent_id TEXT REFERENCES commits(id),
    author_id INTEGER REFERENCES users(id),
    auteur_systeme INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL,
    base_snapshot TEXT NOT NULL REFERENCES snapshots(hash),
    overrides TEXT NOT NULL,      -- état complet : règle -> valeur, par rapport à base_snapshot
    changes TEXT NOT NULL,        -- différences avec le parent : [{regle, avant, apres, justification, sources}]
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
    society_id TEXT NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
    nom TEXT NOT NULL,
    head TEXT NOT NULL REFERENCES commits(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (society_id, nom)
);

CREATE TABLE IF NOT EXISTS proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_society TEXT NOT NULL REFERENCES societies(id),
    source_branch TEXT NOT NULL,
    target_society TEXT NOT NULL REFERENCES societies(id),
    target_branch TEXT NOT NULL,
    titre TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    author_id INTEGER NOT NULL REFERENCES users(id),
    statut TEXT NOT NULL DEFAULT 'ouverte',   -- ouverte | fusionnee | fermee
    merge_commit TEXT REFERENCES commits(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cible_type TEXT NOT NULL,     -- societe | proposition | commit
    cible_id TEXT NOT NULL,
    author_id INTEGER NOT NULL REFERENCES users(id),
    corps TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stars (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    society_id TEXT NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, society_id)
);

-- Conflits rencontrés lors de la mise à jour automatique d'un fork (la loi a changé une règle que le fork modifie aussi).
CREATE TABLE IF NOT EXISTS synchronisations (
    society_id TEXT NOT NULL REFERENCES societies(id) ON DELETE CASCADE,
    branche TEXT NOT NULL,
    ref_commit TEXT NOT NULL,
    conflits TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (society_id, branche)
);

-- Journal des exécutions du Système (mise à jour quotidienne).
CREATE TABLE IF NOT EXISTS systeme_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debut TEXT NOT NULL,
    fin TEXT,
    statut TEXT NOT NULL,          -- en_cours | succes | echec
    declencheur TEXT NOT NULL,     -- planifie | rattrapage | manuel | modele_modifie
    resume TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_commits_society ON commits(society_id);
CREATE INDEX IF NOT EXISTS idx_comments_cible ON comments(cible_type, cible_id);
CREATE INDEX IF NOT EXISTS idx_proposals_target ON proposals(target_society, statut);
"""

_local = threading.local()


def connect() -> sqlite3.Connection:
    conn = getattr(_local, "conn", None)
    if conn is None:
        conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        _local.conn = conn
    return conn


def init_db():
    conn = connect()
    conn.executescript(SCHEMA)
    conn.commit()


@contextmanager
def transaction():
    conn = connect()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def row(r: sqlite3.Row | None) -> dict | None:
    return dict(r) if r is not None else None


def rows(rs) -> list[dict]:
    return [dict(r) for r in rs]


def dumps(x) -> str:
    return json.dumps(x, ensure_ascii=False, sort_keys=True, default=str)


def loads(s: str):
    return json.loads(s) if s else None
