"""
services/keepalive.py

Runs a lightweight background thread that pings Supabase every N minutes
to prevent the free-tier database from going inactive between requests.

The ping is a minimal SELECT (fetches 1 row from the smallest table) so it
produces virtually no load on the database. If Supabase is not configured the
thread exits immediately — no-op for local/CSV fallback mode.

Usage (called once from main.py startup):
    from services.keepalive import start_keepalive
    start_keepalive()
"""

import logging
import threading
import time

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────
_PING_INTERVAL_SECONDS = 4 * 60   # 4 minutes — well under Supabase's ~5-min idle timeout
_PING_TABLE            = "CPU"     # Smallest / most reliable table; only fetches 1 row
_PING_LIMIT            = 1        # Minimal query — just prove the connection is alive

_keepalive_thread: threading.Thread | None = None
_stop_event = threading.Event()


# ── Core ping function ─────────────────────────────────────────────────────────
def _ping_supabase() -> bool:
    """
    Execute a minimal SELECT on Supabase. Returns True on success, False on failure.
    Falls back gracefully — never raises.
    """
    try:
        from services.supabase_service import get_supabase_client
        client = get_supabase_client()
        if client is None:
            return False  # Not configured — skip silently

        response = client.table(_PING_TABLE).select("id").limit(_PING_LIMIT).execute()
        # Any non-exception response counts as success
        return True
    except Exception as e:
        logger.warning(f"[KeepAlive] Ping failed: {e}")
        return False


# ── Background thread ──────────────────────────────────────────────────────────
def _keepalive_loop():
    """
    Thread target: pings Supabase on startup, then every _PING_INTERVAL_SECONDS.
    Stops cleanly when _stop_event is set (e.g. on server shutdown).
    """
    from services.supabase_service import is_supabase_configured

    if not is_supabase_configured():
        logger.info("[KeepAlive] Supabase not configured — keep-alive thread exiting.")
        return

    logger.info(
        f"[KeepAlive] Started. Pinging Supabase every {_PING_INTERVAL_SECONDS // 60} minute(s)."
    )

    while not _stop_event.is_set():
        ok = _ping_supabase()
        status = "OK" if ok else "FAILED"
        logger.debug(f"[KeepAlive] Ping → {status}")

        # Wait for next interval, but wake immediately if stop is requested
        _stop_event.wait(timeout=_PING_INTERVAL_SECONDS)

    logger.info("[KeepAlive] Thread stopped.")


# ── Public API ─────────────────────────────────────────────────────────────────
def start_keepalive():
    """
    Launches the keep-alive background thread (daemon so it won't block shutdown).
    Safe to call multiple times — only one thread is ever started.
    """
    global _keepalive_thread

    if _keepalive_thread is not None and _keepalive_thread.is_alive():
        logger.debug("[KeepAlive] Thread already running — skipping.")
        return

    _stop_event.clear()
    _keepalive_thread = threading.Thread(
        target=_keepalive_loop,
        name="supabase-keepalive",
        daemon=True,   # Dies with the main process automatically
    )
    _keepalive_thread.start()


def stop_keepalive():
    """
    Signals the keep-alive thread to stop. Used for graceful shutdown.
    Typically not needed since the thread is a daemon, but useful in tests.
    """
    _stop_event.set()
    if _keepalive_thread is not None:
        _keepalive_thread.join(timeout=5)
