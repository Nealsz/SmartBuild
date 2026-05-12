import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

data_path = os.path.join(
    BASE_DIR,
    "../../data/components.json"
)

with open(data_path, "r") as f:
    components = json.load(f)


def calculate_total(build):

    total = 0

    for category in build:

        preferred_component = build[category][0]

        total += preferred_component["price"]

    return total


def get_alternatives(
    category,
    preferred_component,
    build,
    limit=3
):

    alternatives = []

    for component in components[category]:

        # Skip preferred component
        if component["name"] == preferred_component["name"]:
            continue

        # CPU compatibility
        if category == "cpus":

            motherboard = build["motherboards"][0]

            if component["socket"] != motherboard["socket"]:
                continue

        # Motherboard compatibility
        elif category == "motherboards":

            cpu = build["cpus"][0]

            if component["socket"] != cpu["socket"]:
                continue

        # RAM compatibility
        elif category == "rams":

            motherboard = build["motherboards"][0]

            if component["type"] != motherboard["ram_type"]:
                continue

        # PSU compatibility
        elif category == "psus":

            gpu = build["gpus"][0]

            if component["wattage"] < gpu["recommended_psu"]:
                continue

        # CASE compatibility
        elif category == "cases":

            gpu = build["gpus"][0]

            if component["max_gpu_length"] < gpu["length"]:
                continue

        component_copy = component.copy()

        component_copy["preferred"] = False

        alternatives.append(component_copy)

        if len(alternatives) == limit:
            break

    return alternatives


def select_build(
    anchor_component,
    focus,
    min_budget,
    max_budget
):

    build = {}

    # =========================
    # CPU
    # =========================
    if focus == "CPU":

        cpu = anchor_component

    else:

        cpu = components["cpus"][0]

    cpu = cpu.copy()

    cpu["preferred"] = True

    build["cpus"] = [cpu]

    # =========================
    # GPU
    # =========================
    if focus == "GPU":

        gpu = anchor_component

    else:

        gpu = components["gpus"][0]

    gpu = gpu.copy()

    gpu["preferred"] = True

    build["gpus"] = [gpu]

    # =========================
    # MOTHERBOARD
    # =========================
    motherboard = next(

        (
            m for m in components["motherboards"]

            if m["socket"] == cpu["socket"]
        ),

        None
    )

    if not motherboard:

        return {
            "error": "No compatible motherboard found."
        }

    motherboard = motherboard.copy()

    motherboard["preferred"] = True

    build["motherboards"] = [motherboard]

    # =========================
    # RAM
    # =========================
    ram = next(

        (
            r for r in components["rams"]

            if r["type"] == motherboard["ram_type"]
        ),

        None
    )

    if not ram:

        return {
            "error": "No compatible RAM found."
        }

    ram = ram.copy()

    ram["preferred"] = True

    build["rams"] = [ram]

    # =========================
    # STORAGE
    # =========================
    storage = components["storages"][0].copy()

    storage["preferred"] = True

    build["storages"] = [storage]

    # =========================
    # PSU
    # =========================
    psu = next(

        (
            p for p in components["psus"]

            if p["wattage"] >= gpu["recommended_psu"]
        ),

        None
    )

    if not psu:

        return {
            "error": "No compatible PSU found."
        }

    psu = psu.copy()

    psu["preferred"] = True

    build["psus"] = [psu]

    # =========================
    # CASE
    # =========================
    case = next(

        (
            c for c in components["cases"]

            if c["max_gpu_length"] >= gpu["length"]
        ),

        None
    )

    if not case:

        return {
            "error": "No compatible case found."
        }

    case = case.copy()

    case["preferred"] = True

    build["cases"] = [case]

    # =========================
    # ADD ALTERNATIVES
    # =========================
    for category in build:

        preferred = build[category][0]

        alternatives = get_alternatives(
            category,
            preferred,
            build
        )

        build[category].extend(alternatives)

    # =========================
    # BUDGET VALIDATION
    # =========================
    total_price = calculate_total(build)

    if total_price < min_budget:

        return {
            "error": "Build is below minimum budget."
        }

    if total_price > max_budget:

        return {
            "error": "Build exceeds maximum budget."
        }

    return build