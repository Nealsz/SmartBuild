from fastapi import FastAPI
from pydantic import BaseModel
import os
import joblib

app = FastAPI()

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