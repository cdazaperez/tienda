import uuid
import enum
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Enum, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class SaleStatus(str, enum.Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    VOIDED = "VOIDED"
    PARTIALLY_RETURNED = "PARTIALLY_RETURNED"
    FULLY_RETURNED = "FULLY_RETURNED"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CARD = "CARD"
    TRANSFER = "TRANSFER"
    MIXED = "MIXED"


class Sale(Base):
    __tablename__ = "sales"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    receipt_number = Column(String(50), unique=True, nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status = Column(Enum(SaleStatus), default=SaleStatus.COMPLETED, nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    discount_percent = Column(Numeric(5, 2), default=Decimal("0"), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False)
    change_amount = Column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    notes = Column(Text, nullable=True)
    void_reason = Column(Text, nullable=True)
    voided_at = Column(DateTime(timezone=True), nullable=True)
    voided_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    # Relaciones
    user = relationship("User", foreign_keys=[user_id], back_populates="sales")
    voided_by = relationship("User", foreign_keys=[voided_by_id])
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    returns = relationship("Return", back_populates="sale")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    # Snapshot de datos del producto al momento de la venta
    product_sku = Column(String(50), nullable=False)
    product_name = Column(String(200), nullable=False)
    unit_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=True)
    tax_rate = Column(Numeric(5, 4), default=Decimal("0"), nullable=False)
    quantity = Column(Integer, nullable=False)
    discount_percent = Column(Numeric(5, 2), default=Decimal("0"), nullable=False)
    discount_amount = Column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    subtotal = Column(Numeric(12, 2), nullable=False)
    tax_amount = Column(Numeric(12, 2), default=Decimal("0"), nullable=False)
    total = Column(Numeric(12, 2), nullable=False)
    returned_qty = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relaciones
    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")


class Return(Base):
    __tablename__ = "returns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sale_id = Column(UUID(as_uuid=True), ForeignKey("sales.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    total_refund = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relaciones
    sale = relationship("Sale", back_populates="returns")
    user = relationship("User", back_populates="returns")
    items = relationship("ReturnItem", back_populates="return_record", cascade="all, delete-orphan")


class ReturnItem(Base):
    __tablename__ = "return_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    return_id = Column(UUID(as_uuid=True), ForeignKey("returns.id"), nullable=False)
    sale_item_id = Column(UUID(as_uuid=True), ForeignKey("sale_items.id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    refund_amount = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relaciones
    return_record = relationship("Return", back_populates="items")
    sale_item = relationship("SaleItem")
