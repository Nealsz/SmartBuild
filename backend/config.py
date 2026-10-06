"""
config.py
All shared constants — imported by services and train_model.
No logic lives here.
"""

import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables from .env file
load_dotenv(os.path.join(BASE_DIR, ".env"))

# ── Supabase Database Config ───────────────────────────────────────────────────
SUPABASE_URL = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip()
SUPABASE_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_KEY")
    or os.getenv("SUPABASE_PUBLISHABLE_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
    or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    or ""
).strip()

# ── CSV data paths ─────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(BASE_DIR), "data")

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

# ── Trained model artifacts ────────────────────────────────────────────────────
MODEL_DIR = os.path.join(BASE_DIR, "model")

MODEL_PATH    = os.path.join(MODEL_DIR, "smartbuild_model.pkl")
ENCODERS_PATH = os.path.join(MODEL_DIR, "encoders.pkl")
TIERS_PATH    = os.path.join(MODEL_DIR, "tier_boundaries.json")
MIN_BUDGET_PATH = os.path.join(MODEL_DIR, "min_compatible_budget.json")

# ── Activity → hardware demand dimension weights ───────────────────────────────
# Each dimension maps directly to a scoreable column in the CSV data:
#   cpu_single  → boost_clock
#   cpu_multi   → core_count × core_clock
#   gpu_compute → boost_clock (proxy for compute throughput)
#   vram        → memory (GB)
#   ram_cap     → total_capacity_gb
#   storage_spd → interface tier (PCIe gen)

