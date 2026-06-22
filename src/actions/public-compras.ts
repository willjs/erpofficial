"use server"

import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { writeFile, mkdir } from "node:fs/promises"
import path from "node:path"

const prioridadMap = {
  normal: "NORMAL",
  urgente: "URGENTE",
  emergencia: "EMERGENCIA",
} as const

const publicRequisicionSchema = z.object({
  solicitante: z.string().min(1, "Nombre del solicitante requerido"),
  prioridad: z.enum(["normal", "urgente", "emergencia"]).default("normal"),
  centroCostosId: z.string().optional(),
  observaciones: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        descripcion: z.string().min(1, "Descripción requerida"),
        unidadMedida: z.string().min(1, "Unidad requerida"),
        cantidadSolicitada: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
      })
    )
    .min(1, "Al menos un ítem requerido"),
})

export type PublicRequisicionFormData = z.infer<typeof publicRequisicionSchema>

export type PublicRequisicionState = { success?: boolean; error?: string } | undefined

async function saveFile(file: File, empresaId: string): Promise<{ nombre: string; url: string; tamaño: number } | null> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadDir = path.join(process.cwd(), "public", "uploads", empresaId)
    await mkdir(uploadDir, { recursive: true })
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const filePath = path.join(uploadDir, fileName)
    await writeFile(filePath, buffer)
    return {
      nombre: file.name,
      url: `/uploads/${empresaId}/${fileName}`,
      tamaño: file.size,
    }
  } catch {
    return null
  }
}

export async function crearRequisicionPublica(
  _prevState: PublicRequisicionState,
  formData: FormData
): Promise<PublicRequisicionState> {
  const itemsRaw: { descripcion: string; unidadMedida: string; cantidadSolicitada: string }[] = []
  let i = 0
  while (formData.has(`items.${i}.descripcion`)) {
    itemsRaw.push({
      descripcion: formData.get(`items.${i}.descripcion`) as string,
      unidadMedida: formData.get(`items.${i}.unidadMedida`) as string,
      cantidadSolicitada: formData.get(`items.${i}.cantidadSolicitada`) as string,
    })
    i++
  }

  const raw = {
    solicitante: formData.get("solicitante"),
    prioridad: formData.get("prioridad") || "normal",
    centroCostosId: formData.get("centroCostosId") || undefined,
    observaciones: formData.get("observaciones") || null,
    items: itemsRaw,
  }

  const validated = publicRequisicionSchema.safeParse(raw)
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(". ") }
  }

  try {
    const empresa = await prisma.empresa.findFirst({ orderBy: { fechaCreacion: "asc" } })
    if (!empresa) return { error: "No hay empresa configurada en el sistema" }

    const [lastReq, lastFra] = await Promise.all([
      prisma.requisicion.findFirst({
        where: { empresaId: empresa.id },
        orderBy: { numero: "desc" },
        select: { numero: true },
      }),
      prisma.requisicion.findFirst({
        where: { empresaId: empresa.id, numeroFactura: { not: null } },
        orderBy: { numeroFactura: "desc" },
        select: { numeroFactura: true },
      }),
    ])
    const nextNumero = (lastReq?.numero ?? 0) + 1
    const nextFactura = (lastFra?.numeroFactura ?? 0) + 1

    const archivos: { nombre: string; url: string; tamaño: number }[] = []
    let fileIdx = 0
    while (formData.has(`archivo.${fileIdx}`)) {
      const file = formData.get(`archivo.${fileIdx}`) as File
      if (file && file.size > 0) {
        const saved = await saveFile(file, empresa.id)
        if (saved) archivos.push(saved)
      }
      fileIdx++
    }

    let areaNombre = "NO ESPECIFICADO"
    if (validated.data.centroCostosId) {
      const cc = await prisma.centroCostos.findUnique({ where: { id: validated.data.centroCostosId } })
      if (cc) areaNombre = cc.nombre
    }

    await prisma.requisicion.create({
      data: {
        empresaId: empresa.id,
        numero: nextNumero,
        numeroFactura: nextFactura,
        areaSolicitante: areaNombre,
        requeridoPor: validated.data.solicitante,
        prioridad: prioridadMap[validated.data.prioridad],
        estado: "PENDIENTE_APROBACION",
        observaciones: validated.data.observaciones ?? null,
        archivos: archivos.length > 0 ? archivos : undefined,
        items: {
          create: validated.data.items.map((item, idx) => ({
            item: idx + 1,
            descripcion: item.descripcion,
            unidadMedida: item.unidadMedida,
            cantidadSolicitada: item.cantidadSolicitada,
            centroCostosId: validated.data.centroCostosId ?? null,
          })),
        },
      },
    })

    return { success: true }
  } catch {
    return { error: "Error al enviar la solicitud. Intente nuevamente." }
  }
}
