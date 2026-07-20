"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import { generarAsiento } from "./motor-contable"
import { notificarPorPermiso } from "./notificaciones"
import { uuid } from "@/lib/utils"
import { AutomationService } from "@/lib/automation-service"

function serializar(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serializar)
  if (typeof (obj as any).toNumber === "function") return Number(obj as any)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializar(value)
  }
  return result
}

// ─── Historial de Estados ─────────────────────────────────

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

async function crearNotificacion(params: {
  empresaId: string
  usuarioId?: string | null
  tipo: string
  titulo: string
  mensaje: string
  referenciaId?: string | null
  referenciaTipo?: string | null
}) {
  await prisma.notificacion.create({
    data: {
      empresaId: params.empresaId,
      usuarioId: params.usuarioId ?? null,
      tipo: params.tipo,
      titulo: params.titulo,
      mensaje: params.mensaje,
      referenciaId: params.referenciaId ?? null,
      referenciaTipo: params.referenciaTipo ?? null,
    },
  })
}

async function getUsuariosByPuesto(empresaId: string, puesto: string): Promise<string[]> {
  const usuarios = await prisma.usuario.findMany({
    where: { empresaId, puesto: { contains: puesto } },
    select: { id: true },
  })
  return usuarios.map((u) => u.id)
}

export async function getHistorial(entidadTipo: string, entidadId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "READ" })
  const data = await prisma.historialEstado.findMany({
    where: { entidadTipo, entidadId },
    include: { usuario: { select: { nombre: true, email: true } } },
    orderBy: { createdAt: "asc" },
  })
  return data.map((h) => ({
    ...h,
    createdAt: h.createdAt.toISOString(),
  }))
}

// ─── Centro de Costos ─────────────────────────────────────

const centroCostosSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
})

export type CentroCostosFormData = z.infer<typeof centroCostosSchema>

export async function getCentrosCostos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "READ" })
  return prisma.centroCostos.findMany({
    where: { empresaId, activo: true },
    orderBy: { codigo: "asc" },
  })
}

export async function createCentroCostos(data: CentroCostosFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "CREATE" })
  const validated = centroCostosSchema.parse(data)
  const existingCodigo = await prisma.centroCostos.findFirst({ where: { empresaId, codigo: validated.codigo, activo: true } })
  if (existingCodigo) throw new Error("Ya existe un centro de costos activo con ese código")
  const cc = await prisma.centroCostos.create({
    data: { empresaId, ...validated, descripcion: validated.descripcion ?? null },
  })
  revalidatePath("/compras")
  return cc
}

export async function updateCentroCostos(id: string, data: CentroCostosFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "UPDATE" })
  const validated = centroCostosSchema.parse(data)
  const existingCodigo = await prisma.centroCostos.findFirst({ where: { empresaId, codigo: validated.codigo, activo: true, id: { not: id } } })
  if (existingCodigo) throw new Error("Ya existe otro centro de costos activo con ese código")
  const cc = await prisma.centroCostos.update({
    where: { id, empresaId },
    data: { ...validated, descripcion: validated.descripcion ?? null },
  })
  revalidatePath("/compras")
  return cc
}

export async function deleteCentroCostos(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "DELETE" })
  await prisma.centroCostos.update({
    where: { id, empresaId },
    data: { activo: false },
  })
  revalidatePath("/compras")
}

// ─── Proveedores ──────────────────────────────────────────

const proveedorSchema = z.object({
  razonSocial: z.string().min(1, "Razón social requerida"),
  nit: z.string().min(1, "NIT requerido"),
  contacto: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  emailFactura: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
})

export type ProveedorFormData = z.infer<typeof proveedorSchema>

export async function getProveedores(soloActivos = true) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proveedor", accion: "READ" })
  return prisma.proveedor.findMany({
    where: { empresaId, activo: soloActivos },
    orderBy: { razonSocial: "asc" },
  })
}

export async function createProveedor(data: ProveedorFormData & { archivos?: { nombre: string; base64: string }[] }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proveedor", accion: "CREATE" })
  const validated = proveedorSchema.parse(data)
  const existingNIT = await prisma.proveedor.findFirst({ where: { empresaId, nit: validated.nit, activo: true } })
  if (existingNIT) throw new Error("Ya existe un proveedor activo con ese NIT")

  const archivos: { nombre: string; url: string; tamaño: number }[] = []
  if (data.archivos?.length) {
    for (const f of data.archivos) {
      if (f.base64) {
        const saved = await saveFile(f, empresaId)
        if (saved) archivos.push(saved)
      }
    }
  }

  const prov = await prisma.proveedor.create({
    data: { empresaId, ...validated, contacto: validated.contacto ?? null, telefono: validated.telefono ?? null, email: validated.email ?? null, emailFactura: validated.emailFactura ?? null, direccion: validated.direccion ?? null, archivos: archivos.length > 0 ? archivos : undefined },
  })
  revalidatePath("/compras")
  revalidatePath("/proveedores")
  return prov
}

export async function updateProveedor(id: string, data: ProveedorFormData & { archivos?: { nombre: string; base64: string }[] }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proveedor", accion: "UPDATE" })
  const validated = proveedorSchema.parse(data)
  const existingNIT = await prisma.proveedor.findFirst({ where: { empresaId, nit: validated.nit, activo: true, id: { not: id } } })
  if (existingNIT) throw new Error("Ya existe otro proveedor activo con ese NIT")

  const existing = await prisma.proveedor.findUnique({ where: { id, empresaId }, select: { archivos: true } })
  const archivosExistentes: { nombre: string; url: string; tamaño: number }[] = existing?.archivos ? (existing.archivos as any[]) : []

  const nuevosArchivos: { nombre: string; url: string; tamaño: number }[] = []
  if (data.archivos?.length) {
    for (const f of data.archivos) {
      if (f.base64) {
        const saved = await saveFile(f, empresaId)
        if (saved) nuevosArchivos.push(saved)
      }
    }
  }

  const archivos = [...archivosExistentes, ...nuevosArchivos]

  const prov = await prisma.proveedor.update({
    where: { id, empresaId },
    data: { ...validated, contacto: validated.contacto ?? null, telefono: validated.telefono ?? null, email: validated.email ?? null, emailFactura: validated.emailFactura ?? null, direccion: validated.direccion ?? null, archivos: archivos.length > 0 ? archivos : [] },
  })
  revalidatePath("/compras")
  revalidatePath("/proveedores")
  return prov
}

export async function deleteProveedor(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proveedor", accion: "DELETE" })
  await prisma.proveedor.update({
    where: { id, empresaId },
    data: { activo: false },
  })
  revalidatePath("/compras")
  revalidatePath("/proveedores")
}

export async function deleteProveedorArchivo(proveedorId: string, url: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "proveedor", accion: "UPDATE" })
  const prov = await prisma.proveedor.findUnique({ where: { id: proveedorId, empresaId }, select: { archivos: true } })
  if (!prov) throw new Error("Proveedor no encontrado")
  const archivos: { nombre: string; url: string; tamaño: number }[] = prov.archivos ? (prov.archivos as any[]) : []
  const filtrados = archivos.filter((a) => a.url !== url)
  await prisma.proveedor.update({
    where: { id: proveedorId, empresaId },
    data: { archivos: filtrados.length > 0 ? filtrados : [] },
  })
  revalidatePath("/proveedores")
  return true
}

// ─── Requisiciones ────────────────────────────────────────

const requisicionItemSchema = z.object({
  item: z.number(),
  descripcion: z.string().min(1, "Descripción requerida"),
  centroCostosId: z.string().nullable().optional(),
  unidadMedida: z.string().min(1, "Unidad requerida"),
  cantidadSolicitada: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
})

