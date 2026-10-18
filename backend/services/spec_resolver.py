"""
services/spec_resolver.py
Resolves technical hardware specifications for user-provided components
using database matching and intelligent heuristic parsing.
"""

import os
import re
import pandas as pd
from typing import Any
from config import PATHS

_cached_dfs: dict[str, pd.DataFrame] = {}


def _get_category_df(category: str) -> pd.DataFrame | None:
    norm_cat = category.strip().lower()
    if norm_cat in ("cooling", "cooler"):
        norm_cat = "cpu_cooler"
    elif norm_cat in ("fan", "fans"):
        norm_cat = "case_fan"

    if norm_cat not in _cached_dfs:
        path = PATHS.get(norm_cat)
        if path and os.path.exists(path):
            try:
                _cached_dfs[norm_cat] = pd.read_csv(path)
            except Exception:
                return None
    return _cached_dfs.get(norm_cat)


def resolve_component_specs(category: str, raw_name: str) -> dict[str, Any]:
    """
    Looks up and extracts specs for an external/user-provided component.
    Returns a dict with all standardized fields expected by the recommender and UI.
    """
    cat = category.strip().lower()
    if cat in ("cooler", "cooling"):
        cat = "cpu_cooler"
    elif cat in ("fan", "fans"):
        cat = "case_fan"

    name = raw_name.strip()
    df = _get_category_df(cat)

    matched_row: dict[str, Any] | None = None

    if df is not None and not df.empty and name:
        query_tokens = [t.lower() for t in re.split(r"[\s\-_/]+", name) if len(t) > 1]
        
        # Priority 1: Check if any row's name or chipset matches majority of tokens
        best_score = 0
        best_row = None

        search_cols = ["name"]
        if "chipset" in df.columns:
            search_cols.append("chipset")

        for _, row in df.iterrows():
            row_text = " ".join(str(row.get(col, "")).lower() for col in search_cols)
            score = sum(1 for t in query_tokens if t in row_text)
            if score > best_score and score >= max(1, len(query_tokens) - 1):
                best_score = score
                best_row = row

        if best_row is not None and best_score >= 1:
            matched_row = best_row.where(pd.notna(best_row), None).to_dict()

    specs: dict[str, Any] = {}

    if cat == "gpu":
        if matched_row:
            specs = {
                "memory": float(matched_row.get("memory") or 6.0),
                "chipset": str(matched_row.get("chipset") or name),
                "core_clock": matched_row.get("core_clock"),
                "boost_clock": matched_row.get("boost_clock"),
                "length": matched_row.get("length") or 240.0,
            }
        else:
            vram_match = re.search(r"(\d+)\s*(?:gb|g)\b", name, re.IGNORECASE)
            vram = float(vram_match.group(1)) if vram_match else 6.0
            chip_match = re.search(r"(rtx|gtx|rx|radeon|geforce|arc)\s*[\w\d\s+]+", name, re.IGNORECASE)
            chipset = chip_match.group(0).strip() if chip_match else name
            specs = {
                "memory": vram,
                "chipset": chipset,
                "length": 240.0,
            }
        vram_str = f"{int(specs['memory']) if float(specs['memory']).is_integer() else specs['memory']}GB VRAM"
        specs["spec_snippet"] = f"{vram_str} \u2022 {specs.get('chipset', name)}"

    elif cat == "cpu":
        if matched_row:
            cores = int(matched_row.get("core_count") or 6)
            threads = cores * 2
            boost = float(matched_row.get("boost_clock") or 4.0)
            socket = str(matched_row.get("socket") or "AM4")
            tdp = float(matched_row.get("tdp") or 65)
            specs = {
                "core_count": cores,
                "thread_count": threads,
                "boost_clock": boost,
                "core_clock": matched_row.get("core_clock") or 3.2,
                "socket": socket,
                "tdp": tdp,
            }
        else:
            cores_match = re.search(r"(\d+)\s*(?:core|c)\b", name, re.IGNORECASE)
            cores = int(cores_match.group(1)) if cores_match else 6
            socket = "AM5" if "am5" in name.lower() or "7000" in name or "9000" in name else (
                "LGA1700" if "12th" in name or "13th" in name or "14th" in name or "12" in name or "13" in name or "14" in name else "AM4"
            )
            specs = {
                "core_count": cores,
                "thread_count": cores * 2,
                "boost_clock": 4.2,
                "core_clock": 3.6,
                "socket": socket,
                "tdp": 65.0,
            }
        specs["spec_snippet"] = f"{specs['core_count']}C/{specs['thread_count']}T \u2022 {specs['boost_clock']}GHz ({specs['socket']})"

    elif cat == "ram":
        if matched_row:
            specs = {
                "total_capacity_gb": int(matched_row.get("total_capacity_gb") or 16),
                "ddr_gen": str(matched_row.get("ddr_gen") or "DDR4"),
                "speed_mhz": int(matched_row.get("speed_mhz") or 3200),
            }
        else:
            cap_match = re.search(r"(\d+)\s*(?:gb|g)\b", name, re.IGNORECASE)
            cap = int(cap_match.group(1)) if cap_match else 16
            gen_match = re.search(r"\b(ddr[345])\b", name, re.IGNORECASE)
            gen = gen_match.group(1).upper() if gen_match else ("DDR5" if cap >= 32 and "5" in name else "DDR4")
            spd_match = re.search(r"(\d{4})\s*(?:mhz)?\b", name, re.IGNORECASE)
            spd = int(spd_match.group(1)) if spd_match else (5600 if gen == "DDR5" else 3200)
            specs = {
                "total_capacity_gb": cap,
                "ddr_gen": gen,
                "speed_mhz": spd,
            }
        specs["spec_snippet"] = f"{specs['total_capacity_gb']}GB {specs['ddr_gen']} \u2022 {specs['speed_mhz']}MHz"

    elif cat == "storage":
        if matched_row:
            specs = {
                "capacity": int(matched_row.get("capacity") or 500),
                "type": str(matched_row.get("type") or "SSD"),
            }
        else:
            tb_match = re.search(r"(\d+)\s*tb\b", name, re.IGNORECASE)
            gb_match = re.search(r"(\d+)\s*gb\b", name, re.IGNORECASE)
            if tb_match:
                cap = int(tb_match.group(1)) * 1000
            elif gb_match:
                cap = int(gb_match.group(1))
            else:
                cap = 500
            stype = "NVMe SSD" if "nvme" in name.lower() or "m.2" in name.lower() else ("HDD" if "hdd" in name.lower() or "hard drive" in name.lower() else "SSD")
            specs = {
                "capacity": cap,
                "type": stype,
            }
        cap_str = f"{specs['capacity'] // 1000}TB" if specs['capacity'] >= 1000 else f"{specs['capacity']}GB"
        specs["spec_snippet"] = f"{cap_str} \u2022 {specs['type']}"

    elif cat == "psu":
        if matched_row:
            specs = {
                "wattage": int(matched_row.get("wattage") or 650),
                "efficiency_rating": str(matched_row.get("efficiency") or "80+ Bronze"),
            }
        else:
            w_match = re.search(r"(\d{3,4})\s*w\b", name, re.IGNORECASE)
            watt = int(w_match.group(1)) if w_match else 650
            eff = "80+ Gold" if "gold" in name.lower() else ("80+ White" if "white" in name.lower() else "80+ Bronze")
            specs = {
                "wattage": watt,
                "efficiency_rating": eff,
            }
        specs["spec_snippet"] = f"{specs['wattage']}W \u2022 {specs['efficiency_rating']}"

    elif cat == "motherboard":
        if matched_row:
            specs = {
                "socket": str(matched_row.get("socket") or "AM4"),
                "form_factor": str(matched_row.get("form_factor") or "Micro ATX"),
                "max_memory": int(matched_row.get("max_memory") or 64),
                "ddr_gen": str(matched_row.get("ddr_gen") or "DDR4"),
            }
        else:
            lower_name = name.lower()
            if "1151" in lower_name or any(c in lower_name for c in ["h110", "b150", "b250", "z170", "z270", "z370", "z390", "h310"]):
                sock = "LGA1151"
            elif "1200" in lower_name or any(c in lower_name for c in ["b460", "b560", "z490", "z590", "h410", "h510"]):
                sock = "LGA1200"
            elif "am5" in lower_name or any(c in lower_name for c in ["b650", "x670", "x870", "a620"]):
                sock = "AM5"
            elif "1700" in lower_name or any(c in lower_name for c in ["b660", "b760", "z690", "z790", "h610"]):
                sock = "LGA1700"
            else:
                sock = "AM4"
            ff = "Mini ITX" if "itx" in lower_name else ("ATX" if "atx" in lower_name and "micro" not in lower_name and "matx" not in lower_name else "Micro ATX")
            ddr = "DDR5" if "ddr5" in lower_name or sock in ["AM5", "LGA1851"] else "DDR4"
            specs = {
                "socket": sock,
                "form_factor": ff,
                "max_memory": 64,
                "ddr_gen": ddr,
            }
        specs["spec_snippet"] = f"{specs['socket']} \u2022 {specs['form_factor']}"

    elif cat == "case":
        ff = "MicroATX Mini Tower" if "micro" in name.lower() or "matx" in name.lower() else ("Mini ITX Tower" if "itx" in name.lower() else "ATX Mid Tower")
        specs = {
            "type": ff,
            "form_factor": ff,
            "spec_snippet": ff,
        }

    elif cat == "cpu_cooler":
        is_liquid = any(term in name.lower() for term in ("liquid", "aio", "240", "360", "water"))
        size_match = re.search(r"(\d{3})\s*mm\b", name, re.IGNORECASE)
        size = int(size_match.group(1)) if size_match else (240 if is_liquid else 120)
        specs = {
            "size": size,
            "spec_snippet": f"{size}mm {'Liquid AIO' if is_liquid else 'Air Cooler'}",
        }

    elif cat == "case_fan":
        specs = {
            "airflow_cfm": 55.0,
            "spec_snippet": "120mm \u2022 55 CFM Airflow",
        }

    # Always ensure standard common metadata
    specs["name"] = name
    specs["category"] = cat
    specs["is_user_provided"] = True
    specs["price"] = 0.0
    specs["id"] = None
    return specs
