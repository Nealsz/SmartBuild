"""
services/recommender.py
Orchestrates the full recommendation pipeline:

  1. build_feature_vector()  → 12-feature input for RF
  2. RF model                → tier predictions per component
  3. select_build()          → picks best component per tier
  4. check_compatibility()   → validates the full build
  5. evaluate()              → computes 5 system effectiveness parameters

This file contains no scoring logic — it only wires services together.
"""

import os
import json
import time
import pandas as pd
import joblib

import logging
from config import PATHS, MODEL_PATH, ENCODERS_PATH, GPU_TDP_MAP, MIN_BUDGET_PATH
from .intent_classifier import build_feature_vector, compute_intent
from .selector import select_build
from .compatibility import check_compatibility, summarise
from .supabase_service import fetch_table_as_dataframe

logger = logging.getLogger(__name__)


# ── Lazy-loaded singletons (loaded once on first request) ──────────────────────
_dfs:                  dict[str, pd.DataFrame] | None = None
_artifact:             dict | None = None
_encoders:             dict | None = None
_cheapest_build_cache: dict | None = None


def _load_data() -> dict[str, pd.DataFrame]:
    global _dfs
    if _dfs is None:
        _dfs = {}
        numeric_cols_map = {
            "cpu": ["price", "boost_clock", "core_count", "core_clock", "performance_score", "tdp"],
            "gpu": ["price", "memory", "core_clock", "boost_clock"],
            "ram": ["price", "speed_mhz", "total_capacity_gb", "first_word_latency"],
            "storage": ["price", "capacity"],
            "motherboard": ["price", "max_memory", "memory_slots"],
            "psu": ["price", "wattage"],
            "case": ["price", "external_volume"],
            "cpu_cooler": ["price", "size"],
            "case_fan": ["price"],
        }
        for name, path in PATHS.items():
            # Attempt to fetch from Supabase database first
            df = fetch_table_as_dataframe(name)
            
            # Fallback to local CSV file if Supabase data is unavailable
            if df is None or df.empty:
                logger.info(f"Loading '{name}' dataset from local CSV file: {path}")
                df = pd.read_csv(path)
            else:
                logger.info(f"Successfully loaded '{name}' dataset from Supabase database.")

            cols_to_convert = numeric_cols_map.get(name, ["price"])
            for col in cols_to_convert:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce")
            _dfs[name] = df
    return _dfs


def _load_model() -> tuple[dict, dict]:
    global _artifact, _encoders
    if _artifact is None:
        _artifact = joblib.load(MODEL_PATH)
        _encoders = joblib.load(ENCODERS_PATH)
    return _artifact, _encoders


# ── RF inference ───────────────────────────────────────────────────────────────
def predict_tiers(feature_vector: dict) -> tuple[dict[str, str], dict[str, float]]:
    """
    Run the RF model on the 12-feature vector.
    Returns:
        tiers       – e.g. {"cpu": "mid", "gpu": "high", ...}
        confidences – e.g. {"cpu": 95.2, "gpu": 88.1, ...} (percentages)
    """
    artifact, encoders = _load_model()

    feat_df = pd.DataFrame([feature_vector])[artifact["feature_cols"]]
    tiers       = {}
    confidences = {}

    for col in artifact["target_cols"]:
        clf       = artifact["models"][col]
        encoded   = clf.predict(feat_df)[0]
        tier      = encoders[col].inverse_transform([encoded])[0]
        component = col.replace("tier_", "")
        tiers[component] = tier

        # Prediction confidence from RF probability estimates
        proba = clf.predict_proba(feat_df)[0]
        confidences[component] = round(float(max(proba)) * 100, 1)

    return tiers, confidences


# ── Evaluation helpers ─────────────────────────────────────────────────────────

