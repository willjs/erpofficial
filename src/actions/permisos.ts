"use server"

import { verifySession } from "@/lib/dal"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { verificarPermiso } from "@/lib/permisos"

// ─── TipoPermiso ────────────────────────────────────────

export async function getTiposPermiso() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tipo_permiso", accion: "READ" })
  return prisma.tipoPermiso.findMany({
    where: { empresaId },
    orderBy: { nombre: "asc" },
  })
}

const tipoPermisoCreateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  diasMaximos: z.coerce.number().int().positive().optional().nullable(),
  remunerado: z.boolean().default(true),
})

const tipoPermisoUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  diasMaximos: z.coerce.number().int().positive().optional().nullable(),
  remunerado: z.boolean().default(true),
})

export async function createTipoPermiso(data: z.infer<typeof tipoPermisoCreateSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tipo_permiso", accion: "CREATE" })
  const validated = tipoPermisoCreateSchema.parse(data)
  const existing = await prisma.tipoPermiso.findFirst({
    where: { nombre: validated.nombre, empresaId },
  })
  if (existing) throw new Error("Ya existe un tipo de permiso con ese nombre")
  const tipo = await prisma.tipoPermiso.create({
    data: {
      nombre: validated.nombre,
      descripcion: validated.descripcion ?? null,
      diasMaximos: validated.diasMaximos ?? null,
      remunerado: validated.remunerado,
      empresaId,
    },
  })
  revalidatePath("/permisos")
  return tipo
}

export async function updateTipoPermiso(id: string, data: z.infer<typeof tipoPermisoUpdateSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tipo_permiso", accion: "UPDATE" })
  const validated = tipoPermisoUpdateSchema.parse(data)
  const existing = await prisma.tipoPermiso.findFirst({
    where: { nombre: validated.nombre, empresaId, NOT: { id } },
  })
  if (existing) throw new Error("Ya existe otro tipo de permiso con ese nombre")
  const tipo = await prisma.tipoPermiso.updateMany({
    where: { id, empresaId },
    data: {
      nombre: validated.nombre,
      descripcion: validated.descripcion ?? null,
      diasMaximos: validated.diasMaximos ?? null,
      remunerado: validated.remunerado,
    },
  })
  if (tipo.count === 0) throw new Error("Tipo de permiso no encontrado")
  revalidatePath("/permisos")
}

export async function toggleTipoPermisoActivo(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tipo_permiso", accion: "UPDATE" })
  const tipo = await prisma.tipoPermiso.findFirst({ where: { id, empresaId } })
  if (!tipo) throw new Error("Tipo de permiso no encontrado")
  await prisma.tipoPermiso.update({
    where: { id },
    data: { activo: !tipo.activo },
  })
  revalidatePath("/permisos")
}

export async function toggleTipoPermisoRemunerado(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tipo_permiso", accion: "UPDATE" })
  const tipo = await prisma.tipoPermiso.findFirst({ where: { id, empresaId } })
  if (!tipo) throw new Error("Tipo de permiso no encontrado")
  await prisma.tipoPermiso.update({
    where: { id },
    data: { remunerado: !tipo.remunerado },
  })
  revalidatePath("/permisos")
}

export async function deleteTipoPermiso(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "tipo_permiso", accion: "DELETE" })
  const result = await prisma.tipoPermiso.deleteMany({ where: { id, empresaId } })
  if (result.count === 0) throw new Error("Tipo de permiso no encontrado")
  revalidatePath("/permisos")
}

// ─── SolicitudPermiso ───────────────────────────────────

export async function getSolicitudesPermiso() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "READ" })
  return prisma.solicitudPermiso.findMany({
    where: { empleado: { empresaId } },
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true, codigo: true } },
      tipoPermiso: { select: { id: true, nombre: true } },
      solicitante: { select: { id: true, nombre: true, apellido: true } },
      aprobadoPor: { select: { id: true, nombre: true, apellido: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function getSolicitudPermiso(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "READ" })
  const solicitud = await prisma.solicitudPermiso.findFirst({
    where: { id, empleado: { empresaId } },
    include: {
      empleado: { select: { id: true, nombre: true, apellido: true, codigo: true } },
      tipoPermiso: { select: { id: true, nombre: true } },
    },
  })
  if (!solicitud) throw new Error("Solicitud no encontrada")
  return solicitud
}

const solicitudCreateSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  tipoPermisoId: z.string().min(1, "Tipo de permiso requerido"),
  fechaInicio: z.string().min(1, "Fecha inicio requerida"),
  fechaFin: z.string().min(1, "Fecha fin requerida"),
  motivo: z.string().optional(),
})

const solicitudUpdateSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  tipoPermisoId: z.string().min(1, "Tipo de permiso requerido"),
  fechaInicio: z.string().min(1, "Fecha inicio requerida"),
  fechaFin: z.string().min(1, "Fecha fin requerida"),
  motivo: z.string().optional(),
})

export async function createSolicitudPermiso(data: z.infer<typeof solicitudCreateSchema>) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "CREATE" })
  const validated = solicitudCreateSchema.parse(data)

  const empleado = await prisma.empleado.findFirst({
    where: { id: validated.empleadoId, empresaId },
  })
  if (!empleado) throw new Error("Empleado no encontrado")

  const solicitud = await prisma.solicitudPermiso.create({
    data: {
      empleadoId: validated.empleadoId,
      tipoPermisoId: validated.tipoPermisoId,
      solicitanteId: userId,
      fechaInicio: new Date(validated.fechaInicio),
      fechaFin: new Date(validated.fechaFin),
      motivo: validated.motivo ?? null,
    },
  })
  revalidatePath("/permisos")
  return solicitud
}

export async function updateSolicitudPermiso(id: string, data: z.infer<typeof solicitudUpdateSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "UPDATE" })
  const validated = solicitudUpdateSchema.parse(data)
  const result = await prisma.solicitudPermiso.updateMany({
    where: { id, empleado: { empresaId } },
    data: {
      empleadoId: validated.empleadoId,
      tipoPermisoId: validated.tipoPermisoId,
      fechaInicio: new Date(validated.fechaInicio),
      fechaFin: new Date(validated.fechaFin),
      motivo: validated.motivo ?? null,
    },
  })
  if (result.count === 0) throw new Error("Solicitud no encontrada")
  revalidatePath("/permisos")
}

export async function deleteSolicitudPermiso(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "DELETE" })
  const result = await prisma.solicitudPermiso.deleteMany({ where: { id, empleado: { empresaId } } })
  if (result.count === 0) throw new Error("Solicitud no encontrada")
  revalidatePath("/permisos")
}

export async function aprobarSolicitud(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "APROBAR" })
  const solicitud = await prisma.solicitudPermiso.findFirst({
    where: { id, empleado: { empresaId }, estado: "PENDIENTE" },
  })
  if (!solicitud) throw new Error("Solicitud no encontrada o ya fue procesada")
  await prisma.solicitudPermiso.update({
    where: { id },
    data: {
      estado: "APROBADO",
      aprobadoPorId: userId,
      fechaAprobacion: new Date(),
    },
  })
  revalidatePath("/permisos")
}

export async function rechazarSolicitud(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "RECHAZAR" })
  const solicitud = await prisma.solicitudPermiso.findFirst({
    where: { id, empleado: { empresaId }, estado: "PENDIENTE" },
  })
  if (!solicitud) throw new Error("Solicitud no encontrada o ya fue procesada")
  await prisma.solicitudPermiso.update({
    where: { id },
    data: { estado: "RECHAZADO" },
  })
  revalidatePath("/permisos")
}

export async function cancelarSolicitud(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "solicitud_permiso", accion: "UPDATE" })
  const solicitud = await prisma.solicitudPermiso.findFirst({
    where: { id, empleado: { empresaId } },
  })
  if (!solicitud) throw new Error("Solicitud no encontrada")
  await prisma.solicitudPermiso.update({
    where: { id },
    data: { estado: "CANCELADO" },
  })
  revalidatePath("/permisos")
}

// ─── Empleados (para dropdown) ─────────────────────────

export async function getEmpleados() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "READ" })
  return prisma.empleado.findMany({
    where: { empresaId, estado: "ACTIVO" },
    select: { id: true, nombre: true, apellido: true, codigo: true },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  })
}
