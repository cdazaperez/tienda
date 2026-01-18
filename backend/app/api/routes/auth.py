from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, decode_token
from app.models.user import User, RefreshToken
from app.models.config import StoreConfig
from app.models.audit import AuditLog
from app.schemas.user import UserLogin, Token, TokenRefresh, UserResponse, ChangePassword
from app.api.deps import get_current_user, get_client_info

router = APIRouter()


def get_store_config(db: Session) -> StoreConfig:
    config = db.query(StoreConfig).first()
    if not config:
        config = StoreConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def create_audit_log(
    db: Session,
    user_id: Optional[UUID],
    action: str,
    entity: str,
    entity_id: Optional[UUID] = None,
    description: Optional[str] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity=entity,
        entity_id=entity_id,
        description=description,
        old_values=old_values,
        new_values=new_values,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(log)
    db.commit()


@router.post("/login", response_model=Token)
def login(
    data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """Iniciar sesión"""
    client_info = get_client_info(request)

    # Buscar usuario por email o username
    user = db.query(User).filter(
        (User.email == data.email) | (User.username == data.email)
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    # Verificar si está bloqueado
    config = get_store_config(db)
    if user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = (user.locked_until - datetime.now(timezone.utc)).seconds // 60
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Cuenta bloqueada. Intente en {remaining} minutos"
        )

    # Verificar contraseña
    if not verify_password(data.password, user.password_hash):
        user.failed_attempts += 1

        if user.failed_attempts >= config.max_failed_attempts:
            user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=config.lockout_duration_minutes)
            user.failed_attempts = 0
            db.commit()

            create_audit_log(
                db, user.id, "ACCOUNT_LOCKED", "USER", user.id,
                f"Cuenta bloqueada por {config.max_failed_attempts} intentos fallidos",
                ip_address=client_info["ip_address"],
                user_agent=client_info["user_agent"]
            )

            raise HTTPException(
                status_code=status.HTTP_423_LOCKED,
                detail=f"Cuenta bloqueada por {config.lockout_duration_minutes} minutos"
            )

        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario desactivado"
        )

    # Login exitoso
    user.failed_attempts = 0
    user.locked_until = None
    user.last_login = datetime.now(timezone.utc)

    # Crear tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token_str = create_refresh_token(data={"sub": str(user.id)})

    # Guardar refresh token
    refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token_str,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(refresh_token)
    db.commit()

    create_audit_log(
        db, user.id, "LOGIN", "USER", user.id,
        "Inicio de sesión exitoso",
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"]
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token_str,
        user=UserResponse.model_validate(user)
    )


@router.post("/refresh", response_model=Token)
def refresh_token(
    data: TokenRefresh,
    db: Session = Depends(get_db)
):
    """Refrescar token de acceso"""
    payload = decode_token(data.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado"
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido"
        )

    # Verificar que el refresh token existe en la base de datos
    stored_token = db.query(RefreshToken).filter(
        RefreshToken.token == data.refresh_token,
        RefreshToken.user_id == UUID(user_id),
        RefreshToken.revoked == False,
        RefreshToken.expires_at > datetime.now(timezone.utc)
    ).first()

    if not stored_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token no válido"
        )

    user = db.query(User).filter(User.id == UUID(user_id)).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo"
        )

    # Revocar el token anterior
    stored_token.revoked = True

    # Crear nuevos tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})

    # Guardar nuevo refresh token
    new_token = RefreshToken(
        user_id=user.id,
        token=new_refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
    )
    db.add(new_token)
    db.commit()

    return Token(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cerrar sesión (revocar todos los refresh tokens)"""
    client_info = get_client_info(request)

    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False
    ).update({"revoked": True})

    db.commit()

    create_audit_log(
        db, current_user.id, "LOGOUT", "USER", current_user.id,
        "Cierre de sesión",
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"]
    )

    return {"message": "Sesión cerrada correctamente"}


@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user)
):
    """Obtener información del usuario actual"""
    return UserResponse.model_validate(current_user)


@router.post("/change-password")
def change_password(
    data: ChangePassword,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cambiar contraseña del usuario actual"""
    client_info = get_client_info(request)

    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta"
        )

    current_user.password_hash = get_password_hash(data.new_password)

    # Revocar todos los refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.user_id == current_user.id,
        RefreshToken.revoked == False
    ).update({"revoked": True})

    db.commit()

    create_audit_log(
        db, current_user.id, "CHANGE_PASSWORD", "USER", current_user.id,
        "Cambio de contraseña",
        ip_address=client_info["ip_address"],
        user_agent=client_info["user_agent"]
    )

    return {"message": "Contraseña actualizada correctamente"}


@router.post("/unlock-admin")
def unlock_admin_account(
    db: Session = Depends(get_db)
):
    """
    Endpoint temporal para desbloquear la cuenta admin y resetear contraseña.
    IMPORTANTE: Eliminar este endpoint en producción después de usarlo.
    """
    admin = db.query(User).filter(User.email == "admin@tienda.com").first()

    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario admin no encontrado"
        )

    # Desbloquear cuenta y resetear contraseña
    admin.failed_attempts = 0
    admin.locked_until = None
    admin.is_active = True
    admin.password_hash = get_password_hash("Admin123!")

    # Revocar todos los refresh tokens
    db.query(RefreshToken).filter(
        RefreshToken.user_id == admin.id
    ).update({"revoked": True})

    db.commit()

    return {
        "message": "Cuenta admin desbloqueada y contraseña reseteada",
        "email": admin.email,
        "username": admin.username,
        "new_password": "Admin123!"
    }
