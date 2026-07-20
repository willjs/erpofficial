"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { serializar } from "@/lib/utils"

export async function getDeliveryTicketPrint(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "READ" })

  const [dt, empresa] = await Promise.all([
    prisma.deliveryTicket.findFirst({
      where: { id, empresaId },
      include: {
        cliente: true,
        producto: true,
        barcaza: true,
        capitan: true,
        remolcador: true,
        vehiculo: true,
        conductor: true,
        vehiculos: true,
        conductores: true,
        timeline: { orderBy: { fecha: "asc" } },
        evidencias: true,
        firmas: true,
        ventas: { select: { id: true, numero: true, estado: true, total: true } },
      },
    }),
    prisma.empresa.findUnique({ where: { id: empresaId }, select: { nombre: true, logo: true, rfc: true, direccion: true, telefono: true, email: true } }),
  ])

  if (!dt) throw new Error("Delivery Ticket no encontrado")

  return {
    dt: serializar(dt) as any,
    empresa: empresa ? { ...empresa, logo: empresa.logo ?? "/images/orbys_logo.png" } : null,
  }
}
