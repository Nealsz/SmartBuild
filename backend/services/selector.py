import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

data_path = os.path.join(
    BASE_DIR,
    "../../data/components.json"
)

with open(data_path, "r") as f:
    components = json.load(f)

def calculate_total(build):

    return (
        build["cpu"]["price"] +
        build["gpu"]["price"] +
        build["motherboard"]["price"] +
        build["ram"]["price"] +
        build["storage"][0]["price"] +
        build["psu"]["price"] +
        build["case"]["price"]
    )

def select_build(anchor_component, focus, min_budget, max_budget):

    best_build = None

    cpus = components["cpus"]
    gpus = components["gpus"]

    motherboards = components["motherboards"]
    rams = components["rams"]
    storages = components["storages"]
    psus = components["psus"]
    cases = components["cases"]

    for cpu in cpus:

        for gpu in gpus:

            # Motherboard compatibility
            compatible_mbs = [
                mb for mb in motherboards
                if mb["socket"] == cpu["socket"]
            ]

            if not compatible_mbs:
                continue

            motherboard = compatible_mbs[0]

            # RAM compatibility
            compatible_rams = [
                ram for ram in rams
                if ram["type"] == motherboard["ram_type"]
            ]

            if not compatible_rams:
                continue

            # RAM selection
            if focus == "RAM":
                ram = max(
                    compatible_rams,
                    key=lambda x: x["capacity"]
                )
            else:
                ram = compatible_rams[0]

            # PSU compatibility
            compatible_psus = [
                psu for psu in psus
                if psu["wattage"]
                >= gpu["recommended_psu"]
            ]

            if not compatible_psus:
                continue

            psu = compatible_psus[0]

            # CASE compatibility
            compatible_cases = [
                c for c in cases
                if motherboard["form_factor"]
                in c["supported_form_factors"]
                and gpu["length"]
                <= c["max_gpu_length"]
            ]

            if not compatible_cases:
                continue

            case = compatible_cases[0]

            # Storage
            storage = storages[0]

            build = {
                "cpu": cpu,
                "gpu": gpu,
                "motherboard": motherboard,
                "ram": ram,
                "storage": [storage],
                "psu": psu,
                "case": case
            }

            total_price = calculate_total(build)

            build["total_price"] = total_price

            # BUDGET RANGE FILTER
            if (
                total_price >= min_budget
                and total_price <= max_budget
            ):

                best_build = build

                # GPU-focused scoring
                if focus == "GPU":

                    best_build["score"] = (
                        gpu["gpu_score"] * 0.7
                        + cpu["cpu_score"] * 0.3
                    )

                # CPU-focused scoring
                elif focus == "CPU":

                    best_build["score"] = (
                        cpu["cpu_score"] * 0.7
                        + gpu["gpu_score"] * 0.3
                    )

                # Balanced scoring
                else:

                    best_build["score"] = (
                        cpu["cpu_score"] * 0.5
                        + gpu["gpu_score"] * 0.5
                    )

    if best_build:
        return best_build

    return {
        "error": "No compatible build found within budget range"
    }