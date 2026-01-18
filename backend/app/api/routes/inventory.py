from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
import math

from app.core.database import get_db
from app.models.user import User
from app.models.product import Product
from app.models.inventory import InventoryMovement, MovementType
from app.models.audit import AuditLog
from app.schemas.inventory import (
    InventoryEntry, InventoryAdjust, InventoryMovementResponse,
    LowStockProduct, InventoryReport
)
from app.api.deps import get_current_user, get_current_admin_user, get_client_info

router = APIRouter()


def create_audit_log(db: Session, user_id: UUID, action: str, entity: str, entity_id: UUID,
                     description: str, old_values=None, new_values=None, ip_address=None, user_agent=None):
    log = AuditLog(
        user_id=user_id, action=action, entity=entity, entity_id=entity_id,
        description=description, old_values=old_values, new_values=new_values,
        ip_address=ip_address, user_agent=user_agent
    )
    db.add(log)


def get_movement_response(movement: InventoryMovement, db: Session) -> InventoryMovementResponse:
    user = db.query(User).filter(User.id == movement.user_id).first()
    product = db.query(Product).filter(Product.id == movement.product_id).first()

    return InventoryMovementResponse(
        id=movement.id,
        product_id=movement.product_id,
        user_id=movement.user_id,
        type=movement.type,
        quantity=movement.quantity,
        previous_stock=movement.previous_stock,
        new_stock=movement.new_stock,
        reason=movement.reason,
        reference_id=movement.reference_id,
        reference_type=movement.reference_type,
        created_at=movement.created_at,
        user_name=f"{user.first_name} {user.last_name}" if user else None,
        product_name=product.name if product else None,
        product_sku=product.sku if product else None
    )


@router.get("/{product_id}/movements", response_model=List[InventoryMovementResponse])
def get_product_movements(
    product_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener movimientos de inventario de un producto (Kardex)"""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    movements = db.query(InventoryMovement).filter(
        InventoryMovement.product_id == product_id
    ).order_by(InventoryMovement.created_at.desc()).offset(skip).limit(limit).all()

    return [get_movement_response(m, db) for m in movements]


@router.post("/{product_id}/entry", response_model=InventoryMovementResponse)
def create_inventory_entry(
    product_id: UUID,
    data: InventoryEntry,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Registrar entrada de inventario (Admin)"""
    client_info = get_client_info(request)

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    previous_stock = product.current_stock
    new_stock = previous_stock + data.quantity

    movement = InventoryMovement(
        product_id=product_id,
        user_id=current_user.id,
        type=MovementType.ENTRY,
        quantity=data.quantity,
        previous_stock=previous_stock,
        new_stock=new_stock,
        reason=data.reason or "Entrada de mercancía"
    )
    db.add(movement)

    product.current_stock = new_stock
    db.commit()
    db.refresh(movement)

    create_audit_log(
        db, current_user.id, "INVENTORY_ENTRY", "PRODUCT", product_id,
        f"Entrada de inventario: {product.sku} +{data.quantity}",
        old_values={"stock": previous_stock},
        new_values={"stock": new_stock},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return get_movement_response(movement, db)


@router.post("/{product_id}/adjust", response_model=InventoryMovementResponse)
def adjust_inventory(
    product_id: UUID,
    data: InventoryAdjust,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Ajustar inventario (Admin)"""
    client_info = get_client_info(request)

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    previous_stock = product.current_stock
    quantity_diff = data.new_stock - previous_stock

    movement = InventoryMovement(
        product_id=product_id,
        user_id=current_user.id,
        type=MovementType.ADJUSTMENT,
        quantity=quantity_diff,
        previous_stock=previous_stock,
        new_stock=data.new_stock,
        reason=data.reason
    )
    db.add(movement)

    product.current_stock = data.new_stock
    db.commit()
    db.refresh(movement)

    create_audit_log(
        db, current_user.id, "INVENTORY_ADJUST", "PRODUCT", product_id,
        f"Ajuste de inventario: {product.sku} {previous_stock} -> {data.new_stock}",
        old_values={"stock": previous_stock},
        new_values={"stock": data.new_stock, "reason": data.reason},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return get_movement_response(movement, db)


@router.get("/low-stock", response_model=List[LowStockProduct])
def get_low_stock_products(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener productos con stock bajo o agotado"""
    products = db.query(Product).filter(
        Product.is_active == True,
        Product.current_stock <= Product.min_stock
    ).order_by(Product.current_stock).all()

    return [
        LowStockProduct(
            id=p.id,
            sku=p.sku,
            name=p.name,
            current_stock=p.current_stock,
            min_stock=p.min_stock,
            difference=p.min_stock - p.current_stock
        )
        for p in products
    ]


@router.get("/report", response_model=InventoryReport)
def get_inventory_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener reporte general de inventario"""
    # Total de productos activos
    total_products = db.query(func.count(Product.id)).filter(Product.is_active == True).scalar()

    # Total de unidades en stock
    total_units = db.query(func.sum(Product.current_stock)).filter(Product.is_active == True).scalar() or 0

    # Valor total del inventario (costo)
    total_value = db.query(
        func.sum(Product.current_stock * Product.cost_price)
    ).filter(
        Product.is_active == True,
        Product.cost_price.isnot(None)
    ).scalar() or Decimal("0")

    # Productos con stock bajo
    low_stock_count = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        Product.current_stock <= Product.min_stock,
        Product.current_stock > 0
    ).scalar()

    # Productos agotados
    out_of_stock_count = db.query(func.count(Product.id)).filter(
        Product.is_active == True,
        Product.current_stock == 0
    ).scalar()

    return InventoryReport(
        total_products=total_products,
        total_units=total_units,
        total_value=float(total_value),
        low_stock_count=low_stock_count,
        out_of_stock_count=out_of_stock_count
    )
