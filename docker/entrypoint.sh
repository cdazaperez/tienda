#!/bin/bash
set -e

echo "=========================================="
echo "  Sistema POS - Tienda Minorista"
echo "  Backend: Python/FastAPI"
echo "=========================================="
echo ""

# Crear directorios necesarios
mkdir -p /app/backend/uploads /app/backend/logs /var/log/supervisor

# Verificar variables de entorno requeridas
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL no está configurada"
    echo "Ejemplo: DATABASE_URL=postgresql://user:pass@host:5432/dbname"
    exit 1
fi

echo "✓ DATABASE_URL configurada"

# Configurar JWT_SECRET si no está definido
if [ -z "$JWT_SECRET" ]; then
    export JWT_SECRET="default-secret-change-in-production-$(date +%s)"
    echo "⚠ JWT_SECRET no configurado, usando valor por defecto (cambiar en producción)"
else
    echo "✓ JWT_SECRET configurada"
fi

# Esperar a que la base de datos esté disponible
echo ""
echo "Esperando conexión a base de datos..."
max_retries=30
counter=0

until python -c "
from sqlalchemy import create_engine
import os
engine = create_engine(os.environ['DATABASE_URL'])
conn = engine.connect()
conn.close()
print('✓ Conexión a base de datos exitosa')
" 2>/dev/null; do
    counter=$((counter + 1))
    if [ $counter -ge $max_retries ]; then
        echo "ERROR: No se pudo conectar a la base de datos después de $max_retries intentos"
        exit 1
    fi
    echo "  Intento $counter/$max_retries - Reintentando en 2 segundos..."
    sleep 2
done

# Ejecutar migraciones/seed si es necesario
echo ""
echo "Verificando base de datos..."
cd /app/backend

# Crear tablas y cargar datos de ejemplo si la BD está vacía
python -c "
from app.core.database import engine, Base
from app.models import *
Base.metadata.create_all(bind=engine)
print('✓ Tablas verificadas/creadas')
"

# Intentar cargar seed si no hay usuarios
python -c "
from app.core.database import SessionLocal
from app.models.user import User
db = SessionLocal()
if not db.query(User).first():
    print('Cargando datos de ejemplo...')
    db.close()
    from app.seed import seed_database
    seed_database()
else:
    print('✓ Base de datos ya tiene datos')
    db.close()
"

echo ""
echo "Iniciando servicios..."
echo "  - Backend API en puerto 3001"
echo "  - Frontend en puerto 80"
echo ""
echo "=========================================="
echo "  Aplicación lista en http://localhost"
echo "=========================================="
echo ""

# Iniciar supervisor (maneja nginx y backend)
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
