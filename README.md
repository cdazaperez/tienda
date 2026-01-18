# Sistema POS - Tienda Minorista

Sistema completo de punto de venta (POS) para tiendas de ropa y accesorios. Incluye gestión de inventario, ventas, reportes, auditoría y personalización de marca.

## Stack Tecnológico

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + React Query
- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Base de Datos**: PostgreSQL 16
- **Autenticación**: JWT con refresh tokens
- **PDF**: PDFKit para generación de recibos
- **Docker**: Docker Compose para desarrollo y producción

## Características Principales

### Autenticación y Usuarios
- Login con email/usuario + contraseña
- Roles: ADMIN (acceso completo) y SELLER (ventas y consultas)
- Bloqueo por intentos fallidos configurable
- Gestión de usuarios (crear, editar, desactivar, reset contraseña)

### Catálogo de Productos
- CRUD completo de productos con SKU, código de barras, categorías
- Atributos: marca, talla, color, precio de venta, costo, impuesto
- Imágenes de productos (opcional)
- Stock mínimo con alertas

### Inventario (Kardex)
- Control de existencias con trazabilidad completa
- Tipos de movimiento: Entrada, Venta, Ajuste, Devolución, Anulación
- Alertas de stock bajo
- Reportes de inventario exportables

### Punto de Venta (POS)
- Interfaz rápida y optimizada para ventas
- Búsqueda por nombre, SKU o código de barras
- Descuentos por ítem y/o globales
- Múltiples métodos de pago: Efectivo, Tarjeta, Transferencia
- Cálculo automático de cambio
- Impresión de recibo inmediata

### Recibos
- Generación PDF y HTML imprimible
- Personalizable con logo, datos de tienda
- Historial y reimpresión disponible

### Reportes
- Ventas por día, semana, mes
- Top productos, categorías, vendedores
- Filtros avanzados
- Exportación a CSV

### Auditoría
- Registro completo de todas las operaciones
- Quién, qué, cuándo, desde dónde
- Valores antes/después para cambios

### Personalización
- Logo de tienda
- Colores primario, secundario, acento
- Modo claro/oscuro
- Texto personalizado en recibos

## Instalación

### Requisitos Previos
- Node.js 20+
- PostgreSQL 16+ (o Docker)
- npm o yarn

### Desarrollo Local

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd tienda
```

2. **Iniciar base de datos con Docker**
```bash
docker-compose up -d postgres
```

3. **Configurar Backend**
```bash
cd backend

# Copiar archivo de entorno
cp .env.example .env

# Instalar dependencias
npm install

# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Cargar datos de ejemplo
npm run db:seed

# Iniciar en modo desarrollo
npm run dev
```

4. **Configurar Frontend**
```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar en modo desarrollo
npm run dev
```

5. **Acceder a la aplicación**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api

### Credenciales de Demostración

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@tienda.com | Admin123! |
| Vendedor | vendedor@tienda.com | Vendedor123! |

### Producción con Docker (Opción 1: Imagen Única)

La forma más sencilla de ejecutar toda la aplicación:

```bash
# Construir y ejecutar con imagen única (recomendado)
docker-compose -f docker-compose.simple.yml up -d --build

# Ver logs
docker-compose -f docker-compose.simple.yml logs -f

# Detener
docker-compose -f docker-compose.simple.yml down
```

Esto crea:
- **Un contenedor** con Backend + Frontend + Nginx
- **PostgreSQL** como base de datos
- Acceso en **http://localhost**

### Producción con Docker (Opción 2: Servicios Separados)

Para mayor control y escalabilidad:

```bash
# Construir y ejecutar servicios separados
docker-compose up -d --build

# Ver logs
docker-compose logs -f

# Detener
docker-compose down
```

### Construir Imagen Docker Manualmente

```bash
# Desde la raíz del proyecto
docker build -t tienda-pos:latest .

# Ejecutar con base de datos externa
docker run -d \
  --name tienda-app \
  -p 80:80 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/tienda_db" \
  -e JWT_SECRET="tu-secreto-seguro" \
  -v tienda-uploads:/app/backend/uploads \
  tienda-pos:latest
```

## Estructura del Proyecto

```
tienda/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma      # Modelo de datos
│   │   └── seed.ts            # Datos de ejemplo
│   ├── src/
│   │   ├── config/            # Configuración
│   │   ├── controllers/       # Controladores HTTP
│   │   ├── middleware/        # Middlewares
│   │   ├── routes/            # Rutas API
│   │   ├── services/          # Lógica de negocio
│   │   ├── types/             # Tipos TypeScript
│   │   └── index.ts           # Punto de entrada
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/        # Componentes React
│   │   ├── pages/             # Páginas
│   │   ├── services/          # API client
│   │   ├── store/             # Estado global (Zustand)
│   │   ├── types/             # Tipos TypeScript
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `POST /api/auth/refresh` - Refrescar token
- `POST /api/auth/change-password` - Cambiar contraseña
- `GET /api/auth/me` - Usuario actual

