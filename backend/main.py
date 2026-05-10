from fastapi import FastAPI

from schemas.user_input import UserInput

from services.intent_classifier import classify_usage
from services.recommender import recommend_component
from services.selector import select_build
from services.compatibility import validate_build
from services.requirement_validator import validate_requirements
from services.alternatives import get_component_alternatives

app = FastAPI()


@app.post("/generate-build")
def generate_build(user: UserInput):

    # STEP 1 — Intent Classification
    classification = classify_usage(
        user.description
    )

    usage = classification["usage"]
    focus = classification["focus"]

    # STEP 2 — Recommend Anchor Component
    anchor_component = recommend_component(
        user.max_budget,
        usage,
        focus
    )

    # STEP 3 — Generate Compatible Build
    build = select_build(
        anchor_component,
        focus,
        user.min_budget,
        user.max_budget
    )

    # HANDLE NO BUILD FOUND
    if "error" in build:

        return {
            "classification": classification,
            "error": build["error"]
        }

    # STEP 4 — Compatibility Validation
    compatibility = validate_build(build)

    # STEP 5 — Budget / Requirement Validation
    fit = validate_requirements(
        build,
        user.min_budget,
        user.max_budget
    )

    # STEP 6 — Generate Alternative Options
    alternatives = get_component_alternatives(
        build,
        user.min_budget,
        user.max_budget
    )

    # FINAL RESPONSE
    return {

        "classification": classification,

        "anchor_component": anchor_component,

        "build": build,

        "alternatives": alternatives,

        "compatibility": compatibility,

        "requirement_fit": fit
    }