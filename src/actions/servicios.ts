"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { verificarPermiso } from "@/lib/permisos"

function serializar<T>(obj: T): T {
  if (obj == null || typeof obj !== "object") return obj
  if (obj instanceof Date) return obj.toISOString() as any
  if (typeof (obj as any).toNumber === "function") return Number(obj as any) as T
  if (Array.isArray(obj)) return obj.map(serializar) as T
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializar(value)
  }
  return result as T
}

const servicioSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  unidadMedida: z.string().default("UNIDAD"),
  precioUnitario: z.coerce.number().optional().nullable(),
})

export type ServicioFormData = z.infer<typeof servicioSchema>

export async function getServicios() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "READ" })
  const data = await prisma.servicio.findMany({
    where: { empresaId },
    orderBy: { codigo: "asc" },
  })
  return serializar(data)
}

export async function createServicio(data: ServicioFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "CREATE" })
  const validated = servicioSchema.parse(data)
  const dup = await prisma.servicio.findFirst({ where: { empresaId, codigo: validated.codigo } })
  if (dup) throw new Error("Ya existe un servicio con ese código")
  const result = await prisma.servicio.create({
    data: {
      empresaId,
      ...validated,
      precioUnitario: validated.precioUnitario ?? undefined,
    },
  })
  revalidatePath("/servicios")
  return result
}

export async function updateServicio(id: string, data: ServicioFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "UPDATE" })
  const validated = servicioSchema.parse(data)
  const existing = await prisma.servicio.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Servicio no encontrado")
  const dup = await prisma.servicio.findFirst({ where: { empresaId, codigo: validated.codigo, id: { not: id } } })
  if (dup) throw new Error("Ya existe otro servicio con ese código")
  const result = await prisma.servicio.update({
    where: { id },
    data: {
      ...validated,
      precioUnitario: validated.precioUnitario ?? undefined,
    },
  })
  revalidatePath("/servicios")
  return result
}

export async function deleteServicio(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "DELETE" })
  const existing = await prisma.servicio.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Servicio no encontrado")
  await prisma.servicio.delete({ where: { id } })
  revalidatePath("/servicios")
}

// ─── Import Excel ─────────────────────────────────

export type ServicioImportRow = {
  codigo: string
  nombre: string
  categoria?: string
  unidadMedida: string
  precioUnitario?: number | null
  descripcion?: string
}

export async function importServiciosExcel(data: ServicioImportRow[], modo: "crear" | "actualizar" = "actualizar") {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "CREATE" })

  const result = { creados: 0, actualizados: 0, errores: 0, total: data.length, detalles: [] as string[] }

  for (const row of data) {
    try {
      if (!row.codigo || !row.nombre) {
        result.errores++
        result.detalles.push(`Fila sin código o nombre: ${JSON.stringify(row)}`)
        continue
      }

      const existente = await prisma.servicio.findFirst({ where: { empresaId, codigo: row.codigo } })

      if (existente) {
        if (modo === "crear") {
          result.errores++
          result.detalles.push(`Código ${row.codigo} ya existe, omitido (modo solo crear)`)
          continue
        }
        await prisma.servicio.update({
          where: { id: existente.id },
          data: {
            nombre: row.nombre,
            descripcion: row.descripcion ?? null,
            categoria: row.categoria ?? null,
            unidadMedida: row.unidadMedida || "UNIDAD",
            precioUnitario: row.precioUnitario !== undefined ? row.precioUnitario : undefined,
          },
        })
        result.actualizados++
        result.detalles.push(`Código ${row.codigo} actualizado`)
      } else {
        await prisma.servicio.create({
          data: {
            empresaId,
            codigo: row.codigo,
            nombre: row.nombre,
            descripcion: row.descripcion ?? null,
            categoria: row.categoria ?? null,
            unidadMedida: row.unidadMedida || "UNIDAD",
            precioUnitario: row.precioUnitario ?? undefined,
          },
        })
        result.creados++
      }
    } catch {
      result.errores++
      result.detalles.push(`Error al procesar ${row.codigo || row.nombre}`)
    }
  }

  revalidatePath("/servicios")
  return result
}
