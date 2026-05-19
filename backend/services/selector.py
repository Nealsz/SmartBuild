"""
services/selector.py
Uses RF tier predictions as a price-band pre-filter, then scores
candidates within that band to pick the best component per category.

Flow per component:
  1. RF predicts tier (budget/mid/high/enthusiast)
  2. Filter CSV rows to that price band
  3. Score within band using hardware demand weights
  4. Pick highest scorer within budget ceiling
  5. Fallback to nearest-price if nothing fits
"""

import numpy as np
import pandas as pd

from config import (
    BASE_ALLOC,
    GPU_TDP_MAP,
    LONGEVITY_MULTIPLIER,
    PCIE5_CHIPSETS,
    TIER_BOUNDARIES,
)


# ── Shared util ────────────────────────────────────────────────────────────────
def _minmax(series: pd.Series) -> pd.Series:
    rng = series.max() - series.min()
    if rng == 0:
        return pd.Series([50.0] * len(series), index=series.index)
    return (series - series.min()) / rng * 100


def _tier_price_band(component: str, tier: str) -> tuple[float, float]:
    """Return (min_price, max_price) for a given component tier."""
    bounds = TIER_BOUNDARIES[component]
    bands = {
        "budget":     (0,         bounds[0]),
        "mid":        (bounds[0], bounds[1]),
        "high":       (bounds[1], bounds[2]),
        "enthusiast": (bounds[2], float("inf")),
    }
    return bands.get(tier, (0, float("inf")))


def _pick(df: pd.DataFrame, budget_ceil: float) -> pd.Series | None:
    """
    From a scored DataFrame, return the highest-scoring row within budget_ceil.
    Falls back to cheapest available if nothing fits the ceiling.
    """
    within = df[df["price"] <= budget_ceil]
    if not within.empty:
        return within.sort_values("final_score", ascending=False).iloc[0]
    # Fallback: cheapest row regardless of tier
    return df.sort_values("price").iloc[0] if not df.empty else None


# ── Per-component scorers ──────────────────────────────────────────────────────

