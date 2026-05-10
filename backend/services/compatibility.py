def validate_build(build):

    errors = []

    cpu = build["cpu"]
    motherboard = build["motherboard"]
    ram = build["ram"]
    gpu = build["gpu"]
    psu = build["psu"]
    case = build["case"]

    # CPU ↔ Motherboard
    if cpu["socket"] != motherboard["socket"]:
        errors.append(
            "CPU socket incompatible with motherboard"
        )

    # RAM ↔ Motherboard
    if ram["type"] != motherboard["ram_type"]:
        errors.append(
            "RAM type incompatible with motherboard"
        )

    # PSU ↔ GPU
    if psu["wattage"] < gpu["recommended_psu"]:
        errors.append(
            "PSU wattage insufficient"
        )

    # CASE ↔ GPU
    if gpu["length"] > case["max_gpu_length"]:
        errors.append(
            "GPU too large for case"
        )

    return {
        "isValid": len(errors) == 0,
        "errors": errors
    }