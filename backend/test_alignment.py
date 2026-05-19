"""Quick diagnostic: test intended-use alignment across various inputs."""
from services.recommender import generate_build

tests = [
    ("Browsing & Streaming", None, 20000, 35000),
    ("Gaming", None, 50000, 80000),
    ("Documents / Office Work", None, 15000, 25000),
    ("Video Editing", None, 80000, 150000),
    ("Gaming", "Video Editing", 30000, 50000),
    ("3D Modeling or Animation", None, 60000, 100000),
    ("Music Production", None, 40000, 65000),
    ("Simulations / Data Analysis", None, 45000, 75000),
    ("Programming or Development", None, 25000, 45000),
    ("Streaming / Recording", None, 50000, 80000),
]

for primary, secondary, bmin, bmax in tests:
    r = generate_build(bmin, bmax, primary, secondary, "3-5 years", False)
    ev = r["evaluation"]["intended_use_alignment"]
    tiers = r["tiers"]
    sec_label = secondary or "None"
    print(f"{primary} + {sec_label} (P{bmin/1000:.0f}k-{bmax/1000:.0f}k):")
    print(f"  SCORE={ev['score']}%  PASSED={ev['passed']}")
    print(f"  Tiers: cpu={tiers['cpu']}, gpu={tiers['gpu']}, ram={tiers['ram']}, storage={tiers['storage']}")
    for comp, d in ev["details"].items():
        print(f"    {comp}: demand={d['demand']:.2f} demandRank={d['demand_rank']} -> tier={d['tier']} tierRank={d['tier_rank']} match={d['score']}")
    print()
