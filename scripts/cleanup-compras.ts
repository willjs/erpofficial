import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const url = new URL(process.env.DATABASE_URL ?? "mysql://root:@localhost:3306/oficina_db")
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  } as any),
})

async function main() {
  console.log("=== LIMPIEZA TOTAL DEL MÓDULO COMPRAS ===\n")

  // Solo afectamos CuentasPagar que pertenecen a compras (tienen ordenCompraId)
  const cuentasPagarCompras = await prisma.cuentaPagar.findMany({
    where: { ordenCompraId: { not: null } },
    select: { id: true },
  })
  const cpIds = cuentasPagarCompras.map((c) => c.id)
  console.log(`Cuentas por Pagar de compras: ${cpIds.length}`)

  // Pagos vinculados a esas CuentasPagar
  const pagosCompras = cpIds.length > 0
    ? await prisma.pago.findMany({ where: { cuentaPagarId: { in: cpIds } }, select: { id: true } })
    : []
  const pagoIds = pagosCompras.map((p) => p.id)
  console.log(`Pagos de compras: ${pagoIds.length}`)

  // 1. Egresos
  if (pagoIds.length > 0) {
    const r = await prisma.egreso.deleteMany({ where: { pagoId: { in: pagoIds } } })
    console.log(`  Egresos eliminados: ${r.count}`)
  } else {
    console.log("  Egresos: 0")
  }

  // 2. Pagos
  if (pagoIds.length > 0) {
    const r = await prisma.pago.deleteMany({ where: { id: { in: pagoIds } } })
    console.log(`  Pagos eliminados: ${r.count}`)
  } else {
    console.log("  Pagos: 0")
  }

  // 3. Cuentas por Pagar (solo compras)
  if (cpIds.length > 0) {
    const r = await prisma.cuentaPagar.deleteMany({ where: { id: { in: cpIds } } })
    console.log(`  Cuentas por Pagar eliminadas: ${r.count}`)
  } else {
    console.log("  Cuentas por Pagar: 0")
  }

  // 4. RecepcionItems
  const r4 = await prisma.recepcionItem.deleteMany()
  console.log(`  Items de Recepción eliminados: ${r4.count}`)

  // 5. Recepciones
  const r5 = await prisma.recepcion.deleteMany()
  console.log(`  Recepciones eliminadas: ${r5.count}`)

  // 6. OrdenCompraItems
  const r6 = await prisma.ordenCompraItem.deleteMany()
  console.log(`  Items de OC eliminados: ${r6.count}`)

  // 7. Órdenes de Compra
  const r7 = await prisma.ordenCompra.deleteMany()
  console.log(`  Órdenes de Compra eliminadas: ${r7.count}`)

  // 8. LinkComparativo
  const r8 = await prisma.linkComparativo.deleteMany()
  console.log(`  Links Comparativos eliminados: ${r8.count}`)

  // 9. CotizacionItems
  const r9 = await prisma.cotizacionItem.deleteMany()
  console.log(`  Items de Cotización eliminados: ${r9.count}`)

  // 10. Cotizaciones
  const r10 = await prisma.cotizacion.deleteMany()
  console.log(`  Cotizaciones eliminadas: ${r10.count}`)

  // 11. RequisicionItems
  const r11 = await prisma.requisicionItem.deleteMany()
  console.log(`  Items de Requisición eliminados: ${r11.count}`)

  // 12. Requisiciones
  const r12 = await prisma.requisicion.deleteMany()
  console.log(`  Requisiciones eliminadas: ${r12.count}`)

  // 13. Proveedores
  const r13 = await prisma.proveedor.deleteMany()
  console.log(`  Proveedores eliminados: ${r13.count}`)

  // 14. HistorialEstado (solo entidades de compras)
  const r14 = await prisma.historialEstado.deleteMany({
    where: {
      entidadTipo: {
        in: ["REQUISICION", "ORDEN_COMPRA", "COTIZACION", "RECEPCION", "CUENTA_PAGAR", "PAGO"],
      },
    },
  })
  console.log(`  Historial de Estados eliminados: ${r14.count}`)

  // 15. Notificaciones de compras
  const r15 = await prisma.notificacion.deleteMany({
    where: {
      OR: [
        { referenciaTipo: { in: ["REQUISICION", "ORDEN_COMPRA", "COTIZACION", "RECEPCION", "CUENTA_PAGAR", "PAGO"] } },
        { tipo: { in: ["ORDEN_COMPRA", "REQUISICION_PENDIENTE"] } },
      ],
    },
  })
  console.log(`  Notificaciones eliminadas: ${r15.count}`)

  console.log("\n=== LIMPIEZA COMPLETADA ===")
  console.log("NOTA: CentroCostos no se eliminó porque es compartido con Contabilidad/Presupuestos.")
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1) }).finally(() => prisma.$disconnect())
