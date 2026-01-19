from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.models.sale import SaleStatus, PaymentMethod


class SaleItemCreate(BaseModel):
    product_id: UUID
    quantity: int = Field(..., gt=0)
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)


class SaleCreate(BaseModel):
    items: List[SaleItemCreate] = Field(..., min_length=1)
    payment_method: PaymentMethod
    amount_paid: Decimal = Field(..., ge=0)
    discount_percent: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    apply_tax: Optional[bool] = None  # None = usar config, True/False = forzar
    notes: Optional[str] = None


class SaleItemResponse(BaseModel):
    id: UUID
    sale_id: UUID
    product_id: UUID
    product_sku: str
    product_name: str
    unit_price: Decimal
    cost_price: Optional[Decimal]
    tax_rate: Decimal
    quantity: int
    discount_percent: Decimal
    discount_amount: Decimal
    subtotal: Decimal
    tax_amount: Decimal
    total: Decimal
    returned_qty: int
    created_at: datetime

    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: UUID
    receipt_number: str
    user_id: UUID
    status: SaleStatus
    subtotal: Decimal
    tax_amount: Decimal
    discount_amount: Decimal
    discount_percent: Decimal
    total: Decimal
    payment_method: PaymentMethod
    amount_paid: Decimal
    change_amount: Decimal
    notes: Optional[str]
    void_reason: Optional[str]
    voided_at: Optional[datetime]
    voided_by_id: Optional[UUID]
    created_at: datetime
    updated_at: datetime
    items: List[SaleItemResponse] = []
    # Campos adicionales
    user_name: Optional[str] = None

    class Config:
        from_attributes = True


class SaleVoid(BaseModel):
    reason: str = Field(..., min_length=1)


class ReturnItemCreate(BaseModel):
    sale_item_id: UUID
    quantity: int = Field(..., gt=0)


class ReturnCreate(BaseModel):
    items: List[ReturnItemCreate] = Field(..., min_length=1)
    reason: str = Field(..., min_length=1)


class ReturnItemResponse(BaseModel):
    id: UUID
    return_id: UUID
    sale_item_id: UUID
    quantity: int
    refund_amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class ReturnResponse(BaseModel):
    id: UUID
    sale_id: UUID
    user_id: UUID
    reason: str
    total_refund: Decimal
    created_at: datetime
    items: List[ReturnItemResponse] = []

    class Config:
        from_attributes = True


class SaleListResponse(BaseModel):
    items: List[SaleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
