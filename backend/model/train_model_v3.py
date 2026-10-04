"""
train_model_v3.py
==================
SmartBuild — Random Forest Training Pipeline (v3, Supabase-integrated)

WHY V2 REGRESSED (owning this directly)
----------------------------------------
v2 tried to decouple the ML target from budget by scoring the whole catalog
unbudgeted and labeling with the tier the top-scoring slice fell into. Two
things went wrong:

1. Several scoring formulas are MONOTONIC in price-correlated specs with no
   cost penalty (score_motherboard even adds `price * 0.20` as a *reward*).
   Unbudgeted, "ideal" trivially becomes "the most expensive item that
   exists," for almost any intent. That's why the new report showed RAM,
   motherboard, and CPU cooler locked at "enthusiast" for all 3,500 cases.
2. Labels were cached by (primary, secondary, resolution) only, reused
   across every budget pair — so budget had literally zero relationship to
   the training target. Combined with #1, several targets collapsed to a
   constant, which is why "Mean RF Model Confidence: 99.76%" looked great
   but meant nothing.
Compliance fell to 43% because "enthusiast" RAM/motherboard/cooler now get
selected regardless of the user's actual budget.

THE V3 APPROACH: stop predicting an absolute price tier at all.
------------------------------------------------------------------
Predict, per category, what SHARE of the total budget an intent should
receive (a number between 0 and 1), independent of budget size. Then at
runtime: category_budget = predicted_share * budget_mid, and the existing
intent-weighted scoring functions pick the best SKU under that cap.

This fixes both reports at once:
  - Budget compliance becomes STRUCTURAL: shares are renormalized to sum to
    ~0.97 (small buffer for rounding/tax), so total spend is bounded by the
    budget by construction — not something the model has to learn or that a
    downstream step has to remember to enforce.
  - Workload sensitivity becomes real: a video-editing-heavy intent shifts
    money from GPU toward CPU/RAM/storage; a gaming intent shifts it back
    toward GPU. Different intents produce different MONEY DISTRIBUTIONS,
    not just different tie-breaks within a fixed-size slice.
  - It can't collapse to "always enthusiast" the way v2 did, because a
    share is relative by definition (shares across categories still have to
    sum to ~1), so there's no unbounded "biggest is always best" direction.

DATA-QUALITY FIX (the GT 710 issue)
-------------------------------------
Missing spec fields are DROPPED (clean_numeric), not imputed with the
column median — the old `.fillna(median)` silently gave average
performance credit to items with missing data, which is the likely cause
of the MSI GT 710 anomaly. That fix alone doesn't cover a card with
COMPLETE, accurate data that's simply weak but still wins the score race
at some intent settings (score_gpu's fixed `core*0.15` term rewards clock
speed regardless of activity) — so score_gpu also applies a hard minimum
VRAM/boost-clock floor (GPU_MIN_VRAM_GB / GPU_MIN_BOOST_MHZ) whenever a
workload has any real GPU demand, excluding display-class cards outright
before scoring runs.

CATALOG-FLOOR FIXES (this revision)
---------------------------------------
Four things added on top of the Supabase-integrated base this file started
from, all driven by live-catalog eval reports:

1. case_fan was entirely absent from select_build/BASE_ALLOC/category_demand
   despite being a real category with its own CSV path and Supabase table.
   Added throughout, splitting the old flat "case" 0.02 share into
   case=0.015 / case_fan=0.015.
2. Motherboard alternates weren't checked against the ALREADY-CHOSEN case's
   form factor (an ATX board alternate could be offered against a
   MicroATX-only case) — alternates_motherboard() now filters this directly,
   reusing the same MOBO_CASE_COMPAT map score_case() uses for the reverse
   direction.
3. Leftover-budget redistribution: at wide/high budget tiers the catalog
   runs out of pricier options before a category's share-cap is used up,
   leaving total spend well under budget_min even though every category was
   individually optimal. A bounded upgrade pass walks categories with
   remaining headroom (vs budget_max) and upgrades to the next-priciest
   already-scored alternative until spend reaches budget_min or nothing is
   left to upgrade to.
4. iGPU-skip: a pure Office/Browsing build at a tight budget was always
   forced to spend its GPU share (the single largest BASE_ALLOC share, 33%)
   on whatever the cheapest available discrete card was — the single
   biggest contributor to low-tier budget-compliance failures in live eval.
   When gpu_demand is negligible AND the chosen CPU already has usable
   integrated graphics, the discrete GPU is skipped entirely and that
   budget flows into the redistribution pass instead.

   IMPORTANT INTERACTION BUG THIS REVISION ALSO FIXES: the redistribution
   pass (#3) and the iGPU-skip (#4) were each correct in isolation but broke
   when combined — the redistribution pass could "upgrade" the CPU to a
   non-iGPU variant (e.g. the "F"-suffix Intel chips) AFTER the skip
   decision was already made, silently producing a build with no way to
   output video at all. When skip_discrete_gpu is True, the CPU upgrade
   pool is now constrained to iGPU-capable chips only. This was only caught
   by running the full pipeline against real catalog data end-to-end, not
   by reasoning about either fix in isolation — worth remembering before
   trusting the next one-off fix that only looks correct on paper.

STOCK FILTERING (this revision)
-----------------------------------
A component is only ever eligible for recommendation if stock > 0. This is
applied ONCE, centrally, inside _load_data() (see _apply_stock_filter) —
every downstream consumer (scoring, alternates, the redistribution pass,
swap_alternate) only ever sees in-stock rows, so there was no need to touch
nine separate scoring functions individually. It's a HARD filter, not a
soft scoring boost: an out-of-stock item should never surface at all, not
just rank lower — recommending something a walk-in customer can't actually
buy defeats the point of the in-store admin use case this was built for.
Stock is managed manually by the admin in Supabase; there is no
auto-replenishment signal, so an item stays excluded from every
recommendation until someone manually updates its stock count. Missing or
unparseable stock values are treated as 0 (excluded), never as "unlimited."

HOW TO RUN:
  python train_model_v3.py
  Outputs: smartbuild_model.pkl, tier_boundaries.json
  Data source: Supabase (live catalog) first, local CSV fallback.
"""

