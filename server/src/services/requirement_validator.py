def validate_requirements(
    build,
    min_budget,
    max_budget
):

    total_price = 0

    for category in build:

        preferred_component = build[category][0]

        total_price += preferred_component["price"]

    return {

        "isFit": (
            min_budget <= total_price <= max_budget
        ),

        "total_price": total_price,

        "min_budget": min_budget,

        "max_budget": max_budget
    }