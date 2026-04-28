from backend.schemas.user_input import UserRequirementInput
import json
import os

components_path = os.path.join(os.path.dirname(__file__), "..", "..", "data", "components.json")

def load_components():
    with open(components_path, "r") as file:
        return json.load(file)

def recommend_build(user_input: UserRequirementInput):
    components = load_components()
    """
    Generate a recommended PC build based on user input.
    """
    budget_min = user_input.budget_min
    budget_max = user_input.budget_max
    usage = user_input.usage
    performance_priority = user_input.performance_priority
    brand_preferences = user_input.brand_preferences or {}

    # If user budgets look like PHP-scale values (e.g., 35,000) while dataset prices
    # are catalog-scale (e.g., 50-350), normalize to keep recommendations usable.
    all_prices = [component["price"] for category in components.values() for component in category]
    dataset_max_price = max(all_prices) if all_prices else 0
    if dataset_max_price and budget_max > dataset_max_price * 10:
        budget_min = budget_min / 100
        budget_max = budget_max / 100

    # Filter components based on brand preferences first.
    brand_filtered_components = {
        category: [
            component for component in components.get(category, [])
            if (not brand_preferences.get(category) or component["brand"] == brand_preferences[category])
        ]
        for category in components
    }

    # Then apply budget filtering.
    filtered_components = {
        category: [
            component for component in category_components
            if budget_min <= component["price"] <= budget_max
        ]
        for category, category_components in brand_filtered_components.items()
    }

    # If budget filter removes all options for a category, fallback to brand-filtered list
    # so users still receive a usable recommendation.
    for category in filtered_components:
        if not filtered_components[category]:
            filtered_components[category] = brand_filtered_components.get(category, [])

    # Sort components by performance priority and fill in missing categories
    recommended_build = {}
    for priority in performance_priority:
        if priority in filtered_components and filtered_components[priority]:
            recommended_build[priority] = max(filtered_components[priority], key=lambda x: x["performance"])

    # Ensure all categories are filled, even if not prioritized
    for category in components:
        if category not in recommended_build and filtered_components.get(category):
            recommended_build[category] = max(filtered_components[category], key=lambda x: x["performance"])

    return recommended_build