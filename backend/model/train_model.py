"""
train_model.py
==============
SmartBuild — Random Forest Training Pipeline

APPROACH: Self-supervised synthetic generation
  1. Define a grid of realistic user inputs (budget × activity × longevity × upgrade)
  2. Run each combination through the scoring/selection logic (the "oracle")
  3. Label each selected component with a price tier (budget/mid/high/enthusiast)
  4. Train one multi-output Random Forest to predict all component tiers at once
  5. Save model + encoders + tier boundary metadata

The RF learns: given user intent features → what tier should each component be?
The selector then uses those tier predictions to filter/rank candidates from the CSV data.

HOW TO RUN:
  Ensure all *_php_cleaned.csv files are in the `data/` directory at the project root, then:
    python train_model.py
  Outputs: smartbuild_model.pkl, encoders.pkl, tier_boundaries.json
"""

import os
import json
import itertools
import warnings
import pandas as pd
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

warnings.filterwarnings("ignore")

# ── Paths ──────────────────────────────────────────────────────────────────────
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

OUTPUT_MODEL    = os.path.join(BASE_DIR, "smartbuild_model.pkl")
OUTPUT_ENCODERS = os.path.join(BASE_DIR, "encoders.pkl")
OUTPUT_TIERS    = os.path.join(BASE_DIR, "tier_boundaries.json")

# ── Activity weights (hardware demand dimensions) ──────────────────────────────
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

LONGEVITY_MULTIPLIER = {
    "1-2 years": 0.80,
    "3-5 years": 1.00,
    "5+ years":  1.20,
}

BASE_ALLOC = {
    "gpu":         0.33,
    "cpu":         0.19,
    "motherboard": 0.14,
    "ram":         0.11,
    "storage":     0.09,
    "psu":         0.08,
    "cpu_cooler":  0.04,
    "case":        0.02,
}

GPU_TDP_MAP = {
    "RTX 5090":575,"RTX 5080":360,"RTX 5070 Ti":300,"RTX 5070":250,
    "RTX 5060 Ti":180,"RTX 5060":150,
    "RTX 4090":450,"RTX 4080":320,"RTX 4070 Ti":285,"RTX 4070":200,
    "RTX 4060 Ti":165,"RTX 4060":115,
    "RTX 3090":350,"RTX 3080":320,"RTX 3070":220,"RTX 3060 Ti":200,
    "RTX 3060":170,"RTX 3050":130,
    "RX 9070 XT":220,"RX 9070":200,"RX 9060 XT":150,
    "RX 7900 XTX":355,"RX 7900 XT":315,"RX 7800 XT":263,
    "RX 7700 XT":245,"RX 7600 XT":190,"RX 7600":165,
    "RX 6800 XT":300,"RX 6700 XT":230,"RX 6600 XT":160,"RX 6600":132,
    "Arc B580":190,"Arc B570":140,
}

PCIE5_CHIPSETS = ["Z790","Z890","X870","X670","TRX"]

# ── Tier boundaries (from price quantile analysis) ─────────────────────────────
# Tier 0=budget, 1=mid, 2=high, 3=enthusiast
TIER_BOUNDARIES = {
    "cpu":         [5509,  18047, 28898],   # <25th | 25–75th | 75–90th | >90th
    "gpu":         [20589, 57884, 94539],
    "ram":         [2899,  10439, 17624],
    "storage":     [4014,  13851, 21893],
    "motherboard": [9346,  20830, 30159],
    "psu":         [2500,  5000,  9000],    # PSU tiers estimated (not intent-driven)
    "case":        [1500,  3500,  6000],
    "cpu_cooler":  [1000,  2500,  5000],
}

def price_to_tier(price: float, component: str) -> str:
    bounds = TIER_BOUNDARIES[component]
    if price < bounds[0]:
        return "budget"
    elif price < bounds[1]:
        return "mid"
    elif price < bounds[2]:
        return "high"
    else:
        return "enthusiast"


# ── Scoring utils (mirrors pc_recommender.py) ──────────────────────────────────
def minmax(series: pd.Series) -> pd.Series:
    rng = series.max() - series.min()
    if rng == 0:
        return pd.Series([50.0] * len(series), index=series.index)
    return (series - series.min()) / rng * 100

def compute_intent(primary: str, secondary: str | None = None) -> dict:
    dims = ["cpu_single","cpu_multi","gpu_compute","vram","ram_cap","storage_spd"]
    p = ACTIVITY_WEIGHTS[primary]
    if secondary:
        s = ACTIVITY_WEIGHTS[secondary]
        return {d: round(p[d]*0.70 + s[d]*0.30, 4) for d in dims}
    return {d: p[d] for d in dims}