import os
import sys
import json
import itertools
import warnings
import logging
import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import r2_score

warnings.filterwarnings("ignore")

# Make the backend/ directory importable so supabase_service is reachable
# when this script is run directly (python train_model_v3.py)
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

logger = logging.getLogger(__name__)

# ── Paths (CSV fallback only — Supabase is the primary source) ─────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(os.path.dirname(BASE_DIR))
DATA_DIR = os.path.join(ROOT_DIR, "data")

PATHS = {
    "cpu":         os.path.join(DATA_DIR, "cpu_php_cleaned.csv"),
    "gpu":         os.path.join(DATA_DIR, "gpus_php_cleaned.csv"),
    "ram":         os.path.join(DATA_DIR, "ram_php_cleaned.csv"),
    "storage":     os.path.join(DATA_DIR, "storage_php_cleaned.csv"),
    "motherboard": os.path.join(DATA_DIR, "motherboard_php_cleaned.csv"),
    "psu":         os.path.join(DATA_DIR, "psu_php_cleaned.csv"),
    "case":        os.path.join(DATA_DIR, "case_php_cleaned.csv"),
    "cpu_cooler":  os.path.join(DATA_DIR, "cpu_cooler_php_cleaned.csv"),
    "case_fan":    os.path.join(DATA_DIR, "case_fan_php_cleaned.csv"),
}


# ── Data loading: Supabase-first, CSV fallback ─────────────────────────────
# Mirrors the same pattern used in services/recommender.py so that the
# sanity-check (and any future retrain that needs real catalog data) always
# gets the most up-to-date source available. Running this file is now how
# you retrain against whatever is LIVE in Supabase, not a frozen CSV snapshot.
def _load_data() -> dict[str, pd.DataFrame]:
    """Load all component tables.

    Priority:
      1. Supabase (live catalog)
      2. Local CSV files (offline / fallback)
    """
    numeric_cols_map = {
        "cpu":         ["price", "boost_clock", "core_count", "core_clock", "performance_score", "tdp", "stock"],
        "gpu":         ["price", "memory", "core_clock", "boost_clock", "stock"],
        "ram":         ["price", "speed_mhz", "total_capacity_gb", "first_word_latency", "stock"],
        "storage":     ["price", "capacity", "stock"],
        "motherboard": ["price", "max_memory", "memory_slots", "stock"],
        "psu":         ["price", "wattage", "stock"],
        "case":        ["price", "external_volume", "stock"],
        "cpu_cooler":  ["price", "size", "stock"],
        "case_fan":    ["price", "airflow_cfm", "stock"],
    }

    # Attempt Supabase import; gracefully degrade if credentials are missing
    try:
        from services.supabase_service import fetch_table_as_dataframe
        _supabase_available = True
    except Exception:
        _supabase_available = False
        fetch_table_as_dataframe = lambda _: None  # noqa: E731

    dfs: dict[str, pd.DataFrame] = {}
    for name, path in PATHS.items():
        df = None

        if _supabase_available:
            df = fetch_table_as_dataframe(name)
            if df is not None and not df.empty:
                logger.info(f"[data] '{name}' loaded from Supabase ({len(df):,} rows)")
                print(f"  {name}: {len(df):,} rows  [source: Supabase]")
            else:
                df = None  # fall through to CSV

        if df is None or df.empty:
            if os.path.exists(path):
                df = pd.read_csv(path)
                logger.info(f"[data] '{name}' loaded from local CSV ({len(df):,} rows)")
                print(f"  {name}: {len(df):,} rows  [source: local CSV]")
            else:
                logger.warning(f"[data] '{name}' — CSV not found and Supabase unavailable, skipping")
                print(f"  WARNING: '{name}' not available from any source — skipping")
                continue

        # Coerce numeric columns
        for col in numeric_cols_map.get(name, ["price"]):
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors="coerce")

        dfs[name] = df

    return _apply_stock_filter(dfs)


# ── Stock filter: applied once, centrally, so every downstream consumer
# (score_*, alternates_*, the redistribution pass, swap_alternate) only
# ever sees items that are actually in stock — no need to repeat this
# check in nine separate scoring functions. This is a HARD filter, not a
# soft scoring boost: a zero-stock item should never surface at all, not
# just rank lower, since recommending something a walk-in customer can't
# actually buy defeats the point of the in-store use case. Stock is
# managed manually by the admin (no auto-replenishment signal), so an
# item stays excluded until someone updates its stock count in Supabase.
def _apply_stock_filter(dfs: dict[str, pd.DataFrame]) -> dict[str, pd.DataFrame]:
    filtered: dict[str, pd.DataFrame] = {}
    for name, df in dfs.items():
        if "stock" not in df.columns:
            logger.warning(f"[stock] '{name}' has no 'stock' column — skipping stock filter for this category")
            print(f"  WARNING: '{name}' has no 'stock' column — all rows treated as available")
            filtered[name] = df
            continue

        before = len(df)
        # Missing/unparseable stock is treated as 0 (excluded), not as
        # "unlimited" — unknown stock should never be recommended either.
        stock_numeric = pd.to_numeric(df["stock"], errors="coerce").fillna(0)
        kept = df[stock_numeric > 0].copy()
        after = len(kept)
        if after < before:
            print(f"  {name}: {after}/{before} rows in stock (excluded {before - after} out-of-stock)")
        filtered[name] = kept
    return filtered

OUTPUT_MODEL = os.path.join(BASE_DIR, "smartbuild_model.pkl")
OUTPUT_TIERS = os.path.join(BASE_DIR, "tier_boundaries.json")

