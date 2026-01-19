import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, Numeric
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class StoreConfig(Base):
    __tablename__ = "store_config"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_name = Column(String(200), default="Mi Tienda", nullable=False)
    store_address = Column(Text, nullable=True)
    store_phone = Column(String(50), nullable=True)
    store_email = Column(String(255), nullable=True)
    store_rut = Column(String(50), nullable=True)  # Tax ID
    logo_url = Column(String(500), nullable=True)
    # Colores del tema
    primary_color = Column(String(7), default="#3B82F6", nullable=False)
    secondary_color = Column(String(7), default="#1E40AF", nullable=False)
    accent_color = Column(String(7), default="#F59E0B", nullable=False)
    # Configuración de impuestos
    tax_enabled = Column(Boolean, default=True, nullable=False)
    tax_rate = Column(Numeric(5, 4), default=Decimal("0.19"), nullable=False)  # Ej: 0.19 = 19%
    tax_name = Column(String(50), default="IVA", nullable=False)
    # Configuración de recibos
    receipt_header = Column(Text, nullable=True)
    receipt_footer = Column(Text, default="Gracias por su compra", nullable=True)
    # Configuración de seguridad
    max_failed_attempts = Column(Integer, default=5, nullable=False)
    lockout_duration_minutes = Column(Integer, default=15, nullable=False)
    # Configuración de inventario
    allow_negative_stock = Column(Boolean, default=False, nullable=False)
    low_stock_threshold = Column(Integer, default=10, nullable=False)
    # Otros
    currency_symbol = Column(String(10), default="$", nullable=False)
    currency_code = Column(String(3), default="CLP", nullable=False)
    dark_mode_default = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)


class Sequence(Base):
    """Tabla para manejar secuencias (número de recibo, etc.)"""
    __tablename__ = "sequences"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(50), unique=True, nullable=False)
    prefix = Column(String(10), default="", nullable=False)
    current_value = Column(Integer, default=0, nullable=False)
    padding = Column(Integer, default=8, nullable=False)  # Ej: 00000001
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