ACTIVITY_WEIGHTS: dict[str, dict[str, float]] = {
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

# ── Activity Sub-Categories (Intensity tiers: Light, Standard, Heavy) ───────
ACTIVITY_SUBCATEGORIES: dict[str, dict[str, dict]] = {
    "Gaming": {
        "Light": {
            "description": "Valorant, LoL, CS2, indie titles",
            "hardware_focus": "6-core CPU, entry GPU, 16GB RAM, 1080p 60fps+",
            "weights": {"cpu_single": 0.60, "cpu_multi": 0.20, "gpu_compute": 0.60, "vram": 0.30, "ram_cap": 0.30, "storage_spd": 0.40},
        },
        "Standard": {
            "description": "GTA V, Apex Legends, Helldivers 2",
            "hardware_focus": "6-8 core, mid GPU, 16GB RAM, 1080p-1440p 60-144fps",
            "weights": {"cpu_single": 0.70, "cpu_multi": 0.30, "gpu_compute": 0.90, "vram": 0.60, "ram_cap": 0.30, "storage_spd": 0.60},
        },
        "Heavy": {
            "description": "Cyberpunk 2077, Alan Wake 2, Black Myth Wukong, modded",
            "hardware_focus": "8-core+, high-end GPU, 32GB RAM, 1440p-4K w/ ray tracing",
            "weights": {"cpu_single": 0.80, "cpu_multi": 0.50, "gpu_compute": 1.00, "vram": 0.90, "ram_cap": 0.60, "storage_spd": 0.70},
        },
    },
    "Browsing & Streaming": {
        "Light": {
            "description": "Basic web, email, SD/HD video",
            "hardware_focus": "dual/quad-core, 8GB RAM",
            "weights": {"cpu_single": 0.20, "cpu_multi": 0.10, "gpu_compute": 0.10, "vram": 0.10, "ram_cap": 0.10, "storage_spd": 0.10},
        },
        "Standard": {
            "description": "Many tabs, 4K streaming, light multitasking",
            "hardware_focus": "quad-core+, 8-16GB RAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.10, "gpu_compute": 0.20, "vram": 0.10, "ram_cap": 0.20, "storage_spd": 0.20},
        },
        "Heavy": {
            "description": "Heavy multitasking + 4K/HDR + recording",
            "hardware_focus": "6-core+, 16GB RAM",
            "weights": {"cpu_single": 0.40, "cpu_multi": 0.30, "gpu_compute": 0.30, "vram": 0.20, "ram_cap": 0.30, "storage_spd": 0.30},
        },
    },
    "Documents / Office Work": {
        "Light": {
            "description": "Word/Excel/browser",
            "hardware_focus": "dual/quad-core, 8GB RAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.20, "gpu_compute": 0.00, "vram": 0.00, "ram_cap": 0.20, "storage_spd": 0.20},
        },
        "Standard": {
            "description": "Heavy spreadsheets/macros, video calls",
            "hardware_focus": "quad-core+, 16GB RAM",
            "weights": {"cpu_single": 0.40, "cpu_multi": 0.30, "gpu_compute": 0.00, "vram": 0.00, "ram_cap": 0.40, "storage_spd": 0.30},
        },
        "Heavy": {
            "description": "Large datasets, Power BI/VBA, multi-monitor + calls",
            "hardware_focus": "6-core+, 32GB RAM",
            "weights": {"cpu_single": 0.60, "cpu_multi": 0.50, "gpu_compute": 0.10, "vram": 0.10, "ram_cap": 0.60, "storage_spd": 0.50},
        },
    },
    "Video Editing": {
        "Light": {
            "description": "1080p vlogs/shorts (CapCut, basic Premiere)",
            "hardware_focus": "6-core, 16GB RAM, entry GPU w/ NVENC",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.60, "gpu_compute": 0.40, "vram": 0.30, "ram_cap": 0.50, "storage_spd": 0.60},
        },
        "Standard": {
            "description": "1080p-4K multi-track, color grading (Premiere/Resolve)",
            "hardware_focus": "8-core, 32GB RAM, 8GB+ VRAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.90, "gpu_compute": 0.60, "vram": 0.50, "ram_cap": 0.80, "storage_spd": 0.90},
        },
        "Heavy": {
            "description": "4K-8K RAW, VFX/compositing (Resolve Studio/Fusion)",
            "hardware_focus": "12-16 core, 64GB RAM, 16GB+ VRAM",
            "weights": {"cpu_single": 0.40, "cpu_multi": 1.00, "gpu_compute": 0.85, "vram": 0.90, "ram_cap": 1.00, "storage_spd": 1.00},
        },
    },
    "Photo / Graphic Design": {
        "Light": {
            "description": "Basic retouching, small exports",
            "hardware_focus": "quad-core, 16GB RAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.30, "gpu_compute": 0.20, "vram": 0.20, "ram_cap": 0.40, "storage_spd": 0.40},
        },
        "Standard": {
            "description": "Large PSDs, multi-app workflows",
            "hardware_focus": "6-8 core, 32GB RAM, mid GPU",
            "weights": {"cpu_single": 0.40, "cpu_multi": 0.50, "gpu_compute": 0.50, "vram": 0.40, "ram_cap": 0.60, "storage_spd": 0.50},
        },
        "Heavy": {
            "description": "Huge composites, print production",
            "hardware_focus": "8-core+, 64GB RAM",
            "weights": {"cpu_single": 0.60, "cpu_multi": 0.70, "gpu_compute": 0.70, "vram": 0.60, "ram_cap": 0.90, "storage_spd": 0.70},
        },
    },
    "3D Modeling or Animation": {
        "Light": {
            "description": "Blender/SketchUp hobbyist",
            "hardware_focus": "6-core, 16GB RAM, entry GPU",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.50, "gpu_compute": 0.60, "vram": 0.50, "ram_cap": 0.50, "storage_spd": 0.50},
        },
        "Standard": {
            "description": "Maya/3ds Max professional + mid rendering",
            "hardware_focus": "8-core, 32GB RAM, 12GB+ VRAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.80, "gpu_compute": 0.90, "vram": 0.90, "ram_cap": 0.70, "storage_spd": 0.60},
        },
        "Heavy": {
            "description": "Film-quality rendering, sims (Houdini/UE cinematics)",
            "hardware_focus": "16-core+, 64-128GB RAM, 24GB+ VRAM",
            "weights": {"cpu_single": 0.40, "cpu_multi": 1.00, "gpu_compute": 1.00, "vram": 1.00, "ram_cap": 1.00, "storage_spd": 0.80},
        },
    },
    "Music Production": {
        "Light": {
            "description": "Simple DAW, few tracks",
            "hardware_focus": "quad-core, 16GB RAM",
            "weights": {"cpu_single": 0.40, "cpu_multi": 0.40, "gpu_compute": 0.00, "vram": 0.00, "ram_cap": 0.40, "storage_spd": 0.50},
        },
        "Standard": {
            "description": "Multi-track + moderate VSTs (Ableton/FL standard)",
            "hardware_focus": "6-8 core, 32GB RAM",
            "weights": {"cpu_single": 0.50, "cpu_multi": 0.60, "gpu_compute": 0.10, "vram": 0.10, "ram_cap": 0.70, "storage_spd": 0.70},
        },
        "Heavy": {
            "description": "Orchestral libraries, heavy plugin stacking",
            "hardware_focus": "8-12 core, 64GB RAM, fast NVMe",
            "weights": {"cpu_single": 0.70, "cpu_multi": 0.90, "gpu_compute": 0.10, "vram": 0.10, "ram_cap": 0.95, "storage_spd": 0.90},
        },
    },
    "Programming or Development": {
        "Light": {
            "description": "Scripting, basic web dev",
            "hardware_focus": "quad-core, 16GB RAM",
            "weights": {"cpu_single": 0.40, "cpu_multi": 0.40, "gpu_compute": 0.00, "vram": 0.00, "ram_cap": 0.40, "storage_spd": 0.40},
        },
        "Standard": {
            "description": "Full-stack + Docker + multiple IDEs",
            "hardware_focus": "6-8 core, 32GB RAM",
            "weights": {"cpu_single": 0.50, "cpu_multi": 0.70, "gpu_compute": 0.10, "vram": 0.10, "ram_cap": 0.70, "storage_spd": 0.60},
        },
        "Heavy": {
            "description": "Large builds, multiple VMs, local ML training",
            "hardware_focus": "12-core+, 64GB RAM, GPU for CUDA",
            "weights": {"cpu_single": 0.60, "cpu_multi": 0.95, "gpu_compute": 0.60, "vram": 0.50, "ram_cap": 0.95, "storage_spd": 0.80},
        },
    },
    "Streaming / Recording": {
        "Light": {
            "description": "Occasional 720-1080p single-app capture",
            "hardware_focus": "6-core, 16GB RAM, GPU w/ NVENC",
            "weights": {"cpu_single": 0.35, "cpu_multi": 0.50, "gpu_compute": 0.50, "vram": 0.30, "ram_cap": 0.50, "storage_spd": 0.50},
        },
        "Standard": {
            "description": "Regular 1080p stream + overlays while gaming",
            "hardware_focus": "8-core, 32GB RAM, mid-high GPU",
            "weights": {"cpu_single": 0.40, "cpu_multi": 0.80, "gpu_compute": 0.70, "vram": 0.40, "ram_cap": 0.60, "storage_spd": 0.70},
        },
        "Heavy": {
            "description": "Multi-platform 1440-4K + heavy game + filters",
            "hardware_focus": "12-core+, 32-64GB RAM, high-end GPU",
            "weights": {"cpu_single": 0.60, "cpu_multi": 1.00, "gpu_compute": 0.90, "vram": 0.70, "ram_cap": 0.85, "storage_spd": 0.80},
        },
    },
    "Simulations / Data Analysis": {
        "Light": {
            "description": "Small datasets, basic scripts",
            "hardware_focus": "quad-core, 16GB RAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.50, "gpu_compute": 0.20, "vram": 0.20, "ram_cap": 0.50, "storage_spd": 0.50},
        },
        "Standard": {
            "description": "Pandas/R workflows, moderate ML",
            "hardware_focus": "8-core, 32GB RAM",
            "weights": {"cpu_single": 0.30, "cpu_multi": 0.90, "gpu_compute": 0.50, "vram": 0.40, "ram_cap": 0.90, "storage_spd": 0.80},
        },
        "Heavy": {
            "description": "CFD/FEA, big data, deep learning training",
            "hardware_focus": "16-core+, 64-128GB RAM, CUDA GPU",
            "weights": {"cpu_single": 0.50, "cpu_multi": 1.00, "gpu_compute": 0.95, "vram": 0.90, "ram_cap": 1.00, "storage_spd": 0.95},
        },
    },
}