# ── Activity weights (unchanged) ────────────────────────────────────────────
ACTIVITY_WEIGHTS = {
    "Browsing & Streaming":        {"cpu_single":0.3,"cpu_multi":0.1,"gpu_compute":0.2,"vram":0.1,"ram_cap":0.2,"storage_spd":0.2},
    "Documents / Office Work":     {"cpu_single":0.4,"cpu_multi":0.3,"gpu_compute":0.0,"vram":0.0,"ram_cap":0.4,"storage_spd":0.3},
    "Gaming":                      {"cpu_single":0.7,"cpu_multi":0.3,"gpu_compute":0.9,"vram":0.6,"ram_cap":0.3,"storage_spd":0.6},
    "Video Editing":               {"cpu_single":0.3,"cpu_multi":0.9,"gpu_compute":0.6,"vram":0.5,"ram_cap":0.8,"storage_spd":0.9},
    "Photo / Graphic Design":      {"cpu_single":0.4,"cpu_multi":0.5,"gpu_compute":0.5,"vram":0.4,"ram_cap":0.6,"storage_spd":0.5},
    "3D Modeling or Animation":    {"cpu_single":0.3,"cpu_multi":0.8,"gpu_compute":0.9,"vram":0.9,"ram_cap":0.7,"storage_spd":0.6},
    "Music Production":            {"cpu_single":0.5,"cpu_multi":0.6,"gpu_compute":0.1,"vram":0.1,"ram_cap":0.7,"storage_spd":0.7},
    "Programming or Development":  {"cpu_single":0.5,"cpu_multi":0.7,"gpu_compute":0.1,"vram":0.1,"ram_cap":0.7,"storage_spd":0.6},
    "Streaming / Recording":       {"cpu_single":0.4,"cpu_multi":0.8,"gpu_compute":0.7,"vram":0.4,"ram_cap":0.6,"storage_spd":0.7},
    "Simulations / Data Analysis": {"cpu_single":0.3,"cpu_multi":0.9,"gpu_compute":0.5,"vram":0.4,"ram_cap":0.9,"storage_spd":0.8},
}

RESOLUTION_TARGET_WEIGHTS = {
    "1080p 60Hz (FHD Standard)":     {"tier_mult": 0.85, "vram_mult": 0.85, "gpu_compute_mult": 0.85, "cpu_single_mult": 1.00},
    "1080p 144Hz+ (FHD High FPS)":   {"tier_mult": 1.00, "vram_mult": 0.95, "gpu_compute_mult": 1.00, "cpu_single_mult": 1.15},
    "1440p 60-144Hz (QHD Standard)": {"tier_mult": 1.15, "vram_mult": 1.20, "gpu_compute_mult": 1.20, "cpu_single_mult": 1.05},
    "1440p 165Hz+ (QHD High FPS)":   {"tier_mult": 1.25, "vram_mult": 1.30, "gpu_compute_mult": 1.30, "cpu_single_mult": 1.15},
    "4K 60Hz+ (UHD Ultra)":          {"tier_mult": 1.40, "vram_mult": 1.50, "gpu_compute_mult": 1.50, "cpu_single_mult": 1.00},
}

# case_fan added: the old flat "case" 0.02 share is split 0.015/0.015
# between case and case_fan (was previously missing from this list entirely).
BASE_ALLOC = {
    "gpu": 0.33, "cpu": 0.19, "motherboard": 0.14, "ram": 0.11,
    "storage": 0.09, "psu": 0.08, "cpu_cooler": 0.04, "case": 0.015, "case_fan": 0.015,
}

GPU_TDP_MAP = {
    "RTX 5090":575,"RTX 5080":360,"RTX 5070 Ti":300,"RTX 5070":250,"RTX 5060 Ti":180,"RTX 5060":150,
    "RTX 4090":450,"RTX 4080":320,"RTX 4070 Ti":285,"RTX 4070":200,"RTX 4060 Ti":165,"RTX 4060":115,
    "RTX 3090":350,"RTX 3080":320,"RTX 3070":220,"RTX 3060 Ti":200,"RTX 3060":170,"RTX 3050":130,
    "RX 9070 XT":220,"RX 9070":200,"RX 9060 XT":150,
    "RX 7900 XTX":355,"RX 7900 XT":315,"RX 7800 XT":263,"RX 7700 XT":245,"RX 7600 XT":190,"RX 7600":165,
    "RX 6800 XT":300,"RX 6700 XT":230,"RX 6600 XT":160,"RX 6600":132,
    "Arc B580":190,"Arc B570":140,
}
PCIE5_CHIPSETS = ["Z790","Z890","X870","X670","TRX"]

# Kept only for cosmetic UI labeling of the FINAL chosen item's price
# (e.g. "high-tier GPU" in a summary) — no longer used as an ML target.
TIER_BOUNDARIES = {
    "cpu":         [5509,  18047, 28898],
    "gpu":         [20589, 57884, 94539],
    "ram":         [2899,  10439, 17624],
    "storage":     [4014,  13851, 21893],
    "motherboard": [9346,  20830, 30159],
    "psu":         [2500,  5000,  9000],
    "case":        [1500,  3500,  6000],
    "cpu_cooler":  [1000,  2500,  5000],
}
def price_to_tier(price: float, component: str) -> str:
    b = TIER_BOUNDARIES[component]
    if price < b[0]: return "budget"
    if price < b[1]: return "mid"
    if price < b[2]: return "high"
    return "enthusiast"

# Module-level so it can be reused both to pick a compatible CASE for a
# given motherboard (score_case) and, in the other direction, to filter
# MOTHERBOARD alternates against an already-chosen case (alternates_motherboard
# below) — an ATX board alternate should never be offered against a
# MicroATX-only case.
MOBO_CASE_COMPAT = {
    "ATX":       ["ATX Mid Tower","ATX Full Tower","ATX Desktop","ATX Test Bench"],
    "Micro ATX": ["MicroATX Mini Tower","MicroATX Mid Tower","MicroATX Desktop","ATX Mid Tower","ATX Full Tower"],
    "Mini ITX":  ["Mini ITX Tower","Mini ITX Desktop","MicroATX Mini Tower","ATX Mid Tower","ATX Full Tower"],
    "EATX":      ["ATX Full Tower","XL ATX"],
}


