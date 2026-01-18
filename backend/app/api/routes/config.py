import os
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.user import User
from app.models.config import StoreConfig
from app.models.audit import AuditLog
from app.schemas.config import StoreConfigUpdate, StoreConfigResponse, StoreConfigPublic
from app.api.deps import get_current_user, get_current_admin_user, get_client_info

router = APIRouter()

# Use absolute path for uploads directory (same as main.py)
UPLOAD_DIR = Path(__file__).parent.parent.parent.parent / "uploads"
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB


def create_audit_log(db: Session, user_id, action: str, entity: str, entity_id,
                     description: str, old_values=None, new_values=None, ip_address=None, user_agent=None):
    log = AuditLog(
        user_id=user_id, action=action, entity=entity, entity_id=entity_id,
        description=description, old_values=old_values, new_values=new_values,
        ip_address=ip_address, user_agent=user_agent
    )
    db.add(log)


def get_or_create_config(db: Session) -> StoreConfig:
    config = db.query(StoreConfig).first()
    if not config:
        config = StoreConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.get("/public", response_model=StoreConfigPublic)
def get_public_config(db: Session = Depends(get_db)):
    """Obtener configuración pública (sin autenticación)"""
    config = get_or_create_config(db)
    return StoreConfigPublic.model_validate(config)


@router.get("", response_model=StoreConfigResponse)
def get_config(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener configuración completa (Admin)"""
    config = get_or_create_config(db)
    return StoreConfigResponse.model_validate(config)


@router.put("", response_model=StoreConfigResponse)
def update_config(
    data: StoreConfigUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Actualizar configuración (Admin)"""
    client_info = get_client_info(request)

    config = get_or_create_config(db)

    old_values = {
        "store_name": config.store_name,
        "primary_color": config.primary_color,
        "secondary_color": config.secondary_color,
        "accent_color": config.accent_color
    }

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(config, field, value)

    db.commit()
    db.refresh(config)

    new_values = {
        "store_name": config.store_name,
        "primary_color": config.primary_color,
        "secondary_color": config.secondary_color,
        "accent_color": config.accent_color
    }

    create_audit_log(
        db, current_user.id, "UPDATE", "CONFIG", config.id,
        "Configuración actualizada",
        old_values=old_values, new_values=new_values,
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return StoreConfigResponse.model_validate(config)


@router.post("/logo")
async def upload_logo(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Subir logo de la tienda (Admin)"""
    client_info = get_client_info(request) if request else {}

    # Validar extensión
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Leer contenido
    content = await file.read()

    # Validar tamaño
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Archivo muy grande. Máximo: {MAX_FILE_SIZE // (1024 * 1024)}MB"
        )

    # Crear directorio si no existe
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # Generar nombre único
    filename = f"logo_{uuid.uuid4().hex}{ext}"
    filepath = UPLOAD_DIR / filename

    # Guardar archivo
    with open(filepath, "wb") as f:
        f.write(content)

    # Actualizar configuración
    config = get_or_create_config(db)
    old_logo = config.logo_url

    # Eliminar logo anterior si existe
    if old_logo:
        old_filename = old_logo.split("/")[-1]
        old_path = UPLOAD_DIR / old_filename
        if old_path.exists():
            try:
                old_path.unlink()
            except:
                pass

    config.logo_url = f"/uploads/{filename}"
    db.commit()

    create_audit_log(
        db, current_user.id, "UPDATE", "CONFIG", config.id,
        "Logo actualizado",
        old_values={"logo_url": old_logo},
        new_values={"logo_url": config.logo_url},
        ip_address=client_info.get("ip_address"), user_agent=client_info.get("user_agent")
    )
    db.commit()

    return {"message": "Logo actualizado", "logo_url": config.logo_url}


@router.delete("/logo")
def delete_logo(
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Eliminar logo de la tienda (Admin)"""
    client_info = get_client_info(request)

    config = get_or_create_config(db)

    if not config.logo_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay logo configurado"
        )

    old_logo = config.logo_url

    # Eliminar archivo
    old_filename = old_logo.split("/")[-1]
    filepath = UPLOAD_DIR / old_filename
    if filepath.exists():
        try:
            filepath.unlink()
        except:
            pass

    config.logo_url = None
    db.commit()

    create_audit_log(
        db, current_user.id, "DELETE", "CONFIG", config.id,
        "Logo eliminado",
        old_values={"logo_url": old_logo},
        ip_address=client_info["ip_address"], user_agent=client_info["user_agent"]
    )
    db.commit()

    return {"message": "Logo eliminado"}
