def check_compatibility(build):
    """
    Check compatibility of the given PC build.
    """
    compatibility_issues = []

    # Example compatibility rules
    cpu = build.get("CPU")
    motherboard = build.get("Motherboard")
    ram = build.get("RAM")
    psu = build.get("PSU")

    if cpu and motherboard:
        if cpu["brand"] == "Intel" and not motherboard["name"].startswith("Intel"):
            compatibility_issues.append("CPU and Motherboard are not compatible.")
        if cpu["brand"] == "AMD" and not motherboard["name"].startswith("AMD"):
            compatibility_issues.append("CPU and Motherboard are not compatible.")

    if ram and motherboard:
        if ram["performance"] < 70:  # Example rule for RAM compatibility
            compatibility_issues.append("RAM performance is too low for the selected motherboard.")

    if psu:
        total_power = sum(
            component["performance"]
            for category, component in build.items()
            if component and category != "PSU"
        )
        if psu["performance"] < total_power:
            compatibility_issues.append("PSU does not provide enough power for the build.")

    return compatibility_issues