# ── Numeric cleanup: DROP incomplete rows instead of imputing the median ───
def clean_numeric(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    df = df.copy()
    for col in cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.dropna(subset=cols)


# ── Scoring utils ────────────────────────────────────────────────────────
def minmax(series: pd.Series) -> pd.Series:
    rng = series.max() - series.min()
    if rng == 0:
        return pd.Series([50.0] * len(series), index=series.index)
    return (series - series.min()) / rng * 100

def compute_intent(primary, secondary=None, resolution_target="1080p 144Hz+ (FHD High FPS)"):
    dims = ["cpu_single","cpu_multi","gpu_compute","vram","ram_cap","storage_spd"]
    p = ACTIVITY_WEIGHTS[primary]
    if secondary:
        s = ACTIVITY_WEIGHTS[secondary]
        base = {d: round(p[d]*0.70 + s[d]*0.30, 4) for d in dims}
    else:
        base = {d: p[d] for d in dims}
    res = RESOLUTION_TARGET_WEIGHTS.get(resolution_target, RESOLUTION_TARGET_WEIGHTS["1080p 144Hz+ (FHD High FPS)"])
    base["vram"]        *= res["vram_mult"]
    base["gpu_compute"] *= res["gpu_compute_mult"]
    base["cpu_single"]  *= res["cpu_single_mult"]
    return {d: round(v, 4) for d, v in base.items()}

def score_cpu(df, intent, tier_mult):
    df = clean_numeric(df, ["boost_clock","core_count","core_clock","performance_score"])
    if df.empty: return df
    sc, mc, base = minmax(df["boost_clock"]), minmax(df["core_count"]*df["core_clock"]), minmax(df["performance_score"])
    df["final_score"] = minmax((base*0.30 + sc*intent["cpu_single"] + mc*intent["cpu_multi"]) * tier_mult)
    return df

# Hard floor for GPU-driven workloads. clean_numeric() only catches cards
# with MISSING spec data. This excludes display-class cards outright once a
# workload has any real GPU demand, rather than trusting the score formula
# to rank them low.
GPU_MIN_VRAM_GB    = 4
GPU_MIN_BOOST_MHZ  = 1400
GPU_DEMAND_FLOOR_THRESHOLD = 0.10  # below this (e.g. pure office work), no floor is applied

def score_gpu(df, intent, tier_mult):
    df = clean_numeric(df, ["memory","core_clock","boost_clock"])
    if df.empty: return df
    gpu_demand = 0.55*intent["gpu_compute"] + 0.45*intent["vram"]
    if gpu_demand > GPU_DEMAND_FLOOR_THRESHOLD:
        floored = df[(df["memory"] >= GPU_MIN_VRAM_GB) & (df["boost_clock"] >= GPU_MIN_BOOST_MHZ)]
        if not floored.empty:  # never floor down to zero candidates
            df = floored
    vram, boost, core = minmax(df["memory"]), minmax(df["boost_clock"]), minmax(df["core_clock"])
    df["final_score"] = minmax((vram*intent["vram"] + boost*intent["gpu_compute"] + core*0.15) * tier_mult)
    return df

def score_ram(df, intent, tier_mult):
    df = clean_numeric(df, ["speed_mhz","total_capacity_gb","first_word_latency"])
    if df.empty: return df
    lat_inv  = minmax(1 / df["first_word_latency"].replace(0, np.nan).dropna())
    df = df.loc[lat_inv.index]
    speed, capacity = minmax(df["speed_mhz"]), minmax(df["total_capacity_gb"])
    ddr5 = (df["ddr_gen"] == "DDR5").astype(float) * 5
    df["final_score"] = minmax((capacity*intent["ram_cap"] + speed*0.30 + lat_inv*0.20 + ddr5) * tier_mult)
    return df

def score_storage(df, intent, tier_mult, pcie5_ok=True):
    df = df.copy()
    interface_tier = {"M.2 PCIe 5.0":5,"M.2 PCIe 4.0":4,"M.2 PCIe 3.0":3,"SATA":2}
    df["interface_tier"] = df["interface"].apply(lambda x: next((v for k,v in interface_tier.items() if k in str(x)), 1))
    if not pcie5_ok:
        df = df[df["interface_tier"] <= 4].copy()
    df = clean_numeric(df, ["capacity"])
    if df.empty: return df
    df["final_score"] = minmax((minmax(df["interface_tier"])*intent["storage_spd"] + minmax(df["capacity"])*0.30) * tier_mult)
    return df

def score_psu(df, cpu_tdp, gpu_est_watt):
    df = clean_numeric(df, ["wattage"])
    if df.empty: return df
    min_watt, max_watt = (cpu_tdp + gpu_est_watt) * 1.20, (cpu_tdp + gpu_est_watt) * 1.20 * 1.50
    eff_map = {"titanium":5,"platinum":4,"gold":3,"silver":2,"bronze":1,"80+":1,"plus":1}
    df["eff_score"] = df["efficiency"].str.lower().map(eff_map).fillna(1)
    banded = df[(df["wattage"] >= min_watt) & (df["wattage"] <= max_watt)].copy()
    if banded.empty:
        banded = df[df["wattage"] >= min_watt].copy()
    if banded.empty:
        banded = df.copy()
    banded["final_score"] = minmax(banded["eff_score"])
    return banded

def score_motherboard(df, cpu_socket, ram_ddr_gen):
    df = df[df["socket"] == cpu_socket].copy()
    if ram_ddr_gen == "DDR5":
        df = df[~df["name"].str.contains("DDR4", na=False)].copy()
    else:
        df = df[df["name"].str.contains("DDR4", na=False) | ~df["name"].str.contains("DDR5", na=False)].copy()
    df = clean_numeric(df, ["max_memory","memory_slots","price"])
    if df.empty: return df
    df["final_score"] = minmax(minmax(df["max_memory"])*0.50 + minmax(df["memory_slots"])*0.30 + minmax(df["price"])*0.20)
    return df

def score_case(df, mobo_ff):
    allowed = MOBO_CASE_COMPAT.get(mobo_ff, ["ATX Mid Tower","ATX Full Tower"])
    df = df[df["type"].isin(allowed)].copy()
    df = clean_numeric(df, ["external_volume"])
    if df.empty: return df
    df["final_score"] = minmax(df["external_volume"])
    return df

def score_case_fan(df):
    df = clean_numeric(df, ["airflow_cfm"]) if "airflow_cfm" in df.columns else df.copy()
    if df.empty:
        return df
    if "airflow_cfm" in df.columns:
        df["final_score"] = minmax(df["airflow_cfm"])
    else:  # no airflow spec available — fall back to price as a weak proxy
        df["final_score"] = minmax(df["price"] * -1)
    return df

def score_cooler(df, cpu_tdp):
    df = df.copy()
    df["size"] = pd.to_numeric(df["size"], errors="coerce")
    if cpu_tdp >= 125:
        df["is_aio"] = df["size"].notna().astype(float)
        df["size"]   = df["size"].fillna(0)
        df["final_score"] = minmax(minmax(df["is_aio"])*0.50 + minmax(df["size"])*0.50)
    else:
        df["size"] = df["size"].fillna(0)
        df["final_score"] = minmax(df["price"] * -1)
    return df


# ── STEP A: intent → ideal BUDGET SHARE per category ────────────────────────
def category_demand(intent: dict) -> dict:
    cpu_demand = 0.5*intent["cpu_single"] + 0.5*intent["cpu_multi"]
    gpu_demand = 0.55*intent["gpu_compute"] + 0.45*intent["vram"]
    return {
        "gpu":         gpu_demand,
        "cpu":         cpu_demand,
        "ram":         intent["ram_cap"],
        "storage":     intent["storage_spd"],
        "motherboard": 0.5*cpu_demand + 0.5*intent["ram_cap"],
        "psu":         0.6*gpu_demand + 0.4*cpu_demand,
        "cpu_cooler":  cpu_demand,
        "case":        0.5,  # doesn't meaningfully scale with workload
        "case_fan":    0.5,  # same — cosmetic/airflow, not intent-driven
    }

def _compute_baseline_demand() -> dict:
    """Average demand across all primary activities (no secondary, base
    resolution) — the reference point that adjustments are measured
    against, so a shift is relative rather than a global inflation."""
    all_demands = [category_demand(compute_intent(a)) for a in ACTIVITY_WEIGHTS]
    keys = all_demands[0].keys()
    return {k: float(np.mean([d[k] for d in all_demands])) for k in keys}

BASELINE_DEMAND = _compute_baseline_demand()

def compute_ideal_shares(intent: dict, adjust_strength: float = 0.6,
                          clip_range: tuple = (0.4, 2.2)) -> dict:
    demand = category_demand(intent)
    weights = {}
    for cat, base in BASE_ALLOC.items():
        rel  = demand[cat] - BASELINE_DEMAND[cat]
        mult = min(max(1 + adjust_strength * rel, clip_range[0]), clip_range[1])
        weights[cat] = base * mult
    total = sum(weights.values())
    return {cat: w / total for cat, w in weights.items()}  # sums to exactly 1.0


# ── Feature vector — budget is deliberately NOT included ───────────────────
def build_feature_row(primary, secondary, resolution_target):
    intent = compute_intent(primary, secondary, resolution_target)
    res = RESOLUTION_TARGET_WEIGHTS.get(resolution_target, RESOLUTION_TARGET_WEIGHTS["1080p 144Hz+ (FHD High FPS)"])
    return {
        "intent_cpu_single":  intent["cpu_single"],
        "intent_cpu_multi":   intent["cpu_multi"],
        "intent_gpu_compute": intent["gpu_compute"],
        "intent_vram":        intent["vram"],
        "intent_ram_cap":     intent["ram_cap"],
        "intent_storage_spd": intent["storage_spd"],
        "longevity_mult":     res["tier_mult"],
    }


def generate_training_data():
    print("Generating synthetic training data...")
    activities = list(ACTIVITY_WEIGHTS.keys())
    resolution_targets = list(RESOLUTION_TARGET_WEIGHTS.keys())
    records = []

    for primary, resolution_target in itertools.product(activities, resolution_targets):
        secondaries = [None] + [a for a in activities if a != primary]
        for sec in secondaries:
            intent = compute_intent(primary, sec, resolution_target)
            shares = compute_ideal_shares(intent)
            features = build_feature_row(primary, sec, resolution_target)
            records.append({**features, **{f"share_{k}": v for k, v in shares.items()}})

    df = pd.DataFrame(records)
    print(f"  Generated {len(df):,} training samples (full 10x10x5 intent grid, no budget dimension)")
    return df


def check_share_sensitivity():
    print("\nAllocation-share sensitivity check (fixed resolution, varying primary activity):")
    for act in ["Documents / Office Work", "Gaming", "Video Editing", "3D Modeling or Animation"]:
        shares = compute_ideal_shares(compute_intent(act))
        line = "  ".join(f"{k}={v:.2f}" for k, v in shares.items())
        print(f"  {act:<28} {line}")


def train(df):
    print("\nTraining Random Forest regressors (one per category)...")
    feature_cols = [
        "intent_cpu_single","intent_cpu_multi","intent_gpu_compute",
        "intent_vram","intent_ram_cap","intent_storage_spd","longevity_mult",
    ]
    target_cols = [f"share_{c}" for c in BASE_ALLOC]

    X = df[feature_cols]
    y = df[target_cols]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.20, random_state=42)
    print(f"  Train size: {len(X_train):,} | Test size: {len(X_test):,}")

    models = {}
    for col in target_cols:
        reg = RandomForestRegressor(
            n_estimators=200, max_depth=10, min_samples_leaf=3,
            random_state=42, n_jobs=1,
        )
        reg.fit(X_train, y_train[col])
        models[col] = reg
        r2 = r2_score(y_test[col], reg.predict(X_test))
        importances = sorted(zip(feature_cols, reg.feature_importances_), key=lambda x: -x[1])
        top3 = ", ".join(f"{name}={imp:.2f}" for name, imp in importances[:3])
        print(f"  {col:<20} R^2={r2:.3f}   top features: {top3}")

    return models, feature_cols, target_cols


