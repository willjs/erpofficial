"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { notificarPorPermiso } from "./notificaciones"
import { AutomationService } from "@/lib/automation-service"
import { serializar } from "@/lib/utils"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

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

async function saveFile(file: { nombre: string; base64: string }, empresaId: string, subfolder = "cuentas-cobrar") {
  if (!file.base64) return null
  const buffer = Buffer.from(file.base64, "base64")
  const sanitized = file.nombre.replace(/[^a-zA-Z0-9._-]/g, "_")
  const uploadDir = path.join(process.cwd(), "public", "uploads", empresaId, subfolder)
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${Date.now()}_${sanitized}`
  await writeFile(path.join(uploadDir, fileName), buffer)
  return { url: `/uploads/${empresaId}/${subfolder}/${fileName}`, nombre: file.nombre, tamaño: buffer.length }
}

const fileSchema = z.object({ nombre: z.string(), base64: z.string() }).optional().nullable()

const reciboSchema = z.object({
  cuentaCobrarId: z.string().min(1),
  clienteId: z.string().min(1),
  fecha: z.string().min(1),
  monto: z.coerce.number().positive(),
  metodo: z.string().default("TRANSFERENCIA"),
  referencia: z.string().optional().or(z.literal("")),
  observaciones: z.string().optional().or(z.literal("")),
  documentoFile: fileSchema,
  comprobanteFile: fileSchema,
})

export type ReciboFormData = z.infer<typeof reciboSchema>

export async function getCuentasCobrar() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_cobrar", accion: "READ" })
  const data = await prisma.cuentaCobrar.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      venta: { select: { id: true, numero: true } },
      deliveryTicket: { select: { id: true, numero: true, motonave: true } },
      _count: { select: { recibos: true } },
    },
  })
  return serializar(data) as typeof data
}

export async function getCuentaCobrar(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_cobrar", accion: "READ" })
  const data = await prisma.cuentaCobrar.findFirst({
    where: { id, empresaId },
    include: {
      cliente: true,
      venta: { include: { items: true } },
      deliveryTicket: { select: { id: true, numero: true, motonave: true } },
      recibos: { orderBy: { createdAt: "desc" } },
    },
  })
  return serializar(data) as typeof data
}

export async function createReciboCaja(data: ReciboFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_cobrar", accion: "CREATE" })
  const validated = reciboSchema.parse(data)

  const cuentaCobrar = await prisma.cuentaCobrar.findFirst({
    where: { id: validated.cuentaCobrarId, empresaId },
  })
  if (!cuentaCobrar) throw new Error("Cuenta por cobrar no encontrada")
  if (cuentaCobrar.estado === "PAGADA") throw new Error("La cuenta ya está pagada")

  let documentoUrl: string | null = null
  let comprobanteUrl: string | null = null
  if (validated.documentoFile?.base64) {
    const saved = await saveFile(validated.documentoFile, empresaId, "recibos")
    documentoUrl = saved?.url ?? null
  }
  if (validated.comprobanteFile?.base64) {
    const saved = await saveFile(validated.comprobanteFile, empresaId, "recibos")
    comprobanteUrl = saved?.url ?? null
  }

  const last = await prisma.reciboCaja.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  return prisma.$transaction(async (tx: any) => {
    const recibo = await tx.reciboCaja.create({
      data: {
        empresaId,
        numero,
        cuentaCobrarId: validated.cuentaCobrarId,
        clienteId: validated.clienteId,
        fecha: new Date(validated.fecha),
        monto: validated.monto,
        metodo: validated.metodo,
        referencia: validated.referencia || null,
        observaciones: validated.observaciones || null,
        documentoUrl,
        comprobanteUrl,
        estado: "CONFIRMADO",
      },
    })

    const nuevoSaldo = Number(cuentaCobrar.saldoPendiente) - validated.monto
    const nuevoEstado = nuevoSaldo <= 0 ? "PAGADA" : "PARCIAL"

    await tx.cuentaCobrar.update({
      where: { id: validated.cuentaCobrarId },
      data: {
        saldoPendiente: Math.max(0, nuevoSaldo),
        estado: nuevoEstado,
      },
    })

    await tx.historialEstado.create({
      data: {
        empresaId,
        entidadTipo: "CUENTA_COBRAR",
        entidadId: validated.cuentaCobrarId,
        estadoAnterior: cuentaCobrar.estado,
        estadoNuevo: nuevoEstado,
        descripcion: `Recibo #${numero} por $${validated.monto}. Saldo pendiente: $${Math.max(0, nuevoSaldo)}`,
        usuarioId: userId,
        referenciaId: recibo.id,
      },
    })

    AutomationService.ejecutarEvento({
      empresaId,
      codigoEvento: "RECIBO_CAJA_REGISTRADO",
      entidadTipo: "RECIBO_CAJA",
      entidadId: recibo.id,
      usuarioId: userId,
    }).catch(() => {})

    notificarPorPermiso({
      empresaId,
      tipo: "success",
      titulo: "Recibo de Caja registrado",
      mensaje: `Recibo #${numero} por $${validated.monto} aplicado a CC #${cuentaCobrar.numeroFactura ?? cuentaCobrar.id}`,
      referenciaId: validated.cuentaCobrarId,
      referenciaTipo: "CUENTA_COBRAR",
      recurso: "cuenta_cobrar",
      accion: "READ",
      excluirUsuarioId: userId,
    })

    revalidatePath("/cuentas-cobrar")
    return serializar(recibo) as typeof recibo
  })
}