VALID_SUBCATEGORIES: list[str] = ["Light", "Standard", "Heavy"]
VALID_COOLING_PREFERENCES: list[str] = ["Auto", "Air", "Liquid / AIO"]

def get_activity_weights(activity: str, subcategory: str | None = None) -> dict[str, float]:
    sub = (subcategory or "Standard").strip()
    if activity in ACTIVITY_SUBCATEGORIES and sub in ACTIVITY_SUBCATEGORIES[activity]:
        return ACTIVITY_SUBCATEGORIES[activity][sub]["weights"]
    return ACTIVITY_WEIGHTS.get(activity, ACTIVITY_WEIGHTS["Browsing & Streaming"])

# ── Budget allocation ratios (sum = 1.0) ───────────────────────────────────────
# PSU/case are constraint-driven — allocation just sets a price ceiling,
# not a performance target.
BASE_ALLOC: dict[str, float] = {
    "gpu":         0.33,
    "cpu":         0.19,
    "motherboard": 0.14,
    "ram":         0.11,
    "storage":     0.09,
    "psu":         0.08,
    "cpu_cooler":  0.04,
    "case":        0.02,
}

# ── Resolution & Refresh Rate Target Configuration ────────────────────────────
# Weights apply to intent dimensions (gpu_compute, vram, cpu_single) and overall tier scaling
RESOLUTION_TARGET_WEIGHTS: dict[str, dict[str, float]] = {
    "1080p 60Hz (FHD Standard)": {
        "tier_mult":        0.85,
        "vram_mult":        0.85,
        "gpu_compute_mult": 0.85,
        "cpu_single_mult":  1.00,
    },
    "1080p 144Hz+ (FHD High FPS)": {
        "tier_mult":        1.00,
        "vram_mult":        0.95,
        "gpu_compute_mult": 1.00,
        "cpu_single_mult":  1.15,
    },
    "1440p 60-144Hz (QHD Standard)": {
        "tier_mult":        1.15,
        "vram_mult":        1.20,
        "gpu_compute_mult": 1.20,
        "cpu_single_mult":  1.05,
    },
    "1440p 165Hz+ (QHD High FPS)": {
        "tier_mult":        1.25,
        "vram_mult":        1.30,
        "gpu_compute_mult": 1.30,
        "cpu_single_mult":  1.15,
    },
    "4K 60Hz+ (UHD Ultra)": {
        "tier_mult":        1.40,
        "vram_mult":        1.50,
        "gpu_compute_mult": 1.50,
        "cpu_single_mult":  1.00,
    },
}

