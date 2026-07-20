"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
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

const ordenSchema = z.object({
  programacionId: z.string().min(1),
  clienteId: z.string().min(1),
  motonave: z.string().min(1),
  puerto: z.string().min(1),
  productoId: z.string().min(1),
  // Calidad
  api: z.coerce.number().optional(),
  gravedadEspecifica: z.coerce.number().optional(),
  densidad: z.coerce.number().optional(),
  viscosidad: z.coerce.number().optional(),
  azufre: z.coerce.number().optional(),
  agua: z.coerce.number().optional(),
  puntoChispa: z.coerce.number().optional(),
  temperatura: z.coerce.number().optional(),
  otrasPropiedades: z.string().optional().or(z.literal("")),
  // Muestras
  muestraRetenida: z.boolean().default(false),
  muestraProveedor: z.string().optional().or(z.literal("")),
  muestraMotonave: z.string().optional().or(z.literal("")),
  muestraMarpol: z.boolean().default(false),
  muestraMarpolInfo: z.string().optional().or(z.literal("")),
  muestraOtra: z.string().optional().or(z.literal("")),
  muestraClienteEstado: z.string().optional().or(z.literal("")),
})

export type OrdenFormData = z.infer<typeof ordenSchema>

const asignacionSchema = z.object({
  barcazaId: z.string().optional().or(z.literal("")),
  remolcadorId: z.string().optional().or(z.literal("")),
  vehiculoId: z.string().optional().or(z.literal("")),
  conductorId: z.string().optional().or(z.literal("")),
  capitanId: z.string().optional().or(z.literal("")),
})

export async function getOrdenes() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "READ" })
  const data = await prisma.ordenOperativa.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
    include: {
      cliente: { select: { id: true, nombre: true } },
      producto: { select: { id: true, nombre: true } },
      programacion: { select: { id: true, numero: true } },
      asignaciones: {
        include: { barcaza: true, remolcador: true, vehiculo: true, conductor: true, capitan: true },
      },
    },
  })
  return serializar(data) as typeof data
}

export async function getOrden(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "READ" })
  const data = await prisma.ordenOperativa.findFirst({
    where: { id, empresaId },
    include: {
      cliente: true,
      producto: true,
      programacion: true,
      asignaciones: {
        include: { barcaza: true, remolcador: true, vehiculo: true, conductor: true, capitan: true },
      },
    },
  })
  return serializar(data) as typeof data
}

export async function createOrden(data: OrdenFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "CREATE" })
  const validated = ordenSchema.parse(data)

  const prog = await prisma.programacionOperativa.findFirst({ where: { id: validated.programacionId, empresaId } })
  if (!prog) throw new Error("Programación no encontrada")

  const last = await prisma.ordenOperativa.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const numero = (last?.numero ?? 0) + 1

  const orden = await prisma.ordenOperativa.create({
    data: {
      empresaId,
      numero,
      programacionId: validated.programacionId,
      clienteId: validated.clienteId,
      motonave: validated.motonave,
      puerto: validated.puerto,
      productoId: validated.productoId,
      api: validated.api ?? null,
      gravedadEspecifica: validated.gravedadEspecifica ?? null,
      densidad: validated.densidad ?? null,
      viscosidad: validated.viscosidad ?? null,
      azufre: validated.azufre ?? null,
      agua: validated.agua ?? null,
      puntoChispa: validated.puntoChispa ?? null,
      temperatura: validated.temperatura ?? null,
      otrasPropiedades: validated.otrasPropiedades || null,
      muestraRetenida: validated.muestraRetenida,
      muestraProveedor: validated.muestraProveedor || null,
      muestraMotonave: validated.muestraMotonave || null,
      muestraMarpol: validated.muestraMarpol,
      muestraMarpolInfo: validated.muestraMarpolInfo || null,
      muestraOtra: validated.muestraOtra || null,
      muestraClienteEstado: validated.muestraClienteEstado || "NO",
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_OPERATIVA",
    entidadId: orden.id,
    estadoNuevo: "PENDIENTE",
    descripcion: `Orden Operativa #${numero} creada desde Programación #${prog.numero}`,
    usuarioId: userId,
    referenciaId: prog.id,
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "ORDEN_CREADA",
    entidadTipo: "ORDEN_OPERATIVA",
    entidadId: orden.id,
    usuarioId: userId,
  }).catch(() => {})

  notificarPorPermiso({
    empresaId,
    tipo: "info",
    titulo: "Nueva Orden Operativa",
    mensaje: `Orden #${numero} creada`,
    referenciaId: orden.id,
    referenciaTipo: "ORDEN_OPERATIVA",
    recurso: "orden_operativa",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/ordenes")
  return serializar(orden) as typeof orden
}

export async function updateOrden(id: string, data: OrdenFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "UPDATE" })
  const validated = ordenSchema.parse(data)

  const existing = await prisma.ordenOperativa.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Orden no encontrada")
  if (existing.estado === "CERRADA") throw new Error("No puedes editar una orden cerrada")

  const orden = await prisma.ordenOperativa.update({
    where: { id },
    data: {
      programacionId: validated.programacionId,
      clienteId: validated.clienteId,
      motonave: validated.motonave,
      puerto: validated.puerto,
      productoId: validated.productoId,
      api: validated.api ?? null,
      gravedadEspecifica: validated.gravedadEspecifica ?? null,
      densidad: validated.densidad ?? null,
      viscosidad: validated.viscosidad ?? null,
      azufre: validated.azufre ?? null,
      agua: validated.agua ?? null,
      puntoChispa: validated.puntoChispa ?? null,
      temperatura: validated.temperatura ?? null,
      otrasPropiedades: validated.otrasPropiedades || null,
      muestraRetenida: validated.muestraRetenida,
      muestraProveedor: validated.muestraProveedor || null,
      muestraMotonave: validated.muestraMotonave || null,
      muestraMarpol: validated.muestraMarpol,
      muestraMarpolInfo: validated.muestraMarpolInfo || null,
      muestraOtra: validated.muestraOtra || null,
      muestraClienteEstado: validated.muestraClienteEstado || "NO",
    },
  })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_OPERATIVA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: existing.estado,
    descripcion: "Orden actualizada",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/ordenes")
  return serializar(orden) as typeof orden
}

