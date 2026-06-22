# Plan de Integración ERP – Compras, Tesorería y Contabilidad

## Fase 1 – Base y Correcciones

### 1.1 Bugs existentes
| # | Tarea | Archivos | Estimación |
|---|-------|----------|------------|
| 1 | Corregir Select de OC vacío en "Registrar Factura" (carga `ordenesCompra` en vez de `cuentasPagar`) | `tesoreria/page.tsx` | 30 min |
| 2 | Al crear OC desde requisición sin cotización ganadora, tomar la primera cotización disponible | `compras/page.tsx` | Hecho |
| 3 | Archivos de cotización no se guardaban en update — corregido | `compras.ts` | Hecho |
| 4 | FileReader async perdía archivos — corregido | `compras/page.tsx` | Hecho |

### 1.2 Motor Contable – Core

#### Nuevo archivo: `src/actions/motor-contable.ts`
```typescript
// Tipos de eventos
type EventoContable = 
  | "FACTURA_PROVEEDOR"
  | "PAGO_PROVEEDOR"
  | "RECEPCION_OC"
  | "EGRESO"
  | "NOTA_DEBITO"
  | "NOTA_CREDITO"

// Plantilla contable (por empresa)
type PlantillaContable = {
  id: string
  empresaId: string
  evento: EventoContable
  concepto: string
  lineas: {
    tipo: "DEBE" | "HABER"
    cuentaCodigo: string       // código del PlanCuenta
    centroCostosId?: string
    formula: "VALOR_FACTURA" | "IVA" | "VALOR_TOTAL" | "SALDO" | "PORCENTAJE"
    porcentaje?: number
  }[]
}
```

#### Tablas nuevas en Prisma
```prisma
model PlantillaContable {
  id         String   @id @default(cuid())
  empresaId  String
  evento     String   // FACTURA_PROVEEDOR, PAGO_PROVEEDOR, etc.
  concepto   String
  activo     Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  empresa    Empresa  @relation(fields: [empresaId], references: [id], onDelete: Cascade)
  lineas     PlantillaContableLinea[]

  @@unique([empresaId, evento])
  @@index([empresaId])
}

model PlantillaContableLinea {
  id             String  @id @default(cuid())
  plantillaId    String
  tipo           String  // "DEBE" | "HABER"
  cuentaCodigo   String  // código del PlanCuenta
  centroCostosId String?
  formula        String  // VALOR_FACTURA, IVA, VALOR_TOTAL, SALDO, PORCENTAJE
  porcentaje     Float?

  plantilla     PlantillaContable @relation(fields: [plantillaId], references: [id], onDelete: Cascade)
  centroCostos  CentroCostos?     @relation(fields: [centroCostosId], references: [id])

  @@index([plantillaId])
}

model TipoContabilidad {
  id        String @id @default(cuid())
  empresaId String
  tipo      String // "INTERNA" | "WORD_OFFICE" | "SYSCAR" | "ZEUS" | "OTRO"
  config    Json?  // { apiUrl, token, formato, etc. }
  activo    Boolean @default(true)

  empresa Empresa @relation(fields: [empresaId], references: [id], onDelete: Cascade)

  @@unique([empresaId])
}
```

Agregar campo a `Empresa`:
```prisma
model Empresa {
  ...
  tipoContabilidad String? // "INTERNA" | "WORD_OFFICE" | "SYSCAR" | "ZEUS" | "OTRO"
}
```

#### Server action: `generarAsiento(evento, referenciaId)`
- Busca la plantilla activa para el evento + empresa
- Evalúa fórmulas contra el documento origen
- Crea `AsientoContable` con sus `AsientoDetalle` (si INTERNA)
- O exporta según formato configurado (si externo)

### 1.3 Integración Compras → Contabilidad

#### Punto de integración 1: Factura de Proveedor
- En `crearCuentaPagar()` (hoy en `compras.ts`), al final llamar:
  ```typescript
  await generarAsiento("FACTURA_PROVEEDOR", cuentaPagar.id)
  ```

#### Punto de integración 2: Pago a Proveedor
- En `pagarCuenta()` (hoy en `compras.ts`), después de crear Pago+Egreso llamar:
  ```typescript
  await generarAsiento("PAGO_PROVEEDOR", pago.id)
  ```

#### Punto de integración 3: Recepción
- En `createRecepcion()`, al final llamar:
  ```typescript
  await generarAsiento("RECEPCION_OC", recepcion.id)
  ```

### 1.4 UI de Configuración Contable

#### Nueva pestaña en Configuración del dashboard
- Selector: Tipo de Contabilidad (Interna / Word Office / Syscar / Zeus / Otro)
- Si externo: formulario de configuración (URL, token, formato de exportación)
- Si interno: mensaje "La contabilidad se gestiona dentro del sistema"

