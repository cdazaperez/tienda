from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
import math

from app.core.database import get_db
from app.models.user import User
from app.models.product import Product
from app.models.config import StoreConfig, Sequence
from app.models.inventory import InventoryMovement, MovementType
from app.models.sale import Sale, SaleItem, Return, ReturnItem, SaleStatus, PaymentMethod
from app.models.audit import AuditLog
from app.schemas.sale import (
    SaleCreate, SaleResponse, SaleItemResponse, SaleVoid,
    ReturnCreate, ReturnResponse, SaleListResponse
)
from app.api.deps import get_current_user, get_current_admin_user, get_client_info
from app.services.receipt import generate_receipt_pdf, generate_receipt_html

router = APIRouter()


def create_audit_log(db: Session, user_id: UUID, action: str, entity: str, entity_id: UUID,
                     description: str, old_values=None, new_values=None, ip_address=None, user_agent=None):
    log = AuditLog(
        user_id=user_id, action=action, entity=entity, entity_id=entity_id,
        description=description, old_values=old_values, new_values=new_values,
        ip_address=ip_address, user_agent=user_agent
    )
    db.add(log)


def get_next_receipt_number(db: Session) -> str:
    """Genera el siguiente número de recibo"""
    sequence = db.query(Sequence).filter(Sequence.name == "receipt").with_for_update().first()
    if not sequence:
        sequence = Sequence(name="receipt", prefix="R", current_value=0, padding=8)
        db.add(sequence)

    sequence.current_value += 1
    db.flush()

    return f"{sequence.prefix}{str(sequence.current_value).zfill(sequence.padding)}"


def get_store_config(db: Session) -> StoreConfig:
    config = db.query(StoreConfig).first()
    if not config:
        config = StoreConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def get_sale_response(sale: Sale, db: Session) -> SaleResponse:
    user = db.query(User).filter(User.id == sale.user_id).first()

    items = [
        SaleItemResponse(
            id=item.id,
            sale_id=item.sale_id,
            product_id=item.product_id,
            product_sku=item.product_sku,
            product_name=item.product_name,
            unit_price=item.unit_price,
            cost_price=item.cost_price,
            tax_rate=item.tax_rate,
            quantity=item.quantity,
            discount_percent=item.discount_percent,
            discount_amount=item.discount_amount,
            subtotal=item.subtotal,
            tax_amount=item.tax_amount,
            total=item.total,
            returned_qty=item.returned_qty,
            created_at=item.created_at
        )
        for item in sale.items
    ]

    return SaleResponse(
        id=sale.id,
        receipt_number=sale.receipt_number,
        user_id=sale.user_id,
        status=sale.status,
        subtotal=sale.subtotal,
        tax_amount=sale.tax_amount,
        discount_amount=sale.discount_amount,
        discount_percent=sale.discount_percent,
        total=sale.total,
        payment_method=sale.payment_method,
        amount_paid=sale.amount_paid,
        change_amount=sale.change_amount,
        notes=sale.notes,
        void_reason=sale.void_reason,
        voided_at=sale.voided_at,
        voided_by_id=sale.voided_by_id,
        created_at=sale.created_at,
        updated_at=sale.updated_at,
        items=items,
        user_name=f"{user.first_name} {user.last_name}" if user else None
    )


