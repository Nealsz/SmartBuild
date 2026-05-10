from pydantic import BaseModel

class UserInput(BaseModel):
    min_budget: int
    max_budget: int
    description: str