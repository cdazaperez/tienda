from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func
import math

from app.core.database import get_db
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.inventory import InventoryMovement, MovementType
from app.models.audit import AuditLog
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse, ProductListResponse
from app.schemas.category import CategoryResponse
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


def get_product_response(product: Product) -> ProductResponse:
    category_response = None
    if product.category:
        category_response = CategoryResponse(
            id=product.category.id,
            name=product.category.name,
            description=product.category.description,
            is_active=product.category.is_active,
            product_count=0,
            created_at=product.category.created_at,
            updated_at=product.category.updated_at
        )

    return ProductResponse(
        id=product.id,
        sku=product.sku,
        barcode=product.barcode,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        category=category_response,
        brand=product.brand,
        size=product.size,
        color=product.color,
        sale_price=product.sale_price,
        cost_price=product.cost_price,
        tax_rate=product.tax_rate,
        unit=product.unit,
        image_url=product.image_url,
        min_stock=product.min_stock,
        current_stock=product.current_stock,
        is_active=product.is_active,
        created_at=product.created_at,
        updated_at=product.updated_at
    )


@router.get("", response_model=ProductListResponse)
def list_products(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category_id: Optional[UUID] = None,
    include_inactive: bool = False,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar productos con paginación"""
    query = db.query(Product).options(joinedload(Product.category))

    if not include_inactive:
        query = query.filter(Product.is_active == True)

    if category_id:
        query = query.filter(Product.category_id == category_id)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Product.name.ilike(search_term),
                Product.sku.ilike(search_term),
                Product.barcode.ilike(search_term),
                Product.brand.ilike(search_term)
            )
        )

    total = query.count()
    total_pages = math.ceil(total / page_size)

    products = query.order_by(Product.name).offset((page - 1) * page_size).limit(page_size).all()

    return ProductListResponse(
        items=[get_product_response(p) for p in products],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/search", response_model=List[ProductResponse])
def search_products(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Búsqueda rápida de productos (para POS)"""
    search_term = f"%{q}%"
    products = db.query(Product).options(joinedload(Product.category)).filter(
        Product.is_active == True,
        or_(
            Product.name.ilike(search_term),
            Product.sku.ilike(search_term),
            Product.barcode.ilike(search_term)
        )
    ).limit(limit).all()

    return [get_product_response(p) for p in products]


@router.get("/barcode/{barcode}", response_model=ProductResponse)
def get_product_by_barcode(
    barcode: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener producto por código de barras"""
    product = db.query(Product).options(joinedload(Product.category)).filter(
        Product.barcode == barcode,
        Product.is_active == True
    ).first()

    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    return get_product_response(product)


@router.get("/low-stock", response_model=List[ProductResponse])
def get_low_stock_products(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener productos con stock bajo"""
    products = db.query(Product).options(joinedload(Product.category)).filter(
        Product.is_active == True,
        Product.current_stock <= Product.min_stock
    ).order_by(Product.current_stock).all()

    return [get_product_response(p) for p in products]


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Crear producto (Admin)"""
    client_info = get_client_info(request)

    # Verificar categoría
    category = db.query(Category).filter(Category.id == data.category_id, Category.is_active == True).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")

    # Verificar SKU único
    if db.query(Product).filter(Product.sku == data.sku).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU ya existe")

    # Verificar barcode único si se proporciona
    if data.barcode and db.query(Product).filter(Product.barcode == data.barcode).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Código de barras ya existe")

    product = Product(
        sku=data.sku,
        barcode=data.barcode,
        name=data.name,
        description=data.description,
        category_id=data.category_id,
        brand=data.brand,
        size=data.size,
        color=data.color,
        sale_price=data.sale_price,
        cost_price=data.cost_price,
        tax_rate=data.tax_rate,
        unit=data.unit,
        image_url=data.image_url,
        min_stock=data.min_stock,
        current_stock=data.initial_stock
    )
    db.add(product)
    db.flush()

    # Crear movimiento de inventario inicial si hay stock
    if data.initial_stock > 0:
        movement = InventoryMovement(
            product_id=product.id,
            user_id=current_user.id,
            type=MovementType.ENTRY,
            quantity=data.initial_stock,
            previous_stock=0,
            new_stock=data.initial_stock,
            reason="Stock inicial"
        )
        db.add(movement)

    db.commit()
    db.refresh(product)

    create_audit_log(
        db, current_user.id, "CREATE", "PRODUCT", product.id,
        f"Producto creado: {product.sku} - {product.name}",
        new_values={"sku": product.sku, "name": product.name, "sale_price": str(product.sale_price)},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    # Recargar con la categoría
    product = db.query(Product).options(joinedload(Product.category)).filter(Product.id == product.id).first()
    return get_product_response(product)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener producto por ID"""
    product = db.query(Product).options(joinedload(Product.category)).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")
    return get_product_response(product)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: UUID,
    data: ProductUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Actualizar producto (Admin)"""
    client_info = get_client_info(request)

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    old_values = {
        "sku": product.sku, "name": product.name,
        "sale_price": str(product.sale_price), "is_active": product.is_active
    }

    update_data = data.model_dump(exclude_unset=True)

    # Verificar categoría si se cambia
    if "category_id" in update_data:
        category = db.query(Category).filter(
            Category.id == update_data["category_id"],
            Category.is_active == True
        ).first()
        if not category:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")

    # Verificar SKU único si se cambia
    if "sku" in update_data and update_data["sku"] != product.sku:
        if db.query(Product).filter(Product.sku == update_data["sku"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="SKU ya existe")

    # Verificar barcode único si se cambia
    if "barcode" in update_data and update_data["barcode"] and update_data["barcode"] != product.barcode:
        if db.query(Product).filter(Product.barcode == update_data["barcode"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Código de barras ya existe")

    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)

    new_values = {
        "sku": product.sku, "name": product.name,
        "sale_price": str(product.sale_price), "is_active": product.is_active
    }

    create_audit_log(
        db, current_user.id, "UPDATE", "PRODUCT", product.id,
        f"Producto actualizado: {product.sku}",
        old_values=old_values, new_values=new_values,
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    product = db.query(Product).options(joinedload(Product.category)).filter(Product.id == product.id).first()
    return get_product_response(product)


@router.delete("/{product_id}")
def delete_product(
    product_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Eliminar producto (Admin) - Soft delete"""
    client_info = get_client_info(request)

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Producto no encontrado")

    product.is_active = False
    db.commit()

    create_audit_log(
        db, current_user.id, "DELETE", "PRODUCT", product.id,
        f"Producto eliminado: {product.sku}",
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return {"message": "Producto eliminado correctamente"}
