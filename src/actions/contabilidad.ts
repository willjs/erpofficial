"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

// ─── Plan de Cuentas ─────────────────────────────────────

export async function getPlanCuentas() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plan_cuenta", accion: "READ" })

  const cuentas = await prisma.planCuenta.findMany({
    where: { empresaId },
    include: { _count: { select: { hijos: true, detalles: true } } },
    orderBy: { codigo: "asc" },
  })

  return cuentas.map((c) => ({
    id: c.id,
    empresaId: c.empresaId,
    codigo: c.codigo,
    nombre: c.nombre,
    tipo: c.tipo,
    nivel: c.nivel,
    padreId: c.padreId,
    activo: c.activo,
    createdAt: c.createdAt,
    totalHijos: c._count.hijos,
    totalDetalles: c._count.detalles,
  }))
}

const planCuentaSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  tipo: z.string().min(1, "Tipo requerido"),
  padreId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
})

export type PlanCuentaFormData = z.infer<typeof planCuentaSchema>

export async function createPlanCuenta(data: PlanCuentaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plan_cuenta", accion: "CREATE" })
  const validated = planCuentaSchema.parse(data)

  let nivel = 1
  if (validated.padreId) {
    const padre = await prisma.planCuenta.findFirst({
      where: { id: validated.padreId, empresaId },
    })
    if (!padre) throw new Error("Cuenta padre no encontrada")
    nivel = padre.nivel + 1
  }

  const cuenta = await prisma.planCuenta.create({
    data: {
      empresaId,
      codigo: validated.codigo,
      nombre: validated.nombre,
      tipo: validated.tipo,
      nivel,
      padreId: validated.padreId ?? null,
      activo: validated.activo ?? true,
    },
  })

  revalidatePath("/contabilidad")
  return cuenta
}

export async function updatePlanCuenta(id: string, data: PlanCuentaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plan_cuenta", accion: "UPDATE" })
  const validated = planCuentaSchema.parse(data)

  const existing = await prisma.planCuenta.findFirst({
    where: { id, empresaId },
  })
  if (!existing) throw new Error("Cuenta no encontrada")

  let nivel = existing.nivel
  if (validated.padreId && validated.padreId !== existing.padreId) {
    const padre = await prisma.planCuenta.findFirst({
      where: { id: validated.padreId, empresaId },
    })
    if (!padre) throw new Error("Cuenta padre no encontrada")
    nivel = padre.nivel + 1
  }

  const cuenta = await prisma.planCuenta.update({
    where: { id },
    data: {
      codigo: validated.codigo,
      nombre: validated.nombre,
      tipo: validated.tipo,
      nivel,
      padreId: validated.padreId ?? null,
      activo: validated.activo ?? true,
    },
  })

  revalidatePath("/contabilidad")
  return cuenta
}

export async function deletePlanCuenta(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plan_cuenta", accion: "DELETE" })

  const cuenta = await prisma.planCuenta.findFirst({
    where: { id, empresaId },
    include: { _count: { select: { hijos: true, detalles: true } } },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")
  if (cuenta._count.hijos > 0) throw new Error("No se puede eliminar una cuenta con subcuentas")
  if (cuenta._count.detalles > 0) throw new Error("No se puede eliminar una cuenta con movimientos")

  await prisma.planCuenta.delete({ where: { id } })
  revalidatePath("/contabilidad")
}

export async function getPlanCuentasSelect() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plan_cuenta", accion: "READ" })

  const cuentas = await prisma.planCuenta.findMany({
    where: { empresaId, activo: true },
    orderBy: [{ codigo: "asc" }],
  })

  return cuentas.map((c) => ({
    id: c.id,
    codigo: c.codigo,
    nombre: c.nombre,
    nivel: c.nivel,
    label: `${c.codigo} - ${c.nombre}`,
  }))
}

// ─── Asientos Contables ───────────────────────────────────

export async function getAsientos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "READ" })

  const asientos = await prisma.asientoContable.findMany({
    where: { empresaId },
    include: {
      detalles: {
        include: {
          planCuenta: { select: { id: true, codigo: true, nombre: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ numero: "desc" }],
  })

  return asientos.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    fecha: a.fecha.toISOString(),
    detalles: a.detalles.map((d) => ({
      ...d,
      debe: Number(d.debe),
      haber: Number(d.haber),
    })),
  }))
}

