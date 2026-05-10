import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

data_path = os.path.join(
    BASE_DIR,
    "../../data/components.json"
)

with open(data_path, "r") as f:
    components = json.load(f)

def get_component_alternatives(
    build,
    min_budget,
    max_budget
):

    alternatives = {}

    cpu = build["cpu"]
    gpu = build["gpu"]
    motherboard = build["motherboard"]
    ram = build["ram"]

    # CPU OPTIONS
    compatible_cpus = [
        c for c in components["cpus"]
        if c["socket"] == motherboard["socket"]
        and c["name"] != cpu["name"]
    ]

    compatible_cpus = sorted(
        compatible_cpus,
        key=lambda x: x["cpu_score"],
        reverse=True
    )

    alternatives["cpu_options"] = compatible_cpus[:3]

    # GPU OPTIONS
    compatible_gpus = [
        g for g in components["gpus"]
        if g["recommended_psu"]
        <= build["psu"]["wattage"]
        and g["length"]
        <= build["case"]["max_gpu_length"]
        and g["name"] != gpu["name"]
    ]

    compatible_gpus = sorted(
        compatible_gpus,
        key=lambda x: x["gpu_score"],
        reverse=True
    )

    alternatives["gpu_options"] = compatible_gpus[:3]

    # RAM OPTIONS
    compatible_rams = [
        r for r in components["rams"]
        if r["type"] == motherboard["ram_type"]
        and r["name"] != ram["name"]
    ]

    compatible_rams = sorted(
        compatible_rams,
        key=lambda x: x["capacity"],
        reverse=True
    )

    alternatives["ram_options"] = compatible_rams[:3]

    return alternatives