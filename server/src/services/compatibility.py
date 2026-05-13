def validate_build(build):

    issues = []

    cpu = build["cpus"][0]
    motherboard = build["motherboards"][0]
    ram = build["rams"][0]
    gpu = build["gpus"][0]
    psu = build["psus"][0]
    case = build["cases"][0]

    # =========================
    # CPU ↔ Motherboard
    # =========================
    if cpu["socket"] != motherboard["socket"]:

        issues.append(
            "CPU and motherboard sockets do not match."
        )

    # =========================
    # RAM ↔ Motherboard
    # =========================
    if ram["type"] != motherboard["ram_type"]:

        issues.append(
            "RAM type incompatible with motherboard."
        )

    # =========================
    # GPU ↔ PSU
    # =========================
    if psu["wattage"] < gpu["recommended_psu"]:

        issues.append(
            "PSU wattage insufficient for GPU."
        )

    # =========================
    # GPU ↔ CASE
    # =========================
    if case["max_gpu_length"] < gpu["length"]:

        issues.append(
            "GPU does not fit inside case."
        )

    return {

        "isCompatible": len(issues) == 0,

        "issues": issues
    }