const requisicionSchema = z.object({
  areaSolicitante: z.string().min(1, "Área requerida"),
  requeridoPor: z.string().min(1, "Requerido por requerido"),
  autorizadoPor: z.string().nullable().optional(),
  destino: z.string().nullable().optional(),
  prioridad: z.enum(["NORMAL", "URGENTE", "EMERGENCIA"]),
  observaciones: z.string().nullable().optional(),
  items: z.array(requisicionItemSchema).min(1, "Al menos un ítem requerido"),
})

export type RequisicionFormData = z.infer<typeof requisicionSchema>

function serializeRequisicion(r: any) {
  return serializar({
    ...r,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : r.updatedAt,
    items: r.items?.map((i: any) => ({
      ...i,
      cantidadSolicitada: Number(i.cantidadSolicitada),
    })),
  })
}

export async function getRequisiciones() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "READ" })
  const data = await prisma.requisicion.findMany({
    where: { empresaId },
    include: {
      items: { include: { centroCostos: true }, orderBy: { item: "asc" } },
      _count: { select: { cotizaciones: true, ordenesCompra: true } },
    },
    orderBy: { numero: "desc" },
  })
  return data.map(serializeRequisicion)
}

export async function getRequisicion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "READ" })
  const data = await prisma.requisicion.findFirst({
    where: { id, empresaId },
    include: {
      items: { include: { centroCostos: true }, orderBy: { item: "asc" } },
      cotizaciones: { include: { proveedor: true, items: true }, orderBy: { fecha: "desc" } },
      ordenesCompra: { include: { proveedor: true }, orderBy: { fecha: "desc" } },
    },
  })
  if (!data) throw new Error("Requisición no encontrada")
  return serializeRequisicion(data)
}

async function getNextRequisicionNumero(empresaId: string): Promise<number> {
  const last = await prisma.requisicion.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (last?.numero ?? 0) + 1
}

export async function createRequisicion(data: RequisicionFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "CREATE" })
  const validated = requisicionSchema.parse(data)
  const numero = await getNextRequisicionNumero(empresaId)

  const req = await prisma.requisicion.create({
    data: {
      empresaId,
      numero,
      areaSolicitante: validated.areaSolicitante,
      requeridoPor: validated.requeridoPor,
      autorizadoPor: validated.autorizadoPor ?? null,
      destino: validated.destino ?? null,
      prioridad: validated.prioridad,
      estado: "BORRADOR",
      observaciones: validated.observaciones ?? null,
      items: {
        create: validated.items.map((i) => ({
          item: i.item,
          descripcion: i.descripcion,
          centroCostosId: i.centroCostosId ?? null,
          unidadMedida: i.unidadMedida,
          cantidadSolicitada: i.cantidadSolicitada,
        })),
      },
    },
    include: {
      items: { include: { centroCostos: true }, orderBy: { item: "asc" } },
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "REQUISICION",
    entidadId: req.id,
    estadoNuevo: "BORRADOR",
    descripcion: "Requisición creada",
    usuarioId: userId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "REQUISICION_CREADA",
    entidadTipo: "REQUISICION",
    entidadId: req.id,
    usuarioId: userId,
  }).catch(() => {})

  revalidatePath("/compras")
  return serializeRequisicion(req)
}

export async function updateRequisicion(id: string, data: RequisicionFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "UPDATE" })
  const validated = requisicionSchema.parse(data)

  const existing = await prisma.requisicion.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Requisición no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("Solo se puede editar requisiciones en borrador")

  const req = await prisma.$transaction(async (tx: any) => {
    await tx.requisicionItem.deleteMany({ where: { requisicionId: id } })
    return tx.requisicion.update({
      where: { id },
      data: {
        areaSolicitante: validated.areaSolicitante,
        requeridoPor: validated.requeridoPor,
        autorizadoPor: validated.autorizadoPor ?? null,
        destino: validated.destino ?? null,
        prioridad: validated.prioridad,
        observaciones: validated.observaciones ?? null,
        items: {
          create: validated.items.map((i: any) => ({
            item: i.item,
            descripcion: i.descripcion,
            centroCostosId: i.centroCostosId ?? null,
            unidadMedida: i.unidadMedida,
            cantidadSolicitada: i.cantidadSolicitada,
          })),
        },
      },
      include: {
        items: { include: { centroCostos: true }, orderBy: { item: "asc" } },
      },
    })
  })

  revalidatePath("/compras")
  return serializeRequisicion(req)
}

export async function deleteRequisicion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "DELETE" })
  const existing = await prisma.requisicion.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Requisición no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("Solo se puede eliminar requisiciones en borrador")
  await prisma.requisicion.delete({ where: { id } })
  revalidatePath("/compras")
}

export async function enviarRequisicion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "requisicion", accion: "ENVIAR" })
  const existing = await prisma.requisicion.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Requisición no encontrada")
  if (existing.estado !== "BORRADOR") throw new Error("La requisición debe estar en borrador")

  await prisma.requisicion.update({
    where: { id },
    data: { estado: "EN_COTIZACION" },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "REQUISICION",
    entidadId: id,
    estadoAnterior: "BORRADOR",
    estadoNuevo: "EN_COTIZACION",
    descripcion: "Enviada a cotización",
    usuarioId: userId,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "REQUISICION_ENVIADA",
    entidadTipo: "REQUISICION",
    entidadId: id,
    usuarioId: userId,
  }).catch(() => {})

  revalidatePath("/compras")
}

// ─── Cotizaciones ─────────────────────────────────────────

export async function getCotizaciones(requisicionId?: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "READ" })
  const where: any = { empresaId }
  if (requisicionId) where.requisicionId = requisicionId

  const data = await prisma.cotizacion.findMany({
    where,
    include: {
      proveedor: true,
      requisicion: { select: { id: true, numero: true } },
      items: { orderBy: { item: "asc" } },
    },
    orderBy: { fecha: "desc" },
  })
  return data.map((c: any) => serializar({
    ...c,
    fecha: c.fecha instanceof Date ? c.fecha.toISOString() : c.fecha,
    valorTotal: Number(c.valorTotal),
    items: c.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  })) as any
}

const cotizacionItemSchema = z.object({
  item: z.number(),
  descripcion: z.string().min(1, "Descripción requerida"),
  unidadMedida: z.string().min(1, "Unidad requerida"),
  cantidad: z.coerce.number().positive(),
  valorUnitario: z.coerce.number().min(0),
  valorTotal: z.coerce.number().min(0),
  valorProveedor1: z.coerce.number().min(0).nullable().optional(),
  valorProveedor2: z.coerce.number().min(0).nullable().optional(),
  valorProveedor3: z.coerce.number().min(0).nullable().optional(),
})

const cotizacionSchema = z.object({
  requisicionId: z.string().min(1, "Requisición requerida"),
  proveedorId: z.string().min(1, "Proveedor requerido"),
  tiempoEntrega: z.string().nullable().optional(),
  formaPago: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  items: z.array(cotizacionItemSchema).min(1, "Al menos un ítem requerido"),
  archivos: z.any().optional(),
})

export type CotizacionFormData = z.infer<typeof cotizacionSchema>

async function getNextCotizacionNumero(empresaId: string): Promise<number> {
  const last = await prisma.cotizacion.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (last?.numero ?? 0) + 1
}

