import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
import joblib
import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

data_path = os.path.join(
    BASE_DIR,
    "../../data/components.json"
)

with open(data_path, "r") as f:
    components = json.load(f)

training_data = []

# Gaming GPUs
for gpu in components["gpus"]:
    training_data.append({
        "budget": gpu["recommended_psu"] * 100,
        "usage": "AAA Gaming",
        "recommendation": gpu["name"]
    })

# Esports GPUs
for gpu in components["gpus"]:
    training_data.append({
        "budget": gpu["recommended_psu"] * 80,
        "usage": "Esports Gaming",
        "recommendation": gpu["name"]
    })

# Productivity CPUs
for cpu in components["cpus"]:
    training_data.append({
        "budget": cpu["tdp"] * 1200,
        "usage": "Video Editing",
        "recommendation": cpu["name"]
    })

data = pd.DataFrame(training_data)

usage_encoder = LabelEncoder()
recommendation_encoder = LabelEncoder()

data["usage"] = usage_encoder.fit_transform(data["usage"])
data["recommendation"] = recommendation_encoder.fit_transform(
    data["recommendation"]
)

X = data[["budget", "usage"]]
y = data["recommendation"]

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X, y)

joblib.dump(model, "model.pkl")
joblib.dump(usage_encoder, "usage_encoder.pkl")
joblib.dump(recommendation_encoder, "recommendation_encoder.pkl")

print("Model trained successfully!")