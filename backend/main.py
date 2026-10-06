from fastapi import FastAPI, HTTPException, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware

from schemas.user_input import UserInput, CategoryOptionsRequest, FinalizeBuildRequest
from config import (
    ACTIVITY_WEIGHTS,
    RESOLUTION_TARGET_WEIGHTS,
    ACTIVITY_SUBCATEGORIES,
    VALID_SUBCATEGORIES,
    VALID_COOLING_PREFERENCES,
)
from services.recommender import (
    generate_build as recommender_generate_build,
    get_cheapest_compatible_build,
    trigger_recalculate_min_budget,
)
from services.builder_service import (
    get_builder_options,
    finalize_custom_build,
)
from services.keepalive import start_keepalive
from routers.admin import router as admin_router
from routers.tickets import router as tickets_router, cleanup_expired_tickets
from services.admin_seeder import run_seeder

VALID_ACTIVITIES = list(ACTIVITY_WEIGHTS.keys())
VALID_RESOLUTION_TARGETS = list(RESOLUTION_TARGET_WEIGHTS.keys())

app = FastAPI(
    title="SmartBuild API",
    description="AI-powered PC build recommender using intent-weighted component scoring.",
    version="2.0.0",
)

# CORS must be registered BEFORE routers so error responses (4xx/5xx) also
# carry the Access-Control-Allow-Origin header and the browser can read them.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://smart-build-private.vercel.app",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


app.include_router(admin_router)
app.include_router(tickets_router)


@app.on_event("startup")
def startup_event():
    """Pre-warm dataset, ML models, and clean up expired tickets on boot."""
    # Seed default admin account if none exists
    try:
        run_seeder()
    except Exception as e:
        print(f"[Warning] Admin seeder failed: {e}")

    # Clean up any store tickets past 30 days
    try:
        cleaned = cleanup_expired_tickets()
        if cleaned > 0:
            print(f"[Tickets] Cleaned up {cleaned} expired tickets on startup.")
    except Exception as e:
        print(f"[Warning] Ticket cleanup failed on startup: {e}")

    # Pre-warm recommendation pipeline
    try:
        get_cheapest_compatible_build()
    except Exception as e:
        print(f"[Warning] Failed to pre-warm cheapest build cache: {e}")

    # Start Supabase keep-alive pinger (prevents free-tier idle timeouts)
    try:
        start_keepalive()
    except Exception as e:
        print(f"[Warning] Keep-alive thread failed to start: {e}")


@app.get("/")
def root():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/activities")
def get_activities():
    """Return the list of valid primary/secondary activity options."""
    return {"activities": VALID_ACTIVITIES}


@app.get("/subcategories")
def get_subcategories():
    """Return the subcategories (Light, Standard, Heavy) and detailed descriptions."""
    return {
        "subcategories": VALID_SUBCATEGORIES,
        "activity_subcategories": ACTIVITY_SUBCATEGORIES,
    }


@app.get("/cooling-options")
def get_cooling_options():
    """Return the list of valid CPU cooling preferences."""
    return {"cooling_options": VALID_COOLING_PREFERENCES}


@app.get("/resolution-options")
def get_resolution_options():
    """Return the list of valid resolution & refresh rate target options."""
    return {"resolution_options": VALID_RESOLUTION_TARGETS}


@app.get("/min-compatible-budget")
def get_min_compatible_budget(
    refresh: bool = False,
    background_tasks: BackgroundTasks = None,
):
    """Return the baseline minimum budget for the cheapest working compatible PC."""
    try:
        if refresh and background_tasks:
            background_tasks.add_task(trigger_recalculate_min_budget)
        data = get_cheapest_compatible_build()
        # raw_build contains pandas Series with numpy types — strip before serialising
        return {k: v for k, v in data.items() if k != "raw_build"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/webhooks/supabase")
async def supabase_database_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """
    Webhook endpoint called by Supabase Database Webhooks whenever a component
    is inserted, updated, or deleted. Automatically recalculates the minimum compatible budget.
    """
    try:
        body = await request.json()
    except Exception:
        body = {}

    table = body.get("table", "unknown")
    event_type = body.get("type", "UNKNOWN")
    print(f"[Supabase Webhook] Received {event_type} on table '{table}'. Triggering min budget recalculation.")

    # Schedule asynchronous recalculation
    background_tasks.add_task(trigger_recalculate_min_budget)

    return {
        "status": "received",
        "table": table,
        "event": event_type,
        "action": "recalculation_scheduled",
    }


@app.post("/generate-build")
def generate_build(user: UserInput):
    try:
        res = recommender_generate_build(
            budget_min=user.min_budget,
            budget_max=user.max_budget,
            primary_activity=user.primary_activity,
            secondary_activity=user.secondary_activity,
            resolution_target=user.resolution_target,
            primary_subcategory=user.primary_subcategory,
            secondary_subcategory=user.secondary_subcategory,
            cooling_preference=user.cooling_preference,
        )
        try:
            from services.builder_service import generate_side_builds
            res["comparison_builds"] = generate_side_builds(
                min_budget=user.min_budget,
                max_budget=user.max_budget,
                primary_activity=user.primary_activity,
                primary_subcategory=user.primary_subcategory,
                secondary_activity=user.secondary_activity,
                secondary_subcategory=user.secondary_subcategory,
                cooling_preference=user.cooling_preference,
                resolution_target=user.resolution_target,
                user_build_res=res,
            )
        except Exception as side_err:
            import logging
            logging.getLogger(__name__).warning(f"Could not generate side builds: {side_err}")
        return res
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/builder/category-options")
def get_category_options_endpoint(req: CategoryOptionsRequest):
    """
    Returns 3 compatible component candidates (Value, AI Recommended, Performance)
    for the specified category, complete with formatted specs and difference analysis.
    """
    try:
        return get_builder_options(
            min_budget=req.min_budget,
            max_budget=req.max_budget,
            primary_activity=req.primary_activity,
            primary_subcategory=req.primary_subcategory,
            secondary_activity=req.secondary_activity,
            secondary_subcategory=req.secondary_subcategory,
            cooling_preference=req.cooling_preference,
            resolution_target=req.resolution_target,
            category=req.category,
            selected_components=req.selected_components or {},
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))


@app.post("/builder/finalize-build")
def finalize_build_endpoint(req: FinalizeBuildRequest):
    """
    Validates the 9 components chosen by the user, runs full 7-rule compatibility check,
    computes budget utilization, and scores system effectiveness parameters.
    """
    try:
        return finalize_custom_build(
            min_budget=req.min_budget,
            max_budget=req.max_budget,
            primary_activity=req.primary_activity,
            primary_subcategory=req.primary_subcategory,
            secondary_activity=req.secondary_activity,
            secondary_subcategory=req.secondary_subcategory,
            cooling_preference=req.cooling_preference,
            resolution_target=req.resolution_target,
            selected_components=req.selected_components,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))