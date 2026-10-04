"""
routers/tickets.py
FastAPI router for Store Tickets & Reservations:
  - POST  /tickets                      (public — customer generates ticket with 30-day expiry)
  - GET   /tickets/{ticket_code}        (public — look up ticket by alphanumeric code)
  - GET   /admin/tickets                (protected — list & filter all tickets, auto-cleans >30d)
  - PATCH /admin/tickets/{id}/status    (protected — change status & adjust stock)
  - DELETE /admin/tickets/{id}          (protected — manually delete ticket & restore stock if needed)
"""

import os
import json
import random
import logging
from typing import Any, Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from services.supabase_service import get_supabase_client, TABLE_NAME_MAP
from routers.admin import _verify_token

logger = logging.getLogger(__name__)

router = APIRouter(tags=["tickets"])

# Code alphabet (omits easily confusable characters like 0, O, 1, I)
CODE_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
TICKET_VALIDITY_DAYS = 30
LOCAL_STORE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "store_tickets_fallback.json",
)


def _generate_ticket_code() -> str:
    """Generate a unique human-friendly alphanumeric ticket code, e.g. SB-7K9W2X."""
    suffix = "".join(random.choices(CODE_CHARS, k=6))
    return f"SB-{suffix}"


# ── Schemas ────────────────────────────────────────────────────────────────────

class CreateTicketRequest(BaseModel):
    total_price: float = Field(..., ge=0)
    build_data: dict[str, Any]
    customer_name: Optional[str] = Field(None, max_length=200)
    customer_phone: Optional[str] = Field(None, max_length=30)
    customer_email: Optional[str] = Field(None, max_length=254)


class UpdateStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(Pending|Reserved|Building|Completed|Cancelled|Expired)$")


# ── Local Fallback Store Helpers ───────────────────────────────────────────────

