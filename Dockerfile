# =============================================================================
# Dockerfile - Sistema POS Tienda Minorista
# Construcción multi-stage para backend y frontend
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

# Copiar archivos de dependencias
COPY frontend/package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente del frontend
COPY frontend/ ./

# Construir aplicación de producción
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Build Backend
# -----------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend

# Copiar archivos de dependencias
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Instalar dependencias
RUN npm ci

# Generar cliente Prisma
RUN npx prisma generate

# Copiar código fuente del backend
COPY backend/ ./

# Compilar TypeScript
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Instalar nginx y supervisor para manejar múltiples procesos
RUN apk add --no-cache nginx supervisor

WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

# -----------------------------------------------------------------------------
# Copiar Backend compilado
# -----------------------------------------------------------------------------
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/package.json ./backend/

# -----------------------------------------------------------------------------
# Copiar Frontend compilado
# -----------------------------------------------------------------------------
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# -----------------------------------------------------------------------------
# Configuración de Nginx para servir frontend y proxy al backend
# -----------------------------------------------------------------------------
RUN mkdir -p /run/nginx /var/log/nginx

COPY <<'NGINX_CONF' /etc/nginx/http.d/default.conf
server {
    listen 80;
    server_name localhost;
    root /app/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;

    # Proxy API requests to backend
    location /api {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Proxy uploads
    location /uploads {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SPA fallback - serve index.html for all non-file routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
NGINX_CONF

# -----------------------------------------------------------------------------
# Configuración de Supervisor para manejar nginx y node
# -----------------------------------------------------------------------------
COPY <<'SUPERVISOR_CONF' /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
user=root
logfile=/var/log/supervisor/supervisord.log
pidfile=/var/run/supervisord.pid

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=sh -c "cd /app/backend && npx prisma migrate deploy && node dist/index.js"
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
environment=NODE_ENV="production",PORT="3001"
SUPERVISOR_CONF

# -----------------------------------------------------------------------------
# Script de inicio
# -----------------------------------------------------------------------------
COPY <<'ENTRYPOINT_SCRIPT' /app/entrypoint.sh
#!/bin/sh
set -e

echo "=========================================="
echo "  Sistema POS - Tienda Minorista"
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
until cd /app/backend && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$connect().then(() => {
    console.log('✓ Conexión a base de datos exitosa');
    process.exit(0);
}).catch(() => process.exit(1));
" 2>/dev/null; do
    counter=$((counter + 1))
    if [ $counter -ge $max_retries ]; then
        echo "ERROR: No se pudo conectar a la base de datos después de $max_retries intentos"
        exit 1
    fi
    echo "  Intento $counter/$max_retries - Reintentando en 2 segundos..."
    sleep 2
done

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
ENTRYPOINT_SCRIPT

RUN chmod +x /app/entrypoint.sh

# Crear directorios y asignar permisos
RUN mkdir -p /app/backend/uploads /app/backend/logs /var/log/supervisor && \
    chown -R appuser:appgroup /app/backend/uploads /app/backend/logs

# Puerto expuesto (nginx)
EXPOSE 80

# Variables de entorno por defecto
ENV NODE_ENV=production \
    PORT=3001 \
    CORS_ORIGIN=http://localhost

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/api/health || exit 1

# Punto de entrada
ENTRYPOINT ["/app/entrypoint.sh"]
