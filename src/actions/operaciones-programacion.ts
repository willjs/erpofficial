"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso, asegurarPermisosOperaciones } from "@/lib/permisos"
import { serializar } from "@/lib/utils"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { notificarPorPermiso } from "./notificaciones"
import { AutomationService } from "@/lib/automation-service"

async function registrarHistorial(params: {
  empresaId: string
  entidadTipo: string
  entidadId: string
  estadoAnterior?: string | null
  estadoNuevo: string
  descripcion?: string
  usuarioId?: string | null
  referenciaId?: string | null
}) {
  await prisma.historialEstado.create({ data: { ...params, estadoAnterior: params.estadoAnterior ?? null, descripcion: params.descripcion ?? null, usuarioId: params.usuarioId ?? null, referenciaId: params.referenciaId ?? null } })
}

const programacionSchema = z.object({
  fecha: z.string().min(1),
  clienteId: z.string().min(1, "El cliente es requerido"),
  agente: z.string().optional().or(z.literal("")),
  puerto: z.string().min(1, "El puerto es requerido"),
  lugarSuministro: z.string().optional().or(z.literal("")),
  motonave: z.string().min(1, "La motonave es requerida"),
  imo: z.string().optional().or(z.literal("")),
  bandera: z.string().optional().or(z.literal("")),
  productoId: z.string().min(1, "El producto es requerido"),
  observaciones: z.string().optional().or(z.literal("")),
})

export type ProgramacionFormData = z.infer<typeof programacionSchema>

export async function getProgramaciones() {
  const { empresaId, userId } = await verifySession()
  await asegurarPermisosOperaciones(empresaId)
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "READ" })
  const data = await prisma.programacionOperativa.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      producto: { select: { id: true, nombre: true, codigo: true } },
      _count: { select: { ordenes: true } },
    },
  })
  return serializar(data) as typeof data
}

export async function getProgramacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "READ" })
  const data = await prisma.programacionOperativa.findFirst({
    where: { id, empresaId },
    include: {
      cliente: true,
      producto: true,
      ordenes: {
        include: { asignaciones: true },
      },
    },
  })
  return serializar(data) as typeof data
}

export async function createProgramacion(data: ProgramacionFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "CREATE" })
  const validated = programacionSchema.parse(data)

  const last = await prisma.programacionOperativa.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  const prog = await prisma.programacionOperativa.create({
    data: {
      empresaId,
      numero,
      fecha: new Date(validated.fecha),
      clienteId: validated.clienteId,
      agente: validated.agente || null,
      puerto: validated.puerto,
      lugarSuministro: validated.lugarSuministro || null,
      motonave: validated.motonave,
      imo: validated.imo || null,
      bandera: validated.bandera || null,
      productoId: validated.productoId,
      observaciones: validated.observaciones || null,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PROGRAMACION_OPERATIVA",
    entidadId: prog.id,
    estadoNuevo: "BORRADOR",
    descripcion: `Programación #${numero} creada`,
    usuarioId: userId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "PROGRAMACION_CREADA",
    entidadTipo: "PROGRAMACION_OPERATIVA",
    entidadId: prog.id,
    usuarioId: userId,
  }).catch(() => {})

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nueva Programación",
    mensaje: `Programación #${numero} creada`,
    referenciaId: prog.id,
    referenciaTipo: "PROGRAMACION_OPERATIVA",
    recurso: "programacion_operativa",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/programacion")
  return serializar(prog) as typeof prog
}

export async function updateProgramacion(id: string, data: ProgramacionFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "UPDATE" })
  const validated = programacionSchema.parse(data)

  const existing = await prisma.programacionOperativa.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Programación no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes editar programaciones en borrador")

  const prog = await prisma.programacionOperativa.update({
    where: { id },
    data: {
      fecha: new Date(validated.fecha),
      clienteId: validated.clienteId,
      agente: validated.agente || null,
      puerto: validated.puerto,
      lugarSuministro: validated.lugarSuministro || null,
      motonave: validated.motonave,
      imo: validated.imo || null,
      bandera: validated.bandera || null,
      productoId: validated.productoId,
      observaciones: validated.observaciones || null,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PROGRAMACION_OPERATIVA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Programación actualizada",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/programacion")
  return serializar(prog) as typeof prog
}

export async function cambiarEstadoProgramacion(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "UPDATE" })
  const existing = await prisma.programacionOperativa.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Programación no encontrada")

  const estadoAnterior = existing.estado
  await prisma.programacionOperativa.update({ where: { id }, data: { estado: estado as any } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PROGRAMACION_OPERATIVA",
    entidadId: id,
    estadoAnterior,
    estadoNuevo: estado,
    descripcion: `Estado cambiado de ${estadoAnterior} a ${estado}`,
    usuarioId: userId,
  })

  if (estado === "APROBADA") {
    AutomationService.ejecutarEvento({
      empresaId,
      codigoEvento: "PROGRAMACION_APROBADA",
      entidadTipo: "PROGRAMACION_OPERATIVA",
      entidadId: id,
      usuarioId: userId,
    }).catch(() => {})
  }

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Programación actualizada",
    mensaje: `Programación #${existing.numero} cambió a ${estado}`,
    referenciaId: id,
    referenciaTipo: "PROGRAMACION_OPERATIVA",
    recurso: "programacion_operativa",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/programacion")
}

export async function deleteProgramacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "DELETE" })
  const existing = await prisma.programacionOperativa.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Programación no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes eliminar programaciones en borrador")
  await prisma.programacionOperativa.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PROGRAMACION_OPERATIVA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Programación eliminada",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/programacion")
}

export async function getProductosOperaciones() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "READ" })
  return prisma.producto.findMany({
    where: { empresaId, activo: true },
    select: { id: true, codigo: true, nombre: true, unidadMedida: true },
    orderBy: { nombre: "asc" },
  })
}

export async function getClientesOperaciones() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "programacion_operativa", accion: "READ" })
  return prisma.cliente.findMany({
    where: { empresaId, activo: true },
    select: { id: true, nombre: true, rfc: true },
    orderBy: { nombre: "asc" },
  })
}
