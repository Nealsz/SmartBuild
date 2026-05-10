def validate_requirements(
    build,
    min_budget,
    max_budget
):

    score = 100
    issues = []

    if build["total_price"] < min_budget:

        score -= 20

        issues.append(
            "Build below minimum budget"
        )

    if build["total_price"] > max_budget:

        score -= 30

        issues.append(
            "Build exceeds maximum budget"
        )

    return {
        "isFit": score >= 70,
        "score": score,
        "issues": issues
    }