"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { serializar } from "@/lib/utils"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { notificarPorPermiso } from "./notificaciones"
import { AutomationService } from "@/lib/automation-service"
import { mkdir, writeFile } from "fs/promises"
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

async function saveFile(file: { nombre: string; base64: string }, empresaId: string) {
  if (!file.base64) return null
  const buffer = Buffer.from(file.base64, "base64")
  const sanitized = file.nombre.replace(/[^a-zA-Z0-9._-]/g, "_")
  const uploadDir = path.join(process.cwd(), "public", "uploads", empresaId, "delivery")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${Date.now()}_${sanitized}`
  await writeFile(path.join(uploadDir, fileName), buffer)
  return { nombre: file.nombre, url: `/uploads/${empresaId}/delivery/${fileName}`, tamaño: buffer.length }
}

const deliveryCreateSchema = z.object({
  fecha: z.string().min(1),
  clienteId: z.string().min(1),
  direccion: z.string().optional().or(z.literal("")),
  ciudad: z.string().optional().or(z.literal("")),
  agente: z.string().optional().or(z.literal("")),
  motonave: z.string().min(1),
  imo: z.string().optional().or(z.literal("")),
  bandera: z.string().optional().or(z.literal("")),
  lugarSuministro: z.string().optional().or(z.literal("")),
  tipoSuministro: z.string().optional().or(z.literal("")),
  puerto: z.string().min(1),
  productoId: z.string().min(1),
  // Recursos operativos (barcaza)
  barcazaId: z.string().optional().or(z.literal("")),
  capitanId: z.string().optional().or(z.literal("")),
  remolcadorId: z.string().optional().or(z.literal("")),
  // Sondeos
  sondajeAntes: z.coerce.number().optional(),
  sondajeAntesRealizado: z.string().optional().or(z.literal("")),
  sondajeDespues: z.coerce.number().optional(),
  sondajeDespuesRealizado: z.string().optional().or(z.literal("")),
  sondajeTestificado: z.string().optional().or(z.literal("")),
  companiaEntrega: z.string().optional().or(z.literal("")),
  verificadoPor: z.string().optional().or(z.literal("")),
  observaciones: z.string().optional().or(z.literal("")),
})

const deliveryConfirmSchema = z.object({
  cantidadEntregada: z.coerce.number().positive(),
  vehiculoId: z.string().optional().or(z.literal("")),
  conductorId: z.string().optional().or(z.literal("")),
})

export type DeliveryCreateFormData = z.infer<typeof deliveryCreateSchema>

const deliveryQualitySchema = z.object({
  api: z.coerce.number().optional(),
  gravedadEspecifica: z.coerce.number().optional(),
  densidad: z.coerce.number().optional(),
  viscosidad: z.coerce.number().optional(),
  azufre: z.coerce.number().optional(),
  agua: z.coerce.number().optional(),
  puntoChispa: z.coerce.number().optional(),
  temperatura: z.coerce.number().optional(),
  otrasPropiedades: z.string().optional().or(z.literal("")),
  selloProveedor: z.string().optional().or(z.literal("")),
  selloMotonave: z.string().optional().or(z.literal("")),
  marpolAnnexVi: z.string().optional().or(z.literal("")),
  otraMuestra: z.string().optional().or(z.literal("")),
})

export type DeliveryQualityFormData = z.infer<typeof deliveryQualitySchema>
export type DeliveryConfirmFormData = z.infer<typeof deliveryConfirmSchema>

// --- Recursos para selects (usa permiso delivery_ticket) ---
export async function getBarcazasForDelivery() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  return prisma.barcaza.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, capacidad: true } })
}

export async function getRemolcadoresForDelivery() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  return prisma.remolcador.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, matricula: true } })
}

export async function getVehiculosForDelivery() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  return prisma.vehiculo.findMany({ where: { empresaId, activo: true }, orderBy: { placa: "asc" }, select: { id: true, placa: true, tipo: true } })
}

export async function getConductoresForDelivery() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  return prisma.conductor.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, documento: true } })
}

export async function getCapitanesForDelivery() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  return prisma.capitan.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true, licencia: true } })
}

export async function getDeliveryTickets() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  const data = await prisma.deliveryTicket.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      producto: { select: { id: true, nombre: true } },
      barcaza: { select: { id: true, nombre: true } },
      capitan: { select: { id: true, nombre: true } },
      remolcador: { select: { id: true, nombre: true } },
      vehiculo: { select: { id: true, placa: true } },
      conductor: { select: { id: true, nombre: true } },
      _count: { select: { evidencias: true, firmas: true, ventas: true } },
    },
  })
  return serializar(data) as typeof data
}

export async function getDeliveryTicket(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  const data = await prisma.deliveryTicket.findFirst({
    where: { id, empresaId },
    include: {
      cliente: true,
      producto: true,
      barcaza: true,
      capitan: true,
      remolcador: true,
      vehiculo: true,
      conductor: true,
      timeline: { orderBy: { fecha: "asc" } },
      evidencias: true,
      firmas: true,
      ventas: { select: { id: true, numero: true, estado: true, total: true } },
      ordenOperativa: {
        select: {
          api: true, gravedadEspecifica: true, densidad: true, viscosidad: true,
          azufre: true, agua: true, puntoChispa: true, temperatura: true,
          otrasPropiedades: true,
          muestraProveedor: true, muestraMotonave: true, muestraMarpolInfo: true, muestraOtra: true,
          programacion: { select: { observaciones: true, agente: true } },
        },
      },
    },
  })
  const result = serializar(data) as any
  if (result?.ordenOperativa) {
    const oo = result.ordenOperativa
    if (result.api == null) result.api = oo.api
    if (result.gravedadEspecifica == null) result.gravedadEspecifica = oo.gravedadEspecifica
    if (result.densidad == null) result.densidad = oo.densidad
    if (result.viscosidad == null) result.viscosidad = oo.viscosidad
    if (result.azufre == null) result.azufre = oo.azufre
    if (result.agua == null) result.agua = oo.agua
    if (result.puntoChispa == null) result.puntoChispa = oo.puntoChispa
    if (result.temperatura == null) result.temperatura = oo.temperatura
    if (result.otrasPropiedades == null || result.otrasPropiedades === "") result.otrasPropiedades = oo.otrasPropiedades
    if (result.selloProveedor == null || result.selloProveedor === "") result.selloProveedor = oo.muestraProveedor
    if (result.selloMotonave == null || result.selloMotonave === "") result.selloMotonave = oo.muestraMotonave
    if (result.marpolAnnexVi == null || result.marpolAnnexVi === "") result.marpolAnnexVi = oo.muestraMarpolInfo
    if (result.otraMuestra == null || result.otraMuestra === "") result.otraMuestra = oo.muestraOtra
    if ((result.observaciones == null || result.observaciones === "") && oo.programacion?.observaciones) {
      result.observaciones = oo.programacion.observaciones
    }
    if ((result.agente == null || result.agente === "") && oo.programacion?.agente) {
      result.agente = oo.programacion.agente
    }
    delete result.ordenOperativa
  }
  if ((result.direccion == null || result.direccion === "") && result.cliente?.direccion) {
    result.direccion = result.cliente.direccion
  }
  if ((result.ciudad == null || result.ciudad === "") && result.cliente?.ciudad) {
    result.ciudad = result.cliente.ciudad
  }
  return result as typeof data
}

// --- ETAPA 1: Creación con datos básicos ---
export async function createDeliveryTicket(data: DeliveryCreateFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "CREATE" })
  const validated = deliveryCreateSchema.parse(data)

  const last = await prisma.deliveryTicket.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  const dt = await prisma.deliveryTicket.create({
    data: {
      empresaId,
      numero,
      cantidadEntregada: 0,
      fecha: new Date(validated.fecha),
      clienteId: validated.clienteId,
      direccion: validated.direccion || null,
      ciudad: validated.ciudad || null,
      agente: validated.agente || null,
      motonave: validated.motonave,
      imo: validated.imo || null,
      bandera: validated.bandera || null,
      lugarSuministro: validated.lugarSuministro || null,
      tipoSuministro: validated.tipoSuministro || null,
      puerto: validated.puerto,
      productoId: validated.productoId,
      barcazaId: validated.barcazaId || null,
      capitanId: validated.capitanId || null,
      remolcadorId: validated.remolcadorId || null,
      sondajeAntes: validated.sondajeAntes ?? null,
      sondajeAntesRealizado: validated.sondajeAntesRealizado || null,
      sondajeDespues: validated.sondajeDespues ?? null,
      sondajeDespuesRealizado: validated.sondajeDespuesRealizado || null,
      sondajeTestificado: validated.sondajeTestificado || null,
      companiaEntrega: validated.companiaEntrega || null,
      verificadoPor: validated.verificadoPor || null,
      observaciones: validated.observaciones || null,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DELIVERY_TICKET",
    entidadId: dt.id,
    estadoNuevo: "BORRADOR",
    descripcion: `Delivery Ticket #${numero} creado`,
    usuarioId: userId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "DELIVERY_TICKET_CREADO",
    entidadTipo: "DELIVERY_TICKET",
    entidadId: dt.id,
    usuarioId: userId,
  }).catch(() => {})

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nuevo Delivery Ticket",
    mensaje: `Delivery Ticket #${numero} creado`,
    referenciaId: dt.id,
    referenciaTipo: "DELIVERY_TICKET",
    recurso: "delivery_ticket",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/delivery")
  return serializar(dt) as typeof dt
}