export async function getAsiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "READ" })

  const asiento = await prisma.asientoContable.findFirst({
    where: { id, empresaId },
    include: {
      detalles: {
        include: {
          planCuenta: { select: { id: true, codigo: true, nombre: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  })

  if (!asiento) throw new Error("Asiento no encontrado")

  return {
    ...asiento,
    createdAt: asiento.createdAt.toISOString(),
    updatedAt: asiento.updatedAt.toISOString(),
    fecha: asiento.fecha.toISOString(),
    detalles: asiento.detalles.map((d) => ({
      ...d,
      debe: Number(d.debe),
      haber: Number(d.haber),
    })),
  }
}

async function getNextNumero(empresaId: string): Promise<number> {
  const last = await prisma.asientoContable.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (last?.numero ?? 0) + 1
}

const detalleSchema = z.object({
  planCuentaId: z.string().min(1, "Cuenta requerida"),
  debe: z.string().or(z.number()),
  haber: z.string().or(z.number()),
  descripcion: z.string().optional().nullable(),
})

const asientoSchema = z.object({
  fecha: z.string().min(1, "Fecha requerida"),
  concepto: z.string().min(1, "Concepto requerido"),
  tipo: z.string().min(1, "Tipo requerido"),
  detalles: z.array(detalleSchema).min(1, "Al menos un detalle requerido"),
})

export type AsientoFormData = z.infer<typeof asientoSchema>

export async function createAsiento(data: AsientoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "CREATE" })
  const validated = asientoSchema.parse(data)

  const numero = await getNextNumero(empresaId)

  const asiento = (await prisma.asientoContable.create({
    data: {
      empresaId,
      numero,
      fecha: new Date(validated.fecha),
      concepto: validated.concepto,
      tipo: validated.tipo as any,
      estado: "BORRADOR" as any,
      detalles: {
        create: validated.detalles.map((d) => ({
          planCuentaId: d.planCuentaId,
          debe: typeof d.debe === "string" ? parseFloat(d.debe) : d.debe,
          haber: typeof d.haber === "string" ? parseFloat(d.haber) : d.haber,
          descripcion: d.descripcion ?? null,
        })),
      },
    },
    include: {
      detalles: {
        include: {
          planCuenta: { select: { id: true, codigo: true, nombre: true } },
        },
      },
    },
  })) as any

  revalidatePath("/contabilidad")
  return {
    ...asiento,
    createdAt: asiento.createdAt.toISOString(),
    updatedAt: asiento.updatedAt.toISOString(),
    fecha: asiento.fecha.toISOString(),
    detalles: asiento.detalles.map((d: any) => ({
      ...d,
      debe: Number(d.debe),
      haber: Number(d.haber),
    })),
  }
}

export async function updateAsiento(id: string, data: AsientoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "UPDATE" })
  const validated = asientoSchema.parse(data)

  const existing = await prisma.asientoContable.findFirst({
    where: { id, empresaId },
  })
  if (!existing) throw new Error("Asiento no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo se puede editar asientos en borrador")

  const asiento = await prisma.$transaction(async (tx: any) => {
    await tx.asientoDetalle.deleteMany({ where: { asientoId: id } })

    return tx.asientoContable.update({
      where: { id },
      data: {
        fecha: new Date(validated.fecha),
        concepto: validated.concepto,
        tipo: validated.tipo as any,
        detalles: {
          create: validated.detalles.map((d) => ({
            planCuentaId: d.planCuentaId,
            debe: typeof d.debe === "string" ? parseFloat(d.debe) : d.debe,
            haber: typeof d.haber === "string" ? parseFloat(d.haber) : d.haber,
            descripcion: d.descripcion ?? null,
          })),
        },
      },
      include: {
        detalles: {
          include: {
            planCuenta: { select: { id: true, codigo: true, nombre: true } },
          },
        },
      },
    })
  }) as any

  revalidatePath("/contabilidad")
  return {
    ...asiento,
    createdAt: asiento.createdAt.toISOString(),
    updatedAt: asiento.updatedAt.toISOString(),
    fecha: asiento.fecha.toISOString(),
    detalles: asiento.detalles.map((d: any) => ({
      ...d,
      debe: Number(d.debe),
      haber: Number(d.haber),
    })),
  }
}

export async function deleteAsiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "DELETE" })

  const existing = await prisma.asientoContable.findFirst({
    where: { id, empresaId },
  })
  if (!existing) throw new Error("Asiento no encontrado")
  if (existing.estado === "CONTABILIZADO") throw new Error("No se puede eliminar un asiento contabilizado")

  await prisma.asientoContable.delete({ where: { id } })
  revalidatePath("/contabilidad")
}

