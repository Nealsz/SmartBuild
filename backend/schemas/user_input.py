from pydantic import BaseModel, field_validator
from typing import Optional

from config import ACTIVITY_WEIGHTS, RESOLUTION_TARGET_WEIGHTS

VALID_ACTIVITIES = list(ACTIVITY_WEIGHTS.keys())
VALID_RESOLUTION_TARGETS = list(RESOLUTION_TARGET_WEIGHTS.keys())


class UserInput(BaseModel):
    min_budget:         int
    max_budget:         int
    primary_activity:   str
    secondary_activity: Optional[str] = None
    resolution_target:  str = "1080p 144Hz+ (FHD High FPS)"

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