"""
services/admin_seeder.py
Runs once on startup to ensure at least one admin account exists in Supabase.
Creates a default admin (username: "admin", password: "smartbuild2025") if the
admins table is empty. Never overwrites an existing account.
"""

import logging
import bcrypt
from services.supabase_service import get_supabase_client

logger = logging.getLogger(__name__)

DEFAULT_USERNAME = "admin"
DEFAULT_PASSWORD = "smartbuild2025"


def run_seeder() -> None:
    """Check for an existing admin account; seed a default one if none found."""
    client = get_supabase_client()
    if client is None:
        logger.warning("[Seeder] Supabase client unavailable — skipping admin seed.")
        return

    try:
        response = client.table("admins").select("id").limit(1).execute()
        existing = response.data or []

        if existing:
            logger.info("[Seeder] Admin account already exists — no seeding needed.")
            return

        # No admin found — insert default
        hashed = bcrypt.hashpw(DEFAULT_PASSWORD.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        try:
            client.table("admins").insert({
                "username": DEFAULT_USERNAME,
                "password": hashed,
            }).execute()
        except Exception:
            client.table("admins").insert({
                "username": DEFAULT_USERNAME,
                "password_hash": hashed,
            }).execute()

        logger.info(
            f"[Seeder] Default admin account created. "
            f"Username: '{DEFAULT_USERNAME}' — CHANGE THIS PASSWORD AFTER FIRST LOGIN."
        )

    except Exception as e:
        if "row-level security" in str(e).lower():
            logger.warning(
                "[Seeder] Could not auto-seed admin account due to Supabase Row-Level Security (RLS). "
                "Please run backend/migrations/admins_table.sql in your Supabase SQL Editor to allow access."
            )
        else:
            logger.error(f"[Seeder] Failed to seed admin account: {e}")