export async function cambiarEstadoOrden(id: string, estado: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "UPDATE" })
  const existing = await prisma.ordenOperativa.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Orden no encontrada")

  const estadoAnterior = existing.estado
  await prisma.ordenOperativa.update({ where: { id }, data: { estado: estado as any } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_OPERATIVA",
    entidadId: id,
    estadoAnterior,
    estadoNuevo: estado,
    descripcion: `Estado cambiado de ${estadoAnterior} a ${estado}`,
    usuarioId: userId,
  })

  notificarPorPermiso({
    empresaId,
    tipo: estado === "CERRADA" ? "success" : "info",
    titulo: "Orden actualizada",
    mensaje: `Orden #${existing.numero} cambió a ${estado}`,
    referenciaId: id,
    referenciaTipo: "ORDEN_OPERATIVA",
    recurso: "orden_operativa",
    accion: "READ",
    excluirUsuarioId: userId,
  })

  revalidatePath("/operaciones/ordenes")
}

export async function deleteOrden(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "DELETE" })
  const existing = await prisma.ordenOperativa.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Orden no encontrada")
  if (!["PENDIENTE", "ASIGNADA"].includes(existing.estado)) throw new Error("Solo puedes eliminar órdenes pendientes o asignadas")
  await prisma.ordenOperativa.delete({ where: { id } })

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_OPERATIVA",
    entidadId: id,
    estadoAnterior: existing.estado,
    estadoNuevo: "ELIMINADO",
    descripcion: "Orden eliminada",
    usuarioId: userId,
  })

  revalidatePath("/operaciones/ordenes")
}

export async function asignarRecursos(id: string, data: z.infer<typeof asignacionSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "UPDATE" })
  const validated = asignacionSchema.parse(data)

  const orden = await prisma.ordenOperativa.findFirst({ where: { id, empresaId } })
  if (!orden) throw new Error("Orden no encontrada")

  const existingAsig = await prisma.recursoAsignacion.findUnique({ where: { ordenOperativaId: id } })

  if (existingAsig) {
    await prisma.recursoAsignacion.update({
      where: { ordenOperativaId: id },
      data: {
        barcazaId: validated.barcazaId || null,
        remolcadorId: validated.remolcadorId || null,
        vehiculoId: validated.vehiculoId || null,
        conductorId: validated.conductorId || null,
        capitanId: validated.capitanId || null,
      },
    })
  } else {
    await prisma.recursoAsignacion.create({
      data: {
        ordenOperativaId: id,
        barcazaId: validated.barcazaId || null,
        remolcadorId: validated.remolcadorId || null,
        vehiculoId: validated.vehiculoId || null,
        conductorId: validated.conductorId || null,
        capitanId: validated.capitanId || null,
      },
    })
  }

  await registrarHistorial({
    empresaId,
    entidadTipo: "ORDEN_OPERATIVA",
    entidadId: id,
    estadoAnterior: orden.estado,
    estadoNuevo: "ASIGNADA",
    descripcion: "Recursos asignados",
    usuarioId: userId,
  })

  if (orden.estado === "PENDIENTE") {
    await prisma.ordenOperativa.update({ where: { id }, data: { estado: "ASIGNADA" } })

    AutomationService.ejecutarEvento({
      empresaId,
      codigoEvento: "ORDEN_ASIGNADA",
      entidadTipo: "ORDEN_OPERATIVA",
      entidadId: id,
      usuarioId: userId,
    }).catch(() => {})
  }

  revalidatePath("/operaciones/ordenes")
}

export async function getProgramacionesActivas() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "READ" })
  const data = await prisma.programacionOperativa.findMany({
    where: { empresaId, estado: { in: ["PROGRAMADA", "APROBADA"] } },
    select: { id: true, numero: true, motonave: true, clienteId: true, puerto: true, productoId: true, imo: true, bandera: true, agente: true, lugarSuministro: true, cliente: { select: { id: true, nombre: true } } },
    orderBy: { numero: "desc" },
  })
  return serializar(data) as typeof data
}

export async function getRecursosDisponibles() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "orden_operativa", accion: "READ" })
  const [barcazas, remolcadores, vehiculos, conductores, capitanes] = await Promise.all([
    prisma.barcaza.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.remolcador.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.vehiculo.findMany({ where: { empresaId, activo: true }, orderBy: { placa: "asc" } }),
    prisma.conductor.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
    prisma.capitan.findMany({ where: { empresaId, activo: true }, orderBy: { nombre: "asc" } }),
  ])
  return { barcazas, remolcadores, vehiculos, conductores, capitanes }
}
