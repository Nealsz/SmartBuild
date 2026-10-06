from pydantic import BaseModel, field_validator
from typing import Optional, Any

from config import (
    ACTIVITY_WEIGHTS,
    RESOLUTION_TARGET_WEIGHTS,
    VALID_SUBCATEGORIES,
    VALID_COOLING_PREFERENCES,
)

VALID_ACTIVITIES = list(ACTIVITY_WEIGHTS.keys())
VALID_RESOLUTION_TARGETS = list(RESOLUTION_TARGET_WEIGHTS.keys())


class UserInput(BaseModel):
    min_budget:             int
    max_budget:             int
    primary_activity:       str
    secondary_activity:     Optional[str] = None
    primary_subcategory:   Optional[str] = "Standard"
    secondary_subcategory: Optional[str] = "Standard"
    cooling_preference:     Optional[str] = "Auto"
    resolution_target:      str = "1080p 144Hz+ (FHD High FPS)"

    @field_validator("primary_activity")
    @classmethod
    def validate_primary(cls, v: str) -> str:
        if v not in VALID_ACTIVITIES:
            raise ValueError(
                f"Invalid primary_activity '{v}'. "
                f"Must be one of: {VALID_ACTIVITIES}"
            )
        return v

    @field_validator("secondary_activity", mode="before")
    @classmethod
    def validate_secondary(cls, v: Optional[str]) -> Optional[str]:
        # Treat empty / whitespace-only strings the same as None (no secondary)
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return None
        if v not in VALID_ACTIVITIES:
            raise ValueError(
                f"Invalid secondary_activity '{v}'. "
                f"Must be one of: {VALID_ACTIVITIES}"
            )
        return v

    @field_validator("primary_subcategory", mode="before")
    @classmethod
    def validate_primary_sub(cls, v: Optional[str]) -> str:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return "Standard"
        clean = v.strip().capitalize()
        if clean not in VALID_SUBCATEGORIES:
            raise ValueError(
                f"Invalid primary_subcategory '{v}'. "
                f"Must be one of: {VALID_SUBCATEGORIES}"
            )
        return clean

    @field_validator("secondary_subcategory", mode="before")
    @classmethod
    def validate_secondary_sub(cls, v: Optional[str]) -> Optional[str]:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return "Standard"
        clean = v.strip().capitalize()
        if clean not in VALID_SUBCATEGORIES:
            raise ValueError(
                f"Invalid secondary_subcategory '{v}'. "
                f"Must be one of: {VALID_SUBCATEGORIES}"
            )
        return clean

    @field_validator("cooling_preference", mode="before")
    @classmethod
    def validate_cooling_pref(cls, v: Optional[str]) -> str:
        if v is None or (isinstance(v, str) and v.strip() == ""):
            return "Auto"
        clean = v.strip()
        if clean.lower() in ("liquid", "aio", "water", "liquid / aio"):
            return "Liquid / AIO"
        if clean.lower() in ("air", "air cooling"):
            return "Air"
        if clean.lower() == "auto":
            return "Auto"
        if clean not in VALID_COOLING_PREFERENCES:
            raise ValueError(
                f"Invalid cooling_preference '{v}'. "
                f"Must be one of: {VALID_COOLING_PREFERENCES}"
            )
        return clean

    @field_validator("resolution_target")
    @classmethod
    def validate_resolution_target(cls, v: str) -> str:
        if v not in VALID_RESOLUTION_TARGETS:
            raise ValueError(
                f"Invalid resolution_target '{v}'. "
                f"Must be one of: {VALID_RESOLUTION_TARGETS}"
            )
        return v

    @field_validator("max_budget")
    @classmethod
    def validate_budget(cls, v: int, info) -> int:
        min_b = info.data.get("min_budget")
        if min_b is not None and v < min_b:
            raise ValueError("max_budget must be greater than or equal to min_budget.")
        return v


class CategoryOptionsRequest(UserInput):
    category:            str
    selected_components: Optional[dict[str, Any]] = None


class FinalizeBuildRequest(UserInput):
    selected_components: dict[str, Any]