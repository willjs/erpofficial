"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const proyectoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  departamentoId: z.string().nullable().optional(),
  fechaInicio: z.string().nullable().optional(),
  fechaFin: z.string().nullable().optional(),
  presupuesto: z.coerce.number().nullable().optional(),
  estado: z.enum(["PLANIFICADO", "EN_CURSO", "COMPLETADO", "CANCELADO"]).optional(),
})

const tareaSchema = z.object({
  proyectoId: z.string().nullable().optional(),
  titulo: z.string().min(1, "Título requerido"),
  descripcion: z.string().nullable().optional(),
  estado: z.enum(["PENDIENTE", "EN_PROGRESO", "COMPLETADA", "CANCELADA"]).optional(),
  prioridad: z.enum(["BAJA", "MEDIA", "ALTA", "CRITICA"]).optional(),
  asignadoAId: z.string().nullable().optional(),
  fechaVencimiento: z.string().nullable().optional(),
})

export type ProyectoFormData = z.infer<typeof proyectoSchema>
export type TareaFormData = z.infer<typeof tareaSchema>

export async function getProyectos(params?: {
  departamentoId?: string
  estado?: string
  search?: string
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proyecto", accion: "READ" })
  const where: any = { empresaId }
  if (params?.departamentoId) where.departamentoId = params.departamentoId
  if (params?.estado) where.estado = params.estado
  if (params?.search) where.nombre = { contains: params.search }
  return prisma.proyecto.findMany({
    where,
    include: {
      departamento: { select: { id: true, nombre: true } },
      _count: { select: { tareas: true } },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getProyecto(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proyecto", accion: "READ" })
  return prisma.proyecto.findFirst({
    where: { id, empresaId },
    include: {
      departamento: { select: { id: true, nombre: true } },
      tareas: {
        include: {
          asignadoA: { select: { id: true, nombre: true, apellido: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function createProyecto(data: ProyectoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proyecto", accion: "CREATE" })
  const parsed = proyectoSchema.safeParse(data)
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten().fieldErrors as any }
  const existing = await prisma.proyecto.findFirst({
    where: { nombre: parsed.data.nombre, empresaId },
  })
  if (existing) return { success: false as const, error: "Ya existe un proyecto con ese nombre" }
  const { departamentoId, fechaInicio, fechaFin, ...rest } = parsed.data
  const proyecto = await prisma.proyecto.create({
    data: {
      ...rest,
      empresaId,
      departamentoId: departamentoId || null,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
    },
    include: {
      departamento: { select: { id: true, nombre: true } },
      _count: { select: { tareas: true } },
    },
  })
  revalidatePath("/tareas")
  return { success: true as const, data: proyecto }
}

export async function updateProyecto(id: string, data: ProyectoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proyecto", accion: "UPDATE" })
  const existing = await prisma.proyecto.findFirst({ where: { id, empresaId } })
  if (!existing) return { success: false as const, error: "Proyecto no encontrado" }
  const parsed = proyectoSchema.safeParse(data)
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten().fieldErrors as any }
  const { departamentoId, fechaInicio, fechaFin, ...rest } = parsed.data
  const proyecto = await prisma.proyecto.update({
    where: { id },
    data: {
      ...rest,
      departamentoId: departamentoId || null,
      fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      fechaFin: fechaFin ? new Date(fechaFin) : null,
    },
    include: {
      departamento: { select: { id: true, nombre: true } },
      _count: { select: { tareas: true } },
    },
  })
  revalidatePath("/tareas")
  return { success: true as const, data: proyecto }
}

export async function deleteProyecto(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proyecto", accion: "DELETE" })
  const existing = await prisma.proyecto.findFirst({ where: { id, empresaId } })
  if (!existing) return { success: false as const, error: "Proyecto no encontrado" }
  await prisma.proyecto.delete({ where: { id } })
  revalidatePath("/tareas")
  return { success: true as const }
}

export async function getTareas(params?: {
  proyectoId?: string
  estado?: string
  prioridad?: string
  search?: string
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tarea", accion: "READ" })
  const proyectoIds = (
    await prisma.proyecto.findMany({ where: { empresaId }, select: { id: true } })
  ).map((p) => p.id)
  const where: any = {
    OR: [{ proyectoId: { in: proyectoIds } }, { creadoPorId: userId }],
  }
  if (params?.proyectoId) where.proyectoId = params.proyectoId
  if (params?.estado) where.estado = params.estado
  if (params?.prioridad) where.prioridad = params.prioridad
  if (params?.search) where.titulo = { contains: params.search }
  return prisma.tarea.findMany({
    where,
    include: {
      proyecto: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, nombre: true, apellido: true } },
      _count: { select: { comentarios: true } },
    },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getTarea(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tarea", accion: "READ" })
  return prisma.tarea.findFirst({
    where: { id, proyecto: { empresaId } },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, nombre: true, apellido: true } },
      creadoPor: { select: { id: true, nombre: true, apellido: true } },
      comentarios: {
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function createTarea(data: TareaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tarea", accion: "CREATE" })
  const parsed = tareaSchema.safeParse(data)
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten().fieldErrors as any }
  if (parsed.data.proyectoId) {
    const proyecto = await prisma.proyecto.findFirst({ where: { id: parsed.data.proyectoId, empresaId } })
    if (!proyecto) return { success: false as const, error: "Proyecto no encontrado" }
  }
  const existing = await prisma.tarea.findFirst({
    where: { titulo: parsed.data.titulo, proyectoId: parsed.data.proyectoId ?? undefined },
  })
  if (existing) return { success: false as const, error: "Ya existe una tarea con ese título en el proyecto" }
  const { proyectoId, asignadoAId, fechaVencimiento, ...rest } = parsed.data
  const tarea = await prisma.tarea.create({
    data: {
      ...rest,
      proyectoId: proyectoId || null,
      asignadoAId: asignadoAId || null,
      creadoPorId: userId,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      estado: rest.estado || "PENDIENTE",
      prioridad: rest.prioridad || "MEDIA",
    },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, nombre: true, apellido: true } },
      _count: { select: { comentarios: true } },
    },
  })
  revalidatePath("/tareas")
  return { success: true as const, data: tarea }
}

export async function updateTarea(id: string, data: TareaFormData) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tarea", accion: "UPDATE" })
  const existing = await prisma.tarea.findFirst({
    where: { id, OR: [{ proyecto: { empresaId } }, { creadoPorId: userId }] },
  })
  if (!existing) return { success: false as const, error: "Tarea no encontrada" }
  const parsed = tareaSchema.safeParse(data)
  if (!parsed.success) return { success: false as const, error: parsed.error.flatten().fieldErrors as any }
  const { proyectoId, asignadoAId, fechaVencimiento, ...rest } = parsed.data
  const updateData: any = {
    ...rest,
    proyectoId: proyectoId || null,
    asignadoAId: asignadoAId || null,
    fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
  }
  if (parsed.data.estado === "COMPLETADA" && existing.estado !== "COMPLETADA") {
    updateData.fechaCompletada = new Date()
  }
  const tarea = await prisma.tarea.update({
    where: { id },
    data: updateData,
    include: {
      proyecto: { select: { id: true, nombre: true } },
      asignadoA: { select: { id: true, nombre: true, apellido: true } },
      _count: { select: { comentarios: true } },
    },
  })
  revalidatePath("/tareas")
  return { success: true as const, data: tarea }
}

export async function deleteTarea(id: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tarea", accion: "DELETE" })
  const existing = await prisma.tarea.findFirst({
    where: { id, OR: [{ proyecto: { empresaId } }, { creadoPorId: userId }] },
  })
  if (!existing) return { success: false as const, error: "Tarea no encontrada" }
  await prisma.tarea.delete({ where: { id } })
  revalidatePath("/tareas")
  return { success: true as const }
}

export async function getComentarios(tareaId: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "comentario", accion: "READ" })
  const tarea = await prisma.tarea.findFirst({
    where: { id: tareaId, OR: [{ proyecto: { empresaId } }, { creadoPorId: userId }] },
    select: { id: true },
  })
  if (!tarea) return []
  return prisma.comentarioTarea.findMany({
    where: { tareaId },
    orderBy: { createdAt: "desc" },
  })
}

export async function createComentario(tareaId: string, contenido: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "comentario", accion: "CREATE" })
  const tarea = await prisma.tarea.findFirst({
    where: { id: tareaId, OR: [{ proyecto: { empresaId } }, { creadoPorId: userId }] },
    select: { id: true },
  })
  if (!tarea) return { success: false as const, error: "Tarea no encontrada" }
  const comentario = await prisma.comentarioTarea.create({
    data: { tareaId, contenido, usuarioId: userId },
  })
  revalidatePath("/tareas")
  return { success: true as const, data: comentario }
}

export async function getUsuarios() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "READ" })
  return prisma.usuario.findMany({
    where: { empresaId, activo: true },
    select: { id: true, nombre: true, apellido: true },
    orderBy: { nombre: "asc" },
  })
}

export async function getDepartamentos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "departamento", accion: "READ" })
  return prisma.departamento.findMany({
    where: { empresaId, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  })
}