export async function contabilizarAsiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "UPDATE" })

  const asiento = await prisma.asientoContable.findFirst({
    where: { id, empresaId },
    include: { detalles: true },
  })
  if (!asiento) throw new Error("Asiento no encontrado")
  if (asiento.estado !== "BORRADOR") throw new Error("El asiento debe estar en borrador")

  const totalDebe = asiento.detalles.reduce((sum, d) => sum + Number(d.debe), 0)
  const totalHaber = asiento.detalles.reduce((sum, d) => sum + Number(d.haber), 0)

  if (totalDebe !== totalHaber) {
    throw new Error(`El asiento no está balanceado: Debe ${totalDebe.toFixed(2)} ≠ Haber ${totalHaber.toFixed(2)}`)
  }

  const updated = await prisma.asientoContable.update({
    where: { id },
    data: { estado: "CONTABILIZADO" as any },
  })

  revalidatePath("/contabilidad")
  return updated
}

export async function cancelarAsiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "asiento_contable", accion: "UPDATE" })

  const asiento = await prisma.asientoContable.findFirst({
    where: { id, empresaId },
  })
  if (!asiento) throw new Error("Asiento no encontrado")
  if (asiento.estado !== "BORRADOR") throw new Error("Solo se puede cancelar asientos en borrador")

  const updated = await prisma.asientoContable.update({
    where: { id },
    data: { estado: "CANCELADO" as any },
  })

  revalidatePath("/contabilidad")
  return updated
}

// ─── Plantillas Contables ─────────────────────────────

export async function getPlantillasContables() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plantilla_contable", accion: "READ" })
  const data = await prisma.plantillaContable.findMany({
    where: { empresaId },
    include: {
      lineas: {
        include: { centroCostos: { select: { id: true, nombre: true, codigo: true } } },
      },
    },
    orderBy: { evento: "asc" },
  })
  return data.map((p) => ({
    ...p,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    lineas: p.lineas.map((l) => ({
      ...l,
      porcentaje: l.porcentaje ?? undefined,
    })),
  }))
}

const plantillaLineaSchema = z.object({
  tipo: z.enum(["DEBE", "HABER"]),
  cuentaCodigo: z.string().min(1, "Código de cuenta requerido"),
  centroCostosId: z.string().nullable().optional(),
  formula: z.enum(["VALOR_FACTURA", "IVA", "VALOR_TOTAL", "SALDO", "PORCENTAJE"]),
  porcentaje: z.number().nullable().optional(),
})

const plantillaSchema = z.object({
  evento: z.enum(["FACTURA_PROVEEDOR", "PAGO_PROVEEDOR", "RECEPCION_OC", "EGRESO", "NOTA_DEBITO", "NOTA_CREDITO"]),
  concepto: z.string().min(1, "Concepto requerido"),
  lineas: z.array(plantillaLineaSchema).min(1, "Al menos una línea requerida"),
})

export type PlantillaFormData = z.infer<typeof plantillaSchema>

export async function createPlantillaContable(data: PlantillaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plantilla_contable", accion: "CREATE" })
  const validated = plantillaSchema.parse(data)

  const plantilla = await prisma.plantillaContable.create({
    data: {
      empresaId,
      evento: validated.evento,
      concepto: validated.concepto,
      lineas: {
        create: validated.lineas.map((l) => ({
          tipo: l.tipo,
          cuentaCodigo: l.cuentaCodigo,
          centroCostosId: l.centroCostosId ?? null,
          formula: l.formula,
          porcentaje: l.porcentaje ?? null,
        })),
      },
    },
    include: { lineas: true },
  })

  revalidatePath("/contabilidad")
  revalidatePath("/configuracion")
  return plantilla
}

export async function updatePlantillaContable(id: string, data: PlantillaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plantilla_contable", accion: "UPDATE" })
  const validated = plantillaSchema.parse(data)

  const existing = await prisma.plantillaContable.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Plantilla no encontrada")

  const plantilla = await prisma.$transaction(async (tx: any) => {
    await tx.plantillaContableLinea.deleteMany({ where: { plantillaId: id } })
    return tx.plantillaContable.update({
      where: { id },
      data: {
        evento: validated.evento,
        concepto: validated.concepto,
        lineas: {
          create: validated.lineas.map((l: any) => ({
            tipo: l.tipo,
            cuentaCodigo: l.cuentaCodigo,
            centroCostosId: l.centroCostosId ?? null,
            formula: l.formula,
            porcentaje: l.porcentaje ?? null,
          })),
        },
      },
      include: { lineas: true },
    })
  })

  revalidatePath("/contabilidad")
  revalidatePath("/configuracion")
  return plantilla
}

