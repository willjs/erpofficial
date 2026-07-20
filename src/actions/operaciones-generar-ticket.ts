"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { serializar } from "@/lib/utils"
import { revalidatePath } from "next/cache"

export async function getOrdenesOperativasParaTicket() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "CREATE" })

  const ordenes = await prisma.ordenOperativa.findMany({
    where: { empresaId, estado: { not: "CERRADA" } },
    include: {
      programacion: { select: { id: true, numero: true, imo: true, bandera: true, lugarSuministro: true } },
      cliente: { select: { id: true, nombre: true } },
      producto: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return ordenes.map(o => serializar({
    ...o,
    numero: o.numero,
    programacion: o.programacion ? { ...o.programacion } : null,
  })) as any
}

export async function generarTicketDesdeOrden(ordenId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "delivery_ticket", accion: "CREATE" })

  const orden = await prisma.ordenOperativa.findFirst({
    where: { id: ordenId, empresaId },
    include: {
      programacion: true,
      cliente: true,
      producto: true,
    },
  })
  if (!orden) throw new Error("Orden operativa no encontrada")
  if (!orden.programacion) throw new Error("La orden no tiene programación asociada")

  const prog = orden.programacion

  const lastDt = await prisma.deliveryTicket.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
  })
  const nextNumero = (lastDt?.numero ?? 0) + 1

  const dt = await prisma.deliveryTicket.create({
    data: {
      empresaId,
      numero: nextNumero,
      fecha: new Date(),
      clienteId: orden.clienteId,
      motonave: orden.motonave,
      imo: prog.imo,
      bandera: prog.bandera,
      lugarSuministro: prog.lugarSuministro,
      puerto: orden.puerto,
      productoId: orden.productoId,
      ordenOperativaId: orden.id,
      tipoSuministro: "BARGE",
      // Copiar calidad desde Orden Operativa
      api: orden.api ?? undefined,
      gravedadEspecifica: orden.gravedadEspecifica ?? undefined,
      densidad: orden.densidad ?? undefined,
      viscosidad: orden.viscosidad ?? undefined,
      azufre: orden.azufre ?? undefined,
      agua: orden.agua ?? undefined,
      puntoChispa: orden.puntoChispa ?? undefined,
      temperatura: orden.temperatura ?? undefined,
      otrasPropiedades: orden.otrasPropiedades ?? undefined,
      // Copiar muestras desde Orden Operativa (mapeo de nombres)
      selloProveedor: orden.muestraProveedor ?? undefined,
      selloMotonave: orden.muestraMotonave ?? undefined,
      marpolAnnexVi: orden.muestraMarpolInfo ?? undefined,
      otraMuestra: orden.muestraOtra ?? undefined,
      // Copiar observaciones desde la programación operativa
      observaciones: prog.observaciones ?? undefined,
      // Copiar agente desde la programación operativa
      agente: prog.agente ?? undefined,
      // Copiar dirección y ciudad desde el cliente
      direccion: orden.cliente?.direccion ?? undefined,
      ciudad: orden.cliente?.ciudad ?? undefined,
    } as any,
    include: {
      cliente: { select: { id: true, nombre: true, direccion: true, ciudad: true } },
      producto: { select: { id: true, nombre: true } },
    },
  })

  await prisma.historialEstado.create({
    data: {
      empresaId,
      entidadTipo: "DELIVERY_TICKET",
      entidadId: dt.id,
      estadoNuevo: "BORRADOR",
      descripcion: `Delivery Ticket #${nextNumero} generado desde Orden Operativa #${orden.numero}`,
      usuarioId: userId,
    },
  })

  revalidatePath("/operaciones/delivery")
  return serializar({
    ...dt,
    cliente: dt.cliente?.nombre ?? "",
    producto: dt.producto?.nombre ?? "",
  }) as any
}