def apply_longevity(longevity: str, upgrade_open: bool) -> tuple[dict, float]:
    mult = LONGEVITY_MULTIPLIER[longevity]
    alloc = dict(BASE_ALLOC)
    if upgrade_open:
        alloc["gpu"]         -= 0.03
        alloc["motherboard"] += 0.02
        alloc["psu"]         += 0.01
    return alloc, mult

def score_cpu(df, intent, tier_mult):
    df = df.copy()
    for col in ["boost_clock","core_count","core_clock","performance_score"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    sc   = minmax(df["boost_clock"])
    mc   = minmax(df["core_count"] * df["core_clock"])
    base = minmax(df["performance_score"])
    df["final_score"] = (base*0.30 + sc*intent["cpu_single"] + mc*intent["cpu_multi"]) * tier_mult
    df["final_score"] = minmax(df["final_score"])
    return df

def score_gpu(df, intent, tier_mult):
    df = df.copy()
    for col in ["memory","core_clock","boost_clock"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(df[col].median())
    vram  = minmax(df["memory"])
    boost = minmax(df["boost_clock"])
    core  = minmax(df["core_clock"])
    df["final_score"] = (vram*intent["vram"] + boost*intent["gpu_compute"] + core*0.15) * tier_mult
    df["final_score"] = minmax(df["final_score"])
    return df

def score_ram(df, intent, tier_mult):
    df = df.copy()
    for col in ["speed_mhz","total_capacity_gb","first_word_latency"]:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(df[col].median())
    lat_inv  = minmax(1 / df["first_word_latency"].replace(0, np.nan).fillna(df["first_word_latency"].median()))
    speed    = minmax(df["speed_mhz"])
    capacity = minmax(df["total_capacity_gb"])
    ddr5     = (df["ddr_gen"] == "DDR5").astype(float) * 5
    df["final_score"] = (capacity*intent["ram_cap"] + speed*0.30 + lat_inv*0.20 + ddr5) * tier_mult
    df["final_score"] = minmax(df["final_score"])
    return df

def score_storage(df, intent, tier_mult, pcie5_ok=True):
    df = df.copy()
    interface_tier = {"M.2 PCIe 5.0":5,"M.2 PCIe 4.0":4,"M.2 PCIe 3.0":3,"SATA":2}
    df["interface_tier"] = df["interface"].apply(
        lambda x: next((v for k,v in interface_tier.items() if k in str(x)), 1)
    )
    if not pcie5_ok:
        df = df[df["interface_tier"] <= 4].copy()
    df["capacity"] = pd.to_numeric(df["capacity"], errors="coerce").fillna(500)
    df["final_score"] = (minmax(df["interface_tier"])*intent["storage_spd"] + minmax(df["capacity"])*0.30) * tier_mult
    df["final_score"] = minmax(df["final_score"])
    return df

def score_psu(df, cpu_tdp, gpu_est_watt):
    df = df.copy()
    df["wattage"] = pd.to_numeric(df["wattage"], errors="coerce").fillna(0)
    min_watt = (cpu_tdp + gpu_est_watt) * 1.20
    max_watt = min_watt * 1.50
    eff_map  = {"titanium":5,"platinum":4,"gold":3,"silver":2,"bronze":1,"80+":1,"plus":1}
    df["eff_score"] = df["efficiency"].str.lower().map(eff_map).fillna(1)
    banded = df[(df["wattage"] >= min_watt) & (df["wattage"] <= max_watt)].copy()
    if banded.empty:
        banded = df[df["wattage"] >= min_watt].copy()
    if banded.empty:
        banded = df.copy()
    banded["final_score"] = minmax(banded["eff_score"])
    return banded

def score_motherboard(df, cpu_socket, ram_ddr_gen):
    df = df.copy()
    df = df[df["socket"] == cpu_socket].copy()
    if ram_ddr_gen == "DDR5":
        df = df[~df["name"].str.contains("DDR4", na=False)].copy()
    else:
        df = df[df["name"].str.contains("DDR4", na=False) |
                ~df["name"].str.contains("DDR5", na=False)].copy()
    df["max_memory"]   = pd.to_numeric(df["max_memory"],   errors="coerce").fillna(0)
    df["memory_slots"] = pd.to_numeric(df["memory_slots"], errors="coerce").fillna(0)
    df["final_score"]  = (
        minmax(df["max_memory"])   * 0.50 +
        minmax(df["memory_slots"]) * 0.30 +
        minmax(df["price"])        * 0.20
    )
    df["final_score"] = minmax(df["final_score"])
    return df

def score_case(df, mobo_ff):
    form_compat = {
        "ATX":       ["ATX Mid Tower","ATX Full Tower","ATX Desktop","ATX Test Bench"],
        "Micro ATX": ["MicroATX Mini Tower","MicroATX Mid Tower","MicroATX Desktop","ATX Mid Tower","ATX Full Tower"],
        "Mini ITX":  ["Mini ITX Tower","Mini ITX Desktop","MicroATX Mini Tower","ATX Mid Tower","ATX Full Tower"],
        "EATX":      ["ATX Full Tower","XL ATX"],
    }
    allowed = form_compat.get(mobo_ff, ["ATX Mid Tower","ATX Full Tower"])
    df = df[df["type"].isin(allowed)].copy()
    df["external_volume"] = pd.to_numeric(df["external_volume"], errors="coerce").fillna(40)
    df["final_score"] = minmax(df["external_volume"])
    return df

def score_cooler(df, cpu_tdp):
    df = df.copy()
    df["size"] = pd.to_numeric(df["size"], errors="coerce")
    if cpu_tdp >= 125:
        df["is_aio"] = df["size"].notna().astype(float)
        df["size"]   = df["size"].fillna(0)
        df["final_score"] = minmax(df["is_aio"])*0.50 + minmax(df["size"])*0.50
    else:
        df["size"] = df["size"].fillna(0)
        df["final_score"] = minmax(df["price"] * -1)
    df["final_score"] = minmax(df["final_score"])
    return df


# ── Oracle: run one input combination through the recommender ─────────────────
def run_oracle(dfs, budget_min, budget_max, primary, secondary, longevity, upgrade_open):
    """
    Runs the scoring/selection logic for one input combination.
    Returns a dict of {component: selected_row} or None if selection fails.
    """
    intent = compute_intent(primary, secondary)
    alloc, tier_mult = apply_longevity(longevity, upgrade_open)
    budget_mid = (budget_min + budget_max) / 2
    budgets = {k: v * budget_mid for k, v in alloc.items()}

    try:
        # CPU
        cpu_s    = score_cpu(dfs["cpu"], intent, tier_mult)
        cpu_pick = cpu_s[cpu_s["price"] <= budgets["cpu"]].sort_values("final_score", ascending=False)
        if cpu_pick.empty:
            cpu_pick = cpu_s.sort_values("price")
        cpu_row  = cpu_pick.iloc[0]
        cpu_tdp  = float(cpu_row.get("tdp", 65))
        cpu_sock = str(cpu_row.get("socket", ""))

        # GPU
        gpu_s    = score_gpu(dfs["gpu"], intent, tier_mult)
        gpu_pick = gpu_s[gpu_s["price"] <= budgets["gpu"]].sort_values("final_score", ascending=False)
        if gpu_pick.empty:
            gpu_pick = gpu_s.sort_values("price")
        gpu_row      = gpu_pick.iloc[0]
        gpu_chip     = str(gpu_row.get("chipset", ""))
        gpu_est_watt = next((tdp for k, tdp in GPU_TDP_MAP.items() if k in gpu_chip), 200)

        # RAM
        ram_s    = score_ram(dfs["ram"], intent, tier_mult)
        ram_pick = ram_s[ram_s["price"] <= budgets["ram"]].sort_values("final_score", ascending=False)
        if ram_pick.empty:
            ram_pick = ram_s.sort_values("price")
        ram_row = ram_pick.iloc[0]
        ram_ddr = str(ram_row.get("ddr_gen", "DDR4"))

        # Motherboard
        mb_s    = score_motherboard(dfs["motherboard"], cpu_sock, ram_ddr)
        if mb_s.empty:
            return None
        mb_pick = mb_s[mb_s["price"] <= budgets["motherboard"]].sort_values("final_score", ascending=False)
        if mb_pick.empty:
            mb_pick = mb_s.sort_values("price")
        mb_row     = mb_pick.iloc[0]
        mb_name    = str(mb_row.get("name", ""))
        pcie5_ok   = any(c in mb_name for c in PCIE5_CHIPSETS)

        # Storage
        stor_s    = score_storage(dfs["storage"], intent, tier_mult, pcie5_ok=pcie5_ok)
        stor_pick = stor_s[stor_s["price"] <= budgets["storage"]].sort_values("final_score", ascending=False)
        if stor_pick.empty:
            stor_pick = stor_s.sort_values("price")
        stor_row = stor_pick.iloc[0]

        # PSU
        psu_s    = score_psu(dfs["psu"], cpu_tdp, gpu_est_watt)
        psu_pick = psu_s[psu_s["price"] <= budgets["psu"]].sort_values("final_score", ascending=False)
        if psu_pick.empty:
            psu_pick = psu_s.sort_values("price")
        psu_row = psu_pick.iloc[0] if not psu_pick.empty else None

        # Case
        mobo_ff   = str(mb_row.get("form_factor", "ATX"))
        case_s    = score_case(dfs["case"], mobo_ff)
        case_pick = case_s[case_s["price"] <= budgets["case"]].sort_values("final_score", ascending=False)
        if case_pick.empty:
            case_pick = case_s.sort_values("price")
        case_row = case_pick.iloc[0] if not case_pick.empty else None

        # CPU Cooler
        cool_s    = score_cooler(dfs["cpu_cooler"], cpu_tdp)
        cool_pick = cool_s[cool_s["price"] <= budgets["cpu_cooler"]].sort_values("final_score", ascending=False)
        if cool_pick.empty:
            cool_pick = cool_s.sort_values("price")
        cool_row = cool_pick.iloc[0] if not cool_pick.empty else None

        return {
            "cpu":         cpu_row,
            "gpu":         gpu_row,
            "ram":         ram_row,
            "storage":     stor_row,
            "motherboard": mb_row,
            "psu":         psu_row,
            "case":        case_row,
            "cpu_cooler":  cool_row,
        }

    except Exception as e:
        return None


# ── Build feature vector from one input combination ───────────────────────────
def build_feature_row(budget_min, budget_max, primary, secondary, longevity, upgrade_open):
    intent = compute_intent(primary, secondary)
    budget_mid  = (budget_min + budget_max) / 2
    budget_norm = budget_mid / 200_000          # normalise to ~0–1 range
    spread_norm = (budget_max - budget_min) / 200_000

    return {
        # Budget features
        "budget_mid":         budget_mid,
        "budget_norm":        round(budget_norm, 4),
        "budget_spread_norm": round(spread_norm, 4),
        "performance_bias":   round(min(budget_norm * 0.5 + spread_norm * 0.5, 1.0), 4),

        # Intent dimension weights
        "intent_cpu_single":  intent["cpu_single"],
        "intent_cpu_multi":   intent["cpu_multi"],
        "intent_gpu_compute": intent["gpu_compute"],
        "intent_vram":        intent["vram"],
        "intent_ram_cap":     intent["ram_cap"],
        "intent_storage_spd": intent["storage_spd"],

        # Longevity & upgrade
        "longevity_mult":     LONGEVITY_MULTIPLIER[longevity],
        "upgrade_open":       int(upgrade_open),
    }


# ── Generate synthetic training data ─────────────────────────────────────────
def generate_training_data(dfs):
    print("Generating synthetic training data...")

    activities = list(ACTIVITY_WEIGHTS.keys())
    longevities = list(LONGEVITY_MULTIPLIER.keys())
    upgrade_options = [False, True]

    # Budget grid — covers entry to high-end PH builds
    budget_pairs = [
        (15000,  25000),
        (20000,  35000),
        (25000,  45000),
        (30000,  50000),
        (35000,  60000),
        (40000,  65000),
        (45000,  75000),
        (50000,  80000),
        (60000,  100000),
        (70000,  120000),
        (80000,  150000),
        (100000, 180000),
        (120000, 200000),
    ]

    # Secondary activity pairs (None + each combo of primary ≠ secondary)
    records = []
    total_combinations = 0

    for (bmin, bmax), primary, longevity, upgrade in itertools.product(
        budget_pairs, activities, longevities, upgrade_options
    ):
        # Primary only
        combinations = [(primary, None)]
        # Primary + each secondary (skip same as primary)
        for sec in activities:
            if sec != primary:
                combinations.append((primary, sec))

        for prim, sec in combinations:
            total_combinations += 1
            result = run_oracle(dfs, bmin, bmax, prim, sec, longevity, upgrade)
            if result is None:
                continue

            features = build_feature_row(bmin, bmax, prim, sec, longevity, upgrade)

            # Label: price tier for each component
            labels = {}
            for comp in ["cpu","gpu","ram","storage","motherboard","psu","case","cpu_cooler"]:
                row = result.get(comp)
                if row is not None and comp in TIER_BOUNDARIES:
                    labels[f"tier_{comp}"] = price_to_tier(float(row.get("price", 0)), comp)
                else:
                    labels[f"tier_{comp}"] = "budget"

            records.append({**features, **labels})

    df = pd.DataFrame(records)
    print(f"  Generated {len(df):,} training samples from {total_combinations:,} combinations")
    return df


# ── Train the Random Forest ───────────────────────────────────────────────────
def train(df):
    print("\nTraining Random Forest model...")

    feature_cols = [
        "budget_mid","budget_norm","budget_spread_norm","performance_bias",
        "intent_cpu_single","intent_cpu_multi","intent_gpu_compute",
        "intent_vram","intent_ram_cap","intent_storage_spd",
        "longevity_mult","upgrade_open",
    ]

    target_cols = [
        "tier_cpu","tier_gpu","tier_ram","tier_storage",
        "tier_motherboard","tier_psu","tier_case","tier_cpu_cooler",
    ]

    X = df[feature_cols]

    # Encode all tier labels
    encoders = {}
    y_encoded = pd.DataFrame(index=df.index)

    for col in target_cols:
        le = LabelEncoder()
        y_encoded[col] = le.fit_transform(df[col])
        encoders[col] = le
        print(f"  {col}: classes = {list(le.classes_)}")

    # Train one RF per target column (multi-output via loop)
    # This is cleaner than MultiOutputClassifier for per-target evaluation
    models = {}
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.20, random_state=42
    )

    print(f"\n  Train size: {len(X_train):,} | Test size: {len(X_test):,}")

    for col in target_cols:
        clf = RandomForestClassifier(
            n_estimators=200,
            max_depth=12,
            min_samples_leaf=3,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        clf.fit(X_train, y_train[col])
        models[col] = clf

        # Evaluation
        y_pred = clf.predict(X_test)
        report = classification_report(
            y_test[col], y_pred,
            target_names=encoders[col].classes_,
            zero_division=0,
            output_dict=True,
        )
        acc = report["accuracy"]
        f1  = report["weighted avg"]["f1-score"]
        print(f"  {col:<22} accuracy={acc:.3f}  weighted-F1={f1:.3f}")

    return models, encoders, feature_cols, target_cols


# ── Save artifacts ────────────────────────────────────────────────────────────
def save_artifacts(models, encoders, feature_cols, target_cols):
    joblib.dump({
        "models":       models,
        "feature_cols": feature_cols,
        "target_cols":  target_cols,
    }, OUTPUT_MODEL)

    joblib.dump(encoders, OUTPUT_ENCODERS)

    with open(OUTPUT_TIERS, "w") as f:
        json.dump(TIER_BOUNDARIES, f, indent=2)

    print(f"\n  Saved: {OUTPUT_MODEL}")
    print(f"  Saved: {OUTPUT_ENCODERS}")
    print(f"  Saved: {OUTPUT_TIERS}")


# ── Inference helper (used by recommender at runtime) ─────────────────────────
def predict_tiers(
    budget_min: int,
    budget_max: int,
    primary: str,
    secondary: str | None,
    longevity: str,
    upgrade_open: bool,
    model_path: str = OUTPUT_MODEL,
    encoder_path: str = OUTPUT_ENCODERS,
) -> dict[str, str]:
    """
    Given user inputs, return predicted tier per component.
    E.g. {"cpu": "mid", "gpu": "high", "ram": "mid", ...}
    """
    artifact = joblib.load(model_path)
    encoders = joblib.load(encoder_path)

    features   = build_feature_row(budget_min, budget_max, primary, secondary, longevity, upgrade_open)
    feat_df    = pd.DataFrame([features])[artifact["feature_cols"]]
    predictions = {}

    for col in artifact["target_cols"]:
        clf      = artifact["models"][col]
        encoded  = clf.predict(feat_df)[0]
        tier     = encoders[col].inverse_transform([encoded])[0]
        comp     = col.replace("tier_", "")
        predictions[comp] = tier

    return predictions


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print("SmartBuild — RF Training Pipeline")
    print("=" * 60)

    # Load all CSVs
    print("\nLoading component data...")
    dfs = {}
    for name, path in PATHS.items():
        if not os.path.exists(path):
            print(f"  WARNING: {path} not found — skipping")
            continue
        dfs[name] = pd.read_csv(path)
        print(f"  {name}: {len(dfs[name]):,} rows")

    # Generate training data
    train_df = generate_training_data(dfs)

    # Train
    models, encoders, feature_cols, target_cols = train(train_df)

    # Save
    save_artifacts(models, encoders, feature_cols, target_cols)

    print("\n" + "=" * 60)
    print("Training complete.")
    print("=" * 60)

    # Quick sanity check
    print("\nSanity check — Gaming + Video Editing, ₱50k–₱80k, 3-5 years:")
    tiers = predict_tiers(50000, 80000, "Gaming", "Video Editing", "3-5 years", False)
    for comp, tier in tiers.items():
        print(f"  {comp:<15} → {tier}")