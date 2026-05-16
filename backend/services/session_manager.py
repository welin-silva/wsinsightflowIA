"""
SessionManager — persistent, file-backed session store.

Each session is saved as an individual pickle file under
  backend/storage/sessions/<session_id>.pkl

Sessions survive uvicorn --reload, process restarts, and server crashes
because they are written to disk on every mutation.

Public API
----------
SessionManager.create(session_id, payload)  → None
SessionManager.get(session_id)              → dict | None
SessionManager.update(session_id, **fields) → bool
SessionManager.exists(session_id)           → bool
SessionManager.delete(session_id)           → bool
SessionManager.list_ids()                   → list[str]
"""

import os
import re
import pickle
import logging
import threading
from pathlib import Path

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.IGNORECASE)

logger = logging.getLogger(__name__)

_STORAGE_DIR = Path(__file__).parent.parent / "storage" / "sessions"
_STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# In-memory cache so hot reads never touch disk
_cache: dict[str, dict] = {}
_lock = threading.Lock()


def _session_path(session_id: str) -> Path:
    if not _UUID_RE.match(session_id):
        raise ValueError(f"Invalid session_id format: {session_id!r}")
    return _STORAGE_DIR / f"{session_id}.pkl"


def _load_all() -> None:
    """Called once at import time — loads every .pkl in storage into cache."""
    loaded = 0
    for pkl_file in _STORAGE_DIR.glob("*.pkl"):
        try:
            with open(pkl_file, "rb") as f:
                session = pickle.load(f)
            sid = pkl_file.stem
            _cache[sid] = session
            loaded += 1
        except Exception as e:
            logger.warning("[SessionManager] Could not load %s: %s", pkl_file.name, e)
    if loaded:
        logger.info("[SessionManager] Restored %d session(s) from disk.", loaded)


def _write(session_id: str, session: dict) -> None:
    """Persist a single session to disk (called under lock)."""
    try:
        path = _session_path(session_id)
        tmp = path.with_suffix(".tmp")
        with open(tmp, "wb") as f:
            pickle.dump(session, f, protocol=pickle.HIGHEST_PROTOCOL)
        tmp.replace(path)  # atomic rename
    except Exception as e:
        logger.error("[SessionManager] Failed to persist session %s: %s", session_id[:8], e)


# ── Public API ──────────────────────────────────────────────────────────────

def create(session_id: str, payload: dict) -> None:
    """Store a new session both in memory and on disk."""
    with _lock:
        _cache[session_id] = payload
        _write(session_id, payload)
    logger.info("[SessionManager] Created session %s...", session_id[:8])


def get(session_id: str) -> dict | None:
    """Return session dict or None if not found."""
    with _lock:
        session = _cache.get(session_id)
        if session is None:
            # Last-resort: try disk (handles edge cases where cache was cleared)
            path = _session_path(session_id)
            if path.exists():
                try:
                    with open(path, "rb") as f:
                        session = pickle.load(f)
                    _cache[session_id] = session
                    logger.info("[SessionManager] Reloaded session %s... from disk.", session_id[:8])
                except Exception as e:
                    logger.error("[SessionManager] Disk reload failed for %s: %s", session_id[:8], e)
        return session


def update(session_id: str, **fields) -> bool:
    """Update specific fields in an existing session. Returns False if not found."""
    with _lock:
        session = _cache.get(session_id)
        if session is None:
            return False
        session.update(fields)
        _write(session_id, session)
    logger.info("[SessionManager] Updated session %s... fields=%s", session_id[:8], list(fields.keys()))
    return True


def exists(session_id: str) -> bool:
    with _lock:
        if session_id in _cache:
            return True
        return _session_path(session_id).exists()


def delete(session_id: str) -> bool:
    with _lock:
        _cache.pop(session_id, None)
        path = _session_path(session_id)
        if path.exists():
            path.unlink()
            return True
    return False


def list_ids() -> list:
    with _lock:
        return list(_cache.keys())


# Load all persisted sessions on module import
_load_all()