RESOLUTION_MULTIPLIER: dict[str, float] = {
    k: v["tier_mult"] for k, v in RESOLUTION_TARGET_WEIGHTS.items()
}

# ── GPU TDP estimates by chipset keyword ───────────────────────────────────────
# GPU CSV has no TDP column — used for PSU wattage calculation.
GPU_TDP_MAP: dict[str, int] = {
    "RTX 5090":575,"RTX 5080":360,"RTX 5070 Ti":300,"RTX 5070":250,
    "RTX 5060 Ti":180,"RTX 5060":150,
    "RTX 4090":450,"RTX 4080":320,"RTX 4070 Ti":285,"RTX 4070":200,
    "RTX 4060 Ti":165,"RTX 4060":115,
    "RTX 3090":350,"RTX 3080":320,"RTX 3070":220,"RTX 3060 Ti":200,
    "RTX 3060":170,"RTX 3050":130,
    "RX 9070 XT":220,"RX 9070":200,"RX 9060 XT":150,
    "RX 7900 XTX":355,"RX 7900 XT":315,"RX 7800 XT":263,
    "RX 7700 XT":245,"RX 7600 XT":190,"RX 7600":165,
    "RX 6800 XT":300,"RX 6700 XT":230,"RX 6600 XT":160,"RX 6600":132,"RX 6500 XT":107,
    "Arc B580":190,"Arc B570":140,"Arc A580":185,
    "GTX 1650":75,
}

# ── Motherboard chipsets that support PCIe 5.0 M.2 ────────────────────────────
PCIE5_CHIPSETS: list[str] = ["Z790", "Z890", "X870", "X670", "TRX"]

# ── Price tier boundaries per component ───────────────────────────────────────
# [25th percentile, 75th percentile, 90th percentile]
# budget = below 25th | mid = 25th–75th | high = 75th–90th | enthusiast = above 90th
TIER_BOUNDARIES: dict[str, list[int]] = {
    "cpu":         [5509,  18047, 28898],
    "gpu":         [20589, 57884, 94539],
    "ram":         [2899,  10439, 17624],
    "storage":     [4014,  13851, 21893],
    "motherboard": [9346,  20830, 30159],
    "psu":         [2500,  5000,  9000],
    "case":        [1500,  3500,  6000],
    "cpu_cooler":  [1000,  2500,  5000],
}