export async function deletePlantillaContable(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plantilla_contable", accion: "DELETE" })
  const existing = await prisma.plantillaContable.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Plantilla no encontrada")

  await prisma.plantillaContable.delete({ where: { id } })
  revalidatePath("/contabilidad")
  revalidatePath("/configuracion")
}

export async function togglePlantillaContable(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plantilla_contable", accion: "UPDATE" })
  const existing = await prisma.plantillaContable.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Plantilla no encontrada")

  const updated = await prisma.plantillaContable.update({
    where: { id },
    data: { activo: !existing.activo },
  })
  revalidatePath("/contabilidad")
  revalidatePath("/configuracion")
  return updated
}

// ─── Reportes Contables ───────────────────────────────

export async function getBalanceGeneral(corte: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "reporte", accion: "READ" })
  const fechaCorte = new Date(corte)

  const asientos = await prisma.asientoContable.findMany({
    where: {
      empresaId,
      estado: "CONTABILIZADO",
      fecha: { lte: fechaCorte },
    },
    include: {
      detalles: {
        include: { planCuenta: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
      },
    },
  })

  const saldos: Record<string, { cuentaId: string; codigo: string; nombre: string; tipo: string; debe: number; haber: number }> = {}

  for (const a of asientos) {
    for (const d of a.detalles) {
      const key = d.planCuentaId
      if (!saldos[key]) {
        saldos[key] = { cuentaId: d.planCuentaId, codigo: d.planCuenta.codigo, nombre: d.planCuenta.nombre, tipo: d.planCuenta.tipo, debe: 0, haber: 0 }
      }
      saldos[key].debe += Number(d.debe)
      saldos[key].haber += Number(d.haber)
    }
  }

  const cuentas = Object.values(saldos).map((c) => ({
    ...c,
    saldo: c.tipo === "ACTIVO" || c.tipo === "GASTO" ? c.debe - c.haber : c.haber - c.debe,
  }))

  const grouped: Record<string, any> = { ACTIVO: [], PASIVO: [], PATRIMONIO: [] }
  for (const c of cuentas) {
    if (grouped[c.tipo]) grouped[c.tipo].push(c)
  }

  return {
    fechaCorte: fechaCorte.toISOString(),
    activo: { cuentas: grouped.ACTIVO, total: grouped.ACTIVO.reduce((s: number, c: any) => s + c.saldo, 0) },
    pasivo: { cuentas: grouped.PASIVO, total: grouped.PASIVO.reduce((s: number, c: any) => s + c.saldo, 0) },
    patrimonio: { cuentas: grouped.PATRIMONIO, total: grouped.PATRIMONIO.reduce((s: number, c: any) => s + c.saldo, 0) },
  }
}

export async function getEstadoResultados(desde: string, hasta: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "reporte", accion: "READ" })
  const fechaDesde = new Date(desde)
  const fechaHasta = new Date(hasta)

  const asientos = await prisma.asientoContable.findMany({
    where: {
      empresaId,
      estado: "CONTABILIZADO",
      fecha: { gte: fechaDesde, lte: fechaHasta },
    },
    include: {
      detalles: {
        include: { planCuenta: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
      },
    },
  })

  const ingresos: { codigo: string; nombre: string; saldo: number }[] = []
  const gastos: { codigo: string; nombre: string; saldo: number }[] = []
  const cuentasMap: Record<string, { debe: number; haber: number; nombre: string; codigo: string; tipo: string }> = {}

  for (const a of asientos) {
    for (const d of a.detalles) {
      if (!cuentasMap[d.planCuentaId]) {
        cuentasMap[d.planCuentaId] = { debe: 0, haber: 0, nombre: d.planCuenta.nombre, codigo: d.planCuenta.codigo, tipo: d.planCuenta.tipo }
      }
      cuentasMap[d.planCuentaId].debe += Number(d.debe)
      cuentasMap[d.planCuentaId].haber += Number(d.haber)
    }
  }

  for (const [, c] of Object.entries(cuentasMap)) {
    if (c.tipo === "INGRESO") {
      ingresos.push({ codigo: c.codigo, nombre: c.nombre, saldo: c.haber - c.debe })
    } else if (c.tipo === "GASTO") {
      gastos.push({ codigo: c.codigo, nombre: c.nombre, saldo: c.debe - c.haber })
    }
  }

  const totalIngresos = ingresos.reduce((s, i) => s + i.saldo, 0)
  const totalGastos = gastos.reduce((s, e) => s + e.saldo, 0)

  return {
    desde: fechaDesde.toISOString(),
    hasta: fechaHasta.toISOString(),
    ingresos,
    gastos,
    totalIngresos,
    totalGastos,
    utilidad: totalIngresos - totalGastos,
  }
}

