"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"

export interface ReporteTesoreriaData {
  resumen: {
    saldoTotal: number
    cuentasPagarPendientes: number
    cuentasPagarPagadas: number
    totalPendiente: number
    totalPagado: number
    pagosDelMes: number
    egresosDelMes: number
    ingresosDelMes: number
  }
  flujoMensual: { mes: string; ingresos: number; egastos: number; saldo: number }[]
  flujoTrimestral: { trimestre: string; ingresos: number; egastos: number; saldo: number }[]
  flujoAnual: { anio: number; ingresos: number; egastos: number; saldo: number }[]
  cuentasPagar: {
    proveedor: string
    oc: number
    factura: string | null
    valor: number
    saldoPendiente: number
    estado: string
    fechaVencimiento: string | null
  }[]
  egresos: {
    numero: number
    fecha: string
    beneficiario: string
    cuenta: string | null
    valor: number
    factura: string | null
  }[]
  movimientos: {
    fecha: string
    tipo: string
    monto: number
    descripcion: string | null
    cuenta: string
    estado: string
  }[]
}

export async function getReporteTesoreria(): Promise<ReporteTesoreriaData> {
  const { empresaId } = await verifySession()
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  // ─── Resumen ────────────────────────────────
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { empresaId, activo: true },
    select: { saldoActual: true },
  })
  const saldoTotal = cuentas.reduce((s, c) => s + Number(c.saldoActual), 0)

  const [cpPendientes, cpPagadas] = await Promise.all([
    prisma.cuentaPagar.findMany({
      where: { empresaId, estado: { in: ["PENDIENTE", "ENVIADA_TESORERIA"] } },
      select: { saldoPendiente: true, valor: true },
    }),
    prisma.cuentaPagar.findMany({
      where: { empresaId, estado: "PAGADA" },
      select: { valor: true },
    }),
  ])

  const startOfMonth = new Date(currentYear, currentMonth, 1)

  const [pagosMes, egresosMes, ingresosMes] = await Promise.all([
    prisma.pago.count({ where: { empresaId, createdAt: { gte: startOfMonth } } }),
    prisma.egreso.count({ where: { empresaId, fecha: { gte: startOfMonth } } }),
    prisma.movimientoBancario.count({
      where: { tipo: "INGRESO", fecha: { gte: startOfMonth }, cuenta: { empresaId } },
    }),
  ])

  // ─── Flujo mensual (últimos 12 meses + mes actual) ──
  const flujoMensual: ReporteTesoreriaData["flujoMensual"] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(currentYear, currentMonth - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const start = new Date(y, m - 1, 1)
    const end = new Date(y, m, 1)

    const [ing, eg] = await Promise.all([
      prisma.movimientoBancario.aggregate({
        where: { tipo: "INGRESO", fecha: { gte: start, lt: end }, cuenta: { empresaId } },
        _sum: { monto: true },
      }),
      prisma.movimientoBancario.aggregate({
        where: { tipo: "EGASTO", fecha: { gte: start, lt: end }, cuenta: { empresaId } },
        _sum: { monto: true },
      }),
    ])

    const ingresos = Number(ing._sum.monto ?? 0)
    const egastos = Number(eg._sum.monto ?? 0)
    flujoMensual.push({
      mes: `${String(m).padStart(2, "0")}/${y}`,
      ingresos,
      egastos,
      saldo: ingresos - egastos,
    })
  }

  // ─── Flujo trimestral ────────────────────────
  const flujoTrimestral: ReporteTesoreriaData["flujoTrimestral"] = []
  const trimestres = [
    { label: "Q1 (Ene-Mar)", mStart: 0, mEnd: 3 },
    { label: "Q2 (Abr-Jun)", mStart: 3, mEnd: 6 },
    { label: "Q3 (Jul-Sep)", mStart: 6, mEnd: 9 },
    { label: "Q4 (Oct-Dic)", mStart: 9, mEnd: 12 },
  ]

  for (const q of trimestres) {
    const start = new Date(currentYear, q.mStart, 1)
    const end = new Date(currentYear, q.mEnd, 1)

    const [ing, eg] = await Promise.all([
      prisma.movimientoBancario.aggregate({
        where: { tipo: "INGRESO", fecha: { gte: start, lt: end }, cuenta: { empresaId } },
        _sum: { monto: true },
      }),
      prisma.movimientoBancario.aggregate({
        where: { tipo: "EGASTO", fecha: { gte: start, lt: end }, cuenta: { empresaId } },
        _sum: { monto: true },
      }),
    ])

    const ingresos = Number(ing._sum.monto ?? 0)
    const egastos = Number(eg._sum.monto ?? 0)
    flujoTrimestral.push({
      trimestre: `${q.label} ${currentYear}`,
      ingresos,
      egastos,
      saldo: ingresos - egastos,
    })
  }

  // ─── Flujo anual (últimos 3 años) ────────────
  const flujoAnual: ReporteTesoreriaData["flujoAnual"] = []
  for (let a = currentYear - 2; a <= currentYear; a++) {
    const start = new Date(a, 0, 1)
    const end = new Date(a + 1, 0, 1)

    const [ing, eg] = await Promise.all([
      prisma.movimientoBancario.aggregate({
        where: { tipo: "INGRESO", fecha: { gte: start, lt: end }, cuenta: { empresaId } },
        _sum: { monto: true },
      }),
      prisma.movimientoBancario.aggregate({
        where: { tipo: "EGASTO", fecha: { gte: start, lt: end }, cuenta: { empresaId } },
        _sum: { monto: true },
      }),
    ])

    const ingresos = Number(ing._sum.monto ?? 0)
    const egastos = Number(eg._sum.monto ?? 0)
    flujoAnual.push({ anio: a, ingresos, egastos, saldo: ingresos - egastos })
  }

  // ─── Cuentas por Pagar ───────────────────────
  const cuentasPagarRaw = await prisma.cuentaPagar.findMany({
    where: { empresaId },
    include: { ordenCompra: { select: { numero: true, proveedor: { select: { razonSocial: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })
  const cuentasPagar = cuentasPagarRaw.map((c) => ({
    proveedor: c.ordenCompra?.proveedor?.razonSocial ?? "—",
    oc: c.ordenCompra?.numero ?? 0,
    factura: c.numeroFactura,
    valor: Number(c.valor),
    saldoPendiente: Number(c.saldoPendiente),
    estado: c.estado,
    fechaVencimiento: c.fechaVencimiento ? c.fechaVencimiento.toISOString().slice(0, 10) : null,
  }))

  // ─── Egresos ─────────────────────────────────
  const egresosRaw = await prisma.egreso.findMany({
    where: { empresaId },
    include: { pago: { include: { cuentaPagar: { select: { numeroFactura: true } } } } },
    orderBy: { fecha: "desc" },
    take: 100,
  })
  const egresos = egresosRaw.map((e) => ({
    numero: e.numero,
    fecha: e.fecha instanceof Date ? e.fecha.toISOString().slice(0, 10) : String(e.fecha).slice(0, 10),
    beneficiario: e.beneficiario,
    cuenta: e.cuentaBancaria,
    valor: Number(e.valor),
    factura: e.pago?.cuentaPagar?.numeroFactura ?? null,
  }))

  // ─── Movimientos ─────────────────────────────
  const movs = await prisma.movimientoBancario.findMany({
    where: { cuenta: { empresaId } },
    include: { cuenta: { select: { banco: true, numeroCuenta: true } } },
    orderBy: { fecha: "desc" },
    take: 200,
  })
  const movimientos = movs.map((m) => ({
    fecha: m.fecha instanceof Date ? m.fecha.toISOString().slice(0, 10) : String(m.fecha).slice(0, 10),
    tipo: m.tipo === "INGRESO" ? "Ingreso" : "Egreso",
    monto: Number(m.monto),
    descripcion: m.descripcion,
    cuenta: `${m.cuenta.banco} - ${m.cuenta.numeroCuenta}`,
    estado: m.estado,
  }))

  return {
    resumen: {
      saldoTotal,
      cuentasPagarPendientes: cpPendientes.length,
      cuentasPagarPagadas: cpPagadas.length,
      totalPendiente: cpPendientes.reduce((s, c) => s + Number(c.saldoPendiente), 0),
      totalPagado: cpPagadas.reduce((s, c) => s + Number(c.valor), 0),
      pagosDelMes: pagosMes,
      egresosDelMes: egresosMes,
      ingresosDelMes: ingresosMes,
    },
    flujoMensual,
    flujoTrimestral,
    flujoAnual,
    cuentasPagar,
    egresos,
    movimientos,
  }
}
