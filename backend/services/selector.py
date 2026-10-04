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
    RESOLUTION_MULTIPLIER,
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
    Prioritizes items with stock > 0.
    """
    if "stock" in df.columns:
        in_stock = df[pd.to_numeric(df["stock"], errors="coerce").fillna(0) > 0]
        if not in_stock.empty:
            df = in_stock

    within = df[df["price"] <= budget_ceil]
    if not within.empty:
        return within.sort_values("final_score", ascending=False).iloc[0]
    # Fallback: cheapest row regardless of tier
    return df.sort_values("price").iloc[0] if not df.empty else None


def _pick_top3(df: pd.DataFrame, budget_ceil: float) -> tuple[pd.Series | None, list[pd.Series]]:
    """
    Return (main, [alt1, alt2]) from a scored DataFrame.
    Main  = highest-scoring row within budget_ceil (falls back to cheapest).
    Alts  = next 2 highest-scoring rows within budget_ceil that have different names.
    Prioritizes items with stock > 0.
    """
    if df.empty:
        return None, []

    if "stock" in df.columns:
        in_stock = df[pd.to_numeric(df["stock"], errors="coerce").fillna(0) > 0]
        if not in_stock.empty:
            df = in_stock

    within = df[df["price"] <= budget_ceil].sort_values("final_score", ascending=False)
    fallback = df.sort_values("price")

    pool = within if not within.empty else fallback
    if pool.empty:
        return None, []

    main = pool.iloc[0]
    seen_names = {str(main.get("name", ""))}

    alts: list[pd.Series] = []
    for _, row in pool.iloc[1:].iterrows():
        r_name = str(row.get("name", ""))
        if r_name not in seen_names:
            seen_names.add(r_name)
            alts.append(row)
        if len(alts) >= 2:
            break

    return main, alts


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
    resolution_target: str,
    is_calculating_min_budget: bool = False,
) -> dict:
    """
    Selects the best component for each category using RF tier predictions
    as price-band filters, then scores within that band.
    Returns a dict where each component key maps to
    {"main": pd.Series, "alternatives": [pd.Series, ...]}
    (except psu_min_watt / psu_max_watt which remain scalars).
    """
    tier_mult = RESOLUTION_MULTIPLIER.get(
        resolution_target,
        RESOLUTION_MULTIPLIER["1080p 144Hz+ (FHD High FPS)"],
    )
    alloc      = dict(BASE_ALLOC)

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
    cpu_main, cpu_alts = _pick_top3(cpu_scored, budgets["cpu"])
    if cpu_main is None:
        cpu_main = _score_cpu(valid_cpus, intent, tier_mult).sort_values("price").iloc[0]
        cpu_alts = []

    cpu_tdp  = float(cpu_main.get("tdp", 65))
    cpu_sock = str(cpu_main.get("socket", ""))

    # ── GPU ────────────────────────────────────────────────────────────────────
    lo, hi   = _tier_price_band("gpu", tiers.get("gpu", "mid"))
    gpu_pool = dfs["gpu"][(dfs["gpu"]["price"] >= lo) & (dfs["gpu"]["price"] < hi)].copy()
    if gpu_pool.empty:
        gpu_pool = dfs["gpu"].copy()
    gpu_scored          = _score_gpu(gpu_pool, intent, tier_mult)
    gpu_main, gpu_alts  = _pick_top3(gpu_scored, budgets["gpu"])
    if gpu_main is None:
        gpu_main = _score_gpu(dfs["gpu"], intent, tier_mult).sort_values("price").iloc[0]
        gpu_alts = []

    gpu_chip     = str(gpu_main.get("chipset", ""))
    gpu_est_watt = next((tdp for k, tdp in GPU_TDP_MAP.items() if k in gpu_chip), 200)

    # ── RAM ────────────────────────────────────────────────────────────────────
    lo, hi   = _tier_price_band("ram", tiers.get("ram", "mid"))
    ram_pool = dfs["ram"][(dfs["ram"]["price"] >= lo) & (dfs["ram"]["price"] < hi)].copy()
    if ram_pool.empty:
        ram_pool = dfs["ram"].copy()
    ram_scored          = _score_ram(ram_pool, intent, tier_mult)
    ram_main, ram_alts  = _pick_top3(ram_scored, budgets["ram"])
    if ram_main is None:
        ram_main = _score_ram(dfs["ram"], intent, tier_mult).sort_values("price").iloc[0]
        ram_alts = []

    ram_ddr = str(ram_main.get("ddr_gen", "DDR4"))

    # ── MOTHERBOARD ────────────────────────────────────────────────────────────
    # Motherboard is compatibility-filtered first, tier-filtered second
    mb_compat = _score_motherboard(dfs["motherboard"], cpu_sock, ram_ddr)
    if mb_compat.empty:
        raise ValueError(f"No compatible motherboard found for socket={cpu_sock}, {ram_ddr}")
    lo, hi  = _tier_price_band("motherboard", tiers.get("motherboard", "mid"))
    mb_pool = mb_compat[(mb_compat["price"] >= lo) & (mb_compat["price"] < hi)].copy()
    if mb_pool.empty:
        mb_pool = mb_compat.copy()
    mb_main, mb_alts = _pick_top3(mb_pool, budgets["motherboard"])
    if mb_main is None:
        mb_main = mb_compat.sort_values("price").iloc[0]
        mb_alts = []

    mb_name    = str(mb_main.get("name", ""))
    mobo_ff    = str(mb_main.get("form_factor", "ATX"))
    pcie5_ok   = any(c in mb_name for c in PCIE5_CHIPSETS)

    # ── STORAGE ────────────────────────────────────────────────────────────────
    lo, hi    = _tier_price_band("storage", tiers.get("storage", "mid"))
    stor_pool = dfs["storage"][(dfs["storage"]["price"] >= lo) & (dfs["storage"]["price"] < hi)].copy()
    if stor_pool.empty:
        stor_pool = dfs["storage"].copy()
    stor_scored           = _score_storage(stor_pool, intent, tier_mult, pcie5_ok=pcie5_ok)
    stor_main, stor_alts  = _pick_top3(stor_scored, budgets["storage"])
    if stor_main is None:
        stor_main = _score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok).sort_values("price").iloc[0]
        stor_alts = []

    # ── PSU (constraint-driven — tier prediction is informational only) ────────
    psu_scored, min_watt, max_watt = _score_psu(dfs["psu"], cpu_tdp, gpu_est_watt)
    psu_main, psu_alts = _pick_top3(psu_scored, budgets["psu"])
    if psu_main is None and not psu_scored.empty:
        psu_main = psu_scored.sort_values("price").iloc[0]
        psu_alts = []

    # ── CASE ───────────────────────────────────────────────────────────────────
    case_compat = _score_case(dfs["case"], mobo_ff)
    lo, hi      = _tier_price_band("case", tiers.get("case", "mid"))
    case_pool   = case_compat[(case_compat["price"] >= lo) & (case_compat["price"] < hi)].copy()
    if case_pool.empty:
        case_pool = case_compat.copy()
    case_main, case_alts = _pick_top3(case_pool, budgets["case"])
    if case_main is None and not case_compat.empty:
        case_main = case_compat.sort_values("price").iloc[0]
        case_alts = []

    # ── CPU COOLER ─────────────────────────────────────────────────────────────
    lo, hi      = _tier_price_band("cpu_cooler", tiers.get("cpu_cooler", "mid"))
    cooler_pool = dfs["cpu_cooler"][
        (dfs["cpu_cooler"]["price"] >= lo) & (dfs["cpu_cooler"]["price"] < hi)
    ].copy()
    if cooler_pool.empty:
        cooler_pool = dfs["cpu_cooler"].copy()
    cool_scored             = _score_cooler(cooler_pool, cpu_tdp)
    cool_main, cool_alts    = _pick_top3(cool_scored, budgets["cpu_cooler"])
    if cool_main is None:
        cool_main = _score_cooler(dfs["cpu_cooler"], cpu_tdp).sort_values("price").iloc[0]
        cool_alts = []

    # ── CASE FAN (from remaining budget — no tier, no hard compatibility) ──────
    spent = sum(
        float(r.get("price", 0))
        for r in [cpu_main, gpu_main, ram_main, stor_main, mb_main, psu_main, case_main, cool_main]
        if r is not None
    )
    fan_main = _select_case_fan(dfs["case_fan"], budget_max - spent)

    res_build = {
        "cpu":          {"main": cpu_main,   "alternatives": cpu_alts},
        "gpu":          {"main": gpu_main,   "alternatives": gpu_alts},
        "ram":          {"main": ram_main,   "alternatives": ram_alts},
        "storage":      {"main": stor_main,  "alternatives": stor_alts},
        "motherboard":  {"main": mb_main,    "alternatives": mb_alts},
        "psu":          {"main": psu_main,   "alternatives": psu_alts},
        "case":         {"main": case_main,  "alternatives": case_alts},
        "cpu_cooler":   {"main": cool_main,  "alternatives": cool_alts},
        "case_fan":     {"main": fan_main,   "alternatives": []},
        "psu_min_watt": min_watt,
        "psu_max_watt": max_watt,
    }

    # ── Post-processing: Budget Fit Enforcement ────────────────────────────────
    # Total is based on main picks only
    total_spent = sum(
        float(res_build[k]["main"].get("price", 0))
        for k in res_build
        if k not in ("psu_min_watt", "psu_max_watt") and res_build[k]["main"] is not None
    )

    if total_spent > budget_max and not is_calculating_min_budget:
        from .recommender import get_cheapest_compatible_build
        cheap_info = get_cheapest_compatible_build()

        # If budget_max is near the baseline minimum compatible build cost (or under cheap + 1000)
        if budget_max <= cheap_info["min_budget"] + 1000:
            cheapest_parts = cheap_info["parts"]
            res_build_cheap = {}
            for cat in ["cpu", "gpu", "ram", "motherboard", "storage", "psu", "case", "cpu_cooler", "case_fan"]:
                name = cheapest_parts.get(cat, {}).get("name")
                if name and cat in dfs:
                    row = dfs[cat][dfs[cat]["name"] == name]
                    res_build_cheap[cat] = {"main": row.iloc[0] if not row.empty else None, "alternatives": []}
                else:
                    res_build_cheap[cat] = {"main": None, "alternatives": []}
            res_build_cheap["psu_min_watt"] = min_watt
            res_build_cheap["psu_max_watt"] = max_watt
            return res_build_cheap

        # Trim components iteratively if budget_max is larger
        from .compatibility import check_compatibility, summarise
        for comp in ["gpu", "motherboard", "cpu", "ram", "storage", "case", "cpu_cooler", "psu"]:
            curr_entry = res_build.get(comp)
            if curr_entry is None or curr_entry["main"] is None:
                continue
            curr_price = float(curr_entry["main"].get("price", 0))
            df_comp = dfs[comp].copy()
            df_comp["price_num"] = pd.to_numeric(df_comp["price"], errors="coerce")
            cheaper_items = df_comp[df_comp["price_num"] < curr_price].sort_values("price_num")

            for _, item in cheaper_items.iterrows():
                test_build = dict(res_build)
                test_build[comp] = {"main": item, "alternatives": []}
                # Build a flat main-only view for compatibility check
                test_cand = {
                    k: v["main"]
                    for k, v in test_build.items()
                    if k not in ("psu_min_watt", "psu_max_watt") and isinstance(v, dict)
                }
                res = check_compatibility(test_cand, min_watt, max_watt)
                if summarise(res)["failures"] == 0:
                    res_build = test_build
                    new_tot = sum(
                        float(res_build[k]["main"].get("price", 0))
                        for k in res_build
                        if k not in ("psu_min_watt", "psu_max_watt") and res_build[k]["main"] is not None
                    )
                    if new_tot <= budget_max:
                        return res_build
                    break

    return res_build