export async function getLibroMayor(cuentaId: string, desde: string, hasta: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "reporte", accion: "READ" })

  const asientos = await prisma.asientoContable.findMany({
    where: {
      empresaId,
      estado: "CONTABILIZADO",
      fecha: { gte: new Date(desde), lte: new Date(hasta) },
    },
    include: {
      detalles: {
        where: { planCuentaId: cuentaId },
        include: { planCuenta: { select: { id: true, codigo: true, nombre: true, tipo: true } } },
      },
    },
    orderBy: { fecha: "asc" },
  })

  const cuenta = await prisma.planCuenta.findFirst({ where: { id: cuentaId, empresaId } })
  if (!cuenta) throw new Error("Cuenta no encontrada")

  let saldoAcumulado = 0
  const movimientos = asientos
    .filter((a) => a.detalles.length > 0)
    .map((a) => {
      const d = a.detalles[0]
      const debe = Number(d.debe)
      const haber = Number(d.haber)
      const esDeudora = cuenta.tipo === "ACTIVO" || cuenta.tipo === "GASTO"
      saldoAcumulado += esDeudora ? debe - haber : haber - debe
      return {
        fecha: a.fecha.toISOString(),
        asientoNumero: a.numero,
        concepto: a.concepto,
        debe,
        haber,
        saldoAcumulado,
      }
    })

  return {
    cuenta: { id: cuenta.id, codigo: cuenta.codigo, nombre: cuenta.nombre, tipo: cuenta.tipo },
    desde: new Date(desde).toISOString(),
    hasta: new Date(hasta).toISOString(),
    movimientos,
    saldoFinal: saldoAcumulado,
  }
}

export async function getAuxiliarProveedores(desde: string, hasta: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "reporte", accion: "READ" })

  const cuentasPagar = await prisma.cuentaPagar.findMany({
    where: {
      empresaId,
      createdAt: { gte: new Date(desde), lte: new Date(hasta) },
    },
    include: {
      ordenCompra: { include: { proveedor: { select: { id: true, razonSocial: true, nit: true } } } },
      pagos: { select: { id: true, valor: true, fechaPago: true, estado: true } },
    },
    orderBy: { createdAt: "asc" },
  })

  return cuentasPagar.map((cp) => ({
    id: cp.id,
    numeroFactura: cp.numeroFactura,
    proveedor: cp.ordenCompra.proveedor,
    fecha: cp.createdAt.toISOString(),
    valor: Number(cp.valor),
    saldoPendiente: Number(cp.saldoPendiente),
    estado: cp.estado,
    pagos: cp.pagos.map((p) => ({
      id: p.id,
      valor: Number(p.valor),
      fechaPago: p.fechaPago?.toISOString() ?? null,
      estado: p.estado,
    })),
  }))
}

export async function getAuxiliarCentroCostos(centroCostosId: string, desde: string, hasta: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "reporte", accion: "READ" })

  const ordenes = await prisma.ordenCompra.findMany({
    where: {
      empresaId,
      centroCostosId,
      fecha: { gte: new Date(desde), lte: new Date(hasta) },
    },
    include: {
      proveedor: { select: { id: true, razonSocial: true } },
      cuentasPagar: { select: { id: true, valor: true, estado: true } },
    },
    orderBy: { fecha: "asc" },
  })

  const centro = await prisma.centroCostos.findFirst({ where: { id: centroCostosId, empresaId } })

  return {
    centro: centro ? { id: centro.id, codigo: centro.codigo, nombre: centro.nombre } : null,
    desde: new Date(desde).toISOString(),
    hasta: new Date(hasta).toISOString(),
    movimientos: ordenes.map((oc) => ({
      id: oc.id,
      numero: oc.numero,
      fecha: oc.fecha.toISOString(),
      proveedor: oc.proveedor.razonSocial,
      valorTotal: Number(oc.valorTotal),
      cuentasPagar: oc.cuentasPagar.length,
      totalPagado: oc.cuentasPagar.reduce((s, cp) => s + Number(cp.valor), 0),
    })),
    total: ordenes.reduce((s, oc) => s + Number(oc.valorTotal), 0),
  }
}
