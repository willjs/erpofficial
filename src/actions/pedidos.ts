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

const pedidoItemSchema = z.object({
  tipoItem: z.enum(["PRODUCTO", "SERVICIO"]).default("PRODUCTO"),
  descripcion: z.string().min(1),
  unidadMedida: z.string().default("UNIDAD"),
  cantidad: z.coerce.number().positive(),
  precioUnitario: z.coerce.number().min(0),
  descuento: z.coerce.number().default(0),
  subtotal: z.coerce.number().default(0),
  impuesto: z.coerce.number().default(0),
  total: z.coerce.number().default(0),
})

const pedidoSchema = z.object({
  clienteId: z.string().min(1, "El cliente es requerido"),
  fecha: z.string().min(1),
  notas: z.string().optional().or(z.literal("")),
  items: z.array(pedidoItemSchema).min(1, "Agrega al menos un item"),
})

export type PedidoFormData = z.infer<typeof pedidoSchema>
export type PedidoItemData = z.infer<typeof pedidoItemSchema>

export async function getPedidos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "READ" })
  return prisma.pedido.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      _count: { select: { items: true, ventas: true, despachos: true } },
    },
  })
}

export async function getPedido(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "READ" })
  return prisma.pedido.findFirst({
    where: { id, empresaId },
    include: { items: { orderBy: { item: "asc" } }, cliente: true },
  })
}

export async function createPedido(data: PedidoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "CREATE" })
  const validated = pedidoSchema.parse(data)

  const last = await prisma.pedido.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  const totals = validated.items.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      impuesto: acc.impuesto + item.impuesto,
      descuento: acc.descuento + item.descuento,
      total: acc.total + item.total,
    }),
    { subtotal: 0, impuesto: 0, descuento: 0, total: 0 }
  )

  const pedido = await prisma.pedido.create({
    data: {
      empresaId,
      numero,
      clienteId: validated.clienteId,
      fecha: new Date(validated.fecha),
      ...totals,
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
    entidadTipo: "PEDIDO",
    entidadId: pedido.id,
    estadoNuevo: "BORRADOR",
    descripcion: `Pedido #${numero} creado`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nuevo Pedido",
    mensaje: `Pedido #${numero} creado por ${userId}`,
    referenciaId: pedido.id,
    referenciaTipo: "PEDIDO",
    recurso: "pedido",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/pedidos")
  return pedido
}

export async function updatePedido(id: string, data: PedidoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "UPDATE" })
  const validated = pedidoSchema.parse(data)

  const existing = await prisma.pedido.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Pedido no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes editar pedidos en borrador")

  const totals = validated.items.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      impuesto: acc.impuesto + item.impuesto,
      descuento: acc.descuento + item.descuento,
      total: acc.total + item.total,
    }),
    { subtotal: 0, impuesto: 0, descuento: 0, total: 0 }
  )

  await prisma.pedidoItem.deleteMany({ where: { pedidoId: id } })

  const pedido = await prisma.pedido.update({
    where: { id },
    data: {
      clienteId: validated.clienteId,
      fecha: new Date(validated.fecha),
      ...totals,
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
    entidadTipo: "PEDIDO",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Pedido actualizado",
    usuarioId: userId,
  })

  revalidatePath("/pedidos")
  return pedido
}

export async function cambiarEstadoPedido(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "UPDATE" })
  const pedido = await prisma.pedido.findFirst({ where: { id, empresaId } })
  if (!pedido) throw new Error("Pedido no encontrado")

  if (estado === "EN_DESPACHO") {
    const items = await prisma.pedidoItem.findMany({ where: { pedidoId: id } })
    const servicios = items.filter((i) => i.tipoItem === "SERVICIO")
    if (servicios.length > 0 && items.filter((i) => i.tipoItem === "PRODUCTO").length === 0) {
      throw new Error("No se puede despachar un pedido que solo contiene servicios. Crea una venta directamente.")
    }
  }

  const estadoAnterior = pedido.estado
  await prisma.pedido.update({ where: { id }, data: { estado: estado as any } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PEDIDO",
    entidadId: id,
    estadoAnterior,
    estadoNuevo: estado,
    descripcion: `Estado cambiado de ${estadoAnterior} a ${estado}`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Pedido actualizado",
    mensaje: `Pedido #${pedido.numero} cambió a ${estado}`,
    referenciaId: id,
    referenciaTipo: "PEDIDO",
    recurso: "pedido",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/pedidos")
}

export async function deletePedido(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "DELETE" })
  const existing = await prisma.pedido.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Pedido no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes eliminar pedidos en borrador")
  await prisma.pedido.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PEDIDO",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Pedido eliminado",
    usuarioId: userId,
  })

  revalidatePath("/pedidos")
}

export async function getProductosCatalogo() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pedido", accion: "READ" })
  const prods = await prisma.producto.findMany({
    where: { empresaId, activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      unidadMedida: true,
      precioUnitario: true,
    },
    orderBy: { nombre: "asc" },
  })

  return prods.map((p) => ({
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    unidadMedida: p.unidadMedida,
    precioUnitario: p.precioUnitario ? Number(p.precioUnitario) : 0,
  }))
}
