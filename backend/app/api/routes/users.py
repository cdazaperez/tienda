from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, RefreshToken
from app.models.audit import AuditLog
from app.schemas.user import UserCreate, UserUpdate, UserResponse, ResetPassword
from app.api.deps import get_current_admin_user, get_client_info

router = APIRouter()


def create_audit_log(db: Session, user_id: UUID, action: str, entity: str, entity_id: UUID,
                     description: str, old_values=None, new_values=None, ip_address=None, user_agent=None):
    log = AuditLog(
        user_id=user_id, action=action, entity=entity, entity_id=entity_id,
        description=description, old_values=old_values, new_values=new_values,
        ip_address=ip_address, user_agent=user_agent
    )
    db.add(log)


@router.get("", response_model=List[UserResponse])
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    include_inactive: bool = False,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Listar usuarios (Admin)"""
    query = db.query(User)
    if not include_inactive:
        query = query.filter(User.is_active == True)
    users = query.offset(skip).limit(limit).all()
    return [UserResponse.model_validate(u) for u in users]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    data: UserCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Crear usuario (Admin)"""
    client_info = get_client_info(request)

    # Verificar email único
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email ya registrado")

    # Verificar username único
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nombre de usuario ya registrado")

    user = User(
        email=data.email,
        username=data.username,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=data.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    create_audit_log(
        db, current_user.id, "CREATE", "USER", user.id,
        f"Usuario creado: {user.email}",
        new_values={"email": user.email, "username": user.username, "role": user.role.value},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return UserResponse.model_validate(user)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener usuario por ID (Admin)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return UserResponse.model_validate(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    data: UserUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Actualizar usuario (Admin)"""
    client_info = get_client_info(request)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    old_values = {
        "email": user.email, "username": user.username,
        "first_name": user.first_name, "last_name": user.last_name,
        "role": user.role.value, "is_active": user.is_active
    }

    update_data = data.model_dump(exclude_unset=True)

    # Verificar unicidad de email
    if "email" in update_data and update_data["email"] != user.email:
        if db.query(User).filter(User.email == update_data["email"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email ya registrado")

    # Verificar unicidad de username
    if "username" in update_data and update_data["username"] != user.username:
        if db.query(User).filter(User.username == update_data["username"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username ya registrado")

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)

    new_values = {
        "email": user.email, "username": user.username,
        "first_name": user.first_name, "last_name": user.last_name,
        "role": user.role.value, "is_active": user.is_active
    }

    create_audit_log(
        db, current_user.id, "UPDATE", "USER", user.id,
        f"Usuario actualizado: {user.email}",
        old_values=old_values, new_values=new_values,
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return UserResponse.model_validate(user)


@router.post("/{user_id}/reset-password")
def reset_password(
    user_id: UUID,
    data: ResetPassword,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Resetear contraseña de usuario (Admin)"""
    client_info = get_client_info(request)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    user.password_hash = get_password_hash(data.new_password)
    user.failed_attempts = 0
    user.locked_until = None

    # Revocar todos los refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.revoked == False
    ).update({"revoked": True})

    db.commit()

    create_audit_log(
        db, current_user.id, "RESET_PASSWORD", "USER", user.id,
        f"Contraseña reseteada para: {user.email}",
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return {"message": "Contraseña reseteada correctamente"}


@router.post("/{user_id}/toggle-active")
def toggle_user_active(
    user_id: UUID,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Activar/Desactivar usuario (Admin)"""
    client_info = get_client_info(request)

    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No puede desactivarse a sí mismo")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")

    user.is_active = not user.is_active

    if not user.is_active:
        # Revocar tokens si se desactiva
        db.query(RefreshToken).filter(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked == False
        ).update({"revoked": True})

    db.commit()

    action = "ACTIVATE" if user.is_active else "DEACTIVATE"
    create_audit_log(
        db, current_user.id, action, "USER", user.id,
        f"Usuario {'activado' if user.is_active else 'desactivado'}: {user.email}",
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return {"message": f"Usuario {'activado' if user.is_active else 'desactivado'}", "is_active": user.is_active}
