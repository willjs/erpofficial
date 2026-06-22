"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { notificarPorPermiso } from "./notificaciones"

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
  await prisma.historialEstado.create({
    data: {
      empresaId: params.empresaId,
      entidadTipo: params.entidadTipo,
      entidadId: params.entidadId,
      estadoAnterior: params.estadoAnterior ?? null,
      estadoNuevo: params.estadoNuevo,
      descripcion: params.descripcion ?? null,
      usuarioId: params.usuarioId ?? null,
      referenciaId: params.referenciaId ?? null,
    },
  })
}

const despachoItemSchema = z.object({
  descripcion: z.string().min(1),
  unidadMedida: z.string().default("UNIDAD"),
  cantidad: z.coerce.number().positive(),
  lote: z.string().optional().or(z.literal("")),
})

const despachoSchema = z.object({
  pedidoId: z.string().optional().or(z.literal("")),
  almacenId: z.string().min(1, "El almacén es requerido"),
  fecha: z.string().min(1),
  destino: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  items: z.array(despachoItemSchema).min(1, "Agrega al menos un item"),
})

export type DespachoFormData = z.infer<typeof despachoSchema>

export async function getDespachos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "despacho", accion: "READ" })
  return prisma.despacho.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      pedido: { select: { id: true, numero: true } },
      almacen: { select: { id: true, nombre: true } },
      _count: { select: { items: true } },
    },
  })
}

export async function getDespacho(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "despacho", accion: "READ" })
  return prisma.despacho.findFirst({
    where: { id, empresaId },
    include: {
      items: { orderBy: { item: "asc" } },
      pedido: { include: { cliente: true } },
      almacen: true,
    },
  })
}

export async function createDespacho(data: DespachoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "despacho", accion: "CREATE" })
  const validated = despachoSchema.parse(data)

  const last = await prisma.despacho.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  const despacho = await prisma.despacho.create({
    data: {
      empresaId,
      numero,
      pedidoId: validated.pedidoId || null,
      almacenId: validated.almacenId,
      fecha: new Date(validated.fecha),
      destino: validated.destino || null,
      notas: validated.notas || null,
      items: {
        create: validated.items.map((item, i) => ({
          item: i + 1,
          ...item,
          lote: item.lote || null,
        })),
      },
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DESPACHO",
    entidadId: despacho.id,
    estadoNuevo: "BORRADOR",
    descripcion: `Despacho #${numero} creado`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nuevo Despacho",
    mensaje: `Despacho #${numero} creado por ${userId}`,
    referenciaId: despacho.id,
    referenciaTipo: "DESPACHO",
    recurso: "despacho",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/despachos")
  return despacho
}

export async function updateDespacho(id: string, data: DespachoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "despacho", accion: "UPDATE" })
  const validated = despachoSchema.parse(data)

  const existing = await prisma.despacho.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Despacho no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes editar despachos en borrador")

  await prisma.despachoItem.deleteMany({ where: { despachoId: id } })

  const despacho = await prisma.despacho.update({
    where: { id },
    data: {
      pedidoId: validated.pedidoId || null,
      almacenId: validated.almacenId,
      fecha: new Date(validated.fecha),
      destino: validated.destino || null,
      notas: validated.notas || null,
      items: {
        create: validated.items.map((item, i) => ({
          item: i + 1,
          ...item,
          lote: item.lote || null,
        })),
      },
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DESPACHO",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Despacho actualizado",
    usuarioId: userId,
  })

  revalidatePath("/despachos")
  return despacho
}

export async function cambiarEstadoDespacho(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "despacho", accion: "UPDATE" })
  const despacho = await prisma.despacho.findFirst({ where: { id, empresaId } })
  if (!despacho) throw new Error("Despacho no encontrado")
  const estadoAnterior = despacho.estado
  await prisma.despacho.update({ where: { id }, data: { estado: estado as any } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DESPACHO",
    entidadId: id,
    estadoAnterior,
    estadoNuevo: estado,
    descripcion: `Estado cambiado de ${estadoAnterior} a ${estado}`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Despacho actualizado",
    mensaje: `Despacho #${despacho.numero} cambió a ${estado}`,
    referenciaId: id,
    referenciaTipo: "DESPACHO",
    recurso: "despacho",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/despachos")
}

export async function deleteDespacho(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "despacho", accion: "DELETE" })
  const existing = await prisma.despacho.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Despacho no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes eliminar despachos en borrador")
  await prisma.despacho.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DESPACHO",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Despacho eliminado",
    usuarioId: userId,
  })

  revalidatePath("/despachos")
}