### Categorías
- `GET /api/categories` - Listar categorías
- `POST /api/categories` - Crear categoría (Admin)
- `PUT /api/categories/:id` - Actualizar (Admin)
- `DELETE /api/categories/:id` - Eliminar (Admin)

### Productos
- `GET /api/products` - Listar productos
- `GET /api/products/search?q=` - Búsqueda rápida
- `GET /api/products/barcode/:barcode` - Por código de barras
- `GET /api/products/low-stock` - Bajo stock
- `POST /api/products` - Crear (Admin)
- `PUT /api/products/:id` - Actualizar (Admin)
- `DELETE /api/products/:id` - Desactivar (Admin)

### Inventario
- `GET /api/inventory/:productId/movements` - Movimientos
- `POST /api/inventory/:productId/entry` - Entrada (Admin)
- `POST /api/inventory/:productId/adjust` - Ajuste (Admin)
- `GET /api/inventory/low-stock` - Productos bajo stock
- `GET /api/inventory/report` - Reporte

### Ventas
- `GET /api/sales` - Listar ventas
- `POST /api/sales` - Crear venta
- `GET /api/sales/:id` - Detalle de venta
- `POST /api/sales/:id/void` - Anular (Admin)
- `POST /api/sales/:id/return` - Devolución (Admin)
- `GET /api/sales/:id/receipt/pdf` - Recibo PDF
- `GET /api/sales/:id/receipt/html` - Recibo HTML

### Reportes (Admin)
- `GET /api/reports/sales` - Reporte de ventas
- `GET /api/reports/sales/daily` - Reporte diario
- `GET /api/reports/sales/weekly` - Reporte semanal
- `GET /api/reports/sales/monthly` - Reporte mensual
- `GET /api/reports/sales/export/csv` - Exportar CSV

### Usuarios (Admin)
- `GET /api/users` - Listar usuarios
- `POST /api/users` - Crear usuario
- `PUT /api/users/:id` - Actualizar
- `POST /api/users/:id/reset-password` - Reset contraseña
- `POST /api/users/:id/toggle-active` - Activar/Desactivar

### Configuración
- `GET /api/config/public` - Configuración pública
- `GET /api/config` - Configuración completa (Admin)
- `PUT /api/config` - Actualizar (Admin)
- `POST /api/config/logo` - Subir logo (Admin)

### Auditoría (Admin)
- `GET /api/audit` - Listar logs
- `GET /api/audit/:entity/:entityId` - Logs por entidad

## Modelo de Datos

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Users     │     │  Categories │     │  Products   │
├─────────────┤     ├─────────────┤     ├─────────────┤
│ id          │     │ id          │     │ id          │
│ email       │     │ name        │     │ sku         │
│ username    │     │ description │     │ barcode     │
│ passwordHash│     │ isActive    │     │ name        │
│ firstName   │     └─────────────┘     │ categoryId  │◄─┐
│ lastName    │            │            │ salePrice   │  │
│ role        │            │            │ costPrice   │  │
│ isActive    │            └────────────│ taxRate     │  │
│ ...         │                         │ currentStock│  │
└─────────────┘                         │ minStock    │  │
       │                                │ ...         │  │
       │                                └─────────────┘  │
       │                                       │         │
       ▼                                       ▼         │
┌─────────────┐                         ┌─────────────┐  │
│   Sales     │                         │ Inventory   │  │
├─────────────┤                         │ Movements   │  │
│ id          │                         ├─────────────┤  │
│ receiptNum  │                         │ id          │  │
│ userId      │◄────────────────────────│ productId   │──┘
│ status      │                         │ userId      │
│ subtotal    │                         │ type        │
│ total       │                         │ quantity    │
│ paymentMeth │                         │ reason      │
│ ...         │                         │ ...         │
└─────────────┘                         └─────────────┘
       │
       ▼
┌─────────────┐
│ Sale Items  │
├─────────────┤
│ id          │
│ saleId      │
│ productId   │
│ productName │ (snapshot)
│ unitPrice   │ (snapshot)
│ quantity    │
│ ...         │
└─────────────┘
```

## Seguridad

- Contraseñas hasheadas con bcrypt (12 rounds)
- JWT con expiración corta (15 min) + refresh tokens (7 días)
- Rate limiting en endpoints de autenticación
- Validación de entrada con express-validator
- Protección CORS configurada
- Helmet para headers de seguridad
- Borrado lógico para datos críticos
- Auditoría completa de operaciones

## Licencia

MIT

## Soporte

Para reportar bugs o solicitar funcionalidades, crear un issue en el repositorio.
