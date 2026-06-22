"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const cuentaSchema = z.object({
  banco: z.string().min(1, "Banco requerido"),
  numeroCuenta: z.string().min(1, "Número de cuenta requerido"),
  tipo: z.enum(["CORRIENTE", "AHORROS", "EFECTIVO", "INVERSION"]),
  saldoInicial: z.coerce.number().min(0, "Saldo inicial debe ser mayor o igual a 0"),
  moneda: z.string().default("MXN"),
})

const movimientoSchema = z.object({
  cuentaId: z.string().min(1, "Cuenta requerida"),
  tipo: z.enum(["INGRESO", "EGASTO"]),
  fecha: z.string().min(1, "Fecha requerida"),
  monto: z.coerce.number().positive("Monto debe ser mayor a 0"),
  descripcion: z.string().optional(),
  referencia: z.string().optional(),
})

type CuentaInput = z.infer<typeof cuentaSchema>
type MovimientoInput = z.infer<typeof movimientoSchema>

function serializeCuenta(c: any) {
  return {
    ...c,
    saldoInicial: Number(c.saldoInicial),
    saldoActual: Number(c.saldoActual),
  }
}

function serializeMovimiento(m: any) {
  return {
    ...m,
    monto: Number(m.monto),
    fecha: m.fecha instanceof Date ? m.fecha.toISOString() : m.fecha,
    fechaConciliacion:
      m.fechaConciliacion instanceof Date
        ? m.fechaConciliacion.toISOString()
        : m.fechaConciliacion ?? null,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  }
}

export async function getCuentas() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_bancaria", accion: "READ" })
  const cuentas = await prisma.cuentaBancaria.findMany({
    where: { empresaId, activo: true },
    orderBy: { banco: "asc" },
  })
  return cuentas.map(serializeCuenta)
}

export async function createCuenta(data: CuentaInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_bancaria", accion: "CREATE" })
  const parsed = cuentaSchema.parse(data)

  const cuenta = await prisma.cuentaBancaria.create({
    data: {
      empresaId,
      banco: parsed.banco,
      numeroCuenta: parsed.numeroCuenta,
      tipo: parsed.tipo,
      saldoInicial: parsed.saldoInicial,
      saldoActual: parsed.saldoInicial,
      moneda: parsed.moneda,
    },
  })

  revalidatePath("/tesoreria")
  return { success: true, cuenta: serializeCuenta(cuenta) }
}

export async function updateCuenta(id: string, data: CuentaInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_bancaria", accion: "UPDATE" })
  const parsed = cuentaSchema.parse(data)

  const existing = await prisma.cuentaBancaria.findFirst({
    where: { id, empresaId, activo: true },
  })
  if (!existing) throw new Error("Cuenta no encontrada")

  const cuenta = await prisma.cuentaBancaria.update({
    where: { id },
    data: {
      banco: parsed.banco,
      numeroCuenta: parsed.numeroCuenta,
      tipo: parsed.tipo,
      moneda: parsed.moneda,
    },
  })

  revalidatePath("/tesoreria")
  return { success: true, cuenta: serializeCuenta(cuenta) }
}

export async function deleteCuenta(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_bancaria", accion: "DELETE" })

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id, empresaId },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")

  const movCount = await prisma.movimientoBancario.count({ where: { cuentaId: id } })
  if (movCount > 0) {
    await prisma.cuentaBancaria.update({
      where: { id },
      data: { activo: false },
    })
  } else {
    await prisma.cuentaBancaria.delete({ where: { id } })
  }

  revalidatePath("/tesoreria")
  return { success: true }
}

export async function getMovimientos(cuentaId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "READ" })
  const movimientos = await prisma.movimientoBancario.findMany({
    where: { cuentaId },
    orderBy: { fecha: "desc" },
  })
  return movimientos.map(serializeMovimiento)
}

export async function createMovimiento(data: MovimientoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "CREATE" })
  const parsed = movimientoSchema.parse(data)

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: parsed.cuentaId, empresaId },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")

  const monto = parsed.monto
  const saldoDelta = parsed.tipo === "INGRESO" ? monto : -monto

  const [movimiento] = await prisma.$transaction([
    prisma.movimientoBancario.create({
      data: {
        cuentaId: parsed.cuentaId,
        tipo: parsed.tipo,
        fecha: new Date(parsed.fecha),
        monto,
        descripcion: parsed.descripcion || null,
        referencia: parsed.referencia || null,
      },
    }),
    prisma.cuentaBancaria.update({
      where: { id: parsed.cuentaId },
      data: { saldoActual: { increment: saldoDelta } },
    }),
  ])

  revalidatePath("/tesoreria")
  return { success: true, movimiento: serializeMovimiento(movimiento) }
}

export async function updateMovimiento(id: string, data: MovimientoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "UPDATE" })
  const parsed = movimientoSchema.parse(data)

  const oldMov = await prisma.movimientoBancario.findUnique({ where: { id } })
  if (!oldMov) throw new Error("Movimiento no encontrado")

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: parsed.cuentaId, empresaId },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")

  const oldImpact = oldMov.tipo === "INGRESO" ? Number(oldMov.monto) : -Number(oldMov.monto)
  const newImpact = parsed.tipo === "INGRESO" ? parsed.monto : -parsed.monto
  const saldoAjuste = newImpact - oldImpact

  const [movimiento] = await prisma.$transaction([
    prisma.movimientoBancario.update({
      where: { id },
      data: {
        tipo: parsed.tipo,
        fecha: new Date(parsed.fecha),
        monto: parsed.monto,
        descripcion: parsed.descripcion || null,
        referencia: parsed.referencia || null,
      },
    }),
    prisma.cuentaBancaria.update({
      where: { id: parsed.cuentaId },
      data: { saldoActual: { increment: saldoAjuste } },
    }),
  ])

  revalidatePath("/tesoreria")
  return { success: true, movimiento: serializeMovimiento(movimiento) }
}

export async function deleteMovimiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "DELETE" })
  const oldMov = await prisma.movimientoBancario.findUnique({ where: { id } })
  if (!oldMov) throw new Error("Movimiento no encontrado")

  const impact = oldMov.tipo === "INGRESO" ? Number(oldMov.monto) : -Number(oldMov.monto)

  await prisma.$transaction([
    prisma.movimientoBancario.delete({ where: { id } }),
    prisma.cuentaBancaria.update({
      where: { id: oldMov.cuentaId },
      data: { saldoActual: { increment: -impact } },
    }),
  ])

  revalidatePath("/tesoreria")
  return { success: true }
}

export async function conciliarMovimiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "UPDATE" })
  const mov = await prisma.movimientoBancario.findUnique({ where: { id } })
  if (!mov) throw new Error("Movimiento no encontrado")
  if (mov.estado !== "PENDIENTE") throw new Error("Solo se pueden conciliar movimientos pendientes")

  const updated = await prisma.movimientoBancario.update({
    where: { id },
    data: {
      estado: "CONCILIADO",
      fechaConciliacion: new Date(),
    },
  })

  revalidatePath("/tesoreria")
  return { success: true, movimiento: serializeMovimiento(updated) }
}