_cached_artifact = None

def save_artifacts(models, feature_cols, target_cols):
    global _cached_artifact
    joblib.dump({"models": models, "feature_cols": feature_cols, "target_cols": target_cols}, OUTPUT_MODEL)
    with open(OUTPUT_TIERS, "w") as f:
        json.dump(TIER_BOUNDARIES, f, indent=2)
    _cached_artifact = None
    print(f"\n  Saved: {OUTPUT_MODEL}\n  Saved: {OUTPUT_TIERS}")


# ── STEP B: inference — predict shares, renormalize, apply to budget ───────
def predict_allocation(primary, secondary, resolution_target, model_path=OUTPUT_MODEL, buffer=0.97):
    """Returns per-category budget SHARES that sum to `buffer` (default
    0.97), leaving headroom for tax/shipping/rounding so total spend never
    exceeds the user's stated budget."""
    global _cached_artifact
    if _cached_artifact is None:
        _cached_artifact = joblib.load(model_path)
    artifact = _cached_artifact
    features = build_feature_row(primary, secondary, resolution_target)
    feat_df  = pd.DataFrame([features])[artifact["feature_cols"]]

    raw = {}
    for col in artifact["target_cols"]:
        cat = col.replace("share_", "")
        raw[cat] = max(float(artifact["models"][col].predict(feat_df)[0]), 0.0)

    total = sum(raw.values()) or 1.0
    return {cat: (v / total) * buffer for cat, v in raw.items()}