def _score_cpu(df: pd.DataFrame, intent: dict, tier_mult: float) -> pd.DataFrame:
    df = df.copy()
    for col in ["boost_clock", "core_count", "core_clock", "performance_score"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    sc   = _minmax(df["boost_clock"])
    mc   = _minmax(df["core_count"] * df["core_clock"])
    base = _minmax(df["performance_score"])
    df["final_score"] = (
        base * 0.30 +
        sc   * intent["cpu_single"] +
        mc   * intent["cpu_multi"]
    ) * tier_mult
    df["final_score"] = _minmax(df["final_score"])
    return df


def _score_gpu(df: pd.DataFrame, intent: dict, tier_mult: float) -> pd.DataFrame:
    df = df.copy()
    for col in ["memory", "core_clock", "boost_clock"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(df[col].median())
    vram  = _minmax(df["memory"])
    boost = _minmax(df["boost_clock"])
    core  = _minmax(df["core_clock"])
    df["final_score"] = (
        vram  * intent["vram"] +
        boost * intent["gpu_compute"] +
        core  * 0.15
    ) * tier_mult
    df["final_score"] = _minmax(df["final_score"])
    return df


def _score_ram(df: pd.DataFrame, intent: dict, tier_mult: float) -> pd.DataFrame:
    df = df.copy()
    for col in ["speed_mhz", "total_capacity_gb", "first_word_latency"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(df[col].median())
    lat_inv  = _minmax(
        1 / df["first_word_latency"]
        .replace(0, np.nan)
        .fillna(df["first_word_latency"].median())
    )
    speed    = _minmax(df["speed_mhz"])
    capacity = _minmax(df["total_capacity_gb"])
    ddr5     = (df["ddr_gen"] == "DDR5").astype(float) * 5
    df["final_score"] = (
        capacity * intent["ram_cap"] +
        speed    * 0.30 +
        lat_inv  * 0.20 +
        ddr5
    ) * tier_mult
    df["final_score"] = _minmax(df["final_score"])
    return df


def _score_storage(
    df: pd.DataFrame,
    intent: dict,
    tier_mult: float,
    pcie5_ok: bool = True,
) -> pd.DataFrame:
    df = df.copy()
    interface_tier_map = {
        "M.2 PCIe 5.0": 5,
        "M.2 PCIe 4.0": 4,
        "M.2 PCIe 3.0": 3,
        "SATA":         2,
    }
    df["interface_tier"] = df["interface"].apply(
        lambda x: next((v for k, v in interface_tier_map.items() if k in str(x)), 1)
    )
    if not pcie5_ok:
        df = df[df["interface_tier"] <= 4].copy()
    df["capacity"] = pd.to_numeric(df["capacity"], errors="coerce").fillna(500)
    df["final_score"] = (
        _minmax(df["interface_tier"]) * intent["storage_spd"] +
        _minmax(df["capacity"])       * 0.30
    ) * tier_mult
    df["final_score"] = _minmax(df["final_score"])
    return df


def _score_motherboard(
    df: pd.DataFrame,
    cpu_socket: str,
    ram_ddr_gen: str,
) -> pd.DataFrame:
    """Motherboard is filtered by compatibility first, scored by platform quality."""
    df = df.copy()
    df = df[df["socket"] == cpu_socket].copy()
    if ram_ddr_gen == "DDR5":
        df = df[~df["name"].str.contains("DDR4", na=False)].copy()
    else:
        df = df[
            df["name"].str.contains("DDR4", na=False) |
            ~df["name"].str.contains("DDR5", na=False)
        ].copy()
    if df.empty:
        return df
    df["max_memory"]   = pd.to_numeric(df["max_memory"],   errors="coerce").fillna(0)
    df["memory_slots"] = pd.to_numeric(df["memory_slots"], errors="coerce").fillna(0)
    df["final_score"]  = (
        _minmax(df["max_memory"])   * 0.50 +
        _minmax(df["memory_slots"]) * 0.30 +
        _minmax(df["price"])        * 0.20   # higher price → better VRM assumed
    )
    df["final_score"] = _minmax(df["final_score"])
    return df


def _score_psu(
    df: pd.DataFrame,
    cpu_tdp: float,
    gpu_est_watt: int,
) -> tuple[pd.DataFrame, int, int]:
    """
    PSU is constraint-driven only — not intent-weighted.
    Wattage band: min = (cpu+gpu)*1.2, max = min*1.5
    Within band, pick highest efficiency rating.
    """
    df = df.copy()
    df["wattage"] = pd.to_numeric(df["wattage"], errors="coerce").fillna(0)
    min_watt = (cpu_tdp + gpu_est_watt) * 1.20
    max_watt = min_watt * 1.50
    eff_map  = {
        "titanium": 5, "platinum": 4, "gold": 3,
        "silver": 2, "bronze": 1, "80+": 1, "plus": 1,
    }
    df["eff_score"] = df["efficiency"].str.lower().map(eff_map).fillna(1)
    banded = df[(df["wattage"] >= min_watt) & (df["wattage"] <= max_watt)].copy()
    if banded.empty:
        banded = df[df["wattage"] >= min_watt].copy()
    if banded.empty:
        banded = df.copy()
    banded["final_score"] = _minmax(banded["eff_score"])
    return banded, int(min_watt), int(max_watt)


def _score_case(df: pd.DataFrame, mobo_form_factor: str) -> pd.DataFrame:
    form_compat = {
        "ATX":       ["ATX Mid Tower", "ATX Full Tower", "ATX Desktop", "ATX Test Bench"],
        "Micro ATX": ["MicroATX Mini Tower", "MicroATX Mid Tower", "MicroATX Desktop",
                      "ATX Mid Tower", "ATX Full Tower"],
        "Mini ITX":  ["Mini ITX Tower", "Mini ITX Desktop", "MicroATX Mini Tower",
                      "ATX Mid Tower", "ATX Full Tower"],
        "EATX":      ["ATX Full Tower", "XL ATX"],
    }
    allowed = form_compat.get(mobo_form_factor, ["ATX Mid Tower", "ATX Full Tower"])
    df = df[df["type"].isin(allowed)].copy()
    df["external_volume"] = pd.to_numeric(df["external_volume"], errors="coerce").fillna(40)
    df["final_score"] = _minmax(df["external_volume"])
    return df


def _score_cooler(df: pd.DataFrame, cpu_tdp: float) -> pd.DataFrame:
    df = df.copy()
    df["size"] = pd.to_numeric(df["size"], errors="coerce")
    if cpu_tdp >= 125:
        # High TDP — prefer AIO; size = radiator mm
        df["is_aio"]     = df["size"].notna().astype(float)
        df["size"]       = df["size"].fillna(0)
        df["final_score"] = _minmax(df["is_aio"]) * 0.50 + _minmax(df["size"]) * 0.50
    else:
        # Air cooler sufficient — pick cheapest adequate option
        df["size"]        = df["size"].fillna(0)
        df["final_score"] = _minmax(df["price"] * -1)
    df["final_score"] = _minmax(df["final_score"])
    return df


def _select_case_fan(df: pd.DataFrame, remaining_budget: float) -> pd.Series | None:
    """
    Case fan is not intent-weighted or compatibility-checked (no slot data in case CSV).
    Pick best-airflow 120mm fan within remaining budget.
    """
    df = df.copy()
    df["airflow"] = pd.to_numeric(
        df["airflow"].astype(str).str.split(",").str[-1], errors="coerce"
    ).fillna(0)
    candidates = df[(df["size"] == 120) & (df["price"] <= remaining_budget)]
    if candidates.empty:
        return None
    return candidates.sort_values("airflow", ascending=False).iloc[0]


# ── Main selector ──────────────────────────────────────────────────────────────

def select_build(
    dfs: dict[str, pd.DataFrame],
    tiers: dict[str, str],
    intent: dict[str, float],
    budget_min: int,
    budget_max: int,
    longevity: str,
    upgrade_open: bool,
) -> dict:
    """
    Selects the best component for each category using RF tier predictions
    as price-band filters, then scores within that band.

    Parameters
    ----------
    dfs          : loaded DataFrames keyed by component name
    tiers        : RF-predicted tier per component e.g. {"cpu": "mid", "gpu": "high", ...}
    intent       : blended hardware demand dimension weights from intent_classifier
    budget_min   : user minimum budget (PHP)
    budget_max   : user maximum budget (PHP)
    longevity    : "1-2 years" | "3-5 years" | "5+ years"
    upgrade_open : True if user wants upgrade path

    Returns
    -------
    dict with keys: cpu, gpu, ram, storage, motherboard, psu, case, cpu_cooler,
                    case_fan, psu_min_watt, psu_max_watt
    """
    tier_mult  = LONGEVITY_MULTIPLIER[longevity]
    alloc      = dict(BASE_ALLOC)

    if upgrade_open:
        alloc["gpu"]         -= 0.03
        alloc["motherboard"] += 0.02
        alloc["psu"]         += 0.01

    budget_mid = (budget_min + budget_max) / 2
    budgets    = {k: v * budget_mid for k, v in alloc.items()}

    # ── CPU ────────────────────────────────────────────────────────────────────
    # Pre-filter: exclude CPUs with unknown/missing sockets (no motherboard match)
    valid_cpus = dfs["cpu"][
        dfs["cpu"]["socket"].astype(str).str.strip().ne("")
        & ~dfs["cpu"]["socket"].astype(str).str.lower().isin(["unknown", "nan", "none"])
    ].copy()
    lo, hi   = _tier_price_band("cpu", tiers.get("cpu", "mid"))
    cpu_pool = valid_cpus[(valid_cpus["price"] >= lo) & (valid_cpus["price"] < hi)].copy()
    if cpu_pool.empty:
        cpu_pool = valid_cpus.copy()                     # fallback: all valid CPUs
    cpu_scored = _score_cpu(cpu_pool, intent, tier_mult)
    cpu_row    = _pick(cpu_scored, budgets["cpu"])
    if cpu_row is None:
        cpu_row = _score_cpu(valid_cpus, intent, tier_mult).sort_values("price").iloc[0]

    cpu_tdp  = float(cpu_row.get("tdp", 65))
    cpu_sock = str(cpu_row.get("socket", ""))

    # ── GPU ────────────────────────────────────────────────────────────────────
    lo, hi   = _tier_price_band("gpu", tiers.get("gpu", "mid"))
    gpu_pool = dfs["gpu"][(dfs["gpu"]["price"] >= lo) & (dfs["gpu"]["price"] < hi)].copy()
    if gpu_pool.empty:
        gpu_pool = dfs["gpu"].copy()
    gpu_scored   = _score_gpu(gpu_pool, intent, tier_mult)
    gpu_row      = _pick(gpu_scored, budgets["gpu"])
    if gpu_row is None:
        gpu_row = _score_gpu(dfs["gpu"], intent, tier_mult).sort_values("price").iloc[0]

    gpu_chip     = str(gpu_row.get("chipset", ""))
    gpu_est_watt = next((tdp for k, tdp in GPU_TDP_MAP.items() if k in gpu_chip), 200)

    # ── RAM ────────────────────────────────────────────────────────────────────
    lo, hi   = _tier_price_band("ram", tiers.get("ram", "mid"))
    ram_pool = dfs["ram"][(dfs["ram"]["price"] >= lo) & (dfs["ram"]["price"] < hi)].copy()
    if ram_pool.empty:
        ram_pool = dfs["ram"].copy()
    ram_scored = _score_ram(ram_pool, intent, tier_mult)
    ram_row    = _pick(ram_scored, budgets["ram"])
    if ram_row is None:
        ram_row = _score_ram(dfs["ram"], intent, tier_mult).sort_values("price").iloc[0]

    ram_ddr = str(ram_row.get("ddr_gen", "DDR4"))

    # ── MOTHERBOARD ────────────────────────────────────────────────────────────
    # Motherboard is compatibility-filtered first, tier-filtered second
    mb_compat = _score_motherboard(dfs["motherboard"], cpu_sock, ram_ddr)
    if mb_compat.empty:
        raise ValueError(f"No compatible motherboard found for socket={cpu_sock}, {ram_ddr}")
    lo, hi  = _tier_price_band("motherboard", tiers.get("motherboard", "mid"))
    mb_pool = mb_compat[(mb_compat["price"] >= lo) & (mb_compat["price"] < hi)].copy()
    if mb_pool.empty:
        mb_pool = mb_compat.copy()
    mb_row  = _pick(mb_pool, budgets["motherboard"])
    if mb_row is None:
        mb_row = mb_compat.sort_values("price").iloc[0]

    mb_name    = str(mb_row.get("name", ""))
    mobo_ff    = str(mb_row.get("form_factor", "ATX"))
    pcie5_ok   = any(c in mb_name for c in PCIE5_CHIPSETS)

    # ── STORAGE ────────────────────────────────────────────────────────────────
    lo, hi    = _tier_price_band("storage", tiers.get("storage", "mid"))
    stor_pool = dfs["storage"][(dfs["storage"]["price"] >= lo) & (dfs["storage"]["price"] < hi)].copy()
    if stor_pool.empty:
        stor_pool = dfs["storage"].copy()
    stor_scored = _score_storage(stor_pool, intent, tier_mult, pcie5_ok=pcie5_ok)
    stor_row    = _pick(stor_scored, budgets["storage"])
    if stor_row is None:
        stor_row = _score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok).sort_values("price").iloc[0]

    # ── PSU (constraint-driven — tier prediction is informational only) ────────
    psu_scored, min_watt, max_watt = _score_psu(dfs["psu"], cpu_tdp, gpu_est_watt)
    psu_row = _pick(psu_scored, budgets["psu"])
    if psu_row is None:
        psu_row = psu_scored.sort_values("price").iloc[0] if not psu_scored.empty else None

    # ── CASE ───────────────────────────────────────────────────────────────────
    case_compat = _score_case(dfs["case"], mobo_ff)
    lo, hi      = _tier_price_band("case", tiers.get("case", "mid"))
    case_pool   = case_compat[(case_compat["price"] >= lo) & (case_compat["price"] < hi)].copy()
    if case_pool.empty:
        case_pool = case_compat.copy()
    case_row = _pick(case_pool, budgets["case"])
    if case_row is None and not case_compat.empty:
        case_row = case_compat.sort_values("price").iloc[0]

    # ── CPU COOLER ─────────────────────────────────────────────────────────────
    lo, hi      = _tier_price_band("cpu_cooler", tiers.get("cpu_cooler", "mid"))
    cooler_pool = dfs["cpu_cooler"][
        (dfs["cpu_cooler"]["price"] >= lo) & (dfs["cpu_cooler"]["price"] < hi)
    ].copy()
    if cooler_pool.empty:
        cooler_pool = dfs["cpu_cooler"].copy()
    cool_scored = _score_cooler(cooler_pool, cpu_tdp)
    cool_row    = _pick(cool_scored, budgets["cpu_cooler"])
    if cool_row is None:
        cool_row = _score_cooler(dfs["cpu_cooler"], cpu_tdp).sort_values("price").iloc[0]

    # ── CASE FAN (from remaining budget — no tier, no hard compatibility) ──────
    spent = sum(
        float(r.get("price", 0))
        for r in [cpu_row, gpu_row, ram_row, stor_row, mb_row, psu_row, case_row, cool_row]
        if r is not None
    )
    fan_row = _select_case_fan(dfs["case_fan"], budget_max - spent)

    return {
        "cpu":          cpu_row,
        "gpu":          gpu_row,
        "ram":          ram_row,
        "storage":      stor_row,
        "motherboard":  mb_row,
        "psu":          psu_row,
        "case":         case_row,
        "cpu_cooler":   cool_row,
        "case_fan":     fan_row,
        "psu_min_watt": min_watt,
        "psu_max_watt": max_watt,
    }