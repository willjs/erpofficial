"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { serializar } from "@/lib/utils"
import { verificarPermiso } from "@/lib/permisos"

export async function generarNominasMasivo(data: {
  periodo: string
  fechaInicio: string
  fechaFin: string
  fechaPago?: string
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "CREATE" })

  const empleados = await prisma.empleado.findMany({
    where: { empresaId, estado: "ACTIVO" },
    select: { id: true, nombre: true, apellido: true, salario: true },
  })

  if (empleados.length === 0) throw new Error("No hay empleados activos")

  const existing = await prisma.nomina.findFirst({
    where: {
      empleado: { empresaId },
      periodo: data.periodo,
      estado: { not: "CANCELADA" },
    },
    select: { id: true },
  })
  if (existing) throw new Error(`Ya existen nóminas para el período "${data.periodo}"`)

  const created = await prisma.$transaction(async (tx: any) => {
    const results = []
    for (const emp of empleados) {
      const salario = Number(emp.salario)
      const nomina = await tx.nomina.create({
        data: {
          empleadoId: emp.id,
          periodo: data.periodo,
          fechaInicio: new Date(data.fechaInicio),
          fechaFin: new Date(data.fechaFin),
          fechaPago: data.fechaPago ? new Date(data.fechaPago) : null,
          salarioBase: salario,
          totalDevengado: salario,
          totalPagar: salario,
        },
      })
      await tx.nominaDetalle.create({
        data: {
          nominaId: nomina.id,
          concepto: "Sueldo base",
          tipo: "DEVENGADO",
          monto: salario,
        },
      })
      results.push(nomina)
    }
    return results
  })

  revalidatePath("/nomina")
  return { total: created.length, empleados: empleados.length }
}

export async function getResumenNominas(periodo?: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "READ" })

  const where: any = { empleado: { empresaId } }
  if (periodo) where.periodo = periodo

  const nominas = await prisma.nomina.findMany({
    where,
    select: {
      periodo: true,
      totalDevengado: true,
      totalDeducciones: true,
      totalPagar: true,
      estado: true,
      empleado: { select: { id: true } },
    },
  })

  const resumen: Record<string, { totalDevengado: number; totalDeducciones: number; totalPagar: number; count: number; pagadas: number }> = {}
  for (const n of nominas) {
    const p = n.periodo
    if (!resumen[p]) resumen[p] = { totalDevengado: 0, totalDeducciones: 0, totalPagar: 0, count: 0, pagadas: 0 }
    resumen[p].totalDevengado += Number(n.totalDevengado)
    resumen[p].totalDeducciones += Number(n.totalDeducciones)
    resumen[p].totalPagar += Number(n.totalPagar)
    resumen[p].count++
    if (n.estado === "PAGADA") resumen[p].pagadas++
  }

  return Object.entries(resumen).map(([periodo, data]) => ({ periodo, ...data }))
}

const nominaSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  periodo: z.string().min(1, "Período requerido"),
  fechaInicio: z.string().min(1, "Fecha inicio requerida"),
  fechaFin: z.string().min(1, "Fecha fin requerida"),
  fechaPago: z.string().optional(),
  salarioBase: z.string().min(1, "Salario base requerido"),
})

export type NominaFormData = z.infer<typeof nominaSchema>

export async function getNominas() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "READ" })

  const nominas = await prisma.nomina.findMany({
    where: { empleado: { empresaId } },
    include: { empleado: { select: { id: true, nombre: true, apellido: true, codigo: true } } },
    orderBy: { createdAt: "desc" },
  })

  return nominas.map((n) => ({
    ...n,
    totalPagar: Number(n.totalPagar),
    salarioBase: Number(n.salarioBase),
    totalDevengado: Number(n.totalDevengado),
    totalDeducciones: Number(n.totalDeducciones),
  }))
}

export async function getNomina(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "READ" })

  const nomina = await prisma.nomina.findFirst({
    where: { id, empleado: { empresaId } },
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true, codigo: true } },
      detalles: { orderBy: { id: "asc" } },
    },
  })

  if (!nomina) throw new Error("Nómina no encontrada")

  return {
    ...nomina,
    totalPagar: Number(nomina.totalPagar),
    salarioBase: Number(nomina.salarioBase),
    totalDevengado: Number(nomina.totalDevengado),
    totalDeducciones: Number(nomina.totalDeducciones),
    detalles: nomina.detalles.map((d) => ({ ...d, monto: Number(d.monto) })),
  }
}

export async function createNomina(data: NominaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "CREATE" })

  const empleado = await prisma.empleado.findFirst({
    where: { id: data.empleadoId, empresaId },
  })
  if (!empleado) throw new Error("Empleado no encontrado")

  const salario = parseFloat(data.salarioBase)

  const nomina = await prisma.nomina.create({
    data: {
      empleadoId: data.empleadoId,
      periodo: data.periodo,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      fechaPago: data.fechaPago ? new Date(data.fechaPago) : null,
      salarioBase: salario,
      totalDevengado: salario,
      totalPagar: salario,
    },
  })

  await prisma.nominaDetalle.create({
    data: {
      nominaId: nomina.id,
      concepto: "Sueldo base",
      tipo: "DEVENGADO",
      monto: salario,
    },
  })

  revalidatePath("/nomina")
  return serializar(nomina)
}

export async function updateNomina(id: string, data: NominaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "UPDATE" })

  const nomina = await prisma.nomina.findFirst({
    where: { id, empleado: { empresaId } },
  })
  if (!nomina) throw new Error("Nómina no encontrada")
  if (nomina.estado !== "BORRADOR") throw new Error("Solo se puede editar nóminas en borrador")

  const updated = await prisma.nomina.update({
    where: { id },
    data: {
      empleadoId: data.empleadoId,
      periodo: data.periodo,
      fechaInicio: new Date(data.fechaInicio),
      fechaFin: new Date(data.fechaFin),
      fechaPago: data.fechaPago ? new Date(data.fechaPago) : null,
      salarioBase: parseFloat(data.salarioBase),
    },
  })

  revalidatePath("/nomina")
  return serializar(updated)
}

export async function deleteNomina(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "DELETE" })

  const nomina = await prisma.nomina.findFirst({
    where: { id, empleado: { empresaId } },
  })
  if (!nomina) throw new Error("Nómina no encontrada")
  if (nomina.estado !== "BORRADOR") throw new Error("Solo se puede eliminar nóminas en borrador")

  await prisma.nomina.delete({ where: { id } })
  revalidatePath("/nomina")
}

const DEDUCCIONES_AUTOMATICAS = [
  { concepto: "ISR", porcentaje: 0.10 },
  { concepto: "Salud", porcentaje: 0.04 },
  { concepto: "Pensión", porcentaje: 0.04 },
]

export async function calcularNomina(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "UPDATE" })

  const nomina = await prisma.nomina.findFirst({
    where: { id, empleado: { empresaId } },
    include: { detalles: true },
  })
  if (!nomina) throw new Error("Nómina no encontrada")

  const conceptosExistentes = new Set(nomina.detalles.map((d) => d.concepto))

  const totalDevengado = nomina.detalles
    .filter((d) => d.tipo === "DEVENGADO")
    .reduce((sum, d) => sum + Number(d.monto), 0)

  const deduccionesAAgregar = DEDUCCIONES_AUTOMATICAS.filter(
    (d) => !conceptosExistentes.has(d.concepto)
  )

  if (deduccionesAAgregar.length > 0) {
    await prisma.$transaction(async (tx: any) => {
      for (const ded of deduccionesAAgregar) {
        await tx.nominaDetalle.create({
          data: {
            nominaId: id,
            concepto: ded.concepto,
            tipo: "DEDUCCION",
            monto: Math.round(totalDevengado * ded.porcentaje * 100) / 100,
            formula: `${ded.concepto.toLowerCase()} = devengado × ${(ded.porcentaje * 100).toFixed(0)}%`,
          },
        })
      }
    })
  }

  const detallesActualizados = await prisma.nominaDetalle.findMany({ where: { nominaId: id } })

  const totalDevengadoFinal = detallesActualizados
    .filter((d) => d.tipo === "DEVENGADO")
    .reduce((sum, d) => sum + Number(d.monto), 0)

  const totalDeduccionesFinal = detallesActualizados
    .filter((d) => d.tipo === "DEDUCCION")
    .reduce((sum, d) => sum + Number(d.monto), 0)

  const totalPagar = totalDevengadoFinal - totalDeduccionesFinal

  const updated = await prisma.nomina.update({
    where: { id },
    data: {
      totalDevengado: totalDevengadoFinal,
      totalDeducciones: totalDeduccionesFinal,
      totalPagar,
      estado: "CALCULADA",
    },
  })

  revalidatePath("/nomina")
  return serializar(updated)
}

export async function aprobarNomina(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "UPDATE" })

  const nomina = await prisma.nomina.findFirst({
    where: { id, empleado: { empresaId } },
  })
  if (!nomina) throw new Error("Nómina no encontrada")
  if (nomina.estado !== "CALCULADA") throw new Error("Solo se puede aprobar nóminas calculadas")

  const updated = await prisma.nomina.update({
    where: { id },
    data: { estado: "APROBADA" },
  })

  revalidatePath("/nomina")
  return serializar(updated)
}

export async function pagarNomina(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina", accion: "UPDATE" })

  const nomina = await prisma.nomina.findFirst({
    where: { id, empleado: { empresaId } },
  })
  if (!nomina) throw new Error("Nómina no encontrada")
  if (nomina.estado !== "APROBADA") throw new Error("Solo se puede pagar nóminas aprobadas")

  const updated = await prisma.nomina.update({
    where: { id },
    data: { estado: "PAGADA", fechaPago: new Date() },
  })

  revalidatePath("/nomina")
  return serializar(updated)
}

// ---- NominaDetalle ----

const detalleSchema = z.object({
  nominaId: z.string().min(1),
  concepto: z.string().min(1, "Concepto requerido"),
  tipo: z.enum(["DEVENGADO", "DEDUCCION"]),
  monto: z.string().min(1, "Monto requerido"),
  formula: z.string().optional(),
})

export async function getNominaDetalles(nominaId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina_detalle", accion: "READ" })

  const nomina = await prisma.nomina.findFirst({
    where: { id: nominaId, empleado: { empresaId } },
  })
  if (!nomina) throw new Error("Nómina no encontrada")

  const detalles = await prisma.nominaDetalle.findMany({
    where: { nominaId },
    orderBy: { id: "asc" },
  })

  return detalles.map((d) => ({ ...d, monto: Number(d.monto) }))
}

export async function createNominaDetalle(data: z.infer<typeof detalleSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina_detalle", accion: "CREATE" })

  const nomina = await prisma.nomina.findFirst({
    where: { id: data.nominaId, empleado: { empresaId } },
  })
  if (!nomina) throw new Error("Nómina no encontrada")
  if (nomina.estado !== "BORRADOR") throw new Error("Solo se puede modificar nóminas en borrador")

  const detalle = await prisma.nominaDetalle.create({
    data: {
      nominaId: data.nominaId,
      concepto: data.concepto,
      tipo: data.tipo,
      monto: parseFloat(data.monto),
      formula: data.formula || null,
    },
  })

  revalidatePath("/nomina")
  return { ...detalle, monto: Number(detalle.monto) }
}

export async function updateNominaDetalle(id: string, data: z.infer<typeof detalleSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina_detalle", accion: "UPDATE" })

  const detalle = await prisma.nominaDetalle.findUnique({
    where: { id },
    include: { nomina: { include: { empleado: true } } },
  })
  if (!detalle) throw new Error("Detalle no encontrado")
  if (detalle.nomina.empleado.empresaId !== empresaId) throw new Error("Acceso denegado")
  if (detalle.nomina.estado !== "BORRADOR") throw new Error("Solo se puede modificar nóminas en borrador")

  const updated = await prisma.nominaDetalle.update({
    where: { id },
    data: {
      concepto: data.concepto,
      tipo: data.tipo,
      monto: parseFloat(data.monto),
      formula: data.formula || null,
    },
  })

  revalidatePath("/nomina")
  return { ...updated, monto: Number(updated.monto) }
}

export async function deleteNominaDetalle(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "nomina_detalle", accion: "DELETE" })

  const detalle = await prisma.nominaDetalle.findUnique({
    where: { id },
    include: { nomina: { include: { empleado: true } } },
  })
  if (!detalle) throw new Error("Detalle no encontrado")
  if (detalle.nomina.empleado.empresaId !== empresaId) throw new Error("Acceso denegado")
  if (detalle.nomina.estado !== "BORRADOR") throw new Error("Solo se puede modificar nóminas en borrador")

  await prisma.nominaDetalle.delete({ where: { id } })
  revalidatePath("/nomina")
}

export async function getEmpleados() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "READ" })

  const empleados = await prisma.empleado.findMany({
    where: { empresaId, estado: "ACTIVO" },
    select: { id: true, nombre: true, apellido: true, codigo: true, salario: true },
    orderBy: { nombre: "asc" },
  })

  return empleados.map((e) => ({ ...e, salario: Number(e.salario) }))
}