@router.get("", response_model=SaleListResponse)
def list_sales(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: Optional[SaleStatus] = None,
    user_id: Optional[UUID] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar ventas con filtros"""
    query = db.query(Sale).options(joinedload(Sale.items))

    if status_filter:
        query = query.filter(Sale.status == status_filter)

    if user_id:
        query = query.filter(Sale.user_id == user_id)

    if start_date:
        query = query.filter(Sale.created_at >= start_date)

    if end_date:
        query = query.filter(Sale.created_at <= end_date)

    total = query.count()
    total_pages = math.ceil(total / page_size)

    sales = query.order_by(Sale.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return SaleListResponse(
        items=[get_sale_response(s, db) for s in sales],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.post("", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    data: SaleCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Crear una venta"""
    client_info = get_client_info(request)
    config = get_store_config(db)

    # Validar productos y calcular totales
    sale_items = []
    subtotal = Decimal("0")
    total_tax = Decimal("0")

    for item_data in data.items:
        product = db.query(Product).filter(
            Product.id == item_data.product_id,
            Product.is_active == True
        ).with_for_update().first()

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Producto no encontrado: {item_data.product_id}"
            )

        # Verificar stock
        if not config.allow_negative_stock and product.current_stock < item_data.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Stock insuficiente para {product.name}. Disponible: {product.current_stock}"
            )

        # Calcular montos del item
        item_subtotal = product.sale_price * item_data.quantity
        item_discount = item_subtotal * (item_data.discount_percent / 100)
        item_after_discount = item_subtotal - item_discount
        item_tax = item_after_discount * product.tax_rate
        item_total = item_after_discount + item_tax

        sale_item = SaleItem(
            product_id=product.id,
            product_sku=product.sku,
            product_name=product.name,
            unit_price=product.sale_price,
            cost_price=product.cost_price,
            tax_rate=product.tax_rate,
            quantity=item_data.quantity,
            discount_percent=item_data.discount_percent,
            discount_amount=item_discount,
            subtotal=item_subtotal,
            tax_amount=item_tax,
            total=item_total
        )
        sale_items.append((sale_item, product))

        subtotal += item_subtotal
        total_tax += item_tax

    # Aplicar descuento global
    global_discount = subtotal * (data.discount_percent / 100)
    total = subtotal - global_discount + total_tax

    # Validar pago
    if data.payment_method == PaymentMethod.CASH:
        if data.amount_paid < total:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Monto pagado insuficiente"
            )
        change = data.amount_paid - total
    else:
        change = Decimal("0")

    # Crear venta
    receipt_number = get_next_receipt_number(db)

    sale = Sale(
        receipt_number=receipt_number,
        user_id=current_user.id,
        status=SaleStatus.COMPLETED,
        subtotal=subtotal,
        tax_amount=total_tax,
        discount_amount=global_discount,
        discount_percent=data.discount_percent,
        total=total,
        payment_method=data.payment_method,
        amount_paid=data.amount_paid,
        change_amount=change,
        notes=data.notes
    )
    db.add(sale)
    db.flush()

    # Agregar items y actualizar inventario
    for sale_item, product in sale_items:
        sale_item.sale_id = sale.id
        db.add(sale_item)

        # Descontar stock
        previous_stock = product.current_stock
        product.current_stock -= sale_item.quantity

        # Crear movimiento de inventario
        movement = InventoryMovement(
            product_id=product.id,
            user_id=current_user.id,
            type=MovementType.SALE,
            quantity=-sale_item.quantity,
            previous_stock=previous_stock,
            new_stock=product.current_stock,
            reference_id=sale.id,
            reference_type="SALE"
        )
        db.add(movement)

    db.commit()
    db.refresh(sale)

    create_audit_log(
        db, current_user.id, "CREATE", "SALE", sale.id,
        f"Venta creada: {receipt_number} - Total: {total}",
        new_values={"receipt_number": receipt_number, "total": str(total), "items": len(sale_items)},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    sale = db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale.id).first()
    return get_sale_response(sale, db)


@router.get("/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener detalle de una venta"""
    sale = db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")
    return get_sale_response(sale, db)


@router.post("/{sale_id}/void")
def void_sale(
    sale_id: UUID,
    data: SaleVoid,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Anular una venta (Admin)"""
    client_info = get_client_info(request)

    sale = db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale_id).with_for_update().first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")

    if sale.status == SaleStatus.VOIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="La venta ya está anulada")

    # Restaurar stock
    for item in sale.items:
        product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
        if product:
            previous_stock = product.current_stock
            restore_qty = item.quantity - item.returned_qty
            product.current_stock += restore_qty

            movement = InventoryMovement(
                product_id=product.id,
                user_id=current_user.id,
                type=MovementType.VOID,
                quantity=restore_qty,
                previous_stock=previous_stock,
                new_stock=product.current_stock,
                reference_id=sale.id,
                reference_type="VOID",
                reason=data.reason
            )
            db.add(movement)

    sale.status = SaleStatus.VOIDED
    sale.void_reason = data.reason
    sale.voided_at = datetime.utcnow()
    sale.voided_by_id = current_user.id

    db.commit()

    create_audit_log(
        db, current_user.id, "VOID", "SALE", sale.id,
        f"Venta anulada: {sale.receipt_number}",
        old_values={"status": "COMPLETED"},
        new_values={"status": "VOIDED", "reason": data.reason},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return {"message": "Venta anulada correctamente"}


@router.post("/{sale_id}/return", response_model=ReturnResponse)
def create_return(
    sale_id: UUID,
    data: ReturnCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Crear devolución parcial o total (Admin)"""
    client_info = get_client_info(request)

    sale = db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale_id).with_for_update().first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")

    if sale.status == SaleStatus.VOIDED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No se puede devolver una venta anulada")

    total_refund = Decimal("0")
    return_items = []

    for return_item_data in data.items:
        sale_item = next((i for i in sale.items if i.id == return_item_data.sale_item_id), None)
        if not sale_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Item de venta no encontrado: {return_item_data.sale_item_id}"
            )

        available_qty = sale_item.quantity - sale_item.returned_qty
        if return_item_data.quantity > available_qty:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cantidad a devolver ({return_item_data.quantity}) excede disponible ({available_qty})"
            )

        # Calcular reembolso proporcional
        unit_total = sale_item.total / sale_item.quantity
        refund_amount = unit_total * return_item_data.quantity

        return_items.append((return_item_data, sale_item, refund_amount))
        total_refund += refund_amount

    # Crear devolución
    return_record = Return(
        sale_id=sale.id,
        user_id=current_user.id,
        reason=data.reason,
        total_refund=total_refund
    )
    db.add(return_record)
    db.flush()

    # Procesar items
    for return_item_data, sale_item, refund_amount in return_items:
        return_item = ReturnItem(
            return_id=return_record.id,
            sale_item_id=sale_item.id,
            quantity=return_item_data.quantity,
            refund_amount=refund_amount
        )
        db.add(return_item)

        # Actualizar cantidad devuelta
        sale_item.returned_qty += return_item_data.quantity

        # Restaurar stock
        product = db.query(Product).filter(Product.id == sale_item.product_id).with_for_update().first()
        if product:
            previous_stock = product.current_stock
            product.current_stock += return_item_data.quantity

            movement = InventoryMovement(
                product_id=product.id,
                user_id=current_user.id,
                type=MovementType.RETURN,
                quantity=return_item_data.quantity,
                previous_stock=previous_stock,
                new_stock=product.current_stock,
                reference_id=return_record.id,
                reference_type="RETURN",
                reason=data.reason
            )
            db.add(movement)

    # Actualizar estado de la venta
    total_items_qty = sum(i.quantity for i in sale.items)
    total_returned_qty = sum(i.returned_qty for i in sale.items)

    if total_returned_qty >= total_items_qty:
        sale.status = SaleStatus.FULLY_RETURNED
    else:
        sale.status = SaleStatus.PARTIALLY_RETURNED

    db.commit()
    db.refresh(return_record)

    create_audit_log(
        db, current_user.id, "RETURN", "SALE", sale.id,
        f"Devolución creada para venta {sale.receipt_number}: {total_refund}",
        new_values={"return_id": str(return_record.id), "refund": str(total_refund)},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return ReturnResponse(
        id=return_record.id,
        sale_id=return_record.sale_id,
        user_id=return_record.user_id,
        reason=return_record.reason,
        total_refund=return_record.total_refund,
        created_at=return_record.created_at,
        items=[]
    )


@router.get("/{sale_id}/receipt/pdf")
def get_receipt_pdf(
    sale_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener recibo en PDF"""
    sale = db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")

    config = get_store_config(db)
    user = db.query(User).filter(User.id == sale.user_id).first()

    pdf_bytes = generate_receipt_pdf(sale, config, user)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=recibo_{sale.receipt_number}.pdf"}
    )


@router.get("/{sale_id}/receipt/html")
def get_receipt_html(
    sale_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener recibo en HTML para impresión"""
    sale = db.query(Sale).options(joinedload(Sale.items)).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Venta no encontrada")

    config = get_store_config(db)
    user = db.query(User).filter(User.id == sale.user_id).first()

    html_content = generate_receipt_html(sale, config, user)

    return Response(content=html_content, media_type="text/html")