async function saveFile(file: { nombre: string; base64: string }, empresaId: string): Promise<{ nombre: string; url: string; tamaño: number } | null> {
  try {
    const buffer = Buffer.from(file.base64, "base64")
    const uploadDir = path.join(process.cwd(), "public", "uploads", empresaId)
    await mkdir(uploadDir, { recursive: true })
    const fileName = `${Date.now()}_${file.nombre.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    await writeFile(path.join(uploadDir, fileName), buffer)
    return { nombre: file.nombre, url: `/uploads/${empresaId}/${fileName}`, tamaño: buffer.length }
  } catch {
    return null
  }
}

export async function createCotizacion(data: CotizacionFormData & { archivos?: { nombre: string; base64: string }[] }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "CREATE" })
  const validated = cotizacionSchema.parse(data)
  const numero = await getNextCotizacionNumero(empresaId)

  const reqCheck = await prisma.requisicion.findFirst({
    where: { id: validated.requisicionId, empresaId },
    select: { estado: true },
  })
  if (!reqCheck) throw new Error("Requisición no encontrada")
  if (reqCheck.estado !== "EN_COTIZACION") throw new Error("La requisición debe estar en cotización para agregar cotizaciones")

  const proveedorExists = await prisma.proveedor.findFirst({ where: { id: validated.proveedorId, empresaId }, select: { id: true } })
  if (!proveedorExists) throw new Error("Proveedor no encontrado o no pertenece a esta empresa")

  const valorTotal = validated.items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.valorProveedor1 ?? 0)), 0)

  const archivos: { nombre: string; url: string; tamaño: number }[] = []
  if (data.archivos?.length) {
    for (const f of data.archivos) {
      if ((f as any).base64) {
        const saved = await saveFile(f as { nombre: string; base64: string }, empresaId)
        if (saved) archivos.push(saved)
      }
    }
  }

  const cot = await prisma.cotizacion.create({
    data: {
      empresaId,
      requisicionId: validated.requisicionId,
      proveedorId: validated.proveedorId,
      numero,
      valorTotal,
      tiempoEntrega: validated.tiempoEntrega ?? null,
      formaPago: validated.formaPago ?? null,
      observaciones: validated.observaciones ?? null,
      archivos: archivos.length > 0 ? archivos : undefined,
      items: {
        create: validated.items.map((i) => ({
          item: i.item,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: i.cantidad,
          valorUnitario: Number(i.valorUnitario),
          valorTotal: Number(i.valorTotal),
          valorProveedor1: i.valorProveedor1 ?? null,
          valorProveedor2: i.valorProveedor2 ?? null,
          valorProveedor3: i.valorProveedor3 ?? null,
        })),
      },
    },
    include: { proveedor: true, items: true },
  })

  await prisma.requisicion.update({
    where: { id: validated.requisicionId },
    data: { estado: "EN_COTIZACION" },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "REQUISICION",
    entidadId: validated.requisicionId,
    estadoAnterior: reqCheck.estado,
    estadoNuevo: "EN_COTIZACION",
    descripcion: "Cotización registrada",
    usuarioId: userId,
    referenciaId: cot.id,
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "COTIZACION",
    entidadId: cot.id,
    estadoNuevo: "REGISTRADA",
    descripcion: `Cotización #${numero} creada`,
    usuarioId: userId,
    referenciaId: validated.requisicionId,
  })

  revalidatePath("/compras")
  return serializar({
    ...cot,
    fecha: cot.fecha.toISOString(),
    valorTotal: Number(cot.valorTotal),
    items: cot.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }) as any
}

export async function getCotizacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "READ" })
  const data = await prisma.cotizacion.findFirst({
    where: { id, empresaId },
    include: {
      proveedor: true,
      requisicion: { select: { id: true, numero: true } },
      items: true,
    },
  })
  if (!data) throw new Error("Cotización no encontrada")
  return serializar({
    ...data,
    fecha: data.fecha.toISOString(),
    valorTotal: Number(data.valorTotal),
    items: data.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }) as any
}

export async function updateCotizacion(id: string, data: CotizacionFormData & { archivos?: { nombre: string; base64: string }[] }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "UPDATE" })
  const validated = cotizacionSchema.parse(data)

  const existing = await prisma.cotizacion.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Cotización no encontrada")

  const valorTotal = validated.items.reduce((s, i) => s + (Number(i.cantidad) * Number(i.valorProveedor1 ?? 0)), 0)

  const archivos: { nombre: string; url: string; tamaño: number }[] = []
  if (data.archivos?.length) {
    for (const f of data.archivos) {
      if ((f as any).base64) {
        const saved = await saveFile(f as { nombre: string; base64: string }, empresaId)
        if (saved) archivos.push(saved)
      } else if ((f as any).url) {
        archivos.push({ nombre: f.nombre, url: (f as any).url, tamaño: 0 })
      }
    }
  }

  const cot = await prisma.$transaction(async (tx: any) => {
    await tx.cotizacionItem.deleteMany({ where: { cotizacionId: id } })
    return tx.cotizacion.update({
      where: { id },
      data: {
        proveedor: { connect: { id: validated.proveedorId } },
        valorTotal,
        tiempoEntrega: validated.tiempoEntrega ?? null,
        formaPago: validated.formaPago ?? null,
        observaciones: validated.observaciones ?? null,
        items: {
          create: validated.items.map((i: any) => ({
            item: i.item,
            descripcion: i.descripcion,
            unidadMedida: i.unidadMedida,
            cantidad: i.cantidad,
            valorUnitario: Number(i.valorUnitario),
            valorTotal: Number(i.valorTotal),
            valorProveedor1: i.valorProveedor1 ?? null,
            valorProveedor2: i.valorProveedor2 ?? null,
            valorProveedor3: i.valorProveedor3 ?? null,
          })),
        },
      },
      include: { proveedor: true, items: true },
    })
  })

  await prisma.cotizacion.update({
    where: { id },
    data: { archivos },
  })

  revalidatePath("/compras")
  return serializar({
    ...cot,
    archivos,
    fecha: cot.fecha.toISOString(),
    valorTotal: Number(cot.valorTotal),
    items: cot.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }) as any
}

export async function deleteCotizacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "DELETE" })
  const existing = await prisma.cotizacion.findFirst({ where: { id, empresaId }, include: { ordenesCompra: { where: { estado: { not: "CERRADA" } } } } })
  if (!existing) throw new Error("Cotización no encontrada")
  if (existing.ordenesCompra.length > 0) throw new Error("No se puede eliminar una cotización con órdenes de compra activas")
  if (existing.ganadora) throw new Error("No se puede eliminar la cotización ganadora")

  await prisma.cotizacion.delete({ where: { id } })
  revalidatePath("/compras")
}

export async function seleccionarCotizacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "APROBAR" })

  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id, empresaId },
    include: { requisicion: true },
  })
  if (!cotizacion) throw new Error("Cotización no encontrada")

  await prisma.cotizacion.updateMany({
    where: { requisicionId: cotizacion.requisicionId, empresaId },
    data: { ganadora: false },
  })
  await prisma.cotizacion.update({
    where: { id },
    data: { ganadora: true },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "COTIZACION",
    entidadId: id,
    estadoAnterior: "REGISTRADA",
    estadoNuevo: "SELECCIONADA",
    descripcion: "Cotización seleccionada como ganadora",
    usuarioId: userId,
    referenciaId: cotizacion.requisicionId,
  })

  revalidatePath("/compras")
}

// ─── Orden de Compra ──────────────────────────────────────

async function getNextOCNumero(empresaId: string): Promise<number> {
  const last = await prisma.ordenCompra.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (last?.numero ?? 0) + 1
}