// --- ETAPA 2: Confirmar entrega (cantidad, placas, conductor) ---
export async function confirmarEntrega(id: string, data: DeliveryConfirmFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  const validated = deliveryConfirmSchema.parse(data)

  const existing = await prisma.deliveryTicket.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Delivery Ticket no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes confirmar tickets en borrador")

  const dt = await prisma.deliveryTicket.update({
    where: { id },
    data: {
      cantidadEntregada: validated.cantidadEntregada,
      vehiculoId: validated.vehiculoId || null,
      conductorId: validated.conductorId || null,
      estado: "CONFIRMADO",
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DELIVERY_TICKET",
    entidadId: id,
    estadoAnterior: "BORRADOR",
    estadoNuevo: "CONFIRMADO",
    descripcion: `Delivery Ticket #${existing.numero} confirmado. Cantidad: ${validated.cantidadEntregada} ${existing.unidadMedida ?? "MT"}`,
    usuarioId: userId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "DELIVERY_TICKET_CONFIRMADO",
    entidadTipo: "DELIVERY_TICKET",
    entidadId: id,
    usuarioId: userId,
  }).catch(() => {})

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Delivery Ticket Confirmado",
    mensaje: `DT #${existing.numero} confirmado con ${validated.cantidadEntregada} ${existing.unidadMedida ?? "MT"}`,
    referenciaId: id,
    referenciaTipo: "DELIVERY_TICKET",
    recurso: "delivery_ticket",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/delivery")
  revalidatePath(`/operaciones/delivery/${id}`)
  return serializar(dt) as typeof dt
}

// --- Editar datos básicos (solo en BORRADOR) ---
export async function updateDeliveryTicket(id: string, data: DeliveryCreateFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  const validated = deliveryCreateSchema.parse(data)

  const existing = await prisma.deliveryTicket.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Delivery Ticket no encontrado")
  if (existing.estado !== "BORRADOR") throw new Error("Solo puedes editar tickets en borrador")

  const dt = await prisma.deliveryTicket.update({
    where: { id },
    data: {
      fecha: new Date(validated.fecha),
      clienteId: validated.clienteId,
      direccion: validated.direccion || null,
      ciudad: validated.ciudad || null,
      agente: validated.agente || null,
      motonave: validated.motonave,
      imo: validated.imo || null,
      bandera: validated.bandera || null,
      lugarSuministro: validated.lugarSuministro || null,
      tipoSuministro: validated.tipoSuministro || null,
      puerto: validated.puerto,
      productoId: validated.productoId,
      barcazaId: validated.barcazaId || null,
      capitanId: validated.capitanId || null,
      remolcadorId: validated.remolcadorId || null,
      sondajeAntes: validated.sondajeAntes ?? null,
      sondajeAntesRealizado: validated.sondajeAntesRealizado || null,
      sondajeDespues: validated.sondajeDespues ?? null,
      sondajeDespuesRealizado: validated.sondajeDespuesRealizado || null,
      sondajeTestificado: validated.sondajeTestificado || null,
      companiaEntrega: validated.companiaEntrega || null,
      verificadoPor: validated.verificadoPor || null,
      observaciones: validated.observaciones || null,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DELIVERY_TICKET",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Delivery Ticket actualizado",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/delivery")
  return serializar(dt) as typeof dt
}

// --- Calidad y Muestras ---
export async function updateDeliveryQuality(id: string, data: DeliveryQualityFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  const validated = deliveryQualitySchema.parse(data)

  const existing = await prisma.deliveryTicket.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Delivery Ticket no encontrado")

  const dt = await prisma.deliveryTicket.update({
    where: { id },
    data: {
      api: validated.api ?? null,
      gravedadEspecifica: validated.gravedadEspecifica ?? null,
      densidad: validated.densidad ?? null,
      viscosidad: validated.viscosidad ?? null,
      azufre: validated.azufre ?? null,
      agua: validated.agua ?? null,
      puntoChispa: validated.puntoChispa ?? null,
      temperatura: validated.temperatura ?? null,
      otrasPropiedades: validated.otrasPropiedades || null,
      selloProveedor: validated.selloProveedor || null,
      selloMotonave: validated.selloMotonave || null,
      marpolAnnexVi: validated.marpolAnnexVi || null,
      otraMuestra: validated.otraMuestra || null,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DELIVERY_TICKET",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Calidad y muestras actualizadas",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/delivery")
  revalidatePath(`/operaciones/delivery/${id}`)
  return serializar(dt) as typeof dt
}

// --- ETAPA 3: Cerrar (genera venta, descuenta stock) ---
export async function cerrarDeliveryTicket(
  id: string,
  almacenId: string,
  opts?: {
    numeroFactura?: string
    facturaFile?: { nombre: string; base64: string } | null
    pagado?: boolean
    comprobanteFile?: { nombre: string; base64: string } | null
  }
) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })

  const dt = await prisma.deliveryTicket.findFirst({
    where: { id, empresaId },
    include: { producto: true, cliente: true },
  })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado !== "CONFIRMADO") throw new Error("Solo puedes cerrar tickets confirmados")

  let almacen = almacenId ? await prisma.almacen.findFirst({ where: { id: almacenId, empresaId } }) : null
  if (!almacen) {
    almacen = await prisma.almacen.findFirst({ where: { empresaId } })
    if (!almacen) {
      almacen = await prisma.almacen.create({
        data: { empresaId, codigo: "PPL", nombre: "Principal", activo: true },
      })
    }
  }

  let documentoUrl: string | null = null
  let comprobanteUrl: string | null = null
  if (opts?.facturaFile?.base64) {
    const saved = await saveFile({ nombre: opts.facturaFile.nombre, base64: opts.facturaFile.base64 }, empresaId)
    documentoUrl = saved?.url ?? null
  }
  if (opts?.comprobanteFile?.base64) {
    const saved = await saveFile({ nombre: opts.comprobanteFile.nombre, base64: opts.comprobanteFile.base64 }, empresaId)
    comprobanteUrl = saved?.url ?? null
  }

  return prisma.$transaction(async (tx: any) => {
    await tx.deliveryTicket.update({ where: { id }, data: { estado: "CERRADO" } })

    let stock = await tx.inventarioStock.findUnique({
      where: { productoId_almacenId: { productoId: dt.productoId, almacenId: almacen!.id } },
    })
    if (!stock) {
      stock = await tx.inventarioStock.create({
        data: { empresaId, productoId: dt.productoId, almacenId: almacen!.id, cantidad: 0 },
      })
    }
    await tx.inventarioStock.update({
      where: { productoId_almacenId: { productoId: dt.productoId, almacenId: almacen!.id } },
      data: { cantidad: { decrement: Number(dt.cantidadEntregada) } },
    })
    await tx.movimientoInventario.create({
      data: {
        empresaId,
        productoId: dt.productoId,
        almacenOrigenId: almacen!.id,
        tipo: "SALIDA",
        cantidad: Number(dt.cantidadEntregada),
        referencia: `DT #${dt.numero}`,
        observaciones: `Delivery Ticket #${dt.numero} - ${dt.motonave}`,
      },
    })

    const lastVenta = await tx.venta.findFirst({
      where: { empresaId },
      orderBy: { numero: "desc" },
    })
    const ventaNumero = (lastVenta?.numero ?? 0) + 1
    const totalVenta = Number(dt.cantidadEntregada) * Number(dt.producto.precioUnitario ?? 0)
    const subtotal = totalVenta / 1.19
    const impuesto = totalVenta - subtotal

    const venta = await tx.venta.create({
      data: {
        empresaId,
        numero: ventaNumero,
        deliveryTicketId: id,
        clienteId: dt.clienteId,
        fecha: new Date(),
        estado: "BORRADOR",
        tipoFactura: opts?.pagado ? "CONTADO" : "CREDITO",
        notas: opts?.numeroFactura ? `Factura #${opts.numeroFactura}` : null,
        subtotal,
        impuesto,
        descuento: 0,
        total: totalVenta,
        items: {
          create: [{
            item: 1,
            descripcion: `${dt.producto.nombre} - ${dt.motonave}`,
            unidadMedida: dt.unidadMedida ?? "MT",
            cantidad: Number(dt.cantidadEntregada),
            precioUnitario: Number(dt.producto.precioUnitario ?? 0),
            descuento: 0,
            subtotal,
            impuesto,
            total: totalVenta,
          }],
        },
      },
    })

    // Crear Cuenta por Cobrar (cliente debe pagar)
    const cc = await tx.cuentaCobrar.create({
      data: {
        empresaId,
        ventaId: venta.id,
        clienteId: dt.clienteId,
        deliveryTicketId: id,
        numeroFactura: opts?.numeroFactura || `V${ventaNumero}`,
        documentoUrl,
        comprobanteUrl,
        valor: totalVenta,
        saldoPendiente: opts?.pagado ? 0 : totalVenta,
        estado: opts?.pagado ? "PAGADA" : "PENDIENTE",
      },
    })

    // Crear Factura Delivery Ticket (obligación a proveedor/operador)
    const fdt = await tx.facturaDeliveryTicket.create({
      data: {
        empresaId,
        deliveryTicketId: id,
        numeroFactura: opts?.numeroFactura || `DT #${dt.numero}`,
        valor: totalVenta,
        documentoUrl,
        comprobanteUrl,
        estado: opts?.pagado ? "PAGADA" : "PENDIENTE",
        observaciones: null,
      },
    })

    await tx.historialEstado.create({
      data: {
        empresaId,
        entidadTipo: "DELIVERY_TICKET",
        entidadId: id,
        estadoAnterior: "CONFIRMADO",
        estadoNuevo: "CERRADO",
        descripcion: `DT #${dt.numero} cerrado. Venta #${ventaNumero}, CC #${cc.id}, FDT #${fdt.id} creados. Stock descontado.`,
        usuarioId: userId,
      },
    })

    AutomationService.ejecutarEvento({
      empresaId,
      codigoEvento: "DELIVERY_TICKET_CERRADO",
      entidadTipo: "DELIVERY_TICKET",
      entidadId: id,
      usuarioId: userId,
    }).catch(() => {})

    notificarPorPermiso({
      empresaId,
      tipo: "success",
      titulo: "Delivery Ticket Cerrado",
      mensaje: `DT #${dt.numero} cerrado. Venta #${ventaNumero}, CuentaCobrar y Factura Delivery Ticket generadas.`,
      referenciaId: id,
      referenciaTipo: "DELIVERY_TICKET",
      recurso: "delivery_ticket",
      accion: "READ",
      excluirUsuarioId: userId,
    })

    revalidatePath("/operaciones/delivery")
    revalidatePath("/ventas")
    revalidatePath("/cuentas-cobrar")
    revalidatePath("/operaciones/delivery/" + id)
    return { ventaId: venta.id, ventaNumero, cuentaCobrarId: cc.id, facturaDeliveryTicketId: fdt.id }
  })
}

export async function getFacturasDeliveryTicketAll() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  const data = await prisma.facturaDeliveryTicket.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      deliveryTicket: {
        include: {
          cliente: { select: { id: true, nombre: true, rfc: true, email: true, telefono: true } },
          producto: { select: { id: true, nombre: true } },
        },
      },
    },
  })
  return serializar(data) as typeof data
}

