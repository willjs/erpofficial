"use server"

import { prisma } from "@/lib/prisma"
import { verifySession, requireSuperAdmin } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const codigoSchema = z.object({
  codigo: z.string().min(1, "Código requerido").transform(s => s.toUpperCase()),
  descripcion: z.string().nullable().optional(),
})

export async function getCodigosAprobacion() {
  const session = await verifySession()
  requireSuperAdmin(session)

  const data = await prisma.codigoAprobacion.findMany({
    orderBy: { createdAt: "desc" },
  })
  return data.map((c) => ({
    ...c,
    usadoFecha: c.usadoFecha?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))
}

export async function crearCodigoAprobacion(data: z.infer<typeof codigoSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = codigoSchema.parse(data)

  const existing = await prisma.codigoAprobacion.findUnique({ where: { codigo: validated.codigo } })
  if (existing) throw new Error("Ya existe un código con ese valor")

  await prisma.codigoAprobacion.create({
    data: {
      empresaId: session.empresaId || "",
      codigo: validated.codigo,
      descripcion: validated.descripcion ?? null,
    },
  })

  revalidatePath("/admin/codigos-aprobacion")
}

export async function eliminarCodigoAprobacion(id: string) {
  const session = await verifySession()
  requireSuperAdmin(session)

  const existing = await prisma.codigoAprobacion.findUnique({ where: { id } })
  if (!existing) throw new Error("Código no encontrado")
  if (existing.usado) throw new Error("No se puede eliminar un código que ya fue usado")

  await prisma.codigoAprobacion.delete({ where: { id } })
  revalidatePath("/admin/codigos-aprobacion")
}

export async function desactivarCodigoAprobacion(id: string) {
  const session = await verifySession()
  requireSuperAdmin(session)

  const existing = await prisma.codigoAprobacion.findUnique({ where: { id } })
  if (!existing) throw new Error("Código no encontrado")

  await prisma.codigoAprobacion.update({
    where: { id },
    data: { activo: !existing.activo },
  })
  revalidatePath("/admin/codigos-aprobacion")
}