const ordenCompraSchema = z.object({
  requisicionId: z.string().min(1),
  cotizacionId: z.string().nullable().optional(),
  proveedorId: z.string().min(1),
  condicionesComerciales: z.string().nullable().optional(),
  fechaEntrega: z.string().nullable().optional(),
  sitioEntrega: z.string().nullable().optional(),
  centroCostosId: z.string().nullable().optional(),
  formaPago: z.string().nullable().optional(),
  correoFacturacion: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  aplicaIVA: z.boolean().optional().default(true),
  items: z.array(z.object({
    item: z.number(),
    descripcion: z.string().min(1),
    unidadMedida: z.string().min(1),
    cantidad: z.coerce.number().positive(),
    valorUnitario: z.coerce.number().min(0),
    valorTotal: z.coerce.number().min(0),
    tipoIva: z.enum(["EXENTO", "IVA_5", "IVA_19"]).optional().default("EXENTO"),
  })).min(1),
})

export type OrdenCompraFormData = z.infer<typeof ordenCompraSchema>

export async function generarOrdenCompra(data: OrdenCompraFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "CREATE" })
  const validated = ordenCompraSchema.parse(data)
  const numero = await getNextOCNumero(empresaId)

  const reqCheck = await prisma.requisicion.findFirst({
    where: { id: validated.requisicionId, empresaId },
    select: { estado: true },
  })
  if (!reqCheck) throw new Error("Requisición no encontrada")
  if (reqCheck.estado !== "EN_COTIZACION") throw new Error("La requisición debe estar en cotización para generar una orden de compra")

  const subtotal = validated.items.reduce((s, i) => s + i.valorTotal, 0)
  const descuento = 0
  const iva = validated.items.reduce((s, i) => {
    const base = i.valorTotal
    const tasa = i.tipoIva === "IVA_19" ? 0.19 : i.tipoIva === "IVA_5" ? 0.05 : 0
    return s + Math.round(base * tasa * 100) / 100
  }, 0)
  const valorTotal = subtotal - descuento + iva

  const oc = await prisma.ordenCompra.create({
    data: {
      empresaId,
      requisicionId: validated.requisicionId,
      cotizacionId: validated.cotizacionId ?? null,
      proveedorId: validated.proveedorId,
      numero,
      subtotal,
      descuento,
      iva,
      valorTotal,
      condicionesComerciales: validated.condicionesComerciales ?? null,
      fechaEntrega: validated.fechaEntrega ? new Date(validated.fechaEntrega) : null,
      sitioEntrega: validated.sitioEntrega ?? null,
      centroCostosId: validated.centroCostosId ?? null,
      formaPago: validated.formaPago ?? null,
      correoFacturacion: validated.correoFacturacion ?? null,
      elaboradoPor: userId,
      estado: "EMITIDA",
      observaciones: validated.observaciones ?? null,
      items: {
        create: validated.items.map((i) => ({
          item: i.item,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: i.cantidad,
          valorUnitario: i.valorUnitario,
          valorTotal: i.valorTotal,
          tipoIva: i.tipoIva,
        })),
      },
    },
    include: {
      proveedor: true,
      requisicion: true,
      items: { orderBy: { item: "asc" } },
    },
  })

  await prisma.requisicion.update({
    where: { id: validated.requisicionId },
    data: { estado: "ORDEN_COMPRA_GENERADA" },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "REQUISICION",
    entidadId: validated.requisicionId,
    estadoAnterior: reqCheck.estado,
    estadoNuevo: "ORDEN_COMPRA_GENERADA",
    descripcion: "Orden de Compra generada",
    usuarioId: userId,
    referenciaId: oc.id,
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: oc.id,
    estadoNuevo: "EMITIDA",
    descripcion: `OC #${numero} emitida`,
    usuarioId: userId,
    referenciaId: validated.requisicionId,
  })

  if (validated.cotizacionId) {
    await prisma.cotizacion.update({
      where: { id: validated.cotizacionId },
      data: { ganadora: true },
    })
  }

  await notificarPorPermiso({
    empresaId,
    tipo: "ORDEN_COMPRA_EMITIDA",
    titulo: "Orden de Compra generada",
    mensaje: `OC #${numero} por ${valorTotal.toLocaleString("es-CO")} a ${oc.proveedor.razonSocial}`,
    referenciaId: oc.id,
    referenciaTipo: "ORDEN_COMPRA",
    recurso: "orden_compra",
    accion: "READ",
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "OC_CREADA",
    entidadTipo: "ORDEN_COMPRA",
    entidadId: oc.id,
    usuarioId: userId,
  }).catch(() => {})

  revalidatePath("/compras")
  return serializar({
    ...oc,
    fecha: oc.fecha.toISOString(),
    subtotal: Number(oc.subtotal),
    descuento: Number(oc.descuento),
    iva: Number(oc.iva),
    valorTotal: Number(oc.valorTotal),
    items: oc.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }) as any
}

export async function getOrdenesCompra() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "READ" })
  const data = await prisma.ordenCompra.findMany({
    where: { empresaId },
    include: {
      proveedor: true,
      requisicion: { select: { id: true, numero: true } },
      items: { orderBy: { item: "asc" } },
      _count: { select: { recepciones: true, cuentasPagar: true } },
    },
    orderBy: { numero: "desc" },
  })
  return data.map((oc: any) => serializar({
    ...oc,
    fecha: oc.fecha instanceof Date ? oc.fecha.toISOString() : oc.fecha,
    subtotal: Number(oc.subtotal),
    descuento: Number(oc.descuento),
    iva: Number(oc.iva),
    valorTotal: Number(oc.valorTotal),
    items: oc.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  })) as any
}

export async function getOrdenCompra(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "READ" })
  const oc = await prisma.ordenCompra.findFirst({
    where: { id, empresaId },
    include: {
      proveedor: true,
      requisicion: {
        include: { items: { include: { centroCostos: true }, orderBy: { item: "asc" } } },
      },
      cotizacion: { include: { proveedor: true } },
      items: { orderBy: { item: "asc" } },
      recepciones: {
        include: { items: true },
        orderBy: { fechaRecepcion: "desc" },
      },
      cuentasPagar: true,
    },
  })
  if (!oc) throw new Error("Orden de compra no encontrada")
  return serializar({
    ...oc,
    fecha: oc.fecha instanceof Date ? oc.fecha.toISOString() : oc.fecha,
    subtotal: Number(oc.subtotal),
    descuento: Number(oc.descuento),
    iva: Number(oc.iva),
    valorTotal: Number(oc.valorTotal),
    items: oc.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }) as any
}

export async function updateOrdenCompra(id: string, data: OrdenCompraFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "UPDATE" })
  const validated = ordenCompraSchema.parse(data)

  const existing = await prisma.ordenCompra.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Orden de compra no encontrada")
  if (existing.estado !== "EMITIDA") throw new Error("Solo se puede editar órdenes en estado EMITIDA")

  const subtotal = validated.items.reduce((s, i) => s + i.valorTotal, 0)
  const descuento = existing.descuento
  const iva = validated.items.reduce((s, i) => {
    const base = i.valorTotal
    const tipoIva = (i as any).tipoIva || "EXENTO"
    const tasa = tipoIva === "IVA_19" ? 0.19 : tipoIva === "IVA_5" ? 0.05 : 0
    return s + Math.round(base * tasa * 100) / 100
  }, 0)
  const valorTotal = subtotal - Number(descuento) + iva

  const oc = await prisma.$transaction(async (tx: any) => {
    await tx.ordenCompraItem.deleteMany({ where: { ordenCompraId: id } })
    return tx.ordenCompra.update({
      where: { id },
      data: {
        proveedorId: validated.proveedorId,
        subtotal,
        iva,
        valorTotal,
        condicionesComerciales: validated.condicionesComerciales ?? null,
        fechaEntrega: validated.fechaEntrega ? new Date(validated.fechaEntrega) : null,
        sitioEntrega: validated.sitioEntrega ?? null,
        centroCostosId: validated.centroCostosId ?? null,
        formaPago: validated.formaPago ?? null,
        correoFacturacion: validated.correoFacturacion ?? null,
        observaciones: validated.observaciones ?? null,
        items: {
          create: validated.items.map((i: any) => ({
            item: i.item,
            descripcion: i.descripcion,
            unidadMedida: i.unidadMedida,
            cantidad: i.cantidad,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
            tipoIva: (i as any).tipoIva || "EXENTO",
          })),
        },
      },
      include: {
        proveedor: true,
        requisicion: { select: { id: true, numero: true } },
        items: { orderBy: { item: "asc" } },
      },
    })
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "OC actualizada",
    usuarioId: userId,
  })

  revalidatePath("/compras")
  return serializar({
    ...oc,
    fecha: oc.fecha instanceof Date ? oc.fecha.toISOString() : oc.fecha,
    subtotal: Number(oc.subtotal),
    descuento: Number(oc.descuento),
    iva: Number(oc.iva),
    valorTotal: Number(oc.valorTotal),
    items: oc.items.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }) as any
}

