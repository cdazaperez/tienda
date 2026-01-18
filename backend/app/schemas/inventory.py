from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.inventory import MovementType


class InventoryEntry(BaseModel):
    quantity: int = Field(..., gt=0)
    reason: Optional[str] = None


class InventoryAdjust(BaseModel):
    new_stock: int = Field(..., ge=0)
    reason: str = Field(..., min_length=1)


class InventoryMovementResponse(BaseModel):
    id: UUID
    product_id: UUID
    user_id: UUID
    type: MovementType
    quantity: int
    previous_stock: int
    new_stock: int
    reason: Optional[str]
    reference_id: Optional[UUID]
    reference_type: Optional[str]
    created_at: datetime
    # Campos relacionados
    user_name: Optional[str] = None
    product_name: Optional[str] = None
    product_sku: Optional[str] = None

    class Config:
        from_attributes = True


class LowStockProduct(BaseModel):
    id: UUID
    sku: str
    name: str
    current_stock: int
    min_stock: int
    difference: int

    class Config:
        from_attributes = True


class InventoryReport(BaseModel):
    total_products: int
    total_units: int
    total_value: float
    low_stock_count: int
    out_of_stock_count: int
