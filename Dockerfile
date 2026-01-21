# =============================================================================
# Dockerfile - Sistema POS Tienda Minorista
# Construcción multi-stage para backend Python y frontend React
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend (usando Node.js para compatibilidad con CPUs sin AVX)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar archivos de dependencias
COPY frontend/package*.json ./

# Instalar dependencias con npm
RUN npm ci || npm install

# Copiar código fuente del frontend
COPY frontend/ ./

# Construir aplicación de producción
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Runtime
# -----------------------------------------------------------------------------
FROM python:3.11-slim AS production

# Instalar nginx, supervisor y curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    supervisor \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Crear usuario no-root para seguridad
RUN groupadd --system --gid 1001 appgroup && \
    useradd --system --uid 1001 --gid appgroup appuser

# -----------------------------------------------------------------------------
# Instalar dependencias de Python
# -----------------------------------------------------------------------------
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# -----------------------------------------------------------------------------
# Copiar código del Backend
# -----------------------------------------------------------------------------
COPY backend/ ./backend/

# -----------------------------------------------------------------------------
# Copiar Frontend compilado
# -----------------------------------------------------------------------------
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# -----------------------------------------------------------------------------
# Configuración de Nginx y Supervisor
# -----------------------------------------------------------------------------
RUN mkdir -p /run/nginx /var/log/nginx /var/log/supervisor

COPY docker/nginx.conf /etc/nginx/sites-available/default
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/entrypoint.sh /app/entrypoint.sh

RUN chmod +x /app/entrypoint.sh

# Crear directorios y asignar permisos
RUN mkdir -p /app/backend/uploads /app/backend/logs && \
    chown -R appuser:appgroup /app/backend/uploads /app/backend/logs

# Puerto expuesto (nginx)
EXPOSE 80

# Variables de entorno por defecto
ENV PYTHONPATH=/app/backend \
    PYTHONUNBUFFERED=1 \
    PORT=3001 \
    CORS_ORIGINS=http://localhost \
    AUTO_CREATE_TABLES=true

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost/api/health || exit 1

# Punto de entrada
ENTRYPOINT ["/app/entrypoint.sh"]
