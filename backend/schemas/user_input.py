from pydantic import BaseModel, Field
from typing import Optional, List

class UserRequirementInput(BaseModel):
    budget_min: int = Field(..., description="Minimum budget for the PC build")
    budget_max: int = Field(..., description="Maximum budget for the PC build")
    usage: str = Field(..., description="Intended PC usage (e.g., gaming, professional work, general use)")
    performance_priority: List[str] = Field(..., description="Performance priorities (e.g., CPU, GPU, RAM, storage)")
    brand_preferences: Optional[dict] = Field(None, description="Brand preferences for components (e.g., {'CPU': 'Intel', 'GPU': 'NVIDIA'})")