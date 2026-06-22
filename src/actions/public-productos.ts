"use server"

import { prisma } from "@/lib/prisma"

export async function getProductosPublicos() {
  const items = await prisma.producto.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      descripcion: true,
      unidadMedida: true,
      precioUnitario: true,
    },
    orderBy: { nombre: "asc" },
  })

  return items.map((p) => ({
    ...p,
    precioUnitario: p.precioUnitario ? Number(p.precioUnitario) : null,
  }))
}

export async function getServiciosPublicos() {
  const items = await prisma.servicio.findMany({
    where: { activo: true },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      descripcion: true,
      unidadMedida: true,
      precioUnitario: true,
    },
    orderBy: { nombre: "asc" },
  })

  return items.map((p) => ({
    ...p,
    precioUnitario: p.precioUnitario ? Number(p.precioUnitario) : null,
  }))
}
