from typing import List, Optional
from uuid import UUID
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_
import math

from app.core.database import get_db
from app.models.user import User
from app.models.audit import AuditLog
from app.schemas.audit import AuditLogResponse, AuditLogListResponse
from app.api.deps import get_current_admin_user

router = APIRouter()


def get_audit_response(log: AuditLog, db: Session) -> AuditLogResponse:
    user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None

    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        action=log.action,
        entity=log.entity,
        entity_id=log.entity_id,
        description=log.description,
        old_values=log.old_values,
        new_values=log.new_values,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        created_at=log.created_at,
        user_name=f"{user.first_name} {user.last_name}" if user else None
    )


@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    action: Optional[str] = None,
    entity: Optional[str] = None,
    user_id: Optional[UUID] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Listar logs de auditoría (Admin)"""
    query = db.query(AuditLog)

    if action:
        query = query.filter(AuditLog.action == action)

    if entity:
        query = query.filter(AuditLog.entity == entity)

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    if start_date:
        start_dt = datetime.combine(start_date, datetime.min.time())
        query = query.filter(AuditLog.created_at >= start_dt)

    if end_date:
        end_dt = datetime.combine(end_date, datetime.max.time())
        query = query.filter(AuditLog.created_at <= end_dt)

    total = query.count()
    total_pages = math.ceil(total / page_size)

    logs = query.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return AuditLogListResponse(
        items=[get_audit_response(log, db) for log in logs],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/actions")
def get_available_actions(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener lista de acciones disponibles"""
    actions = db.query(AuditLog.action).distinct().all()
    return {"actions": sorted([a[0] for a in actions])}


@router.get("/entities")
def get_available_entities(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener lista de entidades disponibles"""
    entities = db.query(AuditLog.entity).distinct().all()
    return {"entities": sorted([e[0] for e in entities])}


@router.get("/{entity}/{entity_id}", response_model=List[AuditLogResponse])
def get_entity_audit_logs(
    entity: str,
    entity_id: UUID,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener logs de auditoría de una entidad específica"""
    logs = db.query(AuditLog).filter(
        AuditLog.entity == entity.upper(),
        AuditLog.entity_id == entity_id
    ).order_by(AuditLog.created_at.desc()).all()

    return [get_audit_response(log, db) for log in logs]


@router.get("/user/{user_id}", response_model=List[AuditLogResponse])
def get_user_audit_logs(
    user_id: UUID,
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener logs de auditoría de un usuario específico"""
    logs = db.query(AuditLog).filter(
        AuditLog.user_id == user_id
    ).order_by(AuditLog.created_at.desc()).limit(limit).all()

    return [get_audit_response(log, db) for log in logs]


@router.get("/recent", response_model=List[AuditLogResponse])
def get_recent_activity(
    hours: int = Query(24, ge=1, le=168),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """Obtener actividad reciente"""
    since = datetime.utcnow() - timedelta(hours=hours)

    logs = db.query(AuditLog).filter(
        AuditLog.created_at >= since
    ).order_by(AuditLog.created_at.desc()).limit(100).all()

    return [get_audit_response(log, db) for log in logs]
