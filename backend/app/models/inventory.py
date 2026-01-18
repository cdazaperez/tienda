import uuid
import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class MovementType(str, enum.Enum):
    ENTRY = "ENTRY"
    SALE = "SALE"
    ADJUSTMENT = "ADJUSTMENT"
    RETURN = "RETURN"
    VOID = "VOID"


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(Enum(MovementType), nullable=False)
    quantity = Column(Integer, nullable=False)  # Positivo para entradas, negativo para salidas
    previous_stock = Column(Integer, nullable=False)
    new_stock = Column(Integer, nullable=False)
    reason = Column(Text, nullable=True)
    reference_id = Column(UUID(as_uuid=True), nullable=True)  # ID de venta, devolución, etc.
    reference_type = Column(String(50), nullable=True)  # "SALE", "RETURN", etc.
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relaciones
    product = relationship("Product", back_populates="inventory_movements")
    user = relationship("User", back_populates="inventory_movements")
