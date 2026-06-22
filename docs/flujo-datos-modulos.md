# Flujo de Datos entre Módulos — OficinaApp

## Diagrama General

```
PEDIDOS ──────────────────────────> DESPACHOS
PEDIDOS ──────────────────────────> VENTAS ───> CONTABILIDAD (FACTURA_CLIENTE)
VENTAS ───> EXPORTADORES (si contabilidad externa)

COMPRAS:
  REQUISICION ───> COTIZACION ───> ORDEN_COMPRA ───> RECEPCION ───> INVENTARIOS
                                                  └──> CUENTA_PAGAR ───> PAGO ───> EGRESO
                                                                        └──> TESORERIA

  RECEPCION ───> CONTABILIDAD (RECEPCION_OC)
  CUENTA_PAGAR ───> CONTABILIDAD (FACTURA_PROVEEDOR)
  PAGO ───> CONTABILIDAD (PAGO_PROVEEDOR)

TRASPASOS (completado) ───> INVENTARIOS (SALIDA origen + ENTRADA destino)

CONTABILIDAD ───> EXPORTADORES (XML / CSV / JSON / PLANO)

TODOS LOS MÓDULOS ───> NOTIFICACIONES
TODOS LOS MÓDULOS ───> HISTORIAL_ESTADOS (auditoría)
```

---

## 1. Pedidos → Despachos

**Trigger**: Usuario crea un despacho vinculado opcionalmente a un pedido.

**Server Action**: `despachos.ts` → `createDespacho()`

| Dato Origen (Pedido) | Dato Destino (Despacho) | Tipo |
|---|---|---|
| `pedido.id` | `despacho.pedidoId` | FK opcional |
| `pedido.items[].descripcion` | `despacho.items[].descripcion` | Prellenado en UI |
| `pedido.items[].cantidad` | `despacho.items[].cantidad` | Prellenado en UI |
| `pedido.items[].unidadMedida` | `despacho.items[].unidadMedida` | Prellenado en UI |

**Mecanismo**: La UI lee `?pedidoId=xxx` de la URL, carga el pedido con `getPedido(id)` y prellena el formulario. No hay cambio automático de estado en el pedido.

---

## 2. Pedidos → Ventas

**Trigger**: Usuario crea una venta vinculada opcionalmente a un pedido.

**Server Action**: `ventas.ts` → `createVenta()`

| Dato Origen (Pedido) | Dato Destino (Venta) | Tipo |
|---|---|---|
| `pedido.id` | `venta.pedidoId` | FK opcional |
| `pedido.clienteId` | `venta.clienteId` | Prellenado en UI |
| Items del pedido | Items de venta | Prellenados en UI, editables |

---

## 3. Ventas → Contabilidad

**Trigger**: `cambiarEstadoVenta(id, "CONFIRMADA")` en `ventas.ts`

```typescript
generarAsiento("FACTURA_CLIENTE", id)
```

### Variables extraídas (motor-contable.ts)

| Variable Contable | Fuente | Fórmula |
|---|---|---|
| `valorFactura` | `venta.total - venta.impuesto` | Base gravable |
| `iva` | `venta.impuesto` | IVA del 19% |
| `valorTotal` | `venta.total` | Total factura |
| `saldo` | `venta.total` | Saldo pendiente |
| `fecha` | `venta.fecha` | Fecha contable |
| `concepto` | `"Factura Cliente #" + venta.numero + " - " + cliente.nombre` | Descripción |
| `terceroId` | `venta.clienteId` | ID del cliente |

### Asiento típico generado

Busca la plantilla contable con `evento = "FACTURA_CLIENTE"` y `activo = true`, evalúa las fórmulas de cada línea y crea:

| Cuenta | Tipo | Debe | Haber |
|---|---|---|---|
| Clientes / CxC (código 1305) | DEBE | `VALOR_TOTAL` | — |
| Ingresos Ventas (código 4105) | HABER | — | `VALOR_FACTURA` |
| IVA por Pagar (código 2408) | HABER | — | `IVA` |

### Si contabilidad externa

Si `empresa.tipoContabilidad != "INTERNA"`, se envía a un exportador:

```
DatosAsiento ──> Exportador ──> XML / CSV / JSON / PLANO
```

---

## 4. Compras — Pipeline Completo

### 4a. Requisición → Cotización

**Server Action**: `compras.ts` → `createCotizacion()`

| Dato | Origen → Destino |
|---|---|
| `requisicion.id` | → `cotizacion.requisicionId` (FK requerido) |
| Items: descripción, unidadMedida, cantidadSolicitada | → Prellenados en UI |

**Efecto secundario**: `requisicion.estado` → `"EN_COTIZACION"`

---

### 4b. Cotización → Orden de Compra

**Server Action**: `compras.ts` → `generarOrdenCompra()`

