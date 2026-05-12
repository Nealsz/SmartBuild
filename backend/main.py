from fastapi import FastAPI

from schemas.user_input import UserInput

from services.intent_classifier import classify_usage
from services.recommender import recommend_component
from services.selector import select_build
from services.compatibility import validate_build
from services.requirement_validator import validate_requirements

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

    # STEP 3 — Generate Build
    build = select_build(
        anchor_component,
        focus,
        user.min_budget,
        user.max_budget
    )

    # HANDLE NO BUILD
    if "error" in build:

        return {
            "classification": classification,
            "error": build["error"]
        }

    # STEP 4 — Compatibility Validation
    compatibility = validate_build(build)

    # STEP 5 — Requirement Validation
    fit = validate_requirements(
        build,
        user.min_budget,
        user.max_budget
    )

    return {

        "classification": classification,

        "anchor_component": anchor_component,

        "components": build,

        "compatibility": compatibility,

        "requirement_fit": fit
    }