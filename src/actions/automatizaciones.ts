"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import crypto from "crypto"

const automatizacionSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  modulo: z.string().min(1, "Módulo requerido"),
  evento: z.string().min(1, "Evento requerido"),
  urlPowerAutomate: z.string().url("URL inválida").or(z.literal("")),
})

export type AutomatizacionData = {
  id: string
  empresaId: string
  codigo: string
  nombre: string
  descripcion: string | null
  modulo: string
  evento: string
  urlPowerAutomate: string
  metodoHTTP: string
  activo: boolean
  token: string
  createdAt: Date
  updatedAt: Date
  _count?: { auditorias: number }
}

export async function getAutomatizaciones(): Promise<AutomatizacionData[]> {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "READ" })

  const automatizaciones = await prisma.automatizacion.findMany({
    where: { empresaId },
    include: { _count: { select: { auditorias: true } } },
    orderBy: { codigo: "asc" },
  })

  return automatizaciones.map((a) => ({
    ...a,
    _count: a._count,
  }))
}

export async function getAutomatizacionById(id: string): Promise<AutomatizacionData | null> {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "READ" })

  const automatizacion = await prisma.automatizacion.findFirst({
    where: { id, empresaId },
    include: { _count: { select: { auditorias: true } } },
  })

  if (!automatizacion) return null

  return {
    ...automatizacion,
    _count: automatizacion._count,
  }
}

export async function createAutomatizacion(data: z.infer<typeof automatizacionSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "CREATE" })

  const validated = automatizacionSchema.parse(data)

  const exists = await prisma.automatizacion.findFirst({
    where: { empresaId, codigo: validated.codigo },
  })
  if (exists) {
    throw new Error(`Ya existe una automatización con el código "${validated.codigo}"`)
  }

  const automatizacion = await prisma.automatizacion.create({
    data: {
      empresaId,
      codigo: validated.codigo,
      nombre: validated.nombre,
      descripcion: validated.descripcion || null,
      modulo: validated.modulo,
      evento: validated.evento,
      urlPowerAutomate: validated.urlPowerAutomate || "",
      token: crypto.randomBytes(32).toString("hex"),
    },
  })

  revalidatePath("/configuracion")
  return automatizacion
}

export async function updateAutomatizacion(id: string, data: z.infer<typeof automatizacionSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "UPDATE" })

  const validated = automatizacionSchema.parse(data)

  const existing = await prisma.automatizacion.findFirst({
    where: { id, empresaId },
  })
  if (!existing) {
    throw new Error("Automatización no encontrada")
  }

  const duplicate = await prisma.automatizacion.findFirst({
    where: { empresaId, codigo: validated.codigo, id: { not: id } },
  })
  if (duplicate) {
    throw new Error(`Ya existe otra automatización con el código "${validated.codigo}"`)
  }

  const automatizacion = await prisma.automatizacion.update({
    where: { id },
    data: {
      codigo: validated.codigo,
      nombre: validated.nombre,
      descripcion: validated.descripcion || null,
      modulo: validated.modulo,
      evento: validated.evento,
      urlPowerAutomate: validated.urlPowerAutomate || "",
    },
  })

  revalidatePath("/configuracion")
  return automatizacion
}

export async function toggleAutomatizacionActiva(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "UPDATE" })

  const existing = await prisma.automatizacion.findFirst({
    where: { id, empresaId },
  })
  if (!existing) {
    throw new Error("Automatización no encontrada")
  }

  const automatizacion = await prisma.automatizacion.update({
    where: { id },
    data: { activo: !existing.activo },
  })

  revalidatePath("/configuracion")
  return automatizacion
}

export async function deleteAutomatizacion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "DELETE" })

  const existing = await prisma.automatizacion.findFirst({
    where: { id, empresaId },
  })
  if (!existing) {
    throw new Error("Automatización no encontrada")
  }

  await prisma.automatizacion.delete({ where: { id } })

  revalidatePath("/configuracion")
}

export async function regenerarToken(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "UPDATE" })

  const existing = await prisma.automatizacion.findFirst({
    where: { id, empresaId },
  })
  if (!existing) {
    throw new Error("Automatización no encontrada")
  }

  const newToken = crypto.randomBytes(32).toString("hex")

  const automatizacion = await prisma.automatizacion.update({
    where: { id },
    data: { token: newToken },
  })

  revalidatePath("/configuracion")
  return automatizacion
}

export async function getAuditoriaAutomatizaciones(params: {
  automatizacionId?: string
  page?: number
  limit?: number
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "automatizacion", accion: "READ" })

  const page = params.page || 1
  const limit = params.limit || 20
  const skip = (page - 1) * limit

  const where: any = { empresaId }
  if (params.automatizacionId) {
    where.automatizacionId = params.automatizacionId
  }

  const [auditorias, total] = await Promise.all([
    prisma.automatizacionAuditoria.findMany({
      where,
      include: {
        automatizacion: { select: { codigo: true, nombre: true } },
        usuario: { select: { nombre: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.automatizacionAuditoria.count({ where }),
  ])

  return { auditorias, total, page, limit, totalPages: Math.ceil(total / limit) }
}
