from fastapi import APIRouter

from app.api.routes import auth, users, categories, products, inventory, sales, reports, config, audit

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Autenticación"])
api_router.include_router(users.router, prefix="/users", tags=["Usuarios"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categorías"])
api_router.include_router(products.router, prefix="/products", tags=["Productos"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["Inventario"])
api_router.include_router(sales.router, prefix="/sales", tags=["Ventas"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reportes"])
api_router.include_router(config.router, prefix="/config", tags=["Configuración"])
api_router.include_router(audit.router, prefix="/audit", tags=["Auditoría"])
