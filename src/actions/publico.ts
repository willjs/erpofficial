"use server"

import { prisma } from "@/lib/prisma"
import { generarAsiento } from "./motor-contable"
import { notificarPorPermiso } from "./notificaciones"

export async function obtenerCotizacionPublica(token: string) {
  const cot = await prisma.cotizacion.findFirst({
    where: { tokenPublico: token },
    include: {
      proveedor: { select: { razonSocial: true, nit: true } },
      items: { orderBy: { item: "asc" } },
    },
  })
  if (!cot) return null
  return {
    id: cot.id,
    numero: cot.numero,
    fecha: cot.fecha instanceof Date ? cot.fecha.toISOString() : cot.fecha,
    proveedor: cot.proveedor.razonSocial,
    nit: cot.proveedor.nit,
    valorTotal: Number(cot.valorTotal),
    tiempoEntrega: cot.tiempoEntrega,
    formaPago: cot.formaPago,
    observaciones: cot.observaciones,
    items: cot.items.map((i) => ({
      item: i.item,
      descripcion: i.descripcion,
      unidadMedida: i.unidadMedida,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
    aprobada: cot.aprobadaPublicamente,
    fechaAprobacion: cot.fechaAprobacionPublica?.toISOString() ?? null,
  }
}

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

export async function aprobarCotizacionPublica(token: string, codigo: string) {
  const cot = await prisma.cotizacion.findFirst({
    where: { tokenPublico: token },
    select: { id: true, aprobadaPublicamente: true, numero: true, empresaId: true, requisicionId: true },
  })
  if (!cot) throw new Error("Link inválido")
  if (cot.aprobadaPublicamente) throw new Error("Ya fue aprobada")

  const codigoRec = await prisma.codigoAprobacion.findFirst({
    where: { empresaId: cot.empresaId, codigo: codigo.trim().toUpperCase(), activo: true },
  })
  if (!codigoRec) throw new Error("Código de aprobación incorrecto o inactivo")

  await prisma.$transaction(async (tx: any) => {
    await tx.cotizacion.updateMany({
      where: { requisicionId: cot.requisicionId, empresaId: cot.empresaId },
      data: { ganadora: false },
    })
    await tx.cotizacion.update({
      where: { id: cot.id },
      data: { aprobadaPublicamente: true, fechaAprobacionPublica: new Date(), ganadora: true },
    })
  })

  await registrarHistorial({
    empresaId: cot.empresaId,
    entidadTipo: "COTIZACION",
    entidadId: cot.id,
    estadoAnterior: "REGISTRADA",
    estadoNuevo: "APROBADA_PUBLICAMENTE",
    descripcion: "Cotización aprobada públicamente y seleccionada como ganadora",
    referenciaId: cot.requisicionId,
  })

  return { success: true, numero: cot.numero }
}

export async function obtenerComparativoPublico(token: string) {
  const link = await prisma.linkComparativo.findFirst({
    where: { token, activo: true },
    include: {
      requisicion: { select: { numero: true, fecha: true, observaciones: true, requeridoPor: true } }
    }
  })
  if (!link) return null

  const cotizacionesIds = link.cotizacionesId as string[]
  const cots = await prisma.cotizacion.findMany({
    where: { id: { in: cotizacionesIds } },
    include: {
      proveedor: { select: { razonSocial: true, nit: true } },
      items: { orderBy: { item: "asc" } },
    },
    orderBy: { valorTotal: "asc" },
  })

  return {
    id: link.id,
    requisicion: link.requisicion,
    cotizaciones: cots.map(cot => ({
      id: cot.id,
      numero: cot.numero,
      fecha: cot.fecha instanceof Date ? cot.fecha.toISOString() : cot.fecha,
      proveedor: cot.proveedor.razonSocial,
      nit: cot.proveedor.nit,
      valorTotal: Number(cot.valorTotal),
      tiempoEntrega: cot.tiempoEntrega,
      formaPago: cot.formaPago,
      observaciones: cot.observaciones,
      items: cot.items.map(i => ({
        item: i.item,
        descripcion: i.descripcion,
        unidadMedida: i.unidadMedida,
        cantidad: Number(i.cantidad),
        valorUnitario: Number(i.valorUnitario),
        valorTotal: Number(i.valorTotal),
      })),
      aprobada: cot.aprobadaPublicamente,
      fechaAprobacion: cot.fechaAprobacionPublica?.toISOString() ?? null,
      ganadora: cot.ganadora,
    }))
  }
}

export async function aprobarComparativoPublico(token: string, cotizacionId: string, codigo: string) {
  const link = await prisma.linkComparativo.findFirst({
    where: { token, activo: true },
    select: { empresaId: true, requisicionId: true, cotizacionesId: true }
  })
  if (!link) throw new Error("Link inválido o expirado")
  
  const cotizacionesIds = link.cotizacionesId as string[]
  if (!cotizacionesIds.includes(cotizacionId)) throw new Error("La cotización no pertenece a este comparativo")

  const cot = await prisma.cotizacion.findFirst({
    where: { id: cotizacionId },
    select: { id: true, aprobadaPublicamente: true, numero: true, empresaId: true, requisicionId: true },
  })
  if (!cot) throw new Error("Cotización no encontrada")
  if (cot.aprobadaPublicamente) throw new Error("Ya fue aprobada")

  const codigoRec = await prisma.codigoAprobacion.findFirst({
    where: { empresaId: cot.empresaId, codigo: codigo.trim().toUpperCase(), activo: true },
  })
  if (!codigoRec) throw new Error("Código de aprobación incorrecto o inactivo")

  await prisma.$transaction(async (tx: any) => {
    // Desmarcar todas las cotizaciones de la misma requisición
    await tx.cotizacion.updateMany({
      where: { requisicionId: cot.requisicionId, empresaId: cot.empresaId },
      data: { ganadora: false },
    })
    // Marcar la ganadora
    await tx.cotizacion.update({
      where: { id: cot.id },
      data: { aprobadaPublicamente: true, fechaAprobacionPublica: new Date(), ganadora: true },
    })
  })

  await registrarHistorial({
    empresaId: cot.empresaId,
    entidadTipo: "COTIZACION",
    entidadId: cot.id,
    estadoAnterior: "REGISTRADA",
    estadoNuevo: "APROBADA_PUBLICAMENTE",
    descripcion: "Cotización aprobada públicamente desde comparativo",
    referenciaId: cot.requisicionId,
  })

  return { success: true, numero: cot.numero }
}

// ─── Link Público Orden de Compra ────────────────────────

export async function obtenerOrdenCompraPublica(token: string) {
  const oc = await prisma.ordenCompra.findFirst({
    where: { tokenPublico: token },
    include: {
      proveedor: { select: { razonSocial: true, nit: true, email: true, telefono: true, contacto: true, emailFactura: true } },
      requisicion: { select: { numero: true } },
      cotizacion: { select: { numero: true } },
      centroCostos: { select: { nombre: true } },
      empresa: { select: { nombre: true, logo: true } },
      items: { orderBy: { item: "asc" } },
      cuentasPagar: { take: 1, orderBy: { createdAt: "desc" }, select: { id: true, numeroFactura: true, valor: true, estado: true } },
    },
  })
  if (!oc) return null

  const cp = oc.cuentasPagar[0]

  return {
    id: oc.id,
    numero: oc.numero,
    fecha: oc.fecha instanceof Date ? oc.fecha.toISOString() : oc.fecha,
    empresa: oc.empresa.nombre,
    logo: oc.empresa.logo,
    proveedor: oc.proveedor.razonSocial,
    nit: oc.proveedor.nit,
    email: oc.proveedor.email,
    telefono: oc.proveedor.telefono,
    contacto: oc.proveedor.contacto,
    emailFactura: oc.proveedor.emailFactura,
    correoFacturacion: oc.correoFacturacion,
    numeroRequisicion: oc.requisicion.numero,
    numeroCotizacion: oc.cotizacion?.numero ?? null,
    centroCostos: oc.centroCostos?.nombre ?? null,
    subtotal: Number(oc.subtotal),
    descuento: Number(oc.descuento),
    iva: Number(oc.iva),
    valorTotal: Number(oc.valorTotal),
    condicionesComerciales: oc.condicionesComerciales,
    fechaEntrega: oc.fechaEntrega?.toISOString() ?? null,
    sitioEntrega: oc.sitioEntrega,
    formaPago: oc.formaPago,
    observaciones: oc.observaciones,
    elaboradoPor: oc.elaboradoPor,
    solicitadoPor: oc.solicitadoPor,
    items: oc.items.map((i) => ({
      item: i.item,
      descripcion: i.descripcion,
      unidadMedida: i.unidadMedida,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
      tipoIva: i.tipoIva,
    })),
    facturaRegistrada: cp ? {
      id: cp.id,
      numeroFactura: cp.numeroFactura,
      valor: Number(cp.valor),
      estado: cp.estado,
    } : null,
  }
}

export async function registrarFacturaDesdeOC(token: string, data: { numeroFactura: string; valor: number; fechaFactura?: string }) {
  const oc = await prisma.ordenCompra.findFirst({
    where: { tokenPublico: token },
    include: { cuentasPagar: { take: 1 } },
  })
  if (!oc) throw new Error("Link inválido o expirado")
  if (oc.cuentasPagar.length > 0) throw new Error("Ya se registró una factura para esta orden")

  if (!data.numeroFactura?.trim()) throw new Error("Número de factura requerido")
  if (!data.valor || data.valor <= 0) throw new Error("Valor de factura inválido")

  const cp = await prisma.cuentaPagar.create({
    data: {
      empresaId: oc.empresaId,
      ordenCompraId: oc.id,
      numeroFactura: data.numeroFactura.trim(),
      fechaFactura: data.fechaFactura ? new Date(data.fechaFactura) : new Date(),
      valor: data.valor,
      saldoPendiente: data.valor,
      estado: "ENVIADA_TESORERIA",
    },
  })

  await prisma.ordenCompra.update({
    where: { id: oc.id },
    data: { estado: "FACTURADA" },
  })

  await prisma.historialEstado.create({
    data: {
      empresaId: oc.empresaId,
      entidadTipo: "ORDEN_COMPRA",
      entidadId: oc.id,
      estadoAnterior: "EMITIDA",
      estadoNuevo: "FACTURADA",
      descripcion: `Factura No. ${data.numeroFactura} registrada por el proveedor`,
    },
  })

  await prisma.historialEstado.create({
    data: {
      empresaId: oc.empresaId,
      entidadTipo: "CUENTA_PAGAR",
      entidadId: cp.id,
      estadoNuevo: "ENVIADA_TESORERIA",
      descripcion: `Factura No. ${data.numeroFactura} registrada desde link público - $${Number(data.valor).toLocaleString("es-CO")}`,
    },
  })

  generarAsiento("FACTURA_PROVEEDOR", cp.id).catch(() => {})
  notificarPorPermiso({
    empresaId: oc.empresaId,
    recurso: "cuenta_pagar",
    accion: "CREATE",
    tipo: "CUENTA_PAGAR",
    titulo: "Nueva factura de proveedor",
    mensaje: `Factura No. ${data.numeroFactura} registrada para OC #${oc.numero}`,
    referenciaId: cp.id,
    referenciaTipo: "CUENTA_PAGAR",
  }).catch(() => {})

  return { success: true, numeroFactura: data.numeroFactura }
}
