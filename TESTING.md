# Casos de Prueba y Criterios de Aceptación

## Casos de Prueba

### 1. Autenticación

#### TC-001: Login exitoso
- **Precondición**: Usuario existe y está activo
- **Pasos**:
  1. Enviar POST /api/auth/login con credenciales válidas
  2. Verificar respuesta 200 con accessToken y refreshToken
  3. Verificar que el usuario puede acceder a endpoints protegidos

#### TC-002: Login fallido - credenciales inválidas
- **Pasos**:
  1. Enviar POST /api/auth/login con contraseña incorrecta
  2. Verificar respuesta 401
  3. Verificar que se incrementa failedAttempts

#### TC-003: Bloqueo por intentos fallidos
- **Pasos**:
  1. Enviar 5 intentos de login fallidos
  2. Verificar que el siguiente intento retorna 423 (bloqueado)
  3. Esperar el tiempo de lockout configurado
  4. Verificar que se puede hacer login exitoso

### 2. Productos

#### TC-010: Crear producto
- **Precondición**: Usuario ADMIN autenticado
- **Pasos**:
  1. POST /api/products con datos válidos
  2. Verificar respuesta 201 con producto creado
  3. Verificar que el producto aparece en GET /api/products

#### TC-011: Búsqueda rápida de productos
- **Pasos**:
  1. GET /api/products/search?q=camiseta
  2. Verificar que retorna productos que coinciden por nombre, SKU o barcode
  3. Verificar tiempo de respuesta < 500ms

#### TC-012: Validación de SKU único
- **Pasos**:
  1. Crear producto con SKU existente
  2. Verificar respuesta 409 (conflicto)

### 3. Inventario

#### TC-020: Entrada de inventario
- **Precondición**: Producto existe
- **Pasos**:
  1. POST /api/inventory/{productId}/entry con cantidad=10
  2. Verificar que currentStock se incrementa en 10
  3. Verificar que se crea movimiento tipo ENTRY

#### TC-021: Ajuste de inventario
- **Pasos**:
  1. POST /api/inventory/{productId}/adjust con newStock=5 y reason="Inventario físico"
  2. Verificar que currentStock se ajusta a 5
  3. Verificar que se crea movimiento tipo ADJUSTMENT con reason

#### TC-022: Validación de motivo obligatorio en ajustes
- **Pasos**:
  1. POST /api/inventory/{productId}/adjust sin reason
  2. Verificar respuesta 400

### 4. Ventas (POS)

#### TC-030: Crear venta exitosa
- **Precondición**: Productos con stock disponible
- **Pasos**:
  1. POST /api/sales con items y paymentMethod
  2. Verificar respuesta 201 con receiptNumber
  3. Verificar que stock de productos se descuenta
  4. Verificar que se crean movimientos tipo SALE

#### TC-031: Venta con stock insuficiente
- **Pasos**:
  1. Intentar vender más unidades de las disponibles
  2. Verificar respuesta 400 con mensaje de stock insuficiente
  3. Verificar que no se crea la venta

#### TC-032: Cálculo correcto de totales
- **Pasos**:
  1. Crear venta con descuento por ítem y descuento global
  2. Verificar que subtotal, impuestos y total son correctos
  3. Verificar que cambio se calcula correctamente para efectivo

#### TC-033: Anulación de venta
- **Precondición**: Venta COMPLETED existe
- **Pasos**:
  1. POST /api/sales/{id}/void con reason
  2. Verificar status cambia a VOIDED
  3. Verificar que stock se restaura
  4. Verificar que se crea movimiento tipo VOID

#### TC-034: Devolución parcial
- **Pasos**:
  1. POST /api/sales/{id}/return con items parciales
  2. Verificar que se crea registro de devolución
  3. Verificar que returnedQty se actualiza en items
  4. Verificar que stock se restaura parcialmente

### 5. Reportes

#### TC-040: Reporte diario de ventas
- **Pasos**:
  1. GET /api/reports/sales/daily
  2. Verificar que totalSales, totalRevenue y avgTicket son correctos
  3. Verificar que topProducts y topSellers tienen datos

#### TC-041: Exportación CSV
- **Pasos**:
  1. GET /api/reports/sales/export/csv
  2. Verificar que se descarga archivo CSV válido
  3. Verificar que contiene datos correctos

### 6. Auditoría

#### TC-050: Registro de acciones
- **Pasos**:
  1. Realizar varias operaciones (login, crear producto, venta)
  2. GET /api/audit
  3. Verificar que todas las acciones están registradas
  4. Verificar que contienen userId, action, entity, timestamp

### 7. Configuración

#### TC-060: Actualizar configuración de tienda
- **Pasos**:
  1. PUT /api/config con storeName y colores
  2. Verificar que cambios se guardan
  3. GET /api/config/public verifica que tema se actualiza

#### TC-061: Subir logo
- **Pasos**:
  1. POST /api/config/logo con archivo de imagen
  2. Verificar que logoUrl se actualiza
  3. Verificar que archivo existe en /uploads

---

## Criterios de Aceptación (Checklist MVP)

### Autenticación
- [ ] Login con email y contraseña funciona
- [ ] Los tokens JWT se generan y validan correctamente
- [ ] El refresh token permite renovar el access token
- [ ] El bloqueo por intentos fallidos funciona según configuración
- [ ] El logout invalida los tokens

### Usuarios
- [ ] ADMIN puede crear usuarios
- [ ] ADMIN puede editar usuarios
- [ ] ADMIN puede desactivar/activar usuarios
- [ ] ADMIN puede resetear contraseñas
- [ ] SELLER no puede acceder a funciones de admin

### Productos
- [ ] Se pueden crear productos con todos los campos requeridos
- [ ] La búsqueda rápida encuentra por nombre, SKU y código de barras
- [ ] Los productos se pueden editar
- [ ] Los productos se pueden desactivar (soft delete)
- [ ] Las categorías se asignan correctamente

### Categorías
- [ ] Se pueden crear, editar y eliminar categorías
- [ ] Los productos se asocian correctamente a categorías

### Inventario
- [ ] Las entradas de inventario aumentan el stock
- [ ] Los ajustes de inventario registran el motivo
- [ ] Se generan movimientos para cada operación
- [ ] Las alertas de bajo stock funcionan
- [ ] El kardex muestra el historial correctamente

### POS (Ventas)
- [ ] La búsqueda de productos es rápida (< 500ms)
- [ ] Se pueden agregar productos al carrito
- [ ] Se pueden modificar cantidades y descuentos
- [ ] El cálculo de totales es correcto
- [ ] Se soportan todos los métodos de pago
- [ ] El cambio se calcula correctamente para efectivo
- [ ] Se descuenta el stock al confirmar
- [ ] Se genera número de recibo consecutivo
- [ ] No se permite vender sin stock (a menos que esté configurado)

### Recibos
- [ ] El recibo PDF se genera correctamente
- [ ] El recibo HTML se puede imprimir
- [ ] El recibo muestra todos los datos requeridos
- [ ] Se puede reimprimir desde el historial

### Anulaciones y Devoluciones
- [ ] Las anulaciones restauran el stock
- [ ] Las anulaciones requieren motivo
- [ ] Las devoluciones parciales funcionan
- [ ] Se actualiza el estado de la venta

### Reportes
- [ ] Reporte diario muestra datos correctos
- [ ] Reporte semanal muestra datos correctos
- [ ] Reporte mensual muestra datos correctos
- [ ] Los filtros funcionan (fecha, vendedor, categoría)
- [ ] La exportación CSV funciona

### Auditoría
- [ ] Todas las operaciones críticas se registran
- [ ] Se registra usuario, acción, entidad, timestamp
- [ ] Se registran valores antes/después para cambios
- [ ] Los logs se pueden filtrar

### Configuración
- [ ] Se puede cambiar el nombre de la tienda
- [ ] Se puede subir un logo
- [ ] Los colores del tema se aplican
- [ ] El modo oscuro funciona
- [ ] Los cambios se aplican sin redeploy

### No Funcionales
- [ ] La app funciona en desktop y tablet
- [ ] Los tiempos de respuesta son < 2s
- [ ] Los errores se muestran de forma amigable
- [ ] La app funciona con múltiples usuarios concurrentes

---

## Datos de Prueba

Los datos de prueba se cargan automáticamente con `npm run db:seed`:

### Usuarios
| Email | Contraseña | Rol |
|-------|------------|-----|
| admin@tienda.com | Admin123! | ADMIN |
| vendedor@tienda.com | Vendedor123! | SELLER |

### Categorías
- Camisetas
- Pantalones
- Gorras
- Gafas
- Accesorios

### Productos (12 productos de ejemplo)
- Camisetas básicas en varios colores
- Polos premium
- Jeans y pantalones casuales
- Gorras baseball y trucker
- Gafas de sol
- Cinturones y billeteras

Todos los productos tienen stock inicial, precios y configuración de impuestos.
