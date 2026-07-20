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

export async function getPagosByCuentaId(cuentaId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_bancaria", accion: "READ" })
  const pagos = await prisma.pago.findMany({
    where: { cuentaBancariaId: cuentaId, empresaId },
    include: {
      proveedor: { select: { razonSocial: true, nit: true } },
      cuentaPagar: { select: { numeroFactura: true, valor: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return pagos.map((p) => ({
    ...p,
    valor: Number(p.valor),
    fechaPago: p.fechaPago instanceof Date ? p.fechaPago.toISOString() : p.fechaPago,
    createdAt: p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
    updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
    cuentaPagar: p.cuentaPagar ? { ...p.cuentaPagar, valor: Number(p.cuentaPagar.valor) } : null,
  }))
}

export async function ajustarSaldoCuenta(cuentaId: string, monto: number, descripcion?: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_bancaria", accion: "UPDATE" })
  if (!monto || monto <= 0) throw new Error("El monto debe ser mayor a 0")

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, empresaId, activo: true },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")

  await prisma.$transaction(async (tx: any) => {
    await tx.movimientoBancario.create({
      data: {
        cuentaId,
        tipo: "INGRESO",
        fecha: new Date(),
        monto,
        descripcion: descripcion || "Ajuste de saldo",
        referencia: null,
      },
    })
    await tx.cuentaBancaria.update({
      where: { id: cuentaId },
      data: { saldoActual: { increment: monto } },
    })
  })

  revalidatePath("/tesoreria")
  return { success: true }
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
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaId, empresaId },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")
  const movimientos = await prisma.movimientoBancario.findMany({
    where: { cuentaId },
    orderBy: { fecha: "desc" },
    include: { cuenta: { select: { banco: true, numeroCuenta: true } } },
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

  const movimiento = await prisma.$transaction(async (tx: any) => {
    const mov = await tx.movimientoBancario.create({
      data: {
        cuentaId: parsed.cuentaId,
        tipo: parsed.tipo,
        fecha: new Date(parsed.fecha),
        monto,
        descripcion: parsed.descripcion || null,
        referencia: parsed.referencia || null,
      },
    })
    await tx.cuentaBancaria.update({
      where: { id: parsed.cuentaId },
      data: { saldoActual: { increment: saldoDelta } },
    })
    return mov
  })

  revalidatePath("/tesoreria")
  return { success: true, movimiento: serializeMovimiento(movimiento) }
}

export async function updateMovimiento(id: string, data: MovimientoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "UPDATE" })
  const parsed = movimientoSchema.parse(data)

  const oldMov = await prisma.movimientoBancario.findUnique({ where: { id } })
  if (!oldMov) throw new Error("Movimiento no encontrado")

  const oldCuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: oldMov.cuentaId, empresaId },
  })
  if (!oldCuenta) throw new Error("Cuenta original no encontrada")

  const newCuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: parsed.cuentaId, empresaId },
  })
  if (!newCuenta) throw new Error("Cuenta destino no encontrada")

  const oldImpact = oldMov.tipo === "INGRESO" ? Number(oldMov.monto) : -Number(oldMov.monto)
  const newImpact = parsed.tipo === "INGRESO" ? parsed.monto : -parsed.monto
  const saldoAjuste = newImpact - oldImpact
  const cambiaCuenta = oldMov.cuentaId !== parsed.cuentaId

  const movimiento = await prisma.$transaction(async (tx: any) => {
    const mov = await tx.movimientoBancario.update({
      where: { id },
      data: {
        tipo: parsed.tipo,
        fecha: new Date(parsed.fecha),
        monto: parsed.monto,
        descripcion: parsed.descripcion || null,
        referencia: parsed.referencia || null,
      },
    })

    if (cambiaCuenta) {
      await tx.cuentaBancaria.update({
        where: { id: oldMov.cuentaId },
        data: { saldoActual: { decrement: oldImpact } },
      })
      await tx.cuentaBancaria.update({
        where: { id: parsed.cuentaId },
        data: { saldoActual: { increment: newImpact } },
      })
    } else {
      await tx.cuentaBancaria.update({
        where: { id: parsed.cuentaId },
        data: { saldoActual: { increment: saldoAjuste } },
      })
    }
    return mov
  })

  revalidatePath("/tesoreria")
  return { success: true, movimiento: serializeMovimiento(movimiento) }
}

export async function deleteMovimiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "DELETE" })
  const oldMov = await prisma.movimientoBancario.findUnique({ where: { id } })
  if (!oldMov) throw new Error("Movimiento no encontrado")

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: oldMov.cuentaId, empresaId },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")

  const impact = oldMov.tipo === "INGRESO" ? Number(oldMov.monto) : -Number(oldMov.monto)

  await prisma.$transaction(async (tx: any) => {
    await tx.movimientoBancario.delete({ where: { id } })
    await tx.cuentaBancaria.update({
      where: { id: oldMov.cuentaId },
      data: { saldoActual: { increment: -impact } },
    })
  })

  revalidatePath("/tesoreria")
  return { success: true }
}

export async function conciliarMovimiento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_bancario", accion: "CONCILIAR" })
  const mov = await prisma.movimientoBancario.findUnique({ where: { id } })
  if (!mov) throw new Error("Movimiento no encontrado")

  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: mov.cuentaId, empresaId },
  })
  if (!cuenta) throw new Error("Cuenta no encontrada")

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