export async function getVentasSinCobrar() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_cobrar", accion: "READ" })
  const ventas = await prisma.venta.findMany({
    where: {
      empresaId,
      estado: "CONFIRMADA",
      cuentasCobrar: { none: {} },
    },
    select: { id: true, numero: true, cliente: { select: { id: true, nombre: true } }, total: true, deliveryTicketId: true },
    orderBy: { createdAt: "desc" },
  })
  return serializar(ventas) as typeof ventas
}

export type GenerarFacturaData = {
  ventaId: string
  deliveryTicketId?: string
  numeroFactura: string
  fechaVencimiento?: string
  observaciones?: string
  archivo?: { nombre: string; base64: string } | null
}

export async function getDeliveryTicketsParaFactura(clienteId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_cobrar", accion: "READ" })
  const data = await prisma.deliveryTicket.findMany({
    where: { empresaId, clienteId },
    select: { id: true, numero: true, motonave: true, fecha: true, cantidadEntregada: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
  return serializar(data) as typeof data
}

export async function generarCuentaCobrar(data: GenerarFacturaData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_cobrar", accion: "CREATE" })

  const venta = await prisma.venta.findFirst({
    where: { id: data.ventaId, empresaId },
    include: { cliente: true },
  })
  if (!venta) throw new Error("Venta no encontrada")
  if (venta.estado !== "CONFIRMADA") throw new Error("La venta debe estar confirmada")

  const existing = await prisma.cuentaCobrar.findUnique({ where: { empresaId_ventaId: { empresaId, ventaId: data.ventaId } } })
  if (existing) throw new Error("Ya existe una cuenta por cobrar para esta venta")

  let documentoUrl: string | null = null
  if (data.archivo?.base64) {
    const saved = await saveFile(data.archivo, empresaId)
    documentoUrl = saved?.url ?? null
  }

  const cc = await prisma.cuentaCobrar.create({
    data: {
      empresaId,
      ventaId: data.ventaId,
      clienteId: venta.clienteId,
      deliveryTicketId: data.deliveryTicketId || null,
      numeroFactura: data.numeroFactura || `V${venta.numero}`,
      valor: Number(venta.total),
      saldoPendiente: Number(venta.total),
      fechaVencimiento: data.fechaVencimiento ? new Date(data.fechaVencimiento) : null,
      documentoUrl,
      observaciones: data.observaciones || null,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "CUENTA_COBRAR",
    entidadId: cc.id,
    estadoNuevo: "PENDIENTE",
    descripcion: `Factura #${data.numeroFactura} generada desde Venta #${venta.numero}${data.deliveryTicketId ? `, DT #${(await prisma.deliveryTicket.findUnique({ where: { id: data.deliveryTicketId }, select: { numero: true } }))?.numero ?? ""}` : ""}`,
    usuarioId: userId,
    referenciaId: data.ventaId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "CUENTA_COBRAR_CREADA",
    entidadTipo: "CUENTA_COBRAR",
    entidadId: cc.id,
    usuarioId: userId,
  }).catch(() => {})

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nueva Cuenta por Cobrar",
    mensaje: `Factura #${data.numeroFactura} por $${venta.total} de Venta #${venta.numero}`,
    referenciaId: cc.id,
    referenciaTipo: "CUENTA_COBRAR",
    recurso: "cuenta_cobrar",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/cuentas-cobrar")
  return serializar(cc) as typeof cc
}