export async function deleteOrdenCompra(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "DELETE" })

  const existing = await prisma.ordenCompra.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Orden de compra no encontrada")
  if (existing.estado !== "EMITIDA") throw new Error("Solo se puede eliminar órdenes en estado EMITIDA")

  await prisma.ordenCompra.delete({ where: { id } })
  revalidatePath("/compras")
}

// ─── Recepción de Bienes ──────────────────────────────────

const recepcionItemSchema = z.object({
  item: z.number(),
  descripcion: z.string().min(1),
  cantidadRecibida: z.coerce.number().min(0),
  observaciones: z.string().nullable().optional(),
})

const recepcionSchema = z.object({
  ordenCompraId: z.string().min(1),
  remision: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
  items: z.array(recepcionItemSchema).min(1),
})

export type RecepcionFormData = z.infer<typeof recepcionSchema>

export async function getRecepciones() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recepcion", accion: "READ" })
  const data = await prisma.recepcion.findMany({
    where: { empresaId },
    include: {
      ordenCompra: { include: { proveedor: true } },
      items: true,
    },
    orderBy: { fechaRecepcion: "desc" },
  })
  return data.map((r: any) => serializar({
    ...r,
    fechaRecepcion: r.fechaRecepcion instanceof Date ? r.fechaRecepcion.toISOString() : r.fechaRecepcion,
    items: r.items.map((i: any) => ({
      ...i,
      cantidadRecibida: Number(i.cantidadRecibida),
    })),
  })) as any
}

export async function createRecepcion(data: RecepcionFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recepcion", accion: "CREATE" })
  const validated = recepcionSchema.parse(data)

  const totalItems = validated.items.length
  const cantidadesCompletas = validated.items.filter((i) => i.cantidadRecibida > 0).length
  const estado = totalItems === cantidadesCompletas ? "COMPLETA" : totalItems > 0 ? "PARCIAL" : "PENDIENTE"

  const recepcion = await prisma.recepcion.create({
    data: {
      empresaId,
      ordenCompraId: validated.ordenCompraId,
      remision: validated.remision ?? null,
      observaciones: validated.observaciones ?? null,
      estado,
      items: {
        create: validated.items.map((i) => ({
          item: i.item,
          descripcion: i.descripcion,
          cantidadRecibida: i.cantidadRecibida,
          observaciones: i.observaciones ?? null,
        })),
      },
    },
    include: {
      ordenCompra: { include: { proveedor: true } },
      items: true,
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "RECEPCION",
    entidadId: recepcion.id,
    estadoNuevo: estado,
    descripcion: `Recepción #${recepcion.remision || recepcion.id.slice(0, 8)} registrada`,
    usuarioId: userId,
    referenciaId: validated.ordenCompraId,
  })

  await generarAsiento("RECEPCION_OC", recepcion.id).catch((err) => {
    console.error("Error al generar asiento contable:", err)
  })

  // Actualizar inventario: buscar productos por nombre similar
  try {
    const almacenes = await prisma.almacen.findFirst({ where: { empresaId, activo: true } })
    if (almacenes) {
      for (const item of recepcion.items) {
        const producto = await prisma.producto.findFirst({
          where: { empresaId, nombre: { contains: item.descripcion } },
        })
        if (producto) {
          const cantidad = Number(item.cantidadRecibida)
          await prisma.inventarioStock.upsert({
            where: { productoId_almacenId: { productoId: producto.id, almacenId: almacenes.id } },
            update: { cantidad: { increment: cantidad } },
            create: { empresaId, productoId: producto.id, almacenId: almacenes.id, cantidad },
          })
          await prisma.movimientoInventario.create({
            data: {
              empresaId,
              productoId: producto.id,
              almacenDestinoId: almacenes.id,
              tipo: "ENTRADA",
              cantidad,
              referencia: `OC#${recepcion.ordenCompra.numero}`,
              observaciones: `Recepción #${recepcion.remision || recepcion.id.slice(0, 8)}`,
            },
          })
        }
      }
    }
  } catch (err) {
    console.error("Error al actualizar inventario:", err)
  }

  revalidatePath("/compras")
  return serializar({
    ...recepcion,
    fechaRecepcion: recepcion.fechaRecepcion.toISOString(),
    items: recepcion.items.map((i: any) => ({
      ...i,
      cantidadRecibida: Number(i.cantidadRecibida),
    })),
  }) as any
}

export async function updateRecepcion(id: string, data: RecepcionFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recepcion", accion: "UPDATE" })
  const validated = recepcionSchema.parse(data)

  const existing = await prisma.recepcion.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Recepción no encontrada")

  const totalItems = validated.items.length
  const cantidadesCompletas = validated.items.filter((i) => i.cantidadRecibida > 0).length
  const estado = totalItems === cantidadesCompletas ? "COMPLETA" : totalItems > 0 ? "PARCIAL" : "PENDIENTE"

  const recepcion = await prisma.$transaction(async (tx: any) => {
    await tx.recepcionItem.deleteMany({ where: { recepcionId: id } })
    return tx.recepcion.update({
      where: { id },
      data: {
        remision: validated.remision ?? null,
        observaciones: validated.observaciones ?? null,
        estado,
        items: {
          create: validated.items.map((i: any) => ({
            item: i.item,
            descripcion: i.descripcion,
            cantidadRecibida: i.cantidadRecibida,
            observaciones: i.observaciones ?? null,
          })),
        },
      },
      include: {
        ordenCompra: { include: { proveedor: true } },
        items: true,
      },
    })
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "RECEPCION",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: estado,
    descripcion: "Recepción actualizada",
    usuarioId: userId,
  })

  revalidatePath("/compras")
  return serializar({
    ...recepcion,
    fechaRecepcion: recepcion.fechaRecepcion instanceof Date ? recepcion.fechaRecepcion.toISOString() : recepcion.fechaRecepcion,
    items: recepcion.items.map((i: any) => ({
      ...i,
      cantidadRecibida: Number(i.cantidadRecibida),
    })),
  }) as any
}

export async function deleteRecepcion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recepcion", accion: "DELETE" })
  const existing = await prisma.recepcion.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Recepción no encontrada")
  await prisma.recepcion.delete({ where: { id } })
  revalidatePath("/compras")
}

// ─── Cuentas por Pagar ────────────────────────────────────

