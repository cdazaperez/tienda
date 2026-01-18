import uuid
from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, String, Boolean, Integer, DateTime, Text, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = Column(String(50), unique=True, nullable=False, index=True)
    barcode = Column(String(50), unique=True, nullable=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(UUID(as_uuid=True), ForeignKey("categories.id"), nullable=False)
    brand = Column(String(100), nullable=True)
    size = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    sale_price = Column(Numeric(12, 2), nullable=False)
    cost_price = Column(Numeric(12, 2), nullable=True)
    tax_rate = Column(Numeric(5, 4), default=Decimal("0"), nullable=False)  # Ej: 0.19 = 19%
    unit = Column(String(50), default="unidad", nullable=False)
    image_url = Column(String(500), nullable=True)
    min_stock = Column(Integer, default=0, nullable=False)
    current_stock = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relaciones
    category = relationship("Category", back_populates="products")
    inventory_movements = relationship("InventoryMovement", back_populates="product")
    sale_items = relationship("SaleItem", back_populates="product")
