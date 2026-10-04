"""
recalculate_min_budget.py
=========================
Fetches live component inventory from Supabase and recalculates the minimum
viable zero-failure PC build budget, saving the result to model/min_compatible_budget.json.

Usage:
    python recalculate_min_budget.py
"""

import os
import sys
import json

# Ensure backend root is on Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

from services.recommender import get_cheapest_compatible_build


def main():
    print("[INFO] Fetching live component inventory from Supabase...")
    print("[INFO] Running binary search & constraint solver for cheapest compatible build...")
    
    result = get_cheapest_compatible_build(force_recalculate=True)
    
    print("\n" + "=" * 60)
    print(f" Minimum Compatible Budget: {result.get('formatted_min_budget')} ({result.get('min_budget')})")
    print("=" * 60)
    print("Selected Baseline Parts:")
    for comp, info in result.get("parts", {}).items():
        name = info.get("name", "N/A")
        price = info.get("price", 0.0)
        print(f"  • {comp.upper():<12}: {name} (₱{price:,.2f})")
    print("=" * 60)
    print("[SUCCESS] Successfully updated backend/model/min_compatible_budget.json\n")


if __name__ == "__main__":
    main()
