from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, timedelta, date
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
import csv
from io import StringIO

from app.core.database import get_db
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.sale import Sale, SaleItem, SaleStatus
from app.api.deps import get_current_admin_user

router = APIRouter()


def get_date_range(period: str, custom_start: Optional[date] = None, custom_end: Optional[date] = None):
    """Obtiene el rango de fechas según el período"""
    today = date.today()

    if period == "today":
        return today, today
    elif period == "yesterday":
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif period == "week":
        start = today - timedelta(days=today.weekday())
        return start, today
    elif period == "month":
        start = today.replace(day=1)
        return start, today
    elif period == "year":
        start = today.replace(month=1, day=1)
        return start, today
    elif period == "custom" and custom_start and custom_end:
        return custom_start, custom_end
    else:
        return today - timedelta(days=30), today


@router.get("/sales")
def get_sales_report(
    period: str = Query("month", regex="^(today|yesterday|week|month|year|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    user_id: Optional[UUID] = None,
    category_id: Optional[UUID] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener reporte de ventas"""
    date_start, date_end = get_date_range(period, start_date, end_date)

    # Convertir a datetime
    start_dt = datetime.combine(date_start, datetime.min.time())
    end_dt = datetime.combine(date_end, datetime.max.time())

    # Base query para ventas completadas
    base_filter = and_(
        Sale.status.in_([SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED]),
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    )

    if user_id:
        base_filter = and_(base_filter, Sale.user_id == user_id)

    # Totales generales
    total_sales = db.query(func.count(Sale.id)).filter(base_filter).scalar() or 0
    total_revenue = db.query(func.sum(Sale.total)).filter(base_filter).scalar() or Decimal("0")
    total_tax = db.query(func.sum(Sale.tax_amount)).filter(base_filter).scalar() or Decimal("0")
    total_discount = db.query(func.sum(Sale.discount_amount)).filter(base_filter).scalar() or Decimal("0")

    avg_ticket = total_revenue / total_sales if total_sales > 0 else Decimal("0")

    # Ventas por método de pago
    payment_breakdown = db.query(
        Sale.payment_method,
        func.count(Sale.id).label("count"),
        func.sum(Sale.total).label("total")
    ).filter(base_filter).group_by(Sale.payment_method).all()

    payment_methods = {
        pm.payment_method.value: {"count": pm.count, "total": float(pm.total)}
        for pm in payment_breakdown
    }

    # Top productos
    if category_id:
        product_filter = and_(
            SaleItem.sale_id.in_(db.query(Sale.id).filter(base_filter)),
            Product.category_id == category_id
        )
    else:
        product_filter = SaleItem.sale_id.in_(db.query(Sale.id).filter(base_filter))

    top_products = db.query(
        Product.id,
        Product.sku,
        Product.name,
        func.sum(SaleItem.quantity - SaleItem.returned_qty).label("total_qty"),
        func.sum(SaleItem.total).label("total_revenue")
    ).join(SaleItem, SaleItem.product_id == Product.id).filter(
        product_filter
    ).group_by(
        Product.id, Product.sku, Product.name
    ).order_by(
        func.sum(SaleItem.total).desc()
    ).limit(10).all()

    top_products_list = [
        {
            "id": str(p.id),
            "sku": p.sku,
            "name": p.name,
            "quantity_sold": int(p.total_qty or 0),
            "revenue": float(p.total_revenue or 0)
        }
        for p in top_products
    ]

    # Top vendedores
    top_sellers = db.query(
        User.id,
        User.first_name,
        User.last_name,
        func.count(Sale.id).label("sales_count"),
        func.sum(Sale.total).label("total_revenue")
    ).join(Sale, Sale.user_id == User.id).filter(
        base_filter
    ).group_by(
        User.id, User.first_name, User.last_name
    ).order_by(
        func.sum(Sale.total).desc()
    ).limit(10).all()

    top_sellers_list = [
        {
            "id": str(s.id),
            "name": f"{s.first_name} {s.last_name}",
            "sales_count": s.sales_count,
            "revenue": float(s.total_revenue or 0)
        }
        for s in top_sellers
    ]

    # Top categorías
    top_categories = db.query(
        Category.id,
        Category.name,
        func.sum(SaleItem.quantity - SaleItem.returned_qty).label("total_qty"),
        func.sum(SaleItem.total).label("total_revenue")
    ).join(Product, Product.category_id == Category.id).join(
        SaleItem, SaleItem.product_id == Product.id
    ).filter(
        SaleItem.sale_id.in_(db.query(Sale.id).filter(base_filter))
    ).group_by(
        Category.id, Category.name
    ).order_by(
        func.sum(SaleItem.total).desc()
    ).limit(10).all()

    top_categories_list = [
        {
            "id": str(c.id),
            "name": c.name,
            "quantity_sold": int(c.total_qty or 0),
            "revenue": float(c.total_revenue or 0)
        }
        for c in top_categories
    ]

    return {
        "period": period,
        "start_date": date_start.isoformat(),
        "end_date": date_end.isoformat(),
        "summary": {
            "total_sales": total_sales,
            "total_revenue": float(total_revenue),
            "total_tax": float(total_tax),
            "total_discount": float(total_discount),
            "average_ticket": float(avg_ticket)
        },
        "payment_methods": payment_methods,
        "top_products": top_products_list,
        "top_sellers": top_sellers_list,
        "top_categories": top_categories_list
    }


@router.get("/sales/daily")
def get_daily_report(
    date_param: Optional[date] = Query(None, alias="date"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener reporte diario de ventas"""
    target_date = date_param or date.today()
    return get_sales_report(
        period="custom",
        start_date=target_date,
        end_date=target_date,
        current_user=current_user,
        db=db
    )


@router.get("/sales/weekly")
def get_weekly_report(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener reporte semanal de ventas"""
    return get_sales_report(period="week", current_user=current_user, db=db)


@router.get("/sales/monthly")
def get_monthly_report(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener reporte mensual de ventas"""
    return get_sales_report(period="month", current_user=current_user, db=db)


@router.get("/sales/trend")
def get_sales_trend(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener tendencia de ventas por día"""
    end_date = date.today()
    start_date = end_date - timedelta(days=days - 1)

    start_dt = datetime.combine(start_date, datetime.min.time())
    end_dt = datetime.combine(end_date, datetime.max.time())

    # Ventas por día
    daily_sales = db.query(
        func.date(Sale.created_at).label("date"),
        func.count(Sale.id).label("count"),
        func.sum(Sale.total).label("total")
    ).filter(
        Sale.status.in_([SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED]),
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    ).group_by(
        func.date(Sale.created_at)
    ).order_by(
        func.date(Sale.created_at)
    ).all()

    # Crear diccionario con todos los días
    sales_by_day = {str(s.date): {"count": s.count, "total": float(s.total)} for s in daily_sales}

    # Rellenar días sin ventas
    trend = []
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.isoformat()
        if date_str in sales_by_day:
            trend.append({
                "date": date_str,
                "count": sales_by_day[date_str]["count"],
                "total": sales_by_day[date_str]["total"]
            })
        else:
            trend.append({
                "date": date_str,
                "count": 0,
                "total": 0
            })
        current_date += timedelta(days=1)

    return {
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "days": days,
        "trend": trend
    }


@router.get("/sales/export/csv")
def export_sales_csv(
    period: str = Query("month", regex="^(today|yesterday|week|month|year|custom)$"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Exportar ventas a CSV"""
    date_start, date_end = get_date_range(period, start_date, end_date)

    start_dt = datetime.combine(date_start, datetime.min.time())
    end_dt = datetime.combine(date_end, datetime.max.time())

    sales = db.query(Sale).filter(
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    ).order_by(Sale.created_at.desc()).all()

    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Recibo", "Fecha", "Estado", "Vendedor",
        "Subtotal", "Descuento", "Impuestos", "Total",
        "Método de Pago", "Monto Pagado", "Cambio"
    ])

    for sale in sales:
        user = db.query(User).filter(User.id == sale.user_id).first()
        user_name = f"{user.first_name} {user.last_name}" if user else ""

        status_names = {
            "COMPLETED": "Completada",
            "VOIDED": "Anulada",
            "PARTIALLY_RETURNED": "Devolución Parcial",
            "FULLY_RETURNED": "Devolución Total"
        }

        payment_names = {
            "CASH": "Efectivo",
            "CARD": "Tarjeta",
            "TRANSFER": "Transferencia",
            "MIXED": "Mixto"
        }

        writer.writerow([
            sale.receipt_number,
            sale.created_at.strftime("%Y-%m-%d %H:%M:%S"),
            status_names.get(sale.status.value, sale.status.value),
            user_name,
            float(sale.subtotal),
            float(sale.discount_amount),
            float(sale.tax_amount),
            float(sale.total),
            payment_names.get(sale.payment_method.value, sale.payment_method.value),
            float(sale.amount_paid),
            float(sale.change_amount)
        ])

    output.seek(0)
    content = output.getvalue()

    filename = f"ventas_{date_start.isoformat()}_{date_end.isoformat()}.csv"

    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
