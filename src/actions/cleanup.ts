"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"

export async function limpiarDatosComprasTesoreria() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "admin", accion: "DELETE" })

  await prisma.$transaction(async (tx: any) => {
    // 1. Egreso (FK a Pago, no Cascade)
    await tx.egreso.deleteMany({ where: { empresaId } })

    // 2. Pago (FK a CuentaPagar, Proveedor, CuentaBancaria; no Cascade)
    await tx.pago.deleteMany({ where: { empresaId } })

    // 3. CuentaPagar (FK a OrdenCompra; no Cascade)
    await tx.cuentaPagar.deleteMany({ where: { empresaId } })

    // 4. Recepcion + items (FK a OrdenCompra; items cascade)
    await tx.recepcion.deleteMany({ where: { empresaId } })

    // 5. OrdenCompra + items (FK a Requisicion; items cascade)
    await tx.ordenCompra.deleteMany({ where: { empresaId } })

    // 6. Cotizacion + items (FK a Requisicion; items cascade)
    await tx.cotizacion.deleteMany({ where: { empresaId } })

    // 7. LinkComparativo (FK a Requisicion, Cascade)
    await tx.linkComparativo.deleteMany({ where: { empresaId } })

    // 8. Requisicion + items (FK a Empresa, Cascade; items cascade)
    await tx.requisicion.deleteMany({ where: { empresaId } })

    // 9. MovimientoBancario (FK a CuentaBancaria, Cascade)
    await tx.movimientoBancario.deleteMany({
      where: { cuenta: { empresaId } },
    })

    // 10. Reset saldoActual of all bank accounts to saldoInicial
    const cuentas = await tx.cuentaBancaria.findMany({
      where: { empresaId },
      select: { id: true, saldoInicial: true },
    })
    for (const c of cuentas) {
      await tx.cuentaBancaria.update({
        where: { id: c.id },
        data: { saldoActual: c.saldoInicial },
      })
    }

    // 11. HistorialEstado de entidades eliminadas
    await tx.historialEstado.deleteMany({
      where: {
        empresaId,
        entidadTipo: {
          in: [
            "REQUISICION",
            "ORDEN_COMPRA",
            "COTIZACION",
            "RECEPCION",
            "CUENTA_PAGAR",
            "PAGO",
          ],
        },
      },
    })

    // 12. Notificaciones de módulos eliminados
    await tx.notificacion.deleteMany({
      where: {
        empresaId,
        referenciaTipo: {
          in: [
            "REQUISICION",
            "ORDEN_COMPRA",
            "COTIZACION",
            "RECEPCION",
            "CUENTA_PAGAR",
            "PAGO",
            "EGRESO",
          ],
        },
      },
    })
  })

  revalidatePath("/tesoreria")
  revalidatePath("/compras")
  revalidatePath("/proveedores")
  revalidatePath("/reportes")

  return { success: true, message: "Datos de Compras y Tesorería eliminados correctamente" }
}