export async function getCuentasPagar() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_pagar", accion: "READ" })
  const data = await prisma.cuentaPagar.findMany({
    where: { empresaId, deliveryTicketId: null },
    include: {
      ordenCompra: {
        include: {
          proveedor: true,
          items: { orderBy: { item: "asc" } },
          cotizacion: {
            include: {
              proveedor: { select: { razonSocial: true } },
              items: { orderBy: { item: "asc" } },
            },
          },
        },
      },
      _count: { select: { pagos: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return data.map((cp: any) => serializar({
    ...cp,
    valor: Number(cp.valor),
    saldoPendiente: Number(cp.saldoPendiente),
    fechaFactura: cp.fechaFactura instanceof Date ? cp.fechaFactura.toISOString() : cp.fechaFactura,
    fechaVencimiento: cp.fechaVencimiento instanceof Date ? cp.fechaVencimiento.toISOString() : cp.fechaVencimiento,
  })) as any
}

export async function crearCuentaPagar(ordenCompraId: string, numeroFactura?: string, fechaFactura?: string, fechaVencimiento?: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_pagar", accion: "CREATE" })

  const oc = await prisma.ordenCompra.findFirst({
    where: { id: ordenCompraId, empresaId },
  })
  if (!oc) throw new Error("Orden de compra no encontrada")

  const cp = await prisma.cuentaPagar.create({
    data: {
      empresaId,
      ordenCompraId,
      numeroFactura: numeroFactura ?? null,
      fechaFactura: fechaFactura ? new Date(fechaFactura) : null,
      fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
      valor: oc.valorTotal,
      saldoPendiente: oc.valorTotal,
    },
    include: { ordenCompra: { include: { proveedor: true } } },
  })

  // Actualizar estado de orden de compra
  await prisma.ordenCompra.update({
    where: { id: ordenCompraId },
    data: { estado: "FACTURADA" },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: ordenCompraId,
    estadoAnterior: "EMITIDA",
    estadoNuevo: "FACTURADA",
    descripcion: numeroFactura ? `Facturada No. ${numeroFactura}` : "Facturada",
    usuarioId: userId,
    referenciaId: cp.id,
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "CUENTA_PAGAR",
    entidadId: cp.id,
    estadoNuevo: "PENDIENTE",
    descripcion: `Cuenta por pagar creada - $${Number(oc.valorTotal).toLocaleString("es-CO")}`,
    usuarioId: userId,
    referenciaId: ordenCompraId,
  })

  await generarAsiento("FACTURA_PROVEEDOR", cp.id).catch((err) => {
    console.error("Error al generar asiento contable:", err)
  })

  await notificarPorPermiso({
    empresaId,
    tipo: "CUENTA_PAGAR_CREADA",
    titulo: "Cuenta por pagar registrada",
    mensaje: `Factura ${numeroFactura || "sin número"} por ${Number(oc.valorTotal).toLocaleString("es-CO")} de ${cp.ordenCompra?.proveedor?.razonSocial ?? ""}`,
    referenciaId: cp.id,
    referenciaTipo: "CUENTA_PAGAR",
    recurso: "cuenta_pagar",
    accion: "READ",
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "FACTURA_REGISTRADA",
    entidadTipo: "CUENTA_PAGAR",
    entidadId: cp.id,
    usuarioId: userId,
  }).catch(() => {})

  revalidatePath("/compras")
  revalidatePath("/tesoreria")
  return serializar({
    ...cp,
    valor: Number(cp.valor),
    saldoPendiente: Number(cp.saldoPendiente),
  }) as any
}

// ─── Egresos ──────────────────────────────────────────────

export async function getEgresos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "egreso", accion: "READ" })
  const data = await prisma.egreso.findMany({
    where: { empresaId },
    include: {
      pago: { include: { proveedor: true, cuentaPagar: true } },
      centroCostos: true,
    },
    orderBy: { fecha: "desc" },
  })
  return data.map((e: any) => serializar({
    ...e,
    fecha: e.fecha instanceof Date ? e.fecha.toISOString() : e.fecha,
    valor: Number(e.valor),
  })) as any
}

// ─── Dashboard ────────────────────────────────────────────

export async function getDashboardCompras() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "dashboard", accion: "READ" })

  const [
    reqPendientes,
    reqCount,
    cotizacionesPendientes,
    ocCount,
    ocPendientesRecepcion,
    gastoPorArea,
    gastoPorProveedor,
  ] = await Promise.all([
    prisma.requisicion.count({ where: { empresaId, estado: "BORRADOR" } }),
    prisma.requisicion.count({ where: { empresaId, estado: { not: "BORRADOR" } } }),
    prisma.requisicion.count({ where: { empresaId, estado: "EN_COTIZACION" } }),
    prisma.ordenCompra.count({ where: { empresaId } }),
    prisma.ordenCompra.count({ where: { empresaId, estado: "EMITIDA" } }),
    prisma.ordenCompra.groupBy({
      by: ["centroCostosId"],
      where: { empresaId },
      _sum: { valorTotal: true },
    }),
    prisma.ordenCompra.groupBy({
      by: ["proveedorId"],
      where: { empresaId },
      _sum: { valorTotal: true },
    }),
  ])

  return {
    reqPendientes,
    reqCount,
    cotizacionesPendientes,
    ocCount,
    ocPendientesRecepcion,
    gastoPorArea: gastoPorArea.map((g: any) => ({ centroCostosId: g.centroCostosId, total: Number(g._sum.valorTotal) })),
    gastoPorProveedor: gastoPorProveedor.map((g: any) => ({ proveedorId: g.proveedorId, total: Number(g._sum.valorTotal) })),
  }
}

// ─── Enviar a Tesorería / Pagar ───────────────────────────

export async function enviarATesoreria(cuentaPagarId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_pagar", accion: "ENVIAR" })

  const cp = await prisma.cuentaPagar.findFirst({
    where: { id: cuentaPagarId, empresaId },
  })
  if (!cp) throw new Error("Cuenta por pagar no encontrada")
  if (cp.estado !== "PENDIENTE") throw new Error("La cuenta por pagar debe estar pendiente para enviar a tesorería")

  await prisma.cuentaPagar.update({
    where: { id: cuentaPagarId },
    data: { estado: "ENVIADA_TESORERIA" },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "CUENTA_PAGAR",
    entidadId: cuentaPagarId,
    estadoAnterior: cp.estado,
    estadoNuevo: "ENVIADA_TESORERIA",
    descripcion: "Enviada a tesorería",
    usuarioId: userId,
  })

  revalidatePath("/tesoreria")
  revalidatePath("/compras")
}