export async function pagarFacturaDeliveryTicket(id: string, opts?: { comprobanteFile?: { nombre: string; base64: string } | null }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })

  const factura = await prisma.facturaDeliveryTicket.findFirst({ where: { id, empresaId } })
  if (!factura) throw new Error("Factura no encontrada")
  if (factura.estado === "PAGADA") throw new Error("La factura ya está pagada")
  if (factura.estado === "CANCELADA") throw new Error("La factura está cancelada")

  let comprobanteUrl: string | null = null
  if (opts?.comprobanteFile?.base64) {
    const saved = await saveFile(opts.comprobanteFile, empresaId)
    comprobanteUrl = saved?.url ?? null
  }

  const updated = await prisma.facturaDeliveryTicket.update({
    where: { id },
    data: { estado: "PAGADA", comprobanteUrl: comprobanteUrl || factura.comprobanteUrl },
  })

  notificarPorPermiso({
    empresaId,
    tipo: "success",
    titulo: "Factura Delivery Ticket Pagada",
    mensaje: `Factura #${factura.numeroFactura ?? ""} marcada como PAGADA`,
    referenciaId: id,
    referenciaTipo: "DELIVERY_TICKET",
    recurso: "delivery_ticket",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/facturas")
  revalidatePath("/operaciones/delivery/" + factura.deliveryTicketId)
  return serializar(updated) as typeof updated
}

export async function getFacturasDeliveryTicket(deliveryTicketId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })
  const data = await prisma.facturaDeliveryTicket.findMany({
    where: { empresaId, deliveryTicketId },
    orderBy: { createdAt: "desc" },
  })
  return serializar(data) as typeof data
}

