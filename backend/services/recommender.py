"""
services/recommender.py
Orchestrates the full recommendation pipeline:

  1. build_feature_vector()  → 12-feature input for RF
  2. RF model                → tier predictions per component
  3. select_build()          → picks best component per tier
  4. check_compatibility()   → validates the full build

This file contains no scoring logic — it only wires services together.
"""

import pandas as pd
import joblib

from config import PATHS, MODEL_PATH, ENCODERS_PATH
from .intent_classifier import build_feature_vector, compute_intent
from .selector import select_build
from .compatibility import check_compatibility, summarise


# ── Lazy-loaded singletons (loaded once on first request) ──────────────────────
_dfs:      dict[str, pd.DataFrame] | None = None
_artifact: dict | None = None
_encoders: dict | None = None


def _load_data() -> dict[str, pd.DataFrame]:
    global _dfs
    if _dfs is None:
        _dfs = {name: pd.read_csv(path) for name, path in PATHS.items()}
    return _dfs


def _load_model() -> tuple[dict, dict]:
    global _artifact, _encoders
    if _artifact is None:
        _artifact = joblib.load(MODEL_PATH)
        _encoders = joblib.load(ENCODERS_PATH)
    return _artifact, _encoders


# ── RF inference ───────────────────────────────────────────────────────────────
def predict_tiers(feature_vector: dict) -> dict[str, str]:
    """
    Run the RF model on the 12-feature vector.
    Returns e.g. {"cpu": "mid", "gpu": "high", "ram": "mid", ...}
    """
    artifact, encoders = _load_model()

    feat_df = pd.DataFrame([feature_vector])[artifact["feature_cols"]]
    tiers   = {}

    for col in artifact["target_cols"]:
        clf      = artifact["models"][col]
        encoded  = clf.predict(feat_df)[0]
        tier     = encoders[col].inverse_transform([encoded])[0]
        component = col.replace("tier_", "")
        tiers[component] = tier

    return tiers


# ── Main entry point ───────────────────────────────────────────────────────────
def generate_build(
    budget_min:        int,
    budget_max:        int,
    primary_activity:  str,
    secondary_activity: str | None,
    longevity:         str,
    upgrade_open:      bool,
) -> dict:
    """
    Full pipeline from user inputs to a validated build.

    Returns
    -------
    {
        "tiers":           {component: tier},
        "build":           {component: {name, price, ...}},
        "total":           float,
        "budget_fit":      bool,
        "compatibility":   {overall, passed, warnings, failures, details},
    }
    """
    dfs = _load_data()

    # Step 1 — Feature engineering
    features = build_feature_vector(
        budget_min, budget_max,
        primary_activity, secondary_activity,
        longevity, upgrade_open,
    )

    # Step 2 — RF tier prediction
    tiers = predict_tiers(features)

    # Step 3 — Component selection
    intent = compute_intent(primary_activity, secondary_activity)

    build = select_build(
        dfs         = dfs,
        tiers       = tiers,
        intent      = intent,
        budget_min  = budget_min,
        budget_max  = budget_max,
        longevity   = longevity,
        upgrade_open= upgrade_open,
    )

    psu_min_watt = build.pop("psu_min_watt")
    psu_max_watt = build.pop("psu_max_watt")

    # Step 4 — Compatibility check
    compat_results = check_compatibility(build, psu_min_watt, psu_max_watt)
    compatibility  = summarise(compat_results)

    # Step 5 — Budget summary
    total = sum(
        float(row.get("price", 0))
        for row in build.values()
        if row is not None
    )

    # Serialise pandas Series → plain dicts for JSON response
    build_serialised = {}
    for key, row in build.items():
        if row is None:
            build_serialised[key] = None
        elif isinstance(row, pd.Series):
            build_serialised[key] = row.where(pd.notna(row), None).to_dict()
        else:
            build_serialised[key] = row

    return {
        "tiers":         tiers,
        "build":         build_serialised,
        "total":         round(total, 2),
        "budget_fit":    budget_min <= total <= budget_max,
        "compatibility": compatibility,
    }