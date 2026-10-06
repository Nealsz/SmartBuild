"""
services/intent_classifier.py
Converts user inputs into the 11-feature vector the RF model expects.
No ML logic here — pure feature engineering.
"""

from config import ACTIVITY_WEIGHTS, RESOLUTION_TARGET_WEIGHTS, get_activity_weights


def compute_intent(
    primary: str,
    secondary: str | None = None,
    resolution_target: str = "1080p 144Hz+ (FHD High FPS)",
    primary_subcategory: str | None = None,
    secondary_subcategory: str | None = None,
) -> dict[str, float]:
    """
    Blend primary (70%) and secondary (30%) activity dimension weights (accounting for subcategories),
    then apply resolution & refresh rate scaling boosts to VRAM, GPU compute, and CPU single core.
    """
    dims = ["cpu_single", "cpu_multi", "gpu_compute", "vram", "ram_cap", "storage_spd"]
    p = get_activity_weights(primary, primary_subcategory)

    if secondary:
        s = get_activity_weights(secondary, secondary_subcategory)
        base_intent = {d: p[d] * 0.70 + s[d] * 0.30 for d in dims}
    else:
        base_intent = {d: p[d] for d in dims}

    # Resolution / Refresh Rate weighting adjustment
    res_weights = RESOLUTION_TARGET_WEIGHTS.get(
        resolution_target,
        RESOLUTION_TARGET_WEIGHTS["1080p 144Hz+ (FHD High FPS)"],
    )

    base_intent["vram"] *= res_weights["vram_mult"]
    base_intent["gpu_compute"] *= res_weights["gpu_compute_mult"]
    base_intent["cpu_single"] *= res_weights["cpu_single_mult"]

    return {d: round(val, 4) for d, val in base_intent.items()}


def build_feature_vector(
    budget_min: int,
    budget_max: int,
    primary: str,
    secondary: str | None,
    resolution_target: str,
    primary_subcategory: str | None = None,
    secondary_subcategory: str | None = None,
) -> dict[str, float]:
    """
    Produces the exact 11-feature dict the RF model was trained on.

    Features:
      budget_mid          — midpoint of budget range (raw PHP)
      budget_norm         — budget_mid normalised to ~0–1 (÷200,000)
      budget_spread_norm  — range width normalised (÷200,000)
      performance_bias    — blend of budget level and spread; proxy for
                            how much the user is willing to pay for performance
      intent_*            — 6 hardware demand dimension weights from activity mapping
      longevity_mult      — tier multiplier from resolution selection (0.85–1.40)
    """
    intent = compute_intent(
        primary, secondary, resolution_target,
        primary_subcategory=primary_subcategory,
        secondary_subcategory=secondary_subcategory,
    )

    budget_mid  = (budget_min + budget_max) / 2
    budget_norm = budget_mid / 200_000
    spread_norm = (budget_max - budget_min) / 200_000

    res_weights = RESOLUTION_TARGET_WEIGHTS.get(
        resolution_target,
        RESOLUTION_TARGET_WEIGHTS["1080p 144Hz+ (FHD High FPS)"],
    )

    return {
        "budget_mid":          budget_mid,
        "budget_norm":         round(budget_norm, 4),
        "budget_spread_norm":  round(spread_norm, 4),
        "performance_bias":    round(min(budget_norm * 0.5 + spread_norm * 0.5, 1.0), 4),
        "intent_cpu_single":   intent["cpu_single"],
        "intent_cpu_multi":    intent["cpu_multi"],
        "intent_gpu_compute":  intent["gpu_compute"],
        "intent_vram":         intent["vram"],
        "intent_ram_cap":      intent["ram_cap"],
        "intent_storage_spd":  intent["storage_spd"],
        "longevity_mult":      res_weights["tier_mult"],
    }