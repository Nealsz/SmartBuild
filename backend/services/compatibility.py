"""
services/compatibility.py
Rule-based compatibility checker.
Operates purely on the build dict — no CSV access, no ML.
Returns a list of (status, rule, detail) tuples.
"""

import pandas as pd

from config import PCIE5_CHIPSETS


CompatResult = tuple[str, str, str]   # (status, rule, detail)
# status: "PASS" | "FAIL" | "WARN"


def check_compatibility(
    build: dict,
    psu_min_watt: int,
    psu_max_watt: int,
) -> list[CompatResult]:
    """
    Runs all compatibility rules against the selected build.

    Rules
    -----
    1  CPU socket ↔ Motherboard socket
    2  RAM DDR gen ↔ Motherboard DDR support
    3  RAM capacity ≤ Motherboard max memory
    4  Motherboard form factor ↔ Case type
    5  PSU wattage within computed TDP band
    6  Storage PCIe 5.0 ↔ Motherboard chipset support
    7  CPU cooler type adequacy for CPU TDP
    """
    results: list[CompatResult] = []

    cpu  = build.get("cpu")
    ram  = build.get("ram")
    stor = build.get("storage")
    mb   = build.get("motherboard")
    psu  = build.get("psu")
    case = build.get("case")
    cool = build.get("cpu_cooler")

    # ── RULE 1: CPU ↔ Motherboard socket ──────────────────────────────────────
    if cpu is not None and mb is not None:
        cpu_socket = str(cpu.get("socket", ""))
        mb_socket  = str(mb.get("socket", ""))
        if cpu_socket == mb_socket:
            results.append(("PASS", "CPU ↔ Motherboard Socket",
                f"{cpu_socket} matches"))
        else:
            results.append(("FAIL", "CPU ↔ Motherboard Socket",
                f"CPU needs {cpu_socket}, motherboard has {mb_socket}"))

    # ── RULE 2: RAM DDR gen ↔ Motherboard ─────────────────────────────────────
    if ram is not None and mb is not None:
        ddr     = str(ram.get("ddr_gen", ""))
        mb_name = str(mb.get("name", ""))
        if ddr == "DDR5" and "DDR4" in mb_name:
            results.append(("FAIL", "RAM ↔ Motherboard DDR Gen",
                "RAM is DDR5 but motherboard only supports DDR4"))
        elif ddr == "DDR4" and "DDR5" in mb_name:
            results.append(("FAIL", "RAM ↔ Motherboard DDR Gen",
                "RAM is DDR4 but motherboard only supports DDR5"))
        else:
            results.append(("PASS", "RAM ↔ Motherboard DDR Gen",
                f"{ddr} compatible with selected motherboard"))

    # ── RULE 3: RAM capacity ≤ Motherboard max memory ─────────────────────────
    if ram is not None and mb is not None:
        total_cap = float(ram.get("total_capacity_gb", 0))
        max_mem   = float(mb.get("max_memory", 0))
        if total_cap <= max_mem:
            results.append(("PASS", "RAM Capacity ≤ Motherboard Max Memory",
                f"{total_cap:.0f}GB ≤ {max_mem:.0f}GB"))
        else:
            results.append(("FAIL", "RAM Capacity ≤ Motherboard Max Memory",
                f"{total_cap:.0f}GB exceeds motherboard max of {max_mem:.0f}GB"))

    # ── RULE 4: Motherboard form factor ↔ Case ────────────────────────────────
    if mb is not None and case is not None:
        form_compat = {
            "ATX":       ["ATX Mid Tower", "ATX Full Tower", "ATX Desktop", "ATX Test Bench"],
            "Micro ATX": ["MicroATX Mini Tower", "MicroATX Mid Tower", "MicroATX Desktop",
                          "ATX Mid Tower", "ATX Full Tower"],
            "Mini ITX":  ["Mini ITX Tower", "Mini ITX Desktop", "MicroATX Mini Tower",
                          "ATX Mid Tower", "ATX Full Tower"],
            "EATX":      ["ATX Full Tower", "XL ATX"],
        }
        mobo_ff   = str(mb.get("form_factor", ""))
        case_type = str(case.get("type", ""))
        if case_type in form_compat.get(mobo_ff, []):
            results.append(("PASS", "Motherboard Form Factor ↔ Case",
                f"{mobo_ff} fits in {case_type}"))
        else:
            results.append(("FAIL", "Motherboard Form Factor ↔ Case",
                f"{mobo_ff} does not fit in {case_type}"))

    # ── RULE 5: PSU wattage within computed TDP band ──────────────────────────
    if psu is not None:
        psu_watt = float(psu.get("wattage", 0))
        if psu_watt >= psu_min_watt:
            results.append(("PASS", "PSU Wattage ≥ System TDP + 20% Headroom",
                f"{psu_watt:.0f}W ≥ {psu_min_watt}W required "
                f"(band: {psu_min_watt}–{psu_max_watt}W)"))
        else:
            results.append(("FAIL", "PSU Wattage ≥ System TDP + 20% Headroom",
                f"{psu_watt:.0f}W insufficient — need at least {psu_min_watt}W"))

    # ── RULE 6: Storage PCIe 5.0 ↔ Motherboard chipset ───────────────────────
    if stor is not None and mb is not None:
        interface = str(stor.get("interface", ""))
        mb_name   = str(mb.get("name", ""))
        if "PCIe 5.0" in interface:
            if any(c in mb_name for c in PCIE5_CHIPSETS):
                results.append(("PASS", "Storage PCIe 5.0 ↔ Motherboard",
                    "Motherboard chipset supports PCIe 5.0 M.2"))
            else:
                results.append(("WARN", "Storage PCIe 5.0 ↔ Motherboard",
                    "Could not confirm PCIe 5.0 M.2 support — verify motherboard spec sheet"))
        else:
            results.append(("PASS", "Storage Interface ↔ Motherboard",
                f"{interface} is widely supported"))

    # ── RULE 7: CPU cooler adequacy for CPU TDP ───────────────────────────────
    if cool is not None and cpu is not None:
        cpu_tdp   = float(cpu.get("tdp", 65))
        cool_size = cool.get("size")
        is_aio    = (
            pd.notna(cool_size) and float(cool_size) > 0
            if cool_size is not None else False
        )
        if cpu_tdp >= 125 and not is_aio:
            results.append(("WARN", "CPU Cooler ↔ CPU TDP",
                f"CPU TDP is {cpu_tdp:.0f}W — an AIO liquid cooler is recommended"))
        else:
            cool_label = f"AIO {float(cool_size):.0f}mm" if is_aio else "Air cooler"
            results.append(("PASS", "CPU Cooler ↔ CPU TDP",
                f"{cool_label} adequate for {cpu_tdp:.0f}W TDP"))

    return results


def summarise(results: list[CompatResult]) -> dict:
    """Summarise compatibility results into counts and overall status."""
    fails  = sum(1 for s, _, _ in results if s == "FAIL")
    warns  = sum(1 for s, _, _ in results if s == "WARN")
    passed = len(results) - fails - warns

    if fails > 0:
        overall = "FAIL"
    elif warns > 0:
        overall = "WARN"
    else:
        overall = "PASS"

    return {
        "overall":  overall,
        "passed":   passed,
        "warnings": warns,
        "failures": fails,
        "details":  [
            {"status": s, "rule": r, "detail": d}
            for s, r, d in results
        ],
    }