| Dato | Origen → Destino |
|---|---|
| `cotizacion.id` | → `oc.cotizacionId` (FK opcional) |
| `cotizacion.proveedorId` | → `oc.proveedorId` |
| Items: descripción, cantidad, valorUnitario, valorTotal | → Copiados a items de OC |
| `cotizacion.valorTotal` | → `oc.subtotal` |
| — | → `oc.iva` = subtotal × 0.16 |
| — | → `oc.valorTotal` = subtotal - descuento + iva |

**Efectos secundarios**:
- `cotizacion.ganadora` → `true`
- `requisicion.estado` → `"ORDEN_COMPRA_GENERADA"`

---

### 4c. Orden de Compra → Recepción

**Server Action**: `compras.ts` → `createRecepcion()`

| Dato | Origen → Destino |
|---|---|
| `oc.id` | → `recepcion.ordenCompraId` (FK requerido) |
| Items: descripción | → Prellenados |
| Usuario ingresa | → `cantidadRecibida` por item |

**Cálculo de estado**:
- Todos los items recibidos completos → `"COMPLETA"`
- Algunos → `"PARCIAL"`
- Ninguno → `"PENDIENTE"`

**Efectos secundarios**:
1. **→ Inventarios**: Crea `MovimientoInventario` tipo `ENTRADA` + actualiza/crea `InventarioStock`
2. **→ Contabilidad**: `generarAsiento("RECEPCION_OC", recepcionId)`

**Variables contables para RECEPCION_OC**:

| Variable | Fuente |
|---|---|
| `valorFactura` | `oc.valorTotal - oc.iva` |
| `iva` | `oc.iva` |
| `valorTotal` | `oc.valorTotal` |
| `saldo` | `oc.valorTotal` |
| `fecha` | `recepcion.fechaRecepcion` |
| `concepto` | `"Recepción OC #" + oc.numero + " - " + proveedor.razonSocial` |
| `proveedorId` | `oc.proveedorId` |

---

### 4d. Orden de Compra → Cuenta por Pagar

**Server Action**: `compras.ts` → `crearCuentaPagar()`

| Dato | Origen → Destino |
|---|---|
| `oc.id` | → `cuentaPagar.ordenCompraId` (FK requerido) |
| `oc.valorTotal` | → `cuentaPagar.valor` |
| `oc.valorTotal` | → `cuentaPagar.saldoPendiente` (inicial) |
| Usuario ingresa | `numeroFactura`, `fechaFactura`, `fechaVencimiento` |

**Efectos secundarios**:
- `oc.estado` → `"FACTURADA"`
- `cuentaPagar.estado` → `"PENDIENTE"`
- **→ Contabilidad**: `generarAsiento("FACTURA_PROVEEDOR", cpId)`

**Variables contables para FACTURA_PROVEEDOR**:

| Variable | Fuente |
|---|---|
| `valorFactura` | `cp.valor - oc.iva` |
| `iva` | `oc.iva` |
| `valorTotal` | `cp.valor` |
| `saldo` | `cp.saldoPendiente` |
| `fecha` | `cp.fechaFactura` |
| `concepto` | `"Factura " + cp.numeroFactura + " - " + proveedor.razonSocial` |
| `proveedorId` | `oc.proveedorId` |

---

### 4e. Cuenta por Pagar → Pago → Egreso

**Server Action**: `compras.ts` → `pagarCuenta()`

| Dato | Origen → Destino |
|---|---|
| `cuentaPagar.id` | → `pago.cuentaPagarId` (FK requerido) |
| `cuentaPagar.saldoPendiente` | → `pago.valor` |
| Usuario selecciona | → `pago.cuentaBancariaId` |
| — | → `pago.metodo` = `"TRANSFERENCIA"` |
| — | → `pago.fechaPago` = `new Date()` |
| — | → `pago.estado` = `"PAGADO"` |

**Creación de Egreso** (desde el pago):

| Dato | Origen → Destino |
|---|---|
| `pago.id` | → `egreso.pagoId` (relación 1:1) |
| `proveedor.razonSocial` | → `egreso.beneficiario` |
| `cuentaBancaria.banco + " - " + cuenta.numeroCuenta` | → `egreso.cuentaBancaria` |
| `pago.valor` | → `egreso.valor` |
| Auto-increment | → `egreso.numero` |

**Efectos secundarios**:
- `cuentaPagar.estado` → `"PAGADA"`, `saldoPendiente` → 0
- `oc.estado` → `"CERRADA"`
- **→ Contabilidad**: `generarAsiento("PAGO_PROVEEDOR", pagoId)`

**Variables contables para PAGO_PROVEEDOR**:

