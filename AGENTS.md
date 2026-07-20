## Estado del Proyecto — 19/06/2026

| Área | Estado |
|---|---|
| Auth + Multi-empresa | 100% |
| Configuración (usuarios, roles, permisos) | 100% |
| Compras (proveedores, requisiciones, OCs, pagos) | 100% |
| Contabilidad (plan de cuentas, asientos, plantillas) | 100% |
| Clientes | 100% |
| Pedidos (órdenes de clientes) | 100% |
| Ventas (facturación) | 100% |
| Despachos (envíos) | 100% |
| Traspasos entre almacenes | 100% |
| Empleados + Nómina | 100% |
| Inventarios (almacenes, productos, stock) | 100% |
| Inventario (activos fijos) | 100% |
| Tesorería (cuentas, movimientos) | 100% |
| Tareas / Proyectos | 100% |
| Documentos | 100% |
| Permisos (vacaciones, ausencias) | 100% |
| Presupuestos | 100% |
| Notificaciones inteligentes | 100% |
| Dashboard / Reportes | 100% |
| Integración contable externa | 100% |

**Global: 100% funcional para cualquier empresa.**

### Mejoras aplicadas (19/06/2026):
- Sistema de notificaciones toast en toda la app (reemplazo de `alert()`/`confirm()`)
- Manejo de errores con catch blocks en todos los módulos
- Asignación de roles a usuarios desde UI de Configuración
- Validación de duplicados (email, NIT, código, nombre) en todos los CRUD
- Seguridad multi-empresa completada en todas las acciones
- Dashboard con KPIs, skeleton loader, botón de retry y exportación a Excel
- Página de Reportes con exportación a Excel por módulo
- Motor contable: implementados EGRESO, NOTA_DEBITO, NOTA_CREDITO
- Exportadores contables con manejo de errores
- Conexión a sistemas externos con soporte authType bearer/basic
- CRUD completos faltantes (update/delete OC, update Recepción)
- Corrección de bug "EGASTO" → "GASTO" en contabilidad
- Corrección de seguridad multi-empresa en clientes (7 acciones)
- Implementación de módulos: Pedidos, Ventas, Despachos, Traspasos entre almacenes
  - Modelos Prisma + migración DB
  - Server Actions (CRUD + cambios de estado)
  - Páginas con DataTable, FormDialog, detalle modal
  - Traspasos: actualización automática de inventario al completar
  - Sidebar, módulos, rutas protegidas actualizadas
  - HistorialEstado + notificaciones en CRUD y cambios de estado
  - Integración contable (FACTURA_CLIENTE) al confirmar venta
  - Vinculación Pedido → Despacho y Pedido → Venta (quick actions + pre-fill URL params)
  - KPIs de los 4 módulos en Dashboard
  - Reportes Excel para cada módulo en Reportes
- Registro de cambios: AGENTS.md
- Fix import Excel: auto-creación de almacén "Principal" si no existe ninguno + matching por nombre
- Fix import Excel: manejo de `row.almacenCodigo` undefined con IIFE para type safety
- Fix formatDateTime crash: corregir serialización de objetos `Date` en el helper de inventarios y robustecer funciones `formatDate` y `formatDateTime`
- Fix AdminUsuariosPage crash: agregar optional chaining (`u.empresa?.nombre`) para evitar error de lectura en usuarios sin empresa vinculada
- AdminUsuarios: implementar funcionalidad de edición/actualización de usuarios en la vista global `/admin/usuarios` para Super Administradores

### Mejoras 03/07/2026:
- IVA por item en Órdenes de Compra
  - Nuevo campo `tipoIva String @default("EXENTO")` en modelo `OrdenCompraItem`
  - Cada item puede seleccionar Exento / 5% / 19%
  - IVA total calculado como suma de IVA por item (reemplazó IVA global 16%)
  - Columna IVA en tabla del formulario creación, detalle y vista pública
  - `prisma db push` ejecutado, build exitoso

- Duplicar OC implementado (botón "Duplicar" en acciones de OC)
  - Server action `duplicarOrdenCompra` clona OC con items, observaciones con referencia a OC original
  - Botón visible en cualquier estado de OC en la tabla de Órdenes de Compra
  - Build exitoso

### Mejoras 03/07/2026:
- Proveedores extraído de Compras como módulo independiente
  - Nuevo campo `emailFactura` en modelo Proveedor
  - Nueva página `/proveedores` con CRUD completo
  - Sidebar: nueva entrada "Proveedores" con módulo PROVEEDORES
  - Pestaña "Proveedores" eliminada del módulo Compras
  - Server actions actualizadas con `emailFactura` y `revalidatePath("/proveedores")`
  - Permisos `PROVEEDORES` registrados en admin.ts
  - `prisma db push` ejecutado, build exitoso

### Mejoras responsive (30/06/2026):
- Sidebar responsive: off-canvas móvil con overlay, hamburger toggle, cierre automático al navegar
- SidebarProvider (`src/components/sidebar-provider.tsx`) para estado del menú mobile
- "Configuración" movido al final del sidebar con separador
- DataTable: vista en cards en mobile (`md:hidden` cards, `hidden md:block` tabla)
- Action bars (search + buttons) en `flex-col sm:flex-row` con `w-full sm:w-auto` en todos los módulos
- PageHeader responsive (stack vertical en mobile)
- Nómina: grid de totales single-column en mobile, detalles table con scroll horizontal, columna "Fórmula" oculta en mobile
- Inventarios: action bars stack vertical, tabs con `overflow-x-auto`, `mobileCardTitle` en las 4 tablas (productos, almacenes, stock, movimientos)