def _compute_alignment_score(intent: dict, tiers: dict) -> tuple[float, dict]:
    """
    Measures how well the predicted tiers match the activity's demand priorities.

    Uses **pairwise tier-level comparison**: for every pair (A, B) where
    demand(A) > demand(B), check that tier(A) >= tier(B).  Ties in tier are
    always considered aligned.  This avoids false penalties when budget
    constraints force multiple components into the same tier.
    """
    tier_rank = {"budget": 1, "mid": 2, "high": 3, "enthusiast": 4}

    # Aggregate 6 intent dimensions → 4 core components
    component_demand = {
        "cpu":     max(intent.get("cpu_single", 0), intent.get("cpu_multi", 0)),
        "gpu":     max(intent.get("gpu_compute", 0), intent.get("vram", 0)),
        "ram":     intent.get("ram_cap", 0),
        "storage": intent.get("storage_spd", 0),
    }

    # Only consider components that have tier predictions
    components = [c for c in component_demand if c in tiers]

    # ── Pairwise comparison ────────────────────────────────────────────────
    # For each ordered pair where demand(A) > demand(B):
    #   ALIGNED     if tier(A) >= tier(B)           → score 1.0
    #   SLIGHT MISS if tier(A) == tier(B) - 1       → score 0.75
    #   MISALIGNED  if tier(A) < tier(B) by 2+      → score 0.50
    pair_scores  = []
    pair_weights = []

    for i, a in enumerate(components):
        for b in components[i + 1:]:
            d_a = component_demand[a]
            d_b = component_demand[b]
            t_a = tier_rank.get(tiers.get(a, "mid"), 2)
            t_b = tier_rank.get(tiers.get(b, "mid"), 2)

            # Weight this pair by the demand gap (bigger gap = more important)
            weight = abs(d_a - d_b) + 0.1          # +0.1 so equal demands still count

            if d_a >= d_b:
                # A should have tier >= B
                if t_a >= t_b:
                    score = 1.0
                elif t_a == t_b - 1:
                    score = 0.75
                else:
                    score = 0.50
            else:
                # B should have tier >= A
                if t_b >= t_a:
                    score = 1.0
                elif t_b == t_a - 1:
                    score = 0.75
                else:
                    score = 0.50

            pair_scores.append(score * weight)
            pair_weights.append(weight)

    overall = round(
        (sum(pair_scores) / sum(pair_weights)) * 100, 1
    ) if pair_weights else 100.0

    # ── Per-component detail for the UI ────────────────────────────────────
    demand_order = sorted(components, key=lambda c: component_demand[c], reverse=True)
    details = {}
    for i, comp in enumerate(demand_order):
        details[comp] = {
            "demand":      round(component_demand[comp], 2),
            "demand_rank": i + 1,
            "tier":        tiers[comp],
            "tier_rank":   tier_rank.get(tiers.get(comp, "mid"), 2),
            "score":       round(overall, 1),   # uniform (pairwise score)
        }

    return overall, details