| Variable | Fuente |
|---|---|
| `valorFactura` | `pago.valor` |
| `iva` | 0 |
| `valorTotal` | `pago.valor` |
| `saldo` | 0 |
| `fecha` | `pago.fechaPago` |
| `concepto` | `"Pago " + proveedor.razonSocial` |
| `proveedorId` | `pago.proveedorId` |

---

## 5. Traspasos → Inventarios

**Trigger**: `completarTraspaso(id)` en `traspasos.ts`

**Por cada item del traspaso**:

### Paso 1: Buscar producto
Busca en `Producto` donde `nombre contiene item.descripcion` (coincidencia parcial)

### Paso 2: Movimiento de salida (origen)
```prisma
MovimientoInventario {
  tipo: "SALIDA"
  productoId: producto.id
  almacenOrigenId: traspaso.almacenOrigenId
  cantidad: item.cantidad
  referencia: "Traspaso #" + traspaso.numero
}
```

### Paso 3: Movimiento de entrada (destino)
```prisma
MovimientoInventario {
  tipo: "ENTRADA"
  productoId: producto.id
  almacenDestinoId: traspaso.almacenDestinoId
  cantidad: item.cantidad
  referencia: "Traspaso #" + traspaso.numero
}
```

### Paso 4: Actualizar stock
```prisma
// Origen: decrementar
InventarioStock.update({ cantidad: { decrement: item.cantidad } })

// Destino: incrementar o crear
InventarioStock.upsert({ cantidad: { increment: item.cantidad } })
```

### Paso 5: Estado
`traspaso.estado` → `"COMPLETADO"`

---

## 6. Contabilidad → Exportadores

**Trigger**: `generarAsiento()` en `motor-contable.ts`, cuando `empresa.tipoContabilidad != "INTERNA"`

### Interfaz común (`DatosAsiento`)

```typescript
interface DatosAsiento {
  empresaId: string
  empresaNombre: string
  evento: EventoContable
  fecha: Date
  concepto: string
  numeroAsiento: number
  lineas: LineaAsiento[]
  totalDebe: number
  totalHaber: number
}

interface LineaAsiento {
  cuentaCodigo: string
  cuentaNombre: string
  debe: number
  haber: number
  centroCostosCodigo?: string
  centroCostosNombre?: string
  terceroId?: string
  terceroNombre?: string
  descripcion?: string
}
```

### Exportadores disponibles

| Exportador | tipoContabilidad | Formato | Destino |
|---|---|---|---|
| **Word Office** | `WORD_OFFICE` | XML (`<AsientoContable>`) | Archivo XML |
| **Syscar** | `SYSCAR` | CSV o XML | Sistema Syscar |
| **Zeus** | `ZEUS` | PLANO (pipe-delimited) o JSON | Sistema Zeus |
| **Generic API** | `OTRO` | JSON (POST) | URL configurable |

### Ejemplo payload JSON (Generic API)

```json
{
  "empresaId": "emp_123",
  "empresaNombre": "Mi Empresa SAS",
  "evento": "FACTURA_CLIENTE",
  "asiento": {
    "fecha": "2026-06-22T00:00:00.000Z",
    "concepto": "Factura Cliente #1001 - Juan Perez",
    "numero": 42,
    "detalles": [
      {
        "cuenta": "1305",
        "nombreCuenta": "Clientes",
        "debe": 1190000.00,
        "haber": 0,
        "centroCostos": null,
        "centroCostosNombre": null,
        "terceroId": "cli_456",
        "terceroNombre": "Juan Perez",
        "descripcion": "Facturación Clientes - DEBE"
      }
    ],
    "totalDebe": 1190000.00,
    "totalHaber": 1190000.00
  }
}
```

---

## 7. Inventarios — Resumen de movimientos automáticos

| Proceso | Tipo Movimiento | Efecto en Stock |
|---|---|---|
| **Recepción de OC** | `ENTRADA` | Incrementa `InventarioStock.cantidad` |
| **Traspaso completado** | `SALIDA` (origen) + `ENTRADA` (destino) | Decrementa origen, incrementa destino |
| **Venta CONFIRMADA** | ❌ No ejecuta | Sin efecto |
| **Despacho creado** | ❌ No ejecuta | Sin efecto |
| **Ajuste manual** | `ENTRADA` / `SALIDA` | Según usuario |

---

## 8. Tesorería — Integraciones

| Conexión | Estado |
|---|---|
| **Pago (Compras) → CuentaBancaria** | Solo guarda `cuentaBancariaId` como FK. **No** crea `MovimientoBancario`. **No** actualiza `saldoActual`. |
| **CuentaPagar "Enviar a Tesorería"** | Solo cambia estado a `"ENVIADA_TESORERIA"`. No crea registros automáticos. |
| **Venta CRÉDITO → CxC** | No existe modelo `CuentaPorCobrar`. El saldo se trackea solo en `VentaPago`. |
| **Dashboard Tesorería** | Lee `CuentaPagar.aggregate` para KPIs de saldos pendientes. |

