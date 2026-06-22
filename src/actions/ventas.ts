"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { notificarPorPermiso } from "./notificaciones"
import { generarAsiento } from "./motor-contable"

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

const ventaItemSchema = z.object({
  descripcion: z.string().min(1),
  unidadMedida: z.string().default("UNIDAD"),
  cantidad: z.coerce.number().positive(),
  precioUnitario: z.coerce.number().min(0),
  descuento: z.coerce.number().default(0),
  subtotal: z.coerce.number().default(0),
  impuesto: z.coerce.number().default(0),
  total: z.coerce.number().default(0),
})

const ventaPagoSchema = z.object({
  metodo: z.string().min(1),
  monto: z.coerce.number().min(0),
  referencia: z.string().optional().or(z.literal("")),
})

const ventaSchema = z.object({
  clienteId: z.string().min(1, "El cliente es requerido"),
  pedidoId: z.string().optional().or(z.literal("")),
  fecha: z.string().min(1),
  tipoFactura: z.string().default("CONTADO"),
  fechaVencimiento: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  items: z.array(ventaItemSchema).min(1, "Agrega al menos un item"),
  pagos: z.array(ventaPagoSchema).optional(),
})

export type VentaFormData = z.infer<typeof ventaSchema>
export type VentaItemData = z.infer<typeof ventaItemSchema>

export async function getVentas() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "venta", accion: "READ" })
  return prisma.venta.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      _count: { select: { items: true, pagos: true } },
    },
  })
}

export async function getVenta(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "venta", accion: "READ" })
  return prisma.venta.findFirst({
    where: { id, empresaId },
    include: {
      items: { orderBy: { item: "asc" } },
      pagos: true,
      cliente: true,
      pedido: true,
    },
  })
}

export async function createVenta(data: VentaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "venta", accion: "CREATE" })
  const validated = ventaSchema.parse(data)

  const last = await prisma.venta.findFirst({
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

  const venta = await prisma.venta.create({
    data: {
      empresaId,
      numero,
      clienteId: validated.clienteId,
      pedidoId: validated.pedidoId || null,
      fecha: new Date(validated.fecha),
      tipoFactura: validated.tipoFactura,
      fechaVencimiento: validated.fechaVencimiento ? new Date(validated.fechaVencimiento) : null,
      ...totals,
      notas: validated.notas || null,
      items: {
        create: validated.items.map((item, i) => ({
          item: i + 1,
          ...item,
        })),
      },
      pagos: validated.pagos?.length
        ? {
            create: validated.pagos.map((p) => ({
              metodo: p.metodo,
              monto: p.monto,
              referencia: p.referencia || null,
            })),
          }
        : undefined,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "VENTA",
    entidadId: venta.id,
    estadoNuevo: "BORRADOR",
    descripcion: `Venta #${numero} creada`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nueva Venta",
    mensaje: `Venta #${numero} creada por ${userId}`,
    referenciaId: venta.id,
    referenciaTipo: "VENTA",
    recurso: "venta",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/ventas")
  return venta
}

export async function updateVenta(id: string, data: VentaFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "venta", accion: "UPDATE" })
  const validated = ventaSchema.parse(data)

  const existing = await prisma.venta.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Venta no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes editar ventas en borrador")

  const totals = validated.items.reduce(
    (acc, item) => ({
      subtotal: acc.subtotal + item.subtotal,
      impuesto: acc.impuesto + item.impuesto,
      descuento: acc.descuento + item.descuento,
      total: acc.total + item.total,
    }),
    { subtotal: 0, impuesto: 0, descuento: 0, total: 0 }
  )

  await prisma.ventaItem.deleteMany({ where: { ventaId: id } })
  await prisma.ventaPago.deleteMany({ where: { ventaId: id } })

  const venta = await prisma.venta.update({
    where: { id },
    data: {
      clienteId: validated.clienteId,
      pedidoId: validated.pedidoId || null,
      fecha: new Date(validated.fecha),
      tipoFactura: validated.tipoFactura,
      fechaVencimiento: validated.fechaVencimiento ? new Date(validated.fechaVencimiento) : null,
      ...totals,
      notas: validated.notas || null,
      items: {
        create: validated.items.map((item, i) => ({
          item: i + 1,
          ...item,
        })),
      },
      pagos: validated.pagos?.length
        ? {
            create: validated.pagos.map((p) => ({
              metodo: p.metodo,
              monto: p.monto,
              referencia: p.referencia || null,
            })),
          }
        : undefined,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "VENTA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Venta actualizada",
    usuarioId: userId,
  })

  revalidatePath("/ventas")
  return venta
}

export async function cambiarEstadoVenta(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "venta", accion: "UPDATE" })
  const venta = await prisma.venta.findFirst({ where: { id, empresaId } })
  if (!venta) throw new Error("Venta no encontrada")
  const estadoAnterior = venta.estado
  await prisma.venta.update({ where: { id }, data: { estado: estado as any } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "VENTA",
    entidadId: id,
    estadoAnterior,
    estadoNuevo: estado,
    descripcion: `Estado cambiado de ${estadoAnterior} a ${estado}`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: estado === "CONFIRMADA" ? "success" : "warning",
    titulo: "Venta actualizada",
    mensaje: `Venta #${venta.numero} cambió a ${estado}`,
    referenciaId: id,
    referenciaTipo: "VENTA",
    recurso: "venta",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  if (estado === "CONFIRMADA") {
    generarAsiento("FACTURA_CLIENTE", id).catch((err) => {
      console.error("Error al generar asiento contable:", err)
    })
  }

  revalidatePath("/ventas")
}

export async function deleteVenta(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "venta", accion: "DELETE" })
  const existing = await prisma.venta.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Venta no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes eliminar ventas en borrador")
  await prisma.venta.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "VENTA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Venta eliminada",
    usuarioId: userId,
  })

  revalidatePath("/ventas")
}