def select_build(budget_min, budget_max, primary, secondary, resolution_target, dfs, shares=None):
    """Full build selection: predicted allocation shares -> per-category
    budget caps -> existing intent-weighted scoring picks the best SKU
    under each cap. Total spend is bounded by construction."""
    if shares is None:
        shares = predict_allocation(primary, secondary, resolution_target)
    budget_mid = (budget_min + budget_max) / 2
    caps = {cat: share * budget_mid for cat, share in shares.items()}

    intent = compute_intent(primary, secondary, resolution_target)
    res = RESOLUTION_TARGET_WEIGHTS.get(resolution_target, RESOLUTION_TARGET_WEIGHTS["1080p 144Hz+ (FHD High FPS)"])
    tier_mult = res["tier_mult"]

    def pick_top_n(scored_df, cap, n=4):
        """Primary + alternates, with unique component names, ordered by score."""
        if scored_df.empty:
            return []
        affordable = scored_df[scored_df["price"] <= cap].sort_values("final_score", ascending=False)
        pool = affordable if not affordable.empty else scored_df.sort_values("price")
        seen = set()
        unique_cands = []
        for _, row in pool.iterrows():
            name = str(row.get("name", ""))
            if name not in seen:
                seen.add(name)
                unique_cands.append(row)
            if len(unique_cands) >= n:
                break
        return unique_cands

    def pick(scored_df, cap):
        candidates = pick_top_n(scored_df, cap, n=1)
        return candidates[0] if candidates else None

    # ── Constrained alternates ──────────────────────────────────────────
    def alternates_ram(scored_df, cap, mobo_row, main_row, n=3):
        cands = pick_top_n(scored_df, cap, n=n + 5)
        m_name = str(main_row.get("name", "")) if main_row is not None else ""
        cands = [r for r in cands if str(r.get("name", "")) != m_name]
        if mobo_row is not None and "max_memory" in mobo_row:
            max_mem = float(mobo_row.get("max_memory", 1e9))
            cands = [r for r in cands if float(r.get("total_capacity_gb", 0)) <= max_mem]
        return cands[:n]

    def alternates_cpu(scored_df, cap, mobo_row, main_row, n=3):
        cands = pick_top_n(scored_df, cap, n=n + 5)
        m_name = str(main_row.get("name", "")) if main_row is not None else ""
        cands = [r for r in cands if str(r.get("name", "")) != m_name]
        if mobo_row is not None and "socket" in mobo_row:
            sock = str(mobo_row.get("socket", ""))
            cands = [r for r in cands if str(r.get("socket", "")) == sock]
        return cands[:n]

    def alternates_psu(scored_df, cap, cpu_tdp, gpu_watt, main_row, n=3):
        min_watt = (cpu_tdp + gpu_watt) * 1.20  # strict floor
        cands = pick_top_n(scored_df, cap, n=n + 5)
        m_name = str(main_row.get("name", "")) if main_row is not None else ""
        cands = [r for r in cands if str(r.get("name", "")) != m_name and float(r.get("wattage", 0)) >= min_watt]
        return cands[:n]

    def alternates_gpu(scored_df, cap, psu_row, cpu_tdp, main_row, n=3):
        cands = pick_top_n(scored_df, cap, n=n + 5)
        m_name = str(main_row.get("name", "")) if main_row is not None else ""
        cands = [r for r in cands if str(r.get("name", "")) != m_name]
        if psu_row is not None and "wattage" in psu_row:
            headroom_watt = float(psu_row.get("wattage", 0)) / 1.20 - cpu_tdp
            def est_watt(r):
                chip = str(r.get("chipset", ""))
                return next((w for k, w in GPU_TDP_MAP.items() if k in chip), 200)
            cands = [r for r in cands if est_watt(r) <= headroom_watt]
        return cands[:n]

    def alternates_motherboard(scored_df, cap, case_row, main_row, n=3):
        cands = pick_top_n(scored_df, cap, n=n + 5)
        m_name = str(main_row.get("name", "")) if main_row is not None else ""
        cands = [r for r in cands if str(r.get("name", "")) != m_name]
        if case_row is not None and "type" in case_row:
            case_type = str(case_row.get("type", ""))
            cands = [r for r in cands
                     if case_type in MOBO_CASE_COMPAT.get(str(r.get("form_factor", "")), [])]
        return cands[:n]

    def alternates_generic(scored_df, cap, main_row, n=3):
        cands = pick_top_n(scored_df, cap, n=n + 5)
        m_name = str(main_row.get("name", "")) if main_row is not None else ""
        return [r for r in cands if str(r.get("name", "")) != m_name][:n]

    cpu_row = pick(score_cpu(dfs["cpu"], intent, tier_mult), caps["cpu"])
    cpu_tdp = float(cpu_row.get("tdp", 65)) if cpu_row is not None else 65.0
    cpu_sock = str(cpu_row.get("socket", "")) if cpu_row is not None else ""

    # ── iGPU-skip: when the activity has negligible GPU demand AND the
    # chosen CPU already has usable integrated graphics, skip the discrete
    # GPU entirely rather than forcing the cheapest available card into
    # every low-budget non-gaming build. GPU is the single largest
    # BASE_ALLOC share (33%), so this frees real money for the
    # redistribution pass below to spend on CPU/RAM/storage instead.
    GPU_SKIP_DEMAND_THRESHOLD = 0.12
    gpu_demand = 0.55 * intent["gpu_compute"] + 0.45 * intent["vram"]
    cpu_has_igpu = cpu_row is not None and pd.notna(cpu_row.get("graphics"))
    skip_discrete_gpu = (gpu_demand <= GPU_SKIP_DEMAND_THRESHOLD) and cpu_has_igpu

    if skip_discrete_gpu:
        gpu_row = None
        gpu_est_watt = 0  # iGPU power draw is already covered by cpu_tdp
    else:
        gpu_row = pick(score_gpu(dfs["gpu"], intent, tier_mult), caps["gpu"])
        gpu_chip = str(gpu_row.get("chipset", "")) if gpu_row is not None else ""
        gpu_est_watt = next((tdp for k, tdp in GPU_TDP_MAP.items() if k in gpu_chip), 200)

    # If CPU socket strictly mandates DDR5 (e.g. AM5), restrict RAM candidates to DDR5
    ram_df = dfs["ram"]
    if cpu_sock == "AM5":
        ram_df = ram_df[ram_df["ddr_gen"] == "DDR5"]

    ram_row = pick(score_ram(ram_df, intent, tier_mult), caps["ram"])
    ram_ddr = str(ram_row.get("ddr_gen", "DDR4")) if ram_row is not None else "DDR4"

    mb_row = pick(score_motherboard(dfs["motherboard"], cpu_sock, ram_ddr), caps["motherboard"])
    mobo_ff  = str(mb_row.get("form_factor", "ATX")) if mb_row is not None else "ATX"
    pcie5_ok = any(c in str(mb_row.get("name", "")) for c in PCIE5_CHIPSETS) if mb_row is not None else False

    stor_row = pick(score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok), caps["storage"])
    psu_row  = pick(score_psu(dfs["psu"], cpu_tdp, gpu_est_watt), caps["psu"])
    case_row = pick(score_case(dfs["case"], mobo_ff), caps["case"])
    cool_row = pick(score_cooler(dfs["cpu_cooler"], cpu_tdp), caps["cpu_cooler"])
    fan_row  = pick(score_case_fan(dfs["case_fan"]), caps["case_fan"]) if "case_fan" in dfs else None

    picks = {"cpu": cpu_row, "gpu": gpu_row, "ram": ram_row, "motherboard": mb_row,
             "storage": stor_row, "psu": psu_row, "case": case_row, "cpu_cooler": cool_row,
             "case_fan": fan_row}

    # ── Leftover-budget redistribution ──────────────────────────────────
    # v3's own caps are correctly sized, but at wide/high budget tiers the
    # catalog itself runs out of pricier options before the cap is used up.
    # That leaves total spend well under budget_min even though every
    # category was filled optimally within its own slice. Walk categories
    # that DO still have room between their pick's price and budget_max,
    # and upgrade one step at a time to the next-better already-scored
    # alternate, stopping once spend reaches budget_min or no category has
    # a valid upgrade left.
    def _total(p):
        return sum(float(r["price"]) for r in p.values() if r is not None and "price" in r)

    scored_pools = {
        "cpu": score_cpu(dfs["cpu"], intent, tier_mult),
        "gpu": score_gpu(dfs["gpu"], intent, tier_mult),
        "ram": score_ram(ram_df, intent, tier_mult),
        "storage": score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok),
    }
    # If the discrete GPU was skipped, the CPU's integrated graphics is the
    # ONLY video output -- an upgrade must never swap in a non-iGPU CPU, or
    # the build ends up with no way to display anything at all. Constrain
    # the CPU upgrade pool to iGPU-capable chips for the rest of this pass.
    # (Found by running the full pipeline against real catalog data — see
    # the module docstring.)
    if skip_discrete_gpu:
        scored_pools["cpu"] = scored_pools["cpu"][scored_pools["cpu"]["graphics"].notna()]

    total_price = _total(picks)
    max_upgrade_passes = 12  # safety bound, not expected to be hit
    for _ in range(max_upgrade_passes):
        if total_price >= budget_min:
            break
        upgraded_any = False
        for cat, pool in scored_pools.items():
            if pool.empty or picks[cat] is None:
                continue
            current_price = float(picks[cat]["price"])
            better = pool[pool["price"] > current_price].sort_values("price")
            if better.empty:
                continue
            candidate = better.iloc[0]
            projected_total = total_price - current_price + float(candidate["price"])
            if projected_total <= budget_max:
                picks[cat] = candidate
                total_price = projected_total
                upgraded_any = True
                if total_price >= budget_min:
                    break
        if not upgraded_any:
            break  # catalog genuinely has nothing left to upgrade to

    alternates = {
        "cpu":         alternates_cpu(score_cpu(dfs["cpu"], intent, tier_mult), caps["cpu"], mb_row, picks["cpu"]),
        "ram":         alternates_ram(score_ram(ram_df, intent, tier_mult), caps["ram"], mb_row, ram_row),
        "psu":         alternates_psu(score_psu(dfs["psu"], cpu_tdp, gpu_est_watt), caps["psu"], cpu_tdp, gpu_est_watt, psu_row),
        "gpu":         alternates_gpu(score_gpu(dfs["gpu"], intent, tier_mult), caps["gpu"], psu_row, cpu_tdp, picks["gpu"]),
        "motherboard": alternates_motherboard(score_motherboard(dfs["motherboard"], cpu_sock, ram_ddr), caps["motherboard"], case_row, mb_row),
        "storage":     alternates_generic(score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok), caps["storage"], picks["storage"]),
        "case":        alternates_generic(score_case(dfs["case"], mobo_ff), caps["case"], case_row),
        "cpu_cooler":  alternates_generic(score_cooler(dfs["cpu_cooler"], cpu_tdp), caps["cpu_cooler"], cool_row),
        "case_fan":    alternates_generic(score_case_fan(dfs["case_fan"]), caps["case_fan"], fan_row) if "case_fan" in dfs else [],
    }

    return picks, alternates, total_price, budget_mid


