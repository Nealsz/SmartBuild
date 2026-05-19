from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas.user_input import UserInput
from config import ACTIVITY_WEIGHTS, LONGEVITY_MULTIPLIER
from services.recommender import generate_build as recommender_generate_build

VALID_ACTIVITIES = list(ACTIVITY_WEIGHTS.keys())
VALID_LONGEVITY = list(LONGEVITY_MULTIPLIER.keys())

app = FastAPI(
    title="SmartBuild API",
    description="AI-powered PC build recommender using intent-weighted component scoring.",
    version="2.0.0",
)

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


@app.get("/")
def root():
    return {"status": "ok", "version": "2.0.0"}


@app.get("/activities")
def get_activities():
    """Return the list of valid primary/secondary activity options."""
    return {"activities": VALID_ACTIVITIES}


@app.get("/longevity-options")
def get_longevity_options():
    """Return the list of valid longevity options."""
    return {"longevity_options": VALID_LONGEVITY}


@app.post("/generate-build")
def generate_build(user: UserInput):
    try:
        return recommender_generate_build(
            budget_min=user.min_budget,
            budget_max=user.max_budget,
            primary_activity=user.primary_activity,
            secondary_activity=user.secondary_activity,
            longevity=user.longevity,
            upgrade_open=user.upgrade_open,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e))