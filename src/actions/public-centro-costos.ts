"use server"

import { prisma } from "@/lib/prisma"

export async function getCentrosCostosPublicos() {
  const empresa = await prisma.empresa.findFirst({ orderBy: { fechaCreacion: "asc" } })
  if (!empresa) return []

  return prisma.centroCostos.findMany({
    where: { empresaId: empresa.id, activo: true },
    orderBy: [{ codigo: "asc" }],
    select: { id: true, codigo: true, nombre: true, descripcion: true },
  })
}
