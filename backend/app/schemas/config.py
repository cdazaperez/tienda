from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


class StoreConfigUpdate(BaseModel):
    store_name: Optional[str] = Field(None, max_length=200)
    store_address: Optional[str] = None
    store_phone: Optional[str] = Field(None, max_length=50)
    store_email: Optional[EmailStr] = None
    store_rut: Optional[str] = Field(None, max_length=50)
    primary_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    secondary_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    accent_color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')
    tax_enabled: Optional[bool] = None
    tax_rate: Optional[Decimal] = Field(None, ge=0, le=1)
    tax_name: Optional[str] = Field(None, max_length=50)
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None
    max_failed_attempts: Optional[int] = Field(None, ge=1, le=20)
    lockout_duration_minutes: Optional[int] = Field(None, ge=1, le=1440)
    allow_negative_stock: Optional[bool] = None
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    currency_symbol: Optional[str] = Field(None, max_length=10)
    currency_code: Optional[str] = Field(None, max_length=3)
    dark_mode_default: Optional[bool] = None


class StoreConfigResponse(BaseModel):
    id: UUID
    store_name: str
    store_address: Optional[str]
    store_phone: Optional[str]
    store_email: Optional[str]
    store_rut: Optional[str]
    logo_url: Optional[str]
    primary_color: str
    secondary_color: str
    accent_color: str
    tax_enabled: bool
    tax_rate: Decimal
    tax_name: str
    receipt_header: Optional[str]
    receipt_footer: Optional[str]
    max_failed_attempts: int
    lockout_duration_minutes: int
    allow_negative_stock: bool
    low_stock_threshold: int
    currency_symbol: str
    currency_code: str
    dark_mode_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StoreConfigPublic(BaseModel):
    """Configuración pública (sin datos sensibles)"""
    store_name: str
    logo_url: Optional[str]
    primary_color: str
    secondary_color: str
    accent_color: str
    tax_enabled: bool
    tax_rate: Decimal
    tax_name: str
    currency_symbol: str
    currency_code: str
    dark_mode_default: bool

    class Config:
        from_attributes = True
