"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

export interface CarpetaTreeNode {
  id: string
  nombre: string
  padreId: string | null
  hijos: CarpetaTreeNode[]
}

export interface BreadcrumbItem {
  id: string | null
  nombre: string
}

export interface FolderContent {
  carpetas: Array<{
    id: string
    nombre: string
    padreId: string | null
    createdAt: Date
  }>
  documentos: Array<{
    id: string
    nombre: string
    tipo: string
    tamaño: number
    url: string
    version: number
    createdAt: Date
    updatedAt: Date
    empleadoId: string | null
    carpetaId: string | null
  }>
}

export async function getCarpetaTree(): Promise<CarpetaTreeNode[]> {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "carpeta", accion: "READ" })

  const carpetas = await prisma.carpeta.findMany({
    where: { empresaId },
    orderBy: { nombre: "asc" },
  })

  function buildTree(parentId: string | null): CarpetaTreeNode[] {
    return carpetas
      .filter((c) => c.padreId === parentId)
      .map((c) => ({
        id: c.id,
        nombre: c.nombre,
        padreId: c.padreId,
        hijos: buildTree(c.id),
      }))
  }

  return buildTree(null)
}

export async function getBreadcrumb(carpetaId: string | null): Promise<BreadcrumbItem[]> {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "carpeta", accion: "READ" })

  const items: BreadcrumbItem[] = [{ id: null, nombre: "Inicio" }]
  if (!carpetaId) return items

  const path: BreadcrumbItem[] = []
  let currentId: string | null = carpetaId

  while (currentId) {
    const carpeta: { id: string; nombre: string; padreId: string | null } | null =
      await prisma.carpeta.findFirst({
        where: { id: currentId, empresaId },
        select: { id: true, nombre: true, padreId: true },
      })
    if (!carpeta) break
    path.unshift({ id: carpeta.id, nombre: carpeta.nombre })
    currentId = carpeta.padreId
  }

  return [...items, ...path]
}

export async function getFolderContent(
  carpetaId: string | null,
  search?: string
): Promise<FolderContent> {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "carpeta", accion: "READ" })

  const carpetas = await prisma.carpeta.findMany({
    where: { empresaId, padreId: carpetaId },
    orderBy: { nombre: "asc" },
  })

  const documentos = await prisma.documento.findMany({
    where: {
      carpetaId,
      ...(search
        ? { nombre: { contains: search } }
        : {}),
      ...(carpetaId !== null
        ? { carpeta: { empresaId } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  })

  return { carpetas, documentos }
}

const createCarpetaSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  padreId: z.string().nullable(),
})

export async function createCarpeta(formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "carpeta", accion: "CREATE" })

  const validated = createCarpetaSchema.safeParse({
    nombre: formData.get("nombre"),
    padreId: formData.get("padreId") || null,
  })

  if (!validated.success) {
    return { error: "Nombre inválido" }
  }

  const dup = await prisma.carpeta.findFirst({
    where: { empresaId, nombre: validated.data.nombre, padreId: validated.data.padreId },
  })
  if (dup) {
    return { error: "Ya existe una carpeta con ese nombre en esta ubicación" }
  }

  await prisma.carpeta.create({
    data: {
      empresaId,
      nombre: validated.data.nombre,
      padreId: validated.data.padreId,
    },
  })

  revalidatePath("/documentos")
}

const updateCarpetaSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1, "El nombre es requerido").max(100),
})

export async function updateCarpeta(formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "carpeta", accion: "UPDATE" })

  const validated = updateCarpetaSchema.safeParse({
    id: formData.get("id"),
    nombre: formData.get("nombre"),
  })

  if (!validated.success) {
    return { error: "Nombre inválido" }
  }

  const carpeta = await prisma.carpeta.findFirst({
    where: { id: validated.data.id, empresaId },
  })

  if (!carpeta) {
    return { error: "Carpeta no encontrada" }
  }

  const dup = await prisma.carpeta.findFirst({
    where: { empresaId, nombre: validated.data.nombre, padreId: carpeta.padreId, id: { not: validated.data.id } },
  })
  if (dup) {
    return { error: "Ya existe otra carpeta con ese nombre en esta ubicación" }
  }

  await prisma.carpeta.update({
    where: { id: validated.data.id },
    data: { nombre: validated.data.nombre },
  })

  revalidatePath("/documentos")
}

export async function deleteCarpeta(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "carpeta", accion: "DELETE" })

  const carpeta = await prisma.carpeta.findFirst({
    where: { id, empresaId },
  })

  if (!carpeta) {
    return { error: "Carpeta no encontrada" }
  }

  const hijosCount = await prisma.carpeta.count({ where: { padreId: id } })
  const docsCount = await prisma.documento.count({ where: { carpetaId: id } })

  if (hijosCount > 0 || docsCount > 0) {
    return { error: "La carpeta no está vacía. Elimine su contenido primero." }
  }

  await prisma.carpeta.delete({ where: { id } })

  revalidatePath("/documentos")
}

const createDocumentoSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(200),
  tipo: z.string().min(1, "El tipo es requerido"),
  tamaño: z.number().int().positive(),
  url: z.string().min(1, "La URL es requerida"),
  carpetaId: z.string().nullable(),
  empleadoId: z.string().nullable(),
})

export async function createDocumento(formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "documento", accion: "CREATE" })

  const validated = createDocumentoSchema.safeParse({
    nombre: formData.get("nombre"),
    tipo: formData.get("tipo"),
    tamaño: Number(formData.get("tamaño")),
    url: formData.get("url"),
    carpetaId: formData.get("carpetaId") || null,
    empleadoId: formData.get("empleadoId") || null,
  })

  if (!validated.success) {
    return { error: "Datos inválidos" }
  }

  const dup = await prisma.documento.findFirst({
    where: {
      nombre: validated.data.nombre,
      carpetaId: validated.data.carpetaId,
      ...(validated.data.carpetaId ? { carpeta: { empresaId } } : {}),
    },
  })
  if (dup) {
    return { error: "Ya existe un documento con ese nombre en esta ubicación" }
  }

  await prisma.documento.create({
    data: {
      nombre: validated.data.nombre,
      tipo: validated.data.tipo,
      tamaño: validated.data.tamaño,
      url: validated.data.url,
      carpetaId: validated.data.carpetaId,
      empleadoId: validated.data.empleadoId,
    },
  })

  revalidatePath("/documentos")
}

export async function deleteDocumento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "documento", accion: "DELETE" })

  const doc = await prisma.documento.findUnique({
    where: { id },
    include: { carpeta: { select: { empresaId: true } } },
  })

  if (!doc || doc.carpeta?.empresaId !== empresaId) {
    return { error: "Documento no encontrado" }
  }

  await prisma.documento.delete({ where: { id } })

  revalidatePath("/documentos")
}