# ── Swapping an alternate ────────────────────────────────────────────────
# CPU, GPU and RAM alternates are always safe to swap in directly — nothing
# downstream depends on which specific one was chosen at generation time,
# only on the socket/TDP/DDR values it carries. But motherboard, PSU, case,
# and cooler were scored against whichever upstream item was the PRIMARY
# pick. Swap in a different CPU (different socket/TDP) or RAM (different
# DDR gen) and the previously-shown motherboard/PSU/cooler alternates can
# silently stop being compatible with the new upstream part. This function
# re-derives only the categories that actually depend on what changed,
# instead of re-running the whole build or trusting a stale combination.
# case_fan has no entries here deliberately — nothing depends on it, and it
# depends on nothing else, so it never needs re-deriving on a swap.
DOWNSTREAM_OF = {
    "cpu": ["motherboard", "psu", "cpu_cooler"],   # socket, TDP
    "ram": ["motherboard"],                         # DDR generation
    "gpu": ["psu"],                                 # estimated wattage
    "motherboard": ["storage", "case"],             # pcie5_ok, form factor
}

def swap_alternate(picks, changed_component, new_row, budget_mid, shares, intent, tier_mult, dfs):
    picks = dict(picks)
    picks[changed_component] = new_row

    affected = set(DOWNSTREAM_OF.get(changed_component, []))
    # Motherboard changing also invalidates whatever depends on motherboard
    if changed_component in ("cpu", "ram") and "motherboard" in affected:
        affected |= set(DOWNSTREAM_OF["motherboard"])

    cpu_tdp  = float(picks["cpu"].get("tdp", 65))
    cpu_sock = str(picks["cpu"].get("socket", ""))
    ram_ddr  = str(picks["ram"].get("ddr_gen", "DDR4"))
    gpu_chip = str(picks["gpu"].get("chipset", "")) if picks.get("gpu") is not None else ""
    gpu_est_watt = next((tdp for k, tdp in GPU_TDP_MAP.items() if k in gpu_chip), 200) if picks.get("gpu") is not None else 0

    if "motherboard" in affected:
        mb_s = score_motherboard(dfs["motherboard"], cpu_sock, ram_ddr)
        cap = shares["motherboard"] * budget_mid
        aff = mb_s[mb_s["price"] <= cap].sort_values("final_score", ascending=False)
        picks["motherboard"] = aff.iloc[0] if not aff.empty else mb_s.sort_values("price").iloc[0]

    mobo_ff  = str(picks["motherboard"].get("form_factor", "ATX"))
    pcie5_ok = any(c in str(picks["motherboard"].get("name", "")) for c in PCIE5_CHIPSETS)

    for comp in affected:
        if comp == "motherboard":
            continue
        cap = shares[comp] * budget_mid
        if comp == "storage":
            s = score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok)
        elif comp == "psu":
            s = score_psu(dfs["psu"], cpu_tdp, gpu_est_watt)
        elif comp == "case":
            s = score_case(dfs["case"], mobo_ff)
        elif comp == "cpu_cooler":
            s = score_cooler(dfs["cpu_cooler"], cpu_tdp)
        else:
            continue
        aff = s[s["price"] <= cap].sort_values("final_score", ascending=False)
        picks[comp] = aff.iloc[0] if not aff.empty else (s.sort_values("price").iloc[0] if not s.empty else None)

    return picks


