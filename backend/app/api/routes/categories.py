from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.models.user import User
from app.models.category import Category
from app.models.product import Product
from app.models.audit import AuditLog
from app.schemas.category import CategoryCreate, CategoryUpdate, CategoryResponse
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


def get_category_response(db: Session, category: Category) -> CategoryResponse:
    """Construye la respuesta con el conteo de productos"""
    product_count = db.query(func.count(Product.id)).filter(
        Product.category_id == category.id,
        Product.is_active == True
    ).scalar()

    return CategoryResponse(
        id=category.id,
        name=category.name,
        description=category.description,
        is_active=category.is_active,
        product_count=product_count,
        created_at=category.created_at,
        updated_at=category.updated_at
    )


@router.get("", response_model=List[CategoryResponse])
def list_categories(
    include_inactive: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Listar categorías"""
    query = db.query(Category)
    if not include_inactive:
        query = query.filter(Category.is_active == True)
    categories = query.order_by(Category.name).all()
    return [get_category_response(db, c) for c in categories]


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Crear categoría (Admin)"""
    client_info = get_client_info(request)

    # Verificar nombre único
    if db.query(Category).filter(Category.name == data.name).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una categoría con ese nombre")

    category = Category(name=data.name, description=data.description)
    db.add(category)
    db.commit()
    db.refresh(category)

    create_audit_log(
        db, current_user.id, "CREATE", "CATEGORY", category.id,
        f"Categoría creada: {category.name}",
        new_values={"name": category.name, "description": category.description},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return get_category_response(db, category)


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Obtener categoría por ID"""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")
    return get_category_response(db, category)


@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: UUID,
    data: CategoryUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Actualizar categoría (Admin)"""
    client_info = get_client_info(request)

    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")

    old_values = {"name": category.name, "description": category.description, "is_active": category.is_active}

    update_data = data.model_dump(exclude_unset=True)

    # Verificar nombre único si se cambia
    if "name" in update_data and update_data["name"] != category.name:
        if db.query(Category).filter(Category.name == update_data["name"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Ya existe una categoría con ese nombre")

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)

    new_values = {"name": category.name, "description": category.description, "is_active": category.is_active}

    create_audit_log(
        db, current_user.id, "UPDATE", "CATEGORY", category.id,
        f"Categoría actualizada: {category.name}",
        old_values=old_values, new_values=new_values,
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return get_category_response(db, category)


@router.delete("/{category_id}")
def delete_category(
    category_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Eliminar categoría (Admin) - Soft delete"""
    client_info = get_client_info(request)

    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Categoría no encontrada")

    # Verificar que no tenga productos activos
    product_count = db.query(func.count(Product.id)).filter(
        Product.category_id == category_id,
        Product.is_active == True
    ).scalar()

    if product_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se puede eliminar: tiene {product_count} productos activos"
        )

    category.is_active = False
    db.commit()

    create_audit_log(
        db, current_user.id, "DELETE", "CATEGORY", category.id,
        f"Categoría eliminada: {category.name}",
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return {"message": "Categoría eliminada correctamente"}
