from pydantic import BaseModel, field_validator
from typing import Optional

from config import ACTIVITY_WEIGHTS, LONGEVITY_MULTIPLIER

VALID_ACTIVITIES = list(ACTIVITY_WEIGHTS.keys())
VALID_LONGEVITY = list(LONGEVITY_MULTIPLIER.keys())


class UserInput(BaseModel):
    min_budget:         int
    max_budget:         int
    primary_activity:   str
    secondary_activity: Optional[str] = None
    longevity:          str = "3-5 years"
    upgrade_open:       bool = False

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

    @field_validator("longevity")
    @classmethod
    def validate_longevity(cls, v: str) -> str:
        if v not in VALID_LONGEVITY:
            raise ValueError(
                f"Invalid longevity '{v}'. "
                f"Must be one of: {VALID_LONGEVITY}"
            )
        return v

    @field_validator("max_budget")
    @classmethod
    def validate_budget(cls, v: int, info) -> int:
        min_b = info.data.get("min_budget")
        if min_b is not None and v < min_b:
            raise ValueError("max_budget must be greater than or equal to min_budget.")
        return v