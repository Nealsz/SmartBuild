import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

data_path = os.path.join(
    BASE_DIR,
    "../../data/components.json"
)

with open(data_path, "r") as f:
    components = json.load(f)

def recommend_component(budget, usage, focus):

    gpus = components["gpus"]
    cpus = components["cpus"]

    # GPU-focused workloads
    if focus == "GPU":

        valid_gpus = [
            gpu for gpu in gpus
            if gpu["price"] <= budget * 0.5
        ]

        if valid_gpus:
            return max(valid_gpus, key=lambda x: x["gpu_score"])

    # CPU-focused workloads
    if focus == "CPU":

        valid_cpus = [
            cpu for cpu in cpus
            if cpu["price"] <= budget * 0.4
        ]

        if valid_cpus:
            return max(valid_cpus, key=lambda x: x["cpu_score"])

    # Balanced workloads
    valid_gpus = [
        gpu for gpu in gpus
        if gpu["price"] <= budget * 0.35
    ]

    if valid_gpus:
        return max(valid_gpus, key=lambda x: x["gpu_score"])

    return gpus[0]