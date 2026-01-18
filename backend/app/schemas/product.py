from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.schemas.category import CategoryResponse


class ProductBase(BaseModel):
    sku: str = Field(..., min_length=1, max_length=50)
    barcode: Optional[str] = Field(None, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: UUID
    brand: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=50)
    sale_price: Decimal = Field(..., ge=0, decimal_places=2)
    cost_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    tax_rate: Decimal = Field(default=Decimal("0"), ge=0, le=1, decimal_places=4)
    unit: str = Field(default="unidad", max_length=50)
    image_url: Optional[str] = Field(None, max_length=500)
    min_stock: int = Field(default=0, ge=0)


class ProductCreate(ProductBase):
    initial_stock: int = Field(default=0, ge=0)


class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=50)
    barcode: Optional[str] = Field(None, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: Optional[UUID] = None
    brand: Optional[str] = Field(None, max_length=100)
    size: Optional[str] = Field(None, max_length=50)
    color: Optional[str] = Field(None, max_length=50)
    sale_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    cost_price: Optional[Decimal] = Field(None, ge=0, decimal_places=2)
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=1, decimal_places=4)
    unit: Optional[str] = Field(None, max_length=50)
    image_url: Optional[str] = Field(None, max_length=500)
    min_stock: Optional[int] = Field(None, ge=0)
    is_active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: UUID
    sku: str
    barcode: Optional[str]
    name: str
    description: Optional[str]
    category_id: UUID
    category: Optional[CategoryResponse] = None
    brand: Optional[str]
    size: Optional[str]
    color: Optional[str]
    sale_price: Decimal
    cost_price: Optional[Decimal]
    tax_rate: Decimal
    unit: str
    image_url: Optional[str]
    min_stock: int
    current_stock: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProductSearch(BaseModel):
    q: str = Field(..., min_length=1)
    limit: int = Field(default=20, ge=1, le=100)


class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