export async function deleteDeliveryTicket(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "DELETE" })
  const existing = await prisma.deliveryTicket.findFirst({
    where: { id, empresaId },
    include: { ventas: { select: { id: true } } },
  })
  if (!existing) throw new Error("Delivery Ticket no encontrado")
  if (existing.estado === "CERRADO") throw new Error("No puedes eliminar un ticket cerrado")
  if (existing.ventas.length > 0) throw new Error("No puedes eliminar un ticket con ventas asociadas")
  await prisma.deliveryTicket.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "DELIVERY_TICKET",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Delivery Ticket eliminado para regenerar",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/delivery")
}

// --- Timeline Events ---
export async function addTimelineEvent(deliveryTicketId: string, data: { evento: string; fecha: string; hora?: string; observacion?: string }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: deliveryTicketId, empresaId } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado === "CERRADO" || dt.estado === "CANCELADO") throw new Error("No se pueden agregar eventos a tickets cerrados o cancelados")

  const event = await prisma.deliveryTicketTimeline.create({
    data: {
      deliveryTicketId,
      evento: data.evento,
      fecha: new Date(data.fecha),
      hora: data.hora || null,
      usuarioId: userId,
      observacion: data.observacion || null,
    },
  })
  revalidatePath(`/operaciones/delivery/${deliveryTicketId}`)
  return event
}

