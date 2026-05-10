import os
import json

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

data_path = os.path.join(
    BASE_DIR,
    "../../data/components.json"
)

with open(data_path, "r") as f:
    data = json.load(f)

usage_keywords = data["usage_keywords"]

def classify_usage(description):

    description = description.lower()

    for profile in usage_keywords:

        for keyword in profile["keywords"]:

            if keyword.lower() in description:

                return {
                    "usage": profile["usage"],
                    "focus": profile["focus"],
                    "matched_keyword": keyword
                }

    return {
        "usage": "General Use",
        "focus": "Balanced",
        "matched_keyword": None
    }