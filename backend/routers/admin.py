"""
routers/admin.py
FastAPI router for all admin operations:
  - POST /admin/auth/login           (public)
  - GET  /admin/categories           (protected)
  - GET  /admin/components/{cat}     (protected)
  - POST /admin/components/{cat}     (protected)
  - PUT  /admin/components/{cat}/{id}(protected)
  - DELETE /admin/components/{cat}/{id} (protected)
"""

import os
import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import bcrypt
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel

from services.supabase_service import get_supabase_client, TABLE_NAME_MAP
from services.recommender import trigger_recalculate_min_budget

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/admin", tags=["admin"])

# ── Auth config ────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("ADMIN_JWT_SECRET", "smartbuild-admin-secret-key-change-in-production")
ALGORITHM  = "HS256"
TOKEN_EXPIRE_HOURS = 24

bearer_scheme = HTTPBearer()

# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_table(category: str) -> str:
    """Return the actual Supabase table name for a component category key."""
    if category not in TABLE_NAME_MAP:
        raise HTTPException(status_code=404, detail=f"Unknown category: '{category}'")
    return TABLE_NAME_MAP[category][0]   # First name in the list is the canonical table name


def _create_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": username, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def _verify_token(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token payload.")
        return username
    except JWTError:
        raise HTTPException(status_code=401, detail="Token is invalid or expired.")


# ── Schemas ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


# ── Auth routes ────────────────────────────────────────────────────────────────

@router.post("/auth/login")
def login(body: LoginRequest):
    """Verify admin credentials and return a JWT."""
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    try:
        resp = client.table("admins").select("*").eq("username", body.username).limit(1).execute()
    except Exception as e:
        logger.error(f"[Admin] Login DB error: {e}")
        raise HTTPException(status_code=503, detail="Database error during login.")

    rows = resp.data or []
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    admin = rows[0]
    stored_pw = str(admin.get("password") or admin.get("password_hash") or "")

    # Check if stored_pw is a bcrypt hash (starts with $2a$, $2b$, $2y$)
    is_bcrypt = stored_pw.startswith(("$2a$", "$2b$", "$2y$"))

    match = False
    if is_bcrypt:
        try:
            match = bcrypt.checkpw(body.password.encode("utf-8"), stored_pw.encode("utf-8"))
        except Exception:
            match = False
    else:
        # Support plain-text passwords (e.g. manually entered in Supabase Table Editor)
        match = (body.password == stored_pw)
        if match:
            try:
                new_hash = bcrypt.hashpw(body.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
                col_name = "password" if "password" in admin else "password_hash"
                client.table("admins").update({col_name: new_hash}).eq("id", admin["id"]).execute()
                logger.info(f"[Admin] Upgraded password to bcrypt hash for user '{admin.get('username')}'")
            except Exception as e:
                logger.warning(f"[Admin] Failed auto-upgrade of plain-text password: {e}")

    if not match:
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    token = _create_token(admin["username"])
    return {"access_token": token, "token_type": "bearer", "username": admin["username"]}


# ── Category overview ──────────────────────────────────────────────────────────

@router.get("/categories")
def get_categories(username: str = Depends(_verify_token)):
    """Return all categories with their row counts."""
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    result: list[dict] = []
    for key, names in TABLE_NAME_MAP.items():
        table_name = names[0]
        try:
            resp = client.table(table_name).select("id", count="exact").limit(1).execute()
            count = resp.count if resp.count is not None else 0
        except Exception:
            count = 0
        result.append({"key": key, "label": table_name, "count": count})

    return {"categories": result}


# ── Component CRUD ─────────────────────────────────────────────────────────────

@router.get("/components/{category}")
def list_components(
    category: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    q: str = Query("", description="Search term filtered against 'name' column"),
    username: str = Depends(_verify_token),
):
    """Return paginated rows for a component category."""
    table_name = _resolve_table(category)
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    offset = (page - 1) * page_size
    try:
        query = client.table(table_name).select("*", count="exact")
        if q:
            query = query.ilike("name", f"%{q}%")
        resp = query.range(offset, offset + page_size - 1).execute()
    except Exception as e:
        logger.error(f"[Admin] list_components error for '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

    total = resp.count if resp.count is not None else len(resp.data or [])
    return {
        "data":      resp.data or [],
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, -(-total // page_size)),  # ceiling division
    }


@router.post("/components/{category}", status_code=201)
def create_component(
    category: str,
    body: dict[str, Any],
    background_tasks: BackgroundTasks,
    username: str = Depends(_verify_token),
):
    """Insert a new component row and trigger min budget recalculation."""
    table_name = _resolve_table(category)
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    # Strip system fields the caller shouldn't set
    for field in ("id", "created_at"):
        body.pop(field, None)

    try:
        resp = client.table(table_name).insert(body).execute()
    except Exception as e:
        logger.error(f"[Admin] create_component error for '{table_name}': {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Schedule background recalculation of minimum compatible budget
    background_tasks.add_task(trigger_recalculate_min_budget)

    return {"created": resp.data[0] if resp.data else body}


@router.put("/components/{category}/{row_id}")
def update_component(
    category: str,
    row_id: str,
    body: dict[str, Any],
    background_tasks: BackgroundTasks,
    username: str = Depends(_verify_token),
):
    """Update an existing component row by id and trigger min budget recalculation."""
    table_name = _resolve_table(category)
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    for field in ("id", "created_at"):
        body.pop(field, None)

    try:
        resp = client.table(table_name).update(body).eq("id", row_id).execute()
    except Exception as e:
        logger.error(f"[Admin] update_component error for '{table_name}' id={row_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    if not resp.data:
        raise HTTPException(status_code=404, detail="Row not found or no changes made.")

    # Schedule background recalculation of minimum compatible budget
    background_tasks.add_task(trigger_recalculate_min_budget)

    return {"updated": resp.data[0]}


@router.delete("/components/{category}/{row_id}", status_code=200)
def delete_component(
    category: str,
    row_id: str,
    background_tasks: BackgroundTasks,
    username: str = Depends(_verify_token),
):
    """Delete a component row by id and trigger min budget recalculation."""
    table_name = _resolve_table(category)
    client = get_supabase_client()
    if client is None:
        raise HTTPException(status_code=503, detail="Database unavailable.")

    try:
        resp = client.table(table_name).delete().eq("id", row_id).execute()
    except Exception as e:
        logger.error(f"[Admin] delete_component error for '{table_name}' id={row_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

    # Schedule background recalculation of minimum compatible budget
    background_tasks.add_task(trigger_recalculate_min_budget)

    return {"deleted": True, "id": row_id}


@router.post("/recalculate-min-budget")
def admin_recalculate_min_budget(
    background_tasks: BackgroundTasks,
    username: str = Depends(_verify_token),
):
    """Admin endpoint to manually trigger minimum compatible budget recalculation."""
    background_tasks.add_task(trigger_recalculate_min_budget)
    return {"status": "recalculating", "message": "Minimum budget recalculation started in background."}

