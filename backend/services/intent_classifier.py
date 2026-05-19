"""
services/intent_classifier.py
Converts user inputs into the 12-feature vector the RF model expects.
No ML logic here — pure feature engineering.
"""

from config import ACTIVITY_WEIGHTS, LONGEVITY_MULTIPLIER


def compute_intent(primary: str, secondary: str | None = None) -> dict[str, float]:
    """
    Blend primary (70%) and secondary (30%) activity dimension weights.
    If no secondary, primary gets 100% weight.
    """
    dims = ["cpu_single", "cpu_multi", "gpu_compute", "vram", "ram_cap", "storage_spd"]
    p = ACTIVITY_WEIGHTS[primary]

    if secondary:
        s = ACTIVITY_WEIGHTS[secondary]
        return {d: round(p[d] * 0.70 + s[d] * 0.30, 4) for d in dims}

    return {d: p[d] for d in dims}


def build_feature_vector(
    budget_min: int,
    budget_max: int,
    primary: str,
    secondary: str | None,
    longevity: str,
    upgrade_open: bool,
) -> dict[str, float]:
    """
    Produces the exact 12-feature dict the RF model was trained on.

    Features:
      budget_mid          — midpoint of budget range (raw PHP)
      budget_norm         — budget_mid normalised to ~0–1 (÷200,000)
      budget_spread_norm  — range width normalised (÷200,000)
      performance_bias    — blend of budget level and spread; proxy for
                            how much the user is willing to pay for performance
      intent_*            — 6 hardware demand dimension weights from activity mapping
      longevity_mult      — tier multiplier from longevity selection (0.8/1.0/1.2)
      upgrade_open        — 1 if user wants upgrade path, 0 if complete build
    """
    intent = compute_intent(primary, secondary)

    budget_mid  = (budget_min + budget_max) / 2
    budget_norm = budget_mid / 200_000
    spread_norm = (budget_max - budget_min) / 200_000

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
        "longevity_mult":      LONGEVITY_MULTIPLIER[longevity],
        "upgrade_open":        int(upgrade_open),
    }