if __name__ == "__main__":
    print("=" * 60)
    print("SmartBuild — RF Training Pipeline (v3: allocation-share regression)")
    print("=" * 60)

    check_share_sensitivity()

    train_df = generate_training_data()
    models, feature_cols, target_cols = train(train_df)
    save_artifacts(models, feature_cols, target_cols)

    print("\n" + "=" * 60)
    print("Training complete.")
    print("=" * 60)

    print("\nLoading component data for a live sanity check (Supabase-first)...")
    dfs = _load_data()

    print("\nSanity check — same budget, different activities:")
    for act in ["Documents / Office Work", "Gaming", "3D Modeling or Animation"]:
        picks, alternates, total, budget_mid = select_build(80000, 110000, act, None, "1440p 60-144Hz (QHD Standard)", dfs)
        cpu_name = picks["cpu"].get("name", "?") if picks["cpu"] is not None else "N/A"
        gpu_name = picks["gpu"].get("name", "?") if picks["gpu"] is not None else "SKIPPED (iGPU)"
        print(f"  {act:<28} total=P{total:,.0f} (budget_mid=P{budget_mid:,.0f})  CPU={cpu_name}  GPU={gpu_name}")

    print("\nSanity check — iGPU-skip at a tight non-gaming budget:")
    picks, alternates, total, budget_mid = select_build(20000, 30000, "Documents / Office Work", None, "1080p 60Hz (FHD Standard)", dfs)
    gpu_status = picks["gpu"].get("name", "?") if picks["gpu"] is not None else "SKIPPED (using CPU iGPU)"
    print(f"  Documents/Office @ P20k-30k -> total=P{total:,.0f}  CPU={picks['cpu'].get('name','?')}  GPU={gpu_status}")