---

## 9. Notificaciones — Eventos por módulo

### Función base
`notificarPorPermiso(recurso, accion, ...)` busca usuarios con permiso `{ recurso, accion }` en la misma empresa y crea registros `Notificacion`.

| Módulo | Evento | tipo | referenciaTipo | Permiso |
|---|---|---|---|---|
| **Pedidos** | Crear pedido | `info` | `PEDIDO` | `pedido` |
| **Pedidos** | Cambiar estado | `info` | `PEDIDO` | `pedido` |
| **Despachos** | Crear despacho | `info` | `DESPACHO` | `despacho` |
| **Despachos** | Cambiar estado | `info` | `DESPACHO` | `despacho` |
| **Ventas** | Crear venta | `info` | `VENTA` | `venta` |
| **Ventas** | Confirmar venta | `success` | `VENTA` | `venta` |
| **Traspasos** | Crear traspaso | `info` | `TRASPASO` | `traspaso` |
| **Traspasos** | Completar traspaso | `success` | `TRASPASO` | `traspaso` |
| **Compras** | Enviar requisición | `APROBACION_PENDIENTE` | `REQUISICION` | `requisicion` |
| **Compras** | Generar OC | `ORDEN_COMPRA_EMITIDA` | `ORDEN_COMPRA` | `orden_compra` |
| **Compras** | Crear CxP | `CUENTA_PAGAR_CREADA` | `CUENTA_PAGAR` | `cuenta_pagar` |
| **Compras** | Pagar CxP | `PAGO_REALIZADO` | `PAGO` | `pago` |

### Esquema Notificacion

```prisma
model Notificacion {
  id             String
  empresaId      String
  usuarioId      String?       // null = broadcast
  tipo           String        // info | success | warning | APROBACION_PENDIENTE | ...
  titulo         String
  mensaje        String
  referenciaId   String?       // FK a la entidad origen
  referenciaTipo String?       // PEDIDO | VENTA | DESPACHO | REQUISICION | ...
  leida          Boolean       @default(false)
  createdAt      DateTime      @default(now())
}
```

---

## 10. Historial de Estados — Auditoría

Cada cambio de estado en cualquier módulo registra una entrada en `HistorialEstado`:

| Campo | Contenido |
|---|---|
| `entidadTipo` | `REQUISICION` / `COTIZACION` / `ORDEN_COMPRA` / `RECEPCION` / `CUENTA_PAGAR` / `PAGO` / `VENTA` / `PEDIDO` / `DESPACHO` / `TRASPASO` |
| `entidadId` | ID del registro |
| `estadoAnterior` | Estado previo |
| `estadoNuevo` | Estado nuevo |
| `usuarioId` | Usuario que realizó el cambio |
| `descripcion` | Descripción opcional |

---

## 11. Dashboard — KPIs por módulo

El dashboard (`src/actions/dashboard.ts`) agrega datos de todos los módulos:

```typescript
interface DashboardData {
  // Compras
  ordenesCompraPendientes: number
  cuentasPagarPendientes: number
  totalCuentasPagar: number

  // Ventas
  ventasPendientes: number
  ventasDelMes: number
  totalVentas: number

  // Inventarios
  productosStockBajo: number
  productosSinStock: number
  totalProductos: number
  totalMovimientos: number

  // Traspasos
  traspasosPendientes: number

  // Pedidos
  pedidosPendientes: number

  // Despachos
  despachosPendientes: number
  despachosDelMes: number

  // Tesorería
  saldoBancario: number
  cuentaPagarCount: number
  cuentaPagarSaldo: number

  // Otros
  empleadosActivos: number
  tareasPendientes: number
  nominaPendiente: number
}
```

---

## 12. Tareas / Proyectos

**No tiene flujo de datos hacia otros módulos de negocio.** Es autocontenido:

- Se conecta con `Departamento` (FK) y `Usuario` (asignado a / creado por)
- No se integra con Compras, Ventas, Contabilidad, Nómina ni Presupuestos
- El campo `presupuesto` en Proyecto es un Decimal independiente, sin vínculo al módulo de Presupuestos

---

## Resumen de Gaps Identificados

| Gap | Detalle |
|---|---|
| **Ventas no reduce inventario** | Confirmar una venta no descuenta stock automáticamente |
| **Despachos no reduce inventario** | Crear/completar un despacho no afecta stock |
| **Pagos no crean MovimientoBancario** | Pagar una CxP no registra automáticamente el movimiento en Tesorería |
| **No hay CuentaPorCobrar** | Las ventas a crédito no generan un registro formal de CxC |
| **Búsqueda de productos en traspasos** | Usa `contains` sobre el nombre, puede dar falsos positivos |
