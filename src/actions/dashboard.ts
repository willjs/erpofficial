"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"

type SafeNumber = { toNumber?: () => number } | number | null | undefined

function toNumber(v: SafeNumber): number {
  if (v instanceof Object && "toNumber" in v) return (v as { toNumber: () => number }).toNumber()
  return (v as number) ?? 0
}

export interface DashboardData {
  compras: {
    reqPendientes: number
    ocPendientes: number
    comprasMes: number
  }
  tesoreria: {
    pagosPendientes: number
    saldoPendiente: number
    flujoCaja: number
    cuentasPagarCount: number
    cuentasPagarTotal: number
  }
  nomina: {
    totalPagar: number
    nominasCount: number
    empleadosActivos: number
  }
  contabilidad: {
    asientosPendientes: number
    resultadoMes: number
  }
  clientes: {
    activos: number
    interaccionesSemana: number
  }
  inventario: {
    stockBajo: number
    activosAsignados: number
  }
  pedidos: {
    pendientes: number
    totalMes: number
  }
  ventas: {
    pendientes: number
    totalMes: number
  }
  despachos: {
    pendientes: number
    totalMes: number
  }
  traspasos: {
    pendientes: number
    completadoMes: number
  }
}

export async function getDashboardData(): Promise<{ data: DashboardData | null; error?: string }> {
  try {
    const { empresaId } = await verifySession()
    if (!empresaId) throw new Error("No se pudo identificar la empresa")

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const weekAgo = new Date(Date.now() - 7 * 86400000)

    const batch1 = await Promise.all([
      prisma.requisicion.count({ where: { empresaId, estado: "EN_COTIZACION" } }).catch(() => 0),
      prisma.ordenCompra.count({ where: { empresaId, estado: "EMITIDA" } }).catch(() => 0),
      prisma.ordenCompra.aggregate({ where: { empresaId, fecha: { gte: startOfMonth } }, _sum: { valorTotal: true } }).catch(() => ({ _sum: { valorTotal: 0 } })),
      prisma.cuentaPagar.count({ where: { empresaId, estado: { not: "PAGADA" } } }).catch(() => 0),
      prisma.cuentaPagar.aggregate({ where: { empresaId, estado: { not: "PAGADA" } }, _sum: { saldoPendiente: true } }).catch(() => ({ _sum: { saldoPendiente: 0 } })),
      prisma.empleado.count({ where: { empresaId, estado: "ACTIVO" } }).catch(() => 0),
      prisma.cliente.count({ where: { empresaId, activo: true } }).catch(() => 0),
      prisma.asientoContable.count({ where: { empresaId, estado: "BORRADOR" } }).catch(() => 0),
      prisma.pedido.count({ where: { empresaId, estado: "BORRADOR" } }).catch(() => 0),
      prisma.pedido.aggregate({ where: { empresaId, createdAt: { gte: startOfMonth } }, _sum: { total: true } }).catch(() => ({ _sum: { total: 0 } })),
      prisma.venta.count({ where: { empresaId, estado: "BORRADOR" } }).catch(() => 0),
      prisma.venta.aggregate({ where: { empresaId, createdAt: { gte: startOfMonth } }, _sum: { total: true } }).catch(() => ({ _sum: { total: 0 } })),
      prisma.despacho.count({ where: { empresaId, estado: "BORRADOR" } }).catch(() => 0),
      prisma.despacho.count({ where: { empresaId, createdAt: { gte: startOfMonth } } }).catch(() => 0),
      prisma.traspaso.count({ where: { empresaId, estado: { notIn: ["COMPLETADO"] } } }).catch(() => 0),
      prisma.traspaso.count({ where: { empresaId, estado: "COMPLETADO", createdAt: { gte: startOfMonth } } }).catch(() => 0),
    ])

    const [
      cuentasBancariasAgg,
      nominaAgg,
      nominaCount,
      interaccionesSemana,
      stockBajoItems,
      activosAsignados,
      cuentasPagarCount,
    ] = await Promise.all([
      prisma.cuentaBancaria.aggregate({ where: { empresaId, activo: true }, _sum: { saldoActual: true } }).catch(() => ({ _sum: { saldoActual: 0 } })),
      prisma.nomina.aggregate({ where: { empleado: { empresaId }, createdAt: { gte: startOfMonth } }, _sum: { totalPagar: true } }).catch(() => ({ _sum: { totalPagar: 0 } })),
      prisma.nomina.count({ where: { empleado: { empresaId }, createdAt: { gte: startOfMonth } } }).catch(() => 0),
      prisma.interaccionCliente.count({ where: { cliente: { empresaId }, createdAt: { gte: weekAgo } } }).catch(() => 0),
      prisma.inventarioStock.findMany({ where: { empresaId, cantidad: { lte: prisma.inventarioStock.fields.cantidadMinima } }, take: 5 }).catch(() => []),
      prisma.activo.count({ where: { empresaId, estado: "ASIGNADO" } }).catch(() => 0),
      prisma.cuentaPagar.count({ where: { empresaId } }).catch(() => 0),
    ])

    const cuentasPagarAgg = await prisma.cuentaPagar.aggregate({ where: { empresaId }, _sum: { valor: true } }).catch(() => ({ _sum: { valor: 0 } }))

    const ingresos = await prisma.asientoDetalle.findMany({
      where: { asiento: { empresaId, estado: "CONTABILIZADO", fecha: { gte: startOfMonth } }, planCuenta: { tipo: "INGRESO" } },
      select: { haber: true },
    }).then((r) => r.reduce((s: number, a: { haber: SafeNumber }) => s + toNumber(a.haber), 0)).catch(() => 0)
    const gastos = await prisma.asientoDetalle.findMany({
      where: { asiento: { empresaId, estado: "CONTABILIZADO", fecha: { gte: startOfMonth } }, planCuenta: { tipo: "GASTO" } },
      select: { debe: true },
    }).then((r) => r.reduce((s: number, a: { debe: SafeNumber }) => s + toNumber(a.debe), 0)).catch(() => 0)

    const [
      reqPendientes,
      ocPendientes,
      comprasMesAgg,
      pagosPendientesCount,
      pagosPendientesAgg,
      empleadosActivos,
      clientesActivos,
      asientosPendientes,
      pedidosPendientes,
      pedidosMesAgg,
      ventasPendientes,
      ventasMesAgg,
      despachosPendientes,
      despachosMes,
      traspasosPendientes,
      traspasosCompletadoMes,
    ] = batch1 as [number, number, { _sum: { valorTotal: SafeNumber } }, number, { _sum: { saldoPendiente: SafeNumber } }, number, number, number, number, { _sum: { total: SafeNumber } }, number, { _sum: { total: SafeNumber } }, number, number, number, number]

    return {
      data: {
        compras: {
          reqPendientes,
          ocPendientes,
          comprasMes: toNumber(comprasMesAgg._sum.valorTotal),
        },
        tesoreria: {
          pagosPendientes: pagosPendientesCount,
          saldoPendiente: toNumber(pagosPendientesAgg._sum.saldoPendiente),
          flujoCaja: toNumber(cuentasBancariasAgg._sum.saldoActual),
          cuentasPagarCount,
          cuentasPagarTotal: toNumber(cuentasPagarAgg._sum.valor),
        },
        nomina: {
          totalPagar: toNumber(nominaAgg._sum.totalPagar),
          nominasCount: nominaCount,
          empleadosActivos,
        },
        contabilidad: {
          asientosPendientes,
          resultadoMes: ingresos - gastos,
        },
        clientes: {
          activos: clientesActivos,
          interaccionesSemana,
        },
        inventario: {
          stockBajo: stockBajoItems.length,
          activosAsignados,
        },
        pedidos: {
          pendientes: pedidosPendientes,
          totalMes: toNumber(pedidosMesAgg._sum.total),
        },
        ventas: {
          pendientes: ventasPendientes,
          totalMes: toNumber(ventasMesAgg._sum.total),
        },
        despachos: {
          pendientes: despachosPendientes,
          totalMes: despachosMes,
        },
        traspasos: {
          pendientes: traspasosPendientes,
          completadoMes: traspasosCompletadoMes,
        },
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al cargar el dashboard"
    return { data: null, error: message }
  }
}