export async function deleteTimelineEvent(id: string, deliveryTicketId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  await prisma.deliveryTicketTimeline.delete({ where: { id } })
  revalidatePath(`/operaciones/delivery/${deliveryTicketId}`)
}

// --- Evidencias ---
export async function addEvidencia(deliveryTicketId: string, file: { nombre: string; base64: string; tipo: string }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: deliveryTicketId, empresaId } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")

  const saved = await saveFile(file, empresaId)
  if (!saved) throw new Error("Error al guardar el archivo")

  const evidencia = await prisma.deliveryTicketEvidencia.create({
    data: {
      deliveryTicketId,
      nombre: saved.nombre,
      url: saved.url,
      tipo: file.tipo,
      tamaño: saved.tamaño,
    },
  })
  revalidatePath(`/operaciones/delivery/${deliveryTicketId}`)
  return evidencia
}

export async function deleteEvidencia(id: string, deliveryTicketId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  await prisma.deliveryTicketEvidencia.delete({ where: { id } })
  revalidatePath(`/operaciones/delivery/${deliveryTicketId}`)
}

// --- Firmas ---
export async function addFirma(deliveryTicketId: string, data: { rol: string; nombre: string; firma: string; sello?: string }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: deliveryTicketId, empresaId } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")

  const savedFirma = data.firma
    ? await saveFile({ nombre: `firma_${data.rol}_${Date.now()}.png`, base64: data.firma }, empresaId)
    : null

  let savedSello = null
  if (data.sello) {
    const isBase64 = data.sello.startsWith("data:") || /^[A-Za-z0-9+/=]+$/.test(data.sello)
    if (isBase64) {
      const base64Data = data.sello.includes("base64,") ? data.sello.split("base64,")[1] : data.sello
      savedSello = await saveFile({ nombre: `sello_${data.rol}_${Date.now()}.png`, base64: base64Data }, empresaId)
    }
  }

  const firma = await prisma.deliveryTicketFirma.create({
    data: {
      deliveryTicketId,
      rol: data.rol,
      nombre: data.nombre,
      firma: savedFirma?.url ?? data.firma,
      sello: savedSello?.url ?? (data.sello || null),
    },
  })
  revalidatePath(`/operaciones/delivery/${deliveryTicketId}`)
  return firma
}

export async function deleteFirma(id: string, deliveryTicketId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "UPDATE" })
  await prisma.deliveryTicketFirma.delete({ where: { id } })
  revalidatePath(`/operaciones/delivery/${deliveryTicketId}`)
}
