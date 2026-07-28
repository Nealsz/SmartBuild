import sys
import os
import time
import random
import statistics
from fastapi.testclient import TestClient

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app

client = TestClient(app)

activities = [
    "Browsing & Streaming", "Documents / Office Work", "Gaming", 
    "Video Editing", "Photo / Graphic Design", "3D Modeling or Animation",
    "Programming or Development"
]

longevities = ["1-2 years", "3-5 years", "5+ years"]

test_cases = 100
budget_fits = []
intended_use_alignments = []
prediction_accuracies = []
latencies = []
compatibility_scores = []

print(f"Running {test_cases} test evaluations...")

for i in range(test_cases):
    min_budget = random.randint(20000, 50000)
    max_budget = min_budget + random.randint(10000, 40000)
    primary = random.choice(activities)
    secondary = random.choice(activities) if random.random() > 0.5 else ""
    longevity = random.choice(longevities)
    upgrade_open = random.choice([True, False])
    
    payload = {
        "min_budget": min_budget,
        "max_budget": max_budget,
        "primary_activity": primary,
        "secondary_activity": secondary,
        "longevity": longevity,
        "upgrade_open": upgrade_open
    }
    
    start_time = time.time()
    response = client.post("/generate-build", json=payload)
    latency = time.time() - start_time
    
    if response.status_code == 200:
        data = response.json()
        eval_data = data.get("evaluation", {})
        
        # Budget Compliance (1 if within budget, else 0)
        if data.get("total_price", 0) <= max_budget:
            budget_fits.append(1)
        else:
            budget_fits.append(0)
            
        try:
            pred_acc = eval_data.get("prediction_accuracy", {}).get("score", 0)
            use_align = eval_data.get("intended_use_alignment", {}).get("score", 0)
            comp_score = eval_data.get("compatibility_score", {}).get("score", 100)
            
            # Prediction accuracy might be in 0-1 range or 0-100 range.
            # Assuming it's returned as a percentage (0-100) from the backend.
            if pred_acc <= 1.0 and pred_acc > 0:
                pred_acc = pred_acc * 100
            
            prediction_accuracies.append(pred_acc)
            intended_use_alignments.append(use_align)
            compatibility_scores.append(comp_score)
            latencies.append(latency)
        except Exception:
            pass

    print(f"Test {i+1}/{test_cases} complete.", end="\r")

print("\n\n--- EVALUATION RESULTS ---")
print(f"Total Successful Tests: {len(latencies)}/{test_cases}")
if len(latencies) > 0:
    print(f"1. Component Recommendation Accuracy (Avg Model Confidence): {statistics.mean(prediction_accuracies):.1f}%")
    print(f"2. Budget Compliance: {(sum(budget_fits)/len(budget_fits))*100:.1f}%")
    print(f"3. Intended-Use Alignment: {statistics.mean(intended_use_alignments):.1f}%")
    print(f"4. Compatibility Reliability: {statistics.mean(compatibility_scores):.1f}%")
    print(f"5. Recommendation Speed (Latency): {statistics.mean(latencies):.3f} seconds")