def _load_local_tickets() -> list[dict[str, Any]]:
    if not os.path.exists(LOCAL_STORE_PATH):
        return []
    try:
        with open(LOCAL_STORE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error reading local tickets store: {e}")
        return []


def _save_local_tickets(tickets: list[dict[str, Any]]):
    os.makedirs(os.path.dirname(LOCAL_STORE_PATH), exist_ok=True)
    try:
        with open(LOCAL_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(tickets, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error saving local tickets store: {e}")


# ── Stock Adjustment Helper ───────────────────────────────────────────────────

def _adjust_build_stock(build_data: dict[str, Any], delta: int):
    """
    Adjusts the stock count for each component in build_data by delta (+1 or -1)
    in the Supabase inventory tables.
    """
    client = get_supabase_client()
    if client is None:
        logger.warning("[Stock Adjust] Supabase not connected. Skipping DB stock adjustment.")
        return

    # Categories to inspect
    component_keys = [
        "cpu", "gpu", "ram", "storage", "motherboard",
        "psu", "case", "cpu_cooler", "case_fan"
    ]

    for key in component_keys:
        item_entry = build_data.get(key)
        if not item_entry:
            continue

        # Extract component dict (handles {main: {...}} or flat dict)
        comp_dict = item_entry.get("main") if isinstance(item_entry, dict) and "main" in item_entry else item_entry
        if not isinstance(comp_dict, dict):
            continue

        item_id = comp_dict.get("id")
        item_name = comp_dict.get("name")
        candidate_tables = TABLE_NAME_MAP.get(key, [key])
        table_name = candidate_tables[0]

        try:
            query = client.table(table_name).select("id, name, stock")
            if item_id:
                query = query.eq("id", str(item_id))
            elif item_name:
                query = query.eq("name", str(item_name))
            else:
                continue

            resp = query.limit(1).execute()
            if resp.data:
                row = resp.data[0]
                current_stock = int(row.get("stock") or 0)
                new_stock = max(0, current_stock + delta)
                client.table(table_name).update({"stock": new_stock}).eq("id", row["id"]).execute()
                logger.info(f"[Stock Adjust] Updated '{row.get('name')}' in '{table_name}': {current_stock} -> {new_stock} (delta={delta:+d})")
        except Exception as e:
            logger.error(f"[Stock Adjust Error] Failed updating stock for '{key}': {e}")


# ── Auto-Expiry Cleanup ────────────────────────────────────────────────────────

def cleanup_expired_tickets() -> int:
    """
    Finds tickets older than 30 days that are not 'Completed', restores any deducted
    stock, and deletes them from the system. Returns the count of deleted tickets.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    client = get_supabase_client()
    deleted_count = 0

    if client is not None:
        try:
            # Query non-completed tickets where expires_at < now
            resp = client.table("store_tickets").select("*") \
                .neq("status", "Completed") \
                .lt("expires_at", now_iso) \
                .execute()
            expired = resp.data or []

            for ticket in expired:
                if ticket.get("is_stock_deducted"):
                    logger.info(f"[Auto-Expire] Restoring stock for expired ticket: {ticket.get('ticket_code')}")
                    _adjust_build_stock(ticket.get("build_data") or {}, delta=+1)
                client.table("store_tickets").delete().eq("id", ticket["id"]).execute()
                deleted_count += 1
                logger.info(f"[Auto-Expire] Deleted 30-day expired ticket: {ticket.get('ticket_code')}")
        except Exception as e:
            logger.warning(f"[Auto-Expire] Supabase cleanup query failed: {e}")

    # Also clean local store fallback if present
    local_tickets = _load_local_tickets()
    now_dt = datetime.now(timezone.utc)
    remaining_local = []
    for t in local_tickets:
        exp_str = t.get("expires_at")
        try:
            exp_dt = datetime.fromisoformat(exp_str) if exp_str else now_dt + timedelta(days=1)
        except Exception:
            exp_dt = now_dt + timedelta(days=1)

        if t.get("status") != "Completed" and exp_dt < now_dt:
            if t.get("is_stock_deducted"):
                _adjust_build_stock(t.get("build_data") or {}, delta=+1)
            deleted_count += 1
        else:
            remaining_local.append(t)

    if len(remaining_local) != len(local_tickets):
        _save_local_tickets(remaining_local)

    return deleted_count


# ── Customer Endpoints ─────────────────────────────────────────────────────────

@router.post("/tickets", status_code=201)
def create_ticket(body: CreateTicketRequest):
    """
    Creates a new store reservation ticket for a generated PC build.
    Generates a unique ticket code with a strict 30-day expiration.
    """
    cleanup_expired_tickets()

    ticket_code = _generate_ticket_code()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=TICKET_VALIDITY_DAYS)

    ticket_record = {
        "ticket_code":         ticket_code,
        "total_price":         round(body.total_price, 2),
        "build_data":          body.build_data,
        "customer_name":       body.customer_name or None,
        "customer_phone":      body.customer_phone or None,
        "customer_email":      body.customer_email or None,
        "status":              "Pending",
        "is_stock_deducted":   False,
        "created_at":          now.isoformat(),
        "expires_at":          expires_at.isoformat(),
        "updated_at":          now.isoformat(),
    }

    client = get_supabase_client()
    saved_in_db = False

    if client is not None:
        try:
            resp = client.table("store_tickets").insert(ticket_record).execute()
            if resp.data:
                saved_in_db = True
                ticket_record["id"] = resp.data[0].get("id")
        except Exception as e:
            logger.warning(f"Could not insert ticket to Supabase table 'store_tickets': {e}. Falling back to local storage.")

    if not saved_in_db:
        # Fallback to local store
        import uuid
        ticket_record["id"] = str(uuid.uuid4())
        tickets = _load_local_tickets()
        tickets.append(ticket_record)
        _save_local_tickets(tickets)

    return {
        "success":     True,
        "ticket_code": ticket_code,
        "id":          ticket_record["id"],
        "total_price": ticket_record["total_price"],
        "status":      ticket_record["status"],
        "expires_at":  ticket_record["expires_at"],
        "valid_days":  TICKET_VALIDITY_DAYS,
        "message":     f"Store ticket generated! Present code '{ticket_code}' at the store within {TICKET_VALIDITY_DAYS} days.",
    }


@router.get("/tickets/{ticket_code}")
def get_ticket(ticket_code: str):
    """Fetch ticket details by alphanumeric code."""
    cleanup_expired_tickets()
    code_normalized = ticket_code.strip().upper()

    client = get_supabase_client()
    if client is not None:
        try:
            resp = client.table("store_tickets").select("*").eq("ticket_code", code_normalized).limit(1).execute()
            if resp.data:
                return resp.data[0]
        except Exception as e:
            logger.warning(f"Failed to lookup ticket in Supabase: {e}")

    # Fallback lookup
    for t in _load_local_tickets():
        if t.get("ticket_code", "").upper() == code_normalized:
            return t

    raise HTTPException(status_code=404, detail="Store ticket not found or has expired.")


# ── Admin Endpoints (Protected) ────────────────────────────────────────────────

@router.get("/admin/tickets")
def list_tickets(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    username: str = Depends(_verify_token),
):
    """
    List all store tickets for the admin with auto-expiry cleanup and search/filter.
    """
    cleanup_expired_tickets()

    client = get_supabase_client()
    if client is not None:
        try:
            query = client.table("store_tickets").select("*", count="exact")
            if status and status != "All":
                query = query.eq("status", status)
            if q:
                # PostgREST ilike on ticket_code or customer_name
                query = query.or_(f"ticket_code.ilike.%{q}%,customer_name.ilike.%{q}%,customer_phone.ilike.%{q}%")

            offset = (page - 1) * page_size
            resp = query.order("created_at", desc=True).range(offset, offset + page_size - 1).execute()
            total = resp.count if resp.count is not None else len(resp.data or [])

            # Compute counts by status
            all_resp = client.table("store_tickets").select("status").execute()
            status_counts: dict[str, int] = {}
            for row in (all_resp.data or []):
                s = row.get("status", "Pending")
                status_counts[s] = status_counts.get(s, 0) + 1

            return {
                "data":          resp.data or [],
                "total":         total,
                "page":          page,
                "page_size":     page_size,
                "pages":         max(1, -(-total // page_size)),
                "status_counts": status_counts,
            }
        except Exception as e:
            logger.warning(f"Admin list_tickets Supabase error: {e}. Reading fallback store.")

    # Fallback to local store
    all_tickets = _load_local_tickets()
    # Sort descending
    all_tickets.sort(key=lambda t: t.get("created_at", ""), reverse=True)

    # Filter
    filtered = all_tickets
    if status and status != "All":
        filtered = [t for t in filtered if t.get("status") == status]
    if q:
        q_lower = q.lower()
        filtered = [
            t for t in filtered
            if q_lower in t.get("ticket_code", "").lower()
            or q_lower in t.get("customer_name", "").lower()
            or q_lower in (t.get("customer_phone") or "").lower()
        ]

    total = len(filtered)
    offset = (page - 1) * page_size
    page_data = filtered[offset : offset + page_size]

    status_counts = {}
    for t in all_tickets:
        s = t.get("status", "Pending")
        status_counts[s] = status_counts.get(s, 0) + 1

    return {
        "data":          page_data,
        "total":         total,
        "page":          page,
        "page_size":     page_size,
        "pages":         max(1, -(-total // page_size)),
        "status_counts": status_counts,
    }


@router.patch("/admin/tickets/{ticket_id}/status")
def update_ticket_status(
    ticket_id: str,
    body: UpdateStatusRequest,
    username: str = Depends(_verify_token),
):
    """
    Updates ticket status and automatically performs inventory stock deductions:
    - Status -> Reserved / Building / Completed: Deducts 1 unit from stock for each component.
    - Status -> Cancelled / Expired: Restores 1 unit back to stock if previously deducted.
    """
    new_status = body.status
    client = get_supabase_client()
    ticket = None
    is_supabase = False

    if client is not None:
        try:
            resp = client.table("store_tickets").select("*").eq("id", ticket_id).limit(1).execute()
            if resp.data:
                ticket = resp.data[0]
                is_supabase = True
        except Exception as e:
            logger.warning(f"Error fetching ticket {ticket_id} from Supabase: {e}")

    if ticket is None:
        # Check fallback
        for t in _load_local_tickets():
            if str(t.get("id")) == str(ticket_id):
                ticket = t
                break

    if ticket is None:
        raise HTTPException(status_code=404, detail="Store ticket not found.")

    was_deducted = bool(ticket.get("is_stock_deducted"))
    build_data = ticket.get("build_data") or {}
    stock_action_msg = "No stock changes."

    # ── Stock deduction rule ───────────────────────────────────────────────────
    # If moving to Reserved / Building / Completed AND stock was NOT deducted yet -> deduct 1
    if new_status in ("Reserved", "Building", "Completed") and not was_deducted:
        _adjust_build_stock(build_data, delta=-1)
        ticket["is_stock_deducted"] = True
        stock_action_msg = "Stock decreased by 1 for all parts in the build."

    # If moving to Cancelled / Expired AND stock WAS previously deducted -> restore 1
    elif new_status in ("Cancelled", "Expired") and was_deducted:
        _adjust_build_stock(build_data, delta=+1)
        ticket["is_stock_deducted"] = False
        stock_action_msg = "Stock restored (+1) for all parts in the build."

    ticket["status"] = new_status
    ticket["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Save update
    if is_supabase and client is not None:
        try:
            client.table("store_tickets").update({
                "status":            ticket["status"],
                "is_stock_deducted": ticket["is_stock_deducted"],
                "updated_at":        ticket["updated_at"],
            }).eq("id", ticket_id).execute()
        except Exception as e:
            logger.error(f"Failed updating ticket status in Supabase: {e}")
            raise HTTPException(status_code=500, detail="Database update failed.")
    else:
        all_t = _load_local_tickets()
        for idx, item in enumerate(all_t):
            if str(item.get("id")) == str(ticket_id):
                all_t[idx] = ticket
                break
        _save_local_tickets(all_t)

    return {
        "success":           True,
        "id":                ticket_id,
        "ticket_code":       ticket.get("ticket_code"),
        "status":            ticket["status"],
        "is_stock_deducted": ticket["is_stock_deducted"],
        "message":           f"Ticket {ticket.get('ticket_code')} status updated to {new_status}. {stock_action_msg}",
    }


@router.delete("/admin/tickets/{ticket_id}")
def delete_ticket(
    ticket_id: str,
    username: str = Depends(_verify_token),
):
    """
    Manually deletes a store ticket. If stock was deducted, it restores it (+1) before deletion.
    """
    client = get_supabase_client()
    ticket = None
    is_supabase = False

    if client is not None:
        try:
            resp = client.table("store_tickets").select("*").eq("id", ticket_id).limit(1).execute()
            if resp.data:
                ticket = resp.data[0]
                is_supabase = True
        except Exception:
            pass

    if ticket is None:
        for t in _load_local_tickets():
            if str(t.get("id")) == str(ticket_id):
                ticket = t
                break

    if ticket is None:
        raise HTTPException(status_code=404, detail="Store ticket not found.")

    # If stock was deducted and status is not Completed, restore stock
    if ticket.get("is_stock_deducted") and ticket.get("status") != "Completed":
        _adjust_build_stock(ticket.get("build_data") or {}, delta=+1)

    if is_supabase and client is not None:
        client.table("store_tickets").delete().eq("id", ticket_id).execute()
    else:
        all_t = _load_local_tickets()
        all_t = [t for t in all_t if str(t.get("id")) != str(ticket_id)]
        _save_local_tickets(all_t)

    return {"deleted": True, "id": ticket_id, "ticket_code": ticket.get("ticket_code")}