def _compute_budget_score(total: float, budget_min: int, budget_max: int) -> float:
    """
    Returns 100% if within budget, degrades proportionally for over/under.
    """
    if budget_min <= total <= budget_max:
        return 100.0
    elif total > budget_max:
        overshoot = (total - budget_max) / budget_max
        return round(max(0.0, (1.0 - overshoot) * 100), 1)
    else:
        undershoot = (budget_min - total) / budget_min
        return round(max(0.0, (1.0 - undershoot) * 100), 1)


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
    Full pipeline from user inputs to a validated build + evaluation metrics.

    Returns
    -------
    {
        "tiers":           {component: tier},
        "build":           {component: {name, price, ...}},
        "total":           float,
        "budget_fit":      bool,
        "compatibility":   {overall, passed, warnings, failures, details},
        "evaluation":      {prediction_accuracy, budget_fit, intended_use_alignment,
                            compatibility_reliability, recommendation_speed},
    }
    """
    start_time = time.time()

    dfs = _load_data()

    # Step 1 — Feature engineering
    features = build_feature_vector(
        budget_min, budget_max,
        primary_activity, secondary_activity,
        longevity, upgrade_open,
    )

    # Step 2 — RF tier prediction (now also returns confidence scores)
    tiers, confidences = predict_tiers(features)

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

    budget_within = budget_min <= total <= budget_max

    # Step 6 — System evaluation (5 key performance parameters)
    elapsed = round(time.time() - start_time, 3)

    # P1: Prediction Accuracy — average RF confidence across components
    avg_confidence = round(
        sum(confidences.values()) / len(confidences), 1
    ) if confidences else 0.0

    # P2: Budget Fit — continuous score (100% if within range)
    budget_score = _compute_budget_score(total, budget_min, budget_max)

    # P3: Intended-Use Alignment — demand-tier rank matching
    alignment_score, alignment_details = _compute_alignment_score(intent, tiers)

    # P4: Compatibility Reliability — percentage of checks passed (no failures)
    total_checks = compatibility["passed"] + compatibility["warnings"] + compatibility["failures"]
    compat_score = round(
        ((total_checks - compatibility["failures"]) / total_checks) * 100, 1
    ) if total_checks > 0 else 100.0

    evaluation = {
        "prediction_accuracy": {
            "score":     avg_confidence,
            "threshold": 85,
            "passed":    avg_confidence >= 85,
            "details":   confidences,
        },
        "budget_fit": {
            "score":           budget_score,
            "threshold":       90,
            "passed":          budget_score >= 90,
            "utilization_pct": round(total / budget_max * 100, 1) if budget_max > 0 else 0,
            "within_range":    budget_within,
        },
        "intended_use_alignment": {
            "score":     alignment_score,
            "threshold": 85,
            "passed":    alignment_score >= 85,
            "details":   alignment_details,
        },
        "compatibility_reliability": {
            "score":         compat_score,
            "threshold":     100,
            "passed":        compat_score == 100.0,
            "checks_passed": total_checks - compatibility["failures"],
            "total_checks":  total_checks,
        },
        "recommendation_speed": {
            "score_seconds":     elapsed,
            "threshold_seconds": 15,
            "passed":            elapsed <= 15,
        },
    }

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
        "budget_fit":    budget_within,
        "compatibility": compatibility,
        "evaluation":    evaluation,
    }


def get_cheapest_compatible_build(force_recalculate: bool = False) -> dict:
    """
    Finds the minimum budget at which the actual recommendation pipeline
    (select_build + check_compatibility) produces a zero-failure compatible build.

    Result is cached in memory and persisted to MIN_BUDGET_PATH on disk.
    If MIN_BUDGET_PATH exists, it is loaded directly without binary search.
    """
    global _cheapest_build_cache
    if not force_recalculate and _cheapest_build_cache is not None:
        return _cheapest_build_cache

    if not force_recalculate and os.path.exists(MIN_BUDGET_PATH):
        try:
            with open(MIN_BUDGET_PATH, "r", encoding="utf-8") as f:
                _cheapest_build_cache = json.load(f)
                return _cheapest_build_cache
        except Exception:
            pass  # Fall through to calculation if JSON read fails

    dfs     = _load_data()
    _load_model()   # ensure model is warm (not used for tiers here, but loads data)

    from .compatibility import check_compatibility, summarise as compat_summarise
    from .selector     import select_build

    # All-budget tiers — forces the selector into the cheapest price bands
    budget_tiers = {
        "cpu":        "budget",
        "gpu":        "budget",
        "ram":        "budget",
        "storage":    "budget",
        "motherboard":"budget",
        "psu":        "budget",
        "case":       "budget",
        "cpu_cooler": "budget",
    }

    # Neutral intent: equal moderate weights across all dimensions
    # (avoids skewing toward expensive workload-specific parts)
    neutral_intent = {
        "cpu_single":  0.3,
        "cpu_multi":   0.3,
        "gpu_compute": 0.3,
        "vram":        0.3,
        "ram_cap":     0.3,
        "storage_spd": 0.3,
    }

    # Binary search bounds — start at 10k (floor), cap at 60k (safety ceiling)
    lo = 10_000
    hi = 60_000

    best_budget  = None
    best_build   = None
    best_total   = None

    while lo <= hi:
        mid = (lo + hi) // 2
        # Use mid as both min and max so BASE_ALLOC midpoint == mid
        try:
            build = select_build(
                dfs          = dfs,
                tiers        = budget_tiers,
                intent       = neutral_intent,
                budget_min   = mid,
                budget_max   = mid,
                longevity    = "1-2 years",   # lowest longevity → score mult = 0.8 → cheapest picks
                upgrade_open = False,
                is_calculating_min_budget = True,
            )
        except Exception:
            lo = mid + 1_000
            continue

        psu_min = build.pop("psu_min_watt", 0)
        psu_max = build.pop("psu_max_watt", 0)

        compat  = check_compatibility(build, psu_min, psu_max)
        summary = compat_summarise(compat)

        total = sum(
            float(r.get("price", 0))
            for r in build.values()
            if r is not None
        )

        if summary["failures"] == 0 and total <= mid:
            best_budget = mid
            best_build  = build
            best_total  = total
            hi = mid - 1_000          # try to find a cheaper passing point
        else:
            lo = mid + 1_000

    # If binary search found nothing, sweep upward in 500-step increments
    if best_build is None:
        for budget in range(10_000, 80_001, 500):
            try:
                build = select_build(
                    dfs          = dfs,
                    tiers        = budget_tiers,
                    intent       = neutral_intent,
                    budget_min   = budget,
                    budget_max   = budget,
                    longevity    = "1-2 years",
                    upgrade_open = False,
                    is_calculating_min_budget = True,
                )
            except Exception:
                continue

            psu_min = build.pop("psu_min_watt", 0)
            psu_max = build.pop("psu_max_watt", 0)

            compat  = check_compatibility(build, psu_min, psu_max)
            summary = compat_summarise(compat)
            total   = sum(
                float(r.get("price", 0))
                for r in build.values()
                if r is not None
            )

            if summary["failures"] == 0 and total <= budget:
                best_budget = budget
                best_build  = build
                best_total  = total
                break

    if best_build is None or best_total is None:
        raise RuntimeError("Could not find any compatible build within 80,000 budget.")

    rounded_min = int(round(best_total))

    parts_summary: dict = {}
    for k, v in best_build.items():
        if v is not None:
            if isinstance(v, pd.Series):
                parts_summary[k] = {
                    "name":  str(v.get("name", "")),
                    "price": float(v.get("price", 0)),
                }
            else:
                parts_summary[k] = {"name": str(v), "price": 0.0}

    _cheapest_build_cache = {
        "min_budget":           rounded_min,
        "exact_min_budget":     round(best_total, 2),
        "formatted_min_budget": f"₱{rounded_min:,}",
        "parts":                parts_summary,
    }

    try:
        with open(MIN_BUDGET_PATH, "w", encoding="utf-8") as f:
            json.dump(_cheapest_build_cache, f, indent=2)
    except Exception as e:
        print(f"[Warning] Could not save min budget JSON cache: {e}")

    return _cheapest_build_cache