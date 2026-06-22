"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const presupuestoSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  tipo: z.enum(["OPERATIVO", "CAPEX", "PROYECTO", "GENERAL"]),
  año: z.coerce.number().int().min(2000, "Año inválido"),
  mes: z.coerce.number().int().min(1).max(12).optional().nullable(),
  notas: z.string().optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    centroCostosId: z.string().optional().nullable(),
    cuentaContableId: z.string().optional().nullable(),
    descripcion: z.string().min(1, "Descripción requerida"),
    valorPresupuestado: z.coerce.number().positive("Valor debe ser positivo"),
    notas: z.string().optional().nullable(),
  })),
})

export type PresupuestoFormData = z.infer<typeof presupuestoSchema>

export async function getPresupuestos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "presupuesto", accion: "READ" })
  const data = await prisma.presupuesto.findMany({
    where: { empresaId },
    include: {
      items: true,
      creadoPor: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { año: "desc" },
  })
  return data.map((p) => ({
    ...p,
    totalPresupuestado: Number(p.items.reduce((s, i) => s + Number(i.valorPresupuestado), 0)),
    itemCount: p.items.length,
    creadoPor: p.creadoPor,
  }))
}

export async function getPresupuesto(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "presupuesto", accion: "READ" })
  const data = await prisma.presupuesto.findFirst({
    where: { id, empresaId },
    include: {
      items: {
        include: {
          centroCostos: { select: { id: true, codigo: true, nombre: true } },
          cuentaContable: { select: { id: true, codigo: true, nombre: true } },
        },
      },
      revisiones: {
        include: { aprobadoPor: { select: { id: true, nombre: true, apellido: true } } },
        orderBy: { nivel: "asc" },
      },
      creadoPor: { select: { id: true, nombre: true, apellido: true } },
    },
  })
  if (!data) throw new Error("Presupuesto no encontrado")
  return {
    ...data,
    items: data.items.map((i) => ({
      ...i,
      valorPresupuestado: Number(i.valorPresupuestado),
    })),
  }
}

export async function createPresupuesto(data: PresupuestoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "presupuesto", accion: "CREATE" })
  const validated = presupuestoSchema.parse(data)

  const existing = await prisma.presupuesto.findFirst({ where: { empresaId, codigo: validated.codigo } })
  if (existing) throw new Error("Ya existe un presupuesto con ese código")

  const result = await prisma.$transaction(async (tx: any) => {
    const presupuesto = await tx.presupuesto.create({
      data: {
        empresaId,
        codigo: validated.codigo,
        nombre: validated.nombre,
        descripcion: validated.descripcion,
        tipo: validated.tipo,
        año: validated.año,
        mes: validated.mes ?? null,
        notas: validated.notas,
        creadoPorId: userId,
        items: {
          create: validated.items.map((item) => ({
            centroCostosId: item.centroCostosId ?? null,
            cuentaContableId: item.cuentaContableId ?? null,
            descripcion: item.descripcion,
            valorPresupuestado: item.valorPresupuestado,
            notas: item.notas ?? null,
          })),
        },
      },
      include: { items: true },
    })
    return presupuesto
  })

  revalidatePath("/presupuestos")
  return result
}

export async function updatePresupuesto(id: string, data: PresupuestoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "presupuesto", accion: "UPDATE" })
  const validated = presupuestoSchema.parse(data)

  const existing = await prisma.presupuesto.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Presupuesto no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo se puede editar en borrador")
  const dup = await prisma.presupuesto.findFirst({ where: { empresaId, codigo: validated.codigo, id: { not: id } } })
  if (dup) throw new Error("Ya existe otro presupuesto con ese código")

  const result = await prisma.$transaction(async (tx: any) => {
    await tx.presupuestoItem.deleteMany({ where: { presupuestoId: id } })

    return tx.presupuesto.update({
      where: { id },
      data: {
        codigo: validated.codigo,
        nombre: validated.nombre,
        descripcion: validated.descripcion,
        tipo: validated.tipo,
        año: validated.año,
        mes: validated.mes ?? null,
        notas: validated.notas,
        items: {
          create: validated.items.map((item) => ({
            centroCostosId: item.centroCostosId ?? null,
            cuentaContableId: item.cuentaContableId ?? null,
            descripcion: item.descripcion,
            valorPresupuestado: item.valorPresupuestado,
            notas: item.notas ?? null,
          })),
        },
      },
      include: { items: true },
    })
  })

  revalidatePath("/presupuestos")
  return result
}

export async function deletePresupuesto(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "presupuesto", accion: "DELETE" })
  const existing = await prisma.presupuesto.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Presupuesto no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo se puede eliminar en borrador")

  await prisma.presupuesto.delete({ where: { id } })
  revalidatePath("/presupuestos")
}

export async function cambiarEstadoPresupuesto(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "presupuesto", accion: "UPDATE" })
  const existing = await prisma.presupuesto.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Presupuesto no encontrado")

  const transiciones: Record<string, string[]> = {
    BORRADOR: ["EN_REVISION"],
    EN_REVISION: ["APROBADO", "RECHAZADO"],
    APROBADO: ["CERRADO"],
    RECHAZADO: ["BORRADOR"],
  }

  const permitidos = transiciones[existing.estado] ?? []
  if (!permitidos.includes(estado)) {
    throw new Error(`No se puede pasar de ${existing.estado} a ${estado}`)
  }

  const updateData: any = { estado }
  if (estado === "APROBADO") updateData.fechaAprobacion = new Date()

  await prisma.presupuesto.update({ where: { id }, data: updateData })
  revalidatePath("/presupuestos")
}

export async function getCentrosCostos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "READ" })
  return prisma.centroCostos.findMany({
    where: { empresaId, activo: true },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: "asc" },
  })
}

export async function getCuentasContables() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "plan_cuenta", accion: "READ" })
  return prisma.planCuenta.findMany({
    where: { empresaId, activo: true, nivel: { gte: 3 } },
    select: { id: true, codigo: true, nombre: true },
    orderBy: { codigo: "asc" },
  })
}