#### UI de Plantillas Contables
- Tabla: Evento → Concepto → Activo
- Modal de edición: lista de líneas (DEBE/HABER, cuenta, fórmula, %)
- Precargar plantillas por defecto al crear empresa:
  - FACTURA_PROVEEDOR: DEBE(Gasto/Inventario), DEBE(IVA), HABER(Proveedores)
  - PAGO_PROVEEDOR: DEBE(Proveedores), HABER(Bancos)

---

## Fase 2 – Reportes Contables

### 2.1 Balance General
- Fecha de corte parametrizable
- Agrupa cuentas por tipo (ACTIVO, PASIVO, PATRIMONIO)
- Calcula saldos desde asientos contabilizados

### 2.2 Estado de Resultados
- Período (desde/hasta)
- Agrupa INGRESO, EGASTO
- Utilidad = Ingresos - Egresos

### 2.3 Libro Mayor
- Por cuenta + rango de fechas
- Muestra todas las transacciones con saldo acumulado

### 2.4 Auxiliares Contables
- Por tercero (proveedor) o centro de costo
- Detalle de movimientos + saldos

---

## Fase 3 – Exportación a Software Externo

### 3.1 Exportación Word Office
- Formato: XML basado en especificaciones Word Office
- Campos: CUENTA, TERCERO, CENTRO_COSTO, DEBE, HABER, FECHA, CONCEPTO

### 3.2 Exportación Syscar
- Formato: CSV/XML según especificaciones Syscar
- Endpoint configurable

### 3.3 Exportación Zeus
- Formato: archivo plano o API REST según documentación Zeus

### 3.4 API REST Genérica
- POST /api/integracion/asiento
- Body: { empresaId, asiento: { fecha, concepto, detalles: [{ cuenta, debe, haber, centroCostos, tercero }] } }
- Autenticación vía API key configurable por empresa

---

## Fase 4 – Módulos Avanzados

### 4.1 Presupuestos
- Por centro de costo y cuenta contable
- Seguimiento vs real

### 4.2 Inventarios
- Integración con recepción de OC
- Kardex valorizado

### 4.3 Activos Fijos
- Depreciación automática
- Asientos de depreciación

### 4.4 Nómina
- Provisión automática
- Asientos de nómina

### 4.5 RPA
- Automatización de tareas repetitivas (conciliación, generación de reportes)

---

## Resumen de Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `prisma/schema.prisma` | Agregar modelos: `PlantillaContable`, `PlantillaContableLinea`, campo `tipoContabilidad` en Empresa |
| `src/actions/motor-contable.ts` | **Crear** — lógica central de generación de asientos |
| `src/actions/compras.ts` | Modificar `crearCuentaPagar()`, `pagarCuenta()`, `createRecepcion()` para llamar al motor |
| `src/actions/contabilidad.ts` | Agregar CRUD de plantillas contables |
| `src/actions/tesoreria.ts` | Agregar exportación de asientos si aplica |
| `src/app/(dashboard)/contabilidad/page.tsx` | Agregar pestañas de reportes (Balance, Resultados, Mayor, Auxiliares) |
| `src/app/(dashboard)/configuracion/page.tsx` | Agregar sección "Configuración Contable" |
| `src/components/shared/` | Componentes reutilizables de plantillas contables |

---

## Diagrama de Flujo Final

```
Solicitud Compra → Cotización → OC → Recepción
                                           ↓
                                  Factura Proveedor
                                           ↓
                                  Cuenta por Pagar
                                           ↓
                              ┌─ Motor Contable ─┐
                              │  PLANTILLA       │
                              │  FACTURA_PROV    │
                              │  → DEBE Gasto     │
                              │  → DEBE IVA       │
                              │  → HABER Proveed │
                              └────────┬─────────┘
                                       │
                          ┌────────────┴────────────┐
                          │ INTERNA                 │ EXTERNA
                          │ ↓                       │ ↓
                          │ AsientoContable         │ XML / CSV / API
                          │ en DB                   │ a WordOffice / Syscar / Zeus
                          └─────────────────────────┘
                                       │
                                  Tesorería
                                  (Pago)
                                       ↓
                              ┌─ Motor Contable ─┐
                              │  PLANTILLA        │
                              │  PAGO_PROV        │
                              │  → DEBE Proveed   │
                              │  → HABER Bancos   │
                              └────────┬─────────┘
                                       │
                          ┌────────────┴────────────┐
                          │ INTERNA      │ EXTERNA  │
                          │ Asiento      │ Exportar │
                          └─────────────────────────┘
                                       ↓
                                    Cierre
```
