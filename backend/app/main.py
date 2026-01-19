from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import os
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.api import api_router

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Crear aplicación
app = FastAPI(
    title="Sistema POS - Tienda Minorista",
    description="API para gestión de punto de venta, inventario y reportes",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# Configurar CORS
origins = settings.CORS_ORIGINS.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Manejo de errores de validación
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append({
            "field": field,
            "message": error["msg"],
            "type": error["type"]
        })
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Error de validación",
            "errors": errors
        }
    )


# Manejo de errores generales
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Error no manejado: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Error interno del servidor"}
    )


# Incluir rutas de la API
app.include_router(api_router, prefix="/api")


# Montar directorio de uploads
from pathlib import Path
uploads_dir = Path(__file__).parent.parent / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")


# Health check
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "tienda-backend",
        "version": "1.0.0"
    }


# Función para ejecutar migraciones pendientes
def run_pending_migrations():
    """Ejecuta migraciones de esquema pendientes"""
    from sqlalchemy import text

    with engine.connect() as conn:
        # Verificar y agregar columnas de impuestos si no existen
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'store_config'
            AND column_name IN ('tax_enabled', 'tax_rate', 'tax_name')
        """))
        existing_columns = [row[0] for row in result]

        if 'tax_enabled' not in existing_columns:
            logger.info("Migrando: agregando columna tax_enabled...")
            conn.execute(text("ALTER TABLE store_config ADD COLUMN tax_enabled BOOLEAN NOT NULL DEFAULT TRUE"))

        if 'tax_rate' not in existing_columns:
            logger.info("Migrando: agregando columna tax_rate...")
            conn.execute(text("ALTER TABLE store_config ADD COLUMN tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0.19"))

        if 'tax_name' not in existing_columns:
            logger.info("Migrando: agregando columna tax_name...")
            conn.execute(text("ALTER TABLE store_config ADD COLUMN tax_name VARCHAR(50) NOT NULL DEFAULT 'IVA'"))

        conn.commit()


# Evento de inicio
@app.on_event("startup")
async def startup_event():
    logger.info("Iniciando aplicación...")
    logger.info(f"CORS origins: {origins}")

    # Crear tablas si no existen (solo para desarrollo)
    # En producción usar Alembic
    if settings.AUTO_CREATE_TABLES:
        logger.info("Creando tablas de base de datos...")
        Base.metadata.create_all(bind=engine)
        logger.info("Tablas creadas exitosamente")

        # Ejecutar migraciones pendientes
        try:
            run_pending_migrations()
            logger.info("Migraciones ejecutadas exitosamente")
        except Exception as e:
            logger.warning(f"Error en migraciones (puede ser normal si ya están aplicadas): {e}")


# Evento de cierre
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Cerrando aplicación...")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG
    )
