"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
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

const traspasoItemSchema = z.object({
  descripcion: z.string().min(1),
  unidadMedida: z.string().default("UNIDAD"),
  cantidad: z.coerce.number().positive(),
})

const traspasoSchema = z.object({
  almacenOrigenId: z.string().min(1, "El almacén origen es requerido"),
  almacenDestinoId: z.string().min(1, "El almacén destino es requerido"),
  fecha: z.string().min(1),
  notas: z.string().optional().or(z.literal("")),
  items: z.array(traspasoItemSchema).min(1, "Agrega al menos un item"),
})

export type TraspasoFormData = z.infer<typeof traspasoSchema>

export async function getTraspasos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "READ" })
  return prisma.traspaso.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      almacenOrigen: { select: { id: true, nombre: true } },
      almacenDestino: { select: { id: true, nombre: true } },
      _count: { select: { items: true } },
    },
  })
}

export async function getTraspaso(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "READ" })
  return prisma.traspaso.findFirst({
    where: { id, empresaId },
    include: {
      items: { orderBy: { item: "asc" } },
      almacenOrigen: true,
      almacenDestino: true,
    },
  })
}

export async function createTraspaso(data: TraspasoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "CREATE" })
  const validated = traspasoSchema.parse(data)

  if (validated.almacenOrigenId === validated.almacenDestinoId) {
    throw new Error("Los almacenes origen y destino deben ser diferentes")
  }

  const last = await prisma.traspaso.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  const traspaso = await prisma.traspaso.create({
    data: {
      empresaId,
      numero,
      almacenOrigenId: validated.almacenOrigenId,
      almacenDestinoId: validated.almacenDestinoId,
      fecha: new Date(validated.fecha),
      notas: validated.notas || null,
      items: {
        create: validated.items.map((item, i) => ({
          item: i + 1,
          ...item,
        })),
      },
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "TRASPASO",
    entidadId: traspaso.id,
    estadoNuevo: "BORRADOR",
    descripcion: `Traspaso #${numero} creado`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nuevo Traspaso",
    mensaje: `Traspaso #${numero} creado por ${userId}`,
    referenciaId: traspaso.id,
    referenciaTipo: "TRASPASO",
    recurso: "traspaso",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/traspasos")
  return traspaso
}

export async function updateTraspaso(id: string, data: TraspasoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "UPDATE" })
  const validated = traspasoSchema.parse(data)

  const existing = await prisma.traspaso.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Traspaso no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes editar traspasos en borrador")

  if (validated.almacenOrigenId === validated.almacenDestinoId) {
    throw new Error("Los almacenes origen y destino deben ser diferentes")
  }

  await prisma.traspasoItem.deleteMany({ where: { traspasoId: id } })

  const traspaso = await prisma.traspaso.update({
    where: { id },
    data: {
      almacenOrigenId: validated.almacenOrigenId,
      almacenDestinoId: validated.almacenDestinoId,
      fecha: new Date(validated.fecha),
      notas: validated.notas || null,
      items: {
        create: validated.items.map((item, i) => ({
          item: i + 1,
          ...item,
        })),
      },
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "TRASPASO",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Traspaso actualizado",
    usuarioId: userId,
  })

  revalidatePath("/traspasos")
  return traspaso
}

const TRANSICIONES_TRASPASO: Record<string, string[]> = {
  BORRADOR: ["EN_TRANSITO", "COMPLETADO"],
  EN_TRANSITO: ["COMPLETADO", "CANCELADO"],
}

export async function cambiarEstadoTraspaso(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "UPDATE" })
  const traspaso = await prisma.traspaso.findFirst({ where: { id, empresaId } })
  if (!traspaso) throw new Error("Traspaso no encontrado")
  const estadoAnterior = traspaso.estado
  const permitidos = TRANSICIONES_TRASPASO[estadoAnterior]
  if (!permitidos || !permitidos.includes(estado)) {
    throw new Error(`No se puede cambiar de ${estadoAnterior} a ${estado}`)
  }
  await prisma.traspaso.update({ where: { id }, data: { estado: estado as any } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "TRASPASO",
    entidadId: id,
    estadoAnterior,
    estadoNuevo: estado,
    descripcion: `Estado cambiado de ${estadoAnterior} a ${estado}`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Traspaso actualizado",
    mensaje: `Traspaso #${traspaso.numero} cambió a ${estado}`,
    referenciaId: id,
    referenciaTipo: "TRASPASO",
    recurso: "traspaso",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/traspasos")
}

export async function completarTraspaso(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "UPDATE" })
  const traspaso = await prisma.traspaso.findFirst({
    where: { id, empresaId },
    include: { items: true },
  })
  if (!traspaso) throw new Error("Traspaso no encontrado")
  const permitidos = TRANSICIONES_TRASPASO[traspaso.estado]
  if (!permitidos || !permitidos.includes("COMPLETADO")) {
    throw new Error(`El traspaso en estado ${traspaso.estado} no puede ser completado`)
  }

  // Validar stock suficiente antes de ejecutar
  for (const item of traspaso.items) {
    const producto = await prisma.producto.findFirst({
      where: { id: item.descripcion, empresaId },
    })
    if (!producto) throw new Error(`Producto "${item.descripcion}" no encontrado`)

    const stockOrigen = await prisma.inventarioStock.findFirst({
      where: { productoId: producto.id, almacenId: traspaso.almacenOrigenId },
    })
    if (!stockOrigen || Number(stockOrigen.cantidad) < Number(item.cantidad)) {
      throw new Error(`Stock insuficiente para "${producto.nombre}" en almacén origen. Disponible: ${stockOrigen ? Number(stockOrigen.cantidad) : 0}, requerido: ${Number(item.cantidad)}`)
    }
  }

  await prisma.$transaction(async (tx: any) => {
    for (const item of traspaso.items) {
      const producto = await tx.producto.findFirst({
        where: { id: item.descripcion, empresaId },
      })
      if (!producto) throw new Error(`Producto "${item.descripcion}" no encontrado`)

      await tx.movimientoInventario.create({
        data: {
          empresaId,
          productoId: producto.id,
          almacenOrigenId: traspaso.almacenOrigenId,
          tipo: "SALIDA",
          cantidad: item.cantidad,
          referencia: `Traspaso #${traspaso.numero}`,
          observaciones: `Traspaso a ${traspaso.almacenDestinoId}`,
        },
      })

      await tx.movimientoInventario.create({
        data: {
          empresaId,
          productoId: producto.id,
          almacenDestinoId: traspaso.almacenDestinoId,
          tipo: "ENTRADA",
          cantidad: item.cantidad,
          referencia: `Traspaso #${traspaso.numero}`,
          observaciones: `Traspaso desde ${traspaso.almacenOrigenId}`,
        },
      })

      const stockOrigen = await tx.inventarioStock.findFirst({
        where: { productoId: producto.id, almacenId: traspaso.almacenOrigenId },
      })
      if (!stockOrigen || Number(stockOrigen.cantidad) < Number(item.cantidad)) {
        throw new Error(`Stock insuficiente para "${producto.nombre}"`)
      }
      await tx.inventarioStock.update({
        where: { id: stockOrigen.id },
        data: { cantidad: { decrement: item.cantidad } },
      })

      await tx.inventarioStock.upsert({
        where: {
          productoId_almacenId: {
            productoId: producto.id,
            almacenId: traspaso.almacenDestinoId,
          },
        },
        create: {
          empresaId,
          productoId: producto.id,
          almacenId: traspaso.almacenDestinoId,
          cantidad: item.cantidad,
        },
        update: {
          cantidad: { increment: item.cantidad },
        },
      })
    }

    await tx.traspaso.update({ where: { id }, data: { estado: "COMPLETADO" } })
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "TRASPASO",
    entidadId: id,
    estadoAnterior: traspaso.estado,
    estadoNuevo: "COMPLETADO",
    descripcion: "Traspaso completado con movimientos de inventario",
    usuarioId: userId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "TRASPASO_COMPLETADO",
    entidadTipo: "TRASPASO",
    entidadId: id,
    usuarioId: userId,
  }).catch(() => {})

  notificarPorPermiso({
    empresaId,
    tipo: "success",
    titulo: "Traspaso completado",
    mensaje: `Traspaso #${traspaso.numero} completado con inventario actualizado`,
    referenciaId: id,
    referenciaTipo: "TRASPASO",
    recurso: "traspaso",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/traspasos")
}

export async function deleteTraspaso(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "traspaso", accion: "DELETE" })
  const existing = await prisma.traspaso.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Traspaso no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes eliminar traspasos en borrador")
  await prisma.traspaso.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "TRASPASO",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Traspaso eliminado",
    usuarioId: userId,
  })

  revalidatePath("/traspasos")
}
