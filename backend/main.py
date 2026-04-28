from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import joblib

app = FastAPI()

# Allow frontend apps (e.g., Vite on localhost:5173) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "model", "model.pkl")

model = joblib.load(MODEL_PATH)

class UserInput(BaseModel):
    minBudget: int
    maxBudget: int
    usage: int
    priority: int

@app.get("/")
def root():
    return {"message": "SmartBuild API running"}

@app.post("/predict")
def predict(data: UserInput):
    budget = (data.minBudget + data.maxBudget) // 2

    prediction = model.predict([[budget, data.usage, data.priority]])

    return {
        "tier": int(prediction[0]),
        "derived_budget": budget
    }

from backend.schemas.user_input import UserRequirementInput

@app.post("/user-requirements/")
def get_user_requirements(input: UserRequirementInput):
    """
    Endpoint to receive user requirements for PC build.
    """
    return {
        "message": "User requirements received successfully!",
        "data": input.dict()
    }

from backend.services.build_recommendation import recommend_build
from backend.services.compatibility_checker import check_compatibility

@app.post("/recommend-build/")
def generate_recommendation(input: UserRequirementInput):
    """
    Endpoint to generate a recommended PC build based on user input.
    """
    recommendation = recommend_build(input)
    issues = check_compatibility(recommendation)
    return {
        "message": "Recommended build generated successfully!",
        "recommendation": recommendation,
        "compatibility": {
            "is_compatible": len(issues) == 0,
            "issues": issues
        }
    }

@app.post("/generate-build/")
def generate_build(input: UserRequirementInput):
    """
    Endpoint to generate a complete PC build based on user input, ensuring compatibility.
    """
    # Step 1: Generate a recommended build
    build = recommend_build(input)

    # Step 2: Check compatibility
    issues = check_compatibility(build)
    if issues:
        return {
            "message": "Compatibility issues found in the generated build.",
            "issues": issues,
            "build": build
        }

    # Step 3: Return the compatible build
    return {
        "message": "Build generated successfully!",
        "build": build
    }