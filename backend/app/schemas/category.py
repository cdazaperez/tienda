from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    is_active: bool
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