export async function pagarCuenta(cuentaPagarId: string, cuentaBancariaId: string, numeroFactura?: string, comprobante?: { nombre: string; base64: string } | null) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "pago", accion: "APROBAR" })

  const cp = await prisma.cuentaPagar.findFirst({
    where: { id: cuentaPagarId, empresaId },
    include: { ordenCompra: { include: { proveedor: true } } },
  })
  if (!cp) throw new Error("Cuenta por pagar no encontrada")
  if (cp.estado !== "ENVIADA_TESORERIA") throw new Error("La cuenta por pagar debe estar enviada a tesorería para pagar")
  if (cp.ordenCompra && cp.ordenCompra.estado !== "FACTURADA") throw new Error("La orden de compra debe estar facturada para cerrarla")
  if (!cp.ordenCompra) throw new Error("Esta cuenta por pagar no tiene una orden de compra asociada")

  // Get bank account
  const cuenta = await prisma.cuentaBancaria.findFirst({
    where: { id: cuentaBancariaId, empresaId },
    select: { id: true, banco: true, numeroCuenta: true, saldoActual: true },
  })
  if (!cuenta) throw new Error("Cuenta bancaria no encontrada")
  const cuentaLabel = `${cuenta.banco} - ${cuenta.numeroCuenta}`

  // Save comprobante file if provided
  const savedFile = comprobante?.base64 ? await saveFile(comprobante, empresaId) : null

  // Get next egreso number
  const lastEgreso = await prisma.egreso.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  const nextNumero = (lastEgreso?.numero ?? 0) + 1

  let pagoId = ""

  // Execute everything in a transaction
  await prisma.$transaction(async (tx: any) => {
    const pago = await tx.pago.create({
      data: {
        empresaId,
        cuentaPagarId: cp.id,
        proveedorId: cp.ordenCompra!.proveedorId,
        cuentaBancariaId,
        tipo: "FACTURA",
        metodo: "TRANSFERENCIA",
        valor: cp.saldoPendiente,
        fechaPago: new Date(),
        estado: "PAGADO",
        comprobante: savedFile?.url ?? null,
      },
    })
    pagoId = pago.id

    await tx.egreso.create({
      data: {
        empresaId,
        pagoId: pago.id,
        numero: nextNumero,
        beneficiario: cp.ordenCompra!.proveedor.razonSocial,
        cuentaBancaria: cuentaLabel,
        valor: cp.saldoPendiente,
      },
    })

    await tx.movimientoBancario.create({
      data: {
        cuentaId: cuentaBancariaId,
        tipo: "EGASTO",
        fecha: new Date(),
        monto: cp.saldoPendiente,
        descripcion: `Pago OC #${cp.ordenCompra!.numero} - ${cp.ordenCompra!.proveedor.razonSocial}`,
        referencia: `Egreso #${nextNumero}`,
        estado: "CONCILIADO",
        fechaConciliacion: new Date(),
      },
    })

    await tx.cuentaBancaria.update({
      where: { id: cuentaBancariaId },
      data: { saldoActual: { decrement: cp.saldoPendiente } },
    })

    await tx.cuentaPagar.update({
      where: { id: cuentaPagarId },
      data: { estado: "PAGADA", saldoPendiente: 0, ...(numeroFactura ? { numeroFactura } : {}) },
    })

    await tx.ordenCompra.update({
      where: { id: cp.ordenCompraId! },
      data: { estado: "CERRADA" },
    })
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "CUENTA_PAGAR",
    entidadId: cuentaPagarId,
    estadoAnterior: cp.estado,
    estadoNuevo: "PAGADA",
    descripcion: `Pagada - Egreso #${nextNumero}`,
    usuarioId: userId,
    referenciaId: pagoId,
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "PAGO",
    entidadId: pagoId,
    estadoNuevo: "PAGADO",
    descripcion: `Pago #${nextNumero} realizado por $${Number(cp.saldoPendiente).toLocaleString("es-CO")}`,
    usuarioId: userId,
    referenciaId: cuentaPagarId,
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: cp.ordenCompraId!,
    estadoAnterior: "FACTURADA",
    estadoNuevo: "CERRADA",
    descripcion: `Pagada - Egreso #${nextNumero}`,
    usuarioId: userId,
    referenciaId: pagoId,
  })

  await generarAsiento("PAGO_PROVEEDOR", pagoId).catch((err) => {
    console.error("Error al generar asiento contable:", err)
  })

  await notificarPorPermiso({
    empresaId,
    tipo: "PAGO_REALIZADO",
    titulo: "Pago realizado",
    mensaje: `Pago a ${cp.ordenCompra!.proveedor.razonSocial} por ${Number(cp.saldoPendiente).toLocaleString("es-CO")} - Egreso #${nextNumero}`,
    referenciaId: pagoId,
    referenciaTipo: "PAGO",
    recurso: "pago",
    accion: "READ",
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "PAGO_REALIZADO",
    entidadTipo: "PAGO",
    entidadId: pagoId,
    usuarioId: userId,
  }).catch(() => {})

  revalidatePath("/tesoreria")
  revalidatePath("/compras")
  return { success: true }
}

export async function deleteCuentaPagar(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_pagar", accion: "DELETE" })
  const cp = await prisma.cuentaPagar.findFirst({
    where: { id, empresaId },
    include: { _count: { select: { pagos: true } } },
  })
  if (!cp) throw new Error("Cuenta por pagar no encontrada")
  if (cp.estado === "PAGADA") throw new Error("No se puede eliminar una cuenta por pagar ya pagada")

  await prisma.$transaction(async (tx: any) => {
    const pagos = await tx.pago.findMany({ where: { cuentaPagarId: id }, select: { id: true } })
    for (const pago of pagos) {
      await tx.egreso.deleteMany({ where: { pagoId: pago.id } })
    }
    await tx.pago.deleteMany({ where: { cuentaPagarId: id } })
    await tx.cuentaPagar.delete({ where: { id } })
  })

  revalidatePath("/tesoreria")
}

export async function actualizarFacturaCuentaPagar(id: string, numeroFactura: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cuenta_pagar", accion: "UPDATE" })
  const cp = await prisma.cuentaPagar.findFirst({ where: { id, empresaId }, select: { id: true, numeroFactura: true, estado: true } })
  if (!cp) throw new Error("Cuenta por pagar no encontrada")
  if (cp.numeroFactura) throw new Error("La cuenta por pagar ya tiene un número de factura y no se puede modificar")

  await prisma.cuentaPagar.update({
    where: { id },
    data: { numeroFactura },
  })

  revalidatePath("/tesoreria")
  return { success: true }
}

export async function createMultipleCotizaciones(data: {
  requisicionId: string
  cotizaciones: {
    proveedorId: string
    tiempoEntrega: string | null
    formaPago: string | null
    observaciones: string | null
    items: { descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number }[]
    archivos: { nombre: string; base64?: string; url?: string }[]
  }[]
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "CREATE" })

  const reqCheck = await prisma.requisicion.findFirst({
    where: { id: data.requisicionId, empresaId },
    select: { estado: true, numero: true },
  })
  if (!reqCheck) throw new Error("Requisición no encontrada")
  if (reqCheck.estado !== "EN_COTIZACION") throw new Error("La requisición debe estar en cotización")

  const proveedorIds = [...new Set(data.cotizaciones.map(c => c.proveedorId))]
  const proveedoresValidos = await prisma.proveedor.findMany({ where: { id: { in: proveedorIds }, empresaId }, select: { id: true } })
  const validIds = new Set(proveedoresValidos.map(p => p.id))
  for (const c of data.cotizaciones) {
    if (!validIds.has(c.proveedorId)) throw new Error(`Proveedor ${c.proveedorId} no encontrado o no pertenece a esta empresa`)
  }

  const results = await prisma.$transaction(async (tx: any) => {
    const created: any[] = []
    for (const cot of data.cotizaciones) {
      const last = await tx.cotizacion.findFirst({ where: { empresaId }, orderBy: { numero: "desc" }, select: { numero: true } })
      const numero = (last?.numero ?? 0) + 1

      const valorTotal = cot.items.reduce((s, i) => s + Number(i.valorTotal), 0)

      const archivos: { nombre: string; url: string; tamaño: number }[] = []
      for (const f of cot.archivos) {
        if (f.base64) {
          const saved = await saveFile(f as { nombre: string; base64: string }, empresaId)
          if (saved) archivos.push(saved)
        } else if (f.url) {
          archivos.push({ nombre: f.nombre, url: f.url, tamaño: 0 })
        }
      }

      const record = await tx.cotizacion.create({
        data: {
          empresaId,
          requisicionId: data.requisicionId,
          proveedorId: cot.proveedorId,
          numero,
          valorTotal,
          tiempoEntrega: cot.tiempoEntrega,
          formaPago: cot.formaPago,
          observaciones: cot.observaciones,
          archivos: archivos.length > 0 ? archivos : undefined,
          items: {
              create: cot.items.map((i, idx) => ({
                item: idx + 1,
                descripcion: i.descripcion,
                unidadMedida: i.unidadMedida,
                cantidad: i.cantidad,
                valorUnitario: Number(i.valorUnitario),
                valorTotal: Number(i.valorTotal),
              })),
          },
        },
        include: { proveedor: true, items: true },
      })
      created.push(record)
    }
    return created
  })

  await prisma.requisicion.update({
    where: { id: data.requisicionId },
    data: { estado: "EN_COTIZACION" },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "REQUISICION",
    entidadId: data.requisicionId,
    estadoAnterior: reqCheck.estado,
    estadoNuevo: "EN_COTIZACION",
    descripcion: `${results.length} cotización(es) registrada(s)`,
    usuarioId: userId,
    referenciaId: results[0]?.id,
  })

  for (const cot of results) {
    await registrarHistorial({
      empresaId,
      entidadTipo: "COTIZACION",
      entidadId: cot.id,
      estadoNuevo: "REGISTRADA",
      descripcion: `Cotización #${cot.numero} creada`,
      usuarioId: userId,
    })
  }

  revalidatePath("/compras")
  return results.map((r: any) => serializar({
    ...r,
    fecha: r.fecha instanceof Date ? r.fecha.toISOString() : r.fecha,
    valorTotal: Number(r.valorTotal),
    items: r.items?.map((i: any) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  })) as any
}

export async function generarLinkPublicoCotizacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "UPDATE" })

  const cot = await prisma.cotizacion.findFirst({ where: { id, empresaId } })
  if (!cot) throw new Error("Cotización no encontrada")
  if (cot.tokenPublico) throw new Error("Ya tiene un link público generado")

  const tokenPublico = crypto.randomUUID()

  await prisma.cotizacion.update({
    where: { id },
    data: { tokenPublico },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "COTIZACION",
    entidadId: id,
    estadoNuevo: "LINK_GENERADO",
    descripcion: "Link público generado",
    usuarioId: userId,
  })

  revalidatePath("/compras")
  return { token: tokenPublico }
}

export async function generarLinkComparativo(params: { requisicionId: string; cotizacionesIds: string[] }) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "UPDATE" })

  if (!params.requisicionId || !params.cotizacionesIds || params.cotizacionesIds.length < 2) {
    throw new Error("Se requieren al menos 2 cotizaciones para generar un comparativo")
  }

  const token = uuid()
  const link = await prisma.linkComparativo.create({
    data: {
      empresaId,
      requisicionId: params.requisicionId,
      token,
      cotizacionesId: params.cotizacionesIds,
    },
  })

  return { token: link.token }
}

export async function limpiarLinkPublicoCotizacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cotizacion", accion: "UPDATE" })

  const cot = await prisma.cotizacion.findFirst({ where: { id, empresaId } })
  if (!cot) throw new Error("Cotización no encontrada")

  await prisma.cotizacion.update({
    where: { id },
    data: { tokenPublico: null },
  })

  revalidatePath("/compras")
}

// ─── Duplicar OC ───────────────────────────────────────────

export async function duplicarOrdenCompra(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "DUPLICAR" })

  const original = await prisma.ordenCompra.findFirst({
    where: { id, empresaId },
    include: { items: { orderBy: { item: "asc" } } },
  })
  if (!original) throw new Error("Orden de Compra no encontrada")

  const numero = await getNextOCNumero(empresaId)
  const hoy = new Date()

  const oc = await prisma.ordenCompra.create({
    data: {
      empresaId,
      requisicionId: original.requisicionId,
      cotizacionId: original.cotizacionId,
      proveedorId: original.proveedorId,
      numero,
      fecha: hoy,
      subtotal: original.subtotal,
      descuento: original.descuento,
      iva: original.iva,
      valorTotal: original.valorTotal,
      condicionesComerciales: original.condicionesComerciales,
      fechaEntrega: original.fechaEntrega,
      sitioEntrega: original.sitioEntrega,
      centroCostosId: original.centroCostosId,
      formaPago: original.formaPago,
      correoFacturacion: original.correoFacturacion,
      elaboradoPor: userId,
      estado: "EMITIDA",
      observaciones: original.observaciones ? `${original.observaciones} (Duplicada de OC #${original.numero})` : `Duplicada de OC #${original.numero}`,
      items: {
        create: original.items.map((i) => ({
          item: i.item,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: i.cantidad,
          valorUnitario: i.valorUnitario,
          valorTotal: i.valorTotal,
          tipoIva: i.tipoIva ?? "EXENTO",
        })),
      },
    },
    include: {
      proveedor: true,
      items: { orderBy: { item: "asc" } },
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: oc.id,
    estadoNuevo: "EMITIDA",
    descripcion: `OC duplicada de OC #${original.numero}`,
    usuarioId: userId,
    referenciaId: original.id,
  })

  revalidatePath("/compras")
  return {
    ...oc,
    subtotal: Number(oc.subtotal),
    descuento: Number(oc.descuento),
    iva: Number(oc.iva),
    valorTotal: Number(oc.valorTotal),
    proveedor: oc.proveedor,
    items: oc.items.map((i) => ({
      ...i,
      cantidad: Number(i.cantidad),
      valorUnitario: Number(i.valorUnitario),
      valorTotal: Number(i.valorTotal),
    })),
  }
}

// ─── Revertir OC Facturada ────────────────────────────────

export async function revertirOCFacturada(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "UPDATE" })

  const oc = await prisma.ordenCompra.findFirst({
    where: { id, empresaId },
    include: { cuentasPagar: { include: { pagos: true } } },
  })
  if (!oc) throw new Error("Orden de Compra no encontrada")
  if (oc.estado !== "FACTURADA") throw new Error("Solo se puede revertir una OC en estado FACTURADA")

  for (const cp of oc.cuentasPagar) {
    if (cp.pagos.length > 0) throw new Error(`La CuentaPagar ${cp.numeroFactura} ya tiene pagos registrados, no se puede revertir`)
  }

  await prisma.$transaction(async (tx: any) => {
    // Eliminar registros de historial de las CuentasPagar
    for (const cp of oc.cuentasPagar) {
      await tx.historialEstado.deleteMany({ where: { entidadTipo: "CUENTA_PAGAR", entidadId: cp.id } })
      await tx.cuentaPagar.delete({ where: { id: cp.id } })
    }

    // Revertir OC a EMITIDA
    await tx.ordenCompra.update({
      where: { id },
      data: { estado: "EMITIDA", tokenPublico: null },
    })
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: id,
    estadoAnterior: "FACTURADA",
    estadoNuevo: "EMITIDA",
    descripcion: "OC revertida a EMITIDA - factura cancelada",
    usuarioId: userId,
  })

  revalidatePath("/compras")
}

// ─── Link Público OC ──────────────────────────────────────

export async function generarLinkPublicoOrdenCompra(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "UPDATE" })

  const oc = await prisma.ordenCompra.findFirst({ where: { id, empresaId } })
  if (!oc) throw new Error("Orden de Compra no encontrada")
  if (oc.tokenPublico) throw new Error("Ya tiene un link público generado")

  const tokenPublico = crypto.randomUUID()

  await prisma.ordenCompra.update({
    where: { id },
    data: { tokenPublico },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_COMPRA",
    entidadId: id,
    estadoNuevo: "LINK_GENERADO",
    descripcion: "Link público generado",
    usuarioId: userId,
  })

  revalidatePath("/compras")
  return { token: tokenPublico }
}

export async function limpiarLinkPublicoOrdenCompra(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_compra", accion: "UPDATE" })

  const oc = await prisma.ordenCompra.findFirst({ where: { id, empresaId } })
  if (!oc) throw new Error("Orden de Compra no encontrada")

  await prisma.ordenCompra.update({
    where: { id },
    data: { tokenPublico: null },
  })

  revalidatePath("/compras")
}
