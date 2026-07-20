"use server"

import { prisma } from "@/lib/prisma"
import { mkdir, writeFile } from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"
import { enviarCorreo } from "@/lib/email"

async function saveFile(file: { nombre: string; base64: string }, empresaId: string) {
  if (!file.base64) return null
  const base64Data = file.base64.includes("base64,") ? file.base64.split("base64,")[1] : file.base64
  const buffer = Buffer.from(base64Data, "base64")
  const sanitized = file.nombre.replace(/[^a-zA-Z0-9._-]/g, "_")
  const uploadDir = path.join(process.cwd(), "public", "uploads", empresaId, "delivery")
  await mkdir(uploadDir, { recursive: true })
  const fileName = `${Date.now()}_${sanitized}`
  await writeFile(path.join(uploadDir, fileName), buffer)
  return { nombre: file.nombre, url: `/uploads/${empresaId}/delivery/${fileName}`, tamaño: buffer.length }
}

export async function getDeliveryTicketPublic(token: string) {
  const dt = await prisma.deliveryTicket.findFirst({
    where: { id: token },
    include: {
      cliente: { select: { id: true, nombre: true } },
      producto: { select: { id: true, nombre: true, unidadMedida: true } },
      barcaza: { select: { id: true, nombre: true } },
      vehiculos: { select: { id: true, placa: true } },
      conductores: { select: { id: true, nombre: true } },
      firmas: { select: { id: true, rol: true, nombre: true, firma: true, sello: true, fecha: true } },
      timeline: { orderBy: { fecha: "asc" }, select: { id: true, evento: true, fecha: true, hora: true } },
    },
  })
  if (!dt) return null
  return {
    id: dt.id,
    numero: dt.numero,
    fecha: dt.fecha.toISOString(),
    cliente: dt.cliente?.nombre ?? "",
    motonave: dt.motonave,
    imo: dt.imo ?? null,
    bandera: dt.bandera ?? null,
    puerto: dt.puerto,
    lugarSuministro: dt.lugarSuministro ?? "",
    tipoSuministro: dt.tipoSuministro ?? "",
    producto: dt.producto?.nombre ?? "",
    productoUnidad: dt.producto?.unidadMedida ?? "TON",
    cantidadEntregada: Number(dt.cantidadEntregada),
    unidadMedida: dt.unidadMedida ?? dt.producto?.unidadMedida ?? "MT",
    sondajeAntes: dt.sondajeAntes ? Number(dt.sondajeAntes) : null,
    sondajeAntesRealizado: dt.sondajeAntesRealizado,
    sondajeDespues: dt.sondajeDespues ? Number(dt.sondajeDespues) : null,
    sondajeDespuesRealizado: dt.sondajeDespuesRealizado,
    sondajeTestificado: dt.sondajeTestificado,
    barcaza: dt.barcaza?.nombre ?? null,
    estado: dt.estado,
    vehiculos: dt.vehiculos.map((v: any) => ({ id: v.id, placa: v.placa })),
    conductores: dt.conductores.map((c: any) => ({ id: c.id, nombre: c.nombre })),
    timeline: dt.timeline.map((t: any) => ({
      id: t.id,
      evento: t.evento,
      fecha: t.fecha.toISOString(),
      hora: t.hora,
    })),
    firmas: dt.firmas.map((f: any) => ({
      id: f.id,
      rol: f.rol,
      nombre: f.nombre,
      firma: f.firma,
      sello: f.sello,
      fecha: f.fecha.toISOString(),
    })),
  }
}

export async function saveTimelinePublic(
  token: string,
  events: { evento: string; fecha: string; hora?: string }[],
  cantidadEntregada?: number,
  unidadMedida?: string,
  sondajeAntesRealizado?: string,
  sondajeDespuesRealizado?: string,
  sondajeTestificado?: string,
) {
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: token } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado !== "BORRADOR") throw new Error("El Delivery Ticket ya fue confirmado o cerrado")

  // Update cantidadEntregada, unidadMedida, and sondeos if provided
  const updateData: any = {}
  if (cantidadEntregada != null && cantidadEntregada > 0) updateData.cantidadEntregada = cantidadEntregada
  if (unidadMedida) updateData.unidadMedida = unidadMedida
  if (sondajeAntesRealizado) updateData.sondajeAntesRealizado = sondajeAntesRealizado
  if (sondajeDespuesRealizado) updateData.sondajeDespuesRealizado = sondajeDespuesRealizado
  if (sondajeTestificado) updateData.sondajeTestificado = sondajeTestificado
  if (Object.keys(updateData).length > 0) {
    await prisma.deliveryTicket.update({ where: { id: token }, data: updateData })
  }

  // Delete existing timeline events for this DT
  await prisma.deliveryTicketTimeline.deleteMany({ where: { deliveryTicketId: token } })

  // Create new events
  for (const ev of events) {
    await prisma.deliveryTicketTimeline.create({
      data: {
        deliveryTicketId: token,
        evento: ev.evento,
        fecha: new Date(ev.fecha),
        hora: ev.hora || null,
      },
    })
  }

  revalidatePath(`/public/delivery/${token}`)
  return { success: true }
}

export async function saveVehiculosPublic(token: string, placas: string[]) {
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: token } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado !== "BORRADOR") throw new Error("El Delivery Ticket ya fue confirmado o cerrado")

  await prisma.deliveryTicketVehiculo.deleteMany({ where: { deliveryTicketId: token } })
  for (const placa of placas) {
    if (placa.trim()) {
      await prisma.deliveryTicketVehiculo.create({
        data: { deliveryTicketId: token, placa: placa.trim() },
      })
    }
  }

  revalidatePath(`/public/delivery/${token}`)
  return { success: true }
}

export async function saveConductoresPublic(token: string, nombres: string[]) {
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: token } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado !== "BORRADOR") throw new Error("El Delivery Ticket ya fue confirmado o cerrado")

  await prisma.deliveryTicketConductor.deleteMany({ where: { deliveryTicketId: token } })
  for (const nombre of nombres) {
    if (nombre.trim()) {
      await prisma.deliveryTicketConductor.create({
        data: { deliveryTicketId: token, nombre: nombre.trim() },
      })
    }
  }

  revalidatePath(`/public/delivery/${token}`)
  return { success: true }
}

export async function firmarDeliveryTicketPublic(
  token: string,
  data: { rol: "REPRESENTANTE_PROVEEDOR" | "CAPITAN" | "JEFE_MAQUINAS"; nombre: string; firma: string; sello?: string }
) {
  const dt = await prisma.deliveryTicket.findFirst({ where: { id: token } })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado !== "BORRADOR") throw new Error("El Delivery Ticket ya fue confirmado o cerrado")

  const existing = await prisma.deliveryTicketFirma.findUnique({
    where: { deliveryTicketId_rol: { deliveryTicketId: token, rol: data.rol } },
  })
  if (existing) throw new Error(`Ya existe una firma de ${data.rol}`)

  const savedFirma = data.firma
    ? await saveFile({ nombre: `firma_public_${data.rol}_${Date.now()}.png`, base64: data.firma }, dt.empresaId)
    : null

  let savedSello = null
  if (data.sello) {
    const isBase64 = data.sello.startsWith("data:") || /^[A-Za-z0-9+/=]+$/.test(data.sello)
    if (isBase64) {
      const base64Data = data.sello.includes("base64,") ? data.sello.split("base64,")[1] : data.sello
      savedSello = await saveFile({ nombre: `sello_public_${data.rol}_${Date.now()}.png`, base64: base64Data }, dt.empresaId)
    }
  }

  const firma = await prisma.deliveryTicketFirma.create({
    data: {
      deliveryTicketId: token,
      rol: data.rol,
      nombre: data.nombre,
      firma: savedFirma?.url ?? data.firma,
      sello: savedSello?.url ?? (data.sello || null),
    },
  })

  revalidatePath(`/public/delivery/${token}`)
  return { id: firma.id, rol: firma.rol, nombre: firma.nombre, firma: firma.firma, sello: firma.sello }
}

export async function enviarEnlaceCorreo(token: string, destinatario: string) {
  const dt = await prisma.deliveryTicket.findFirst({
    where: { id: token },
    include: { cliente: true },
  })
  if (!dt) throw new Error("Delivery Ticket no encontrado")

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000"
  const link = `${baseUrl}/delivery/${token}`

  const result = await enviarCorreo({
    to: destinatario,
    subject: `Delivery Ticket #${dt.numero} — ${dt.motonave}`,
    html: `
      <div style="font-family: Arial; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a56db;">Delivery Ticket #${dt.numero}</h2>
        <p><strong>Motonave:</strong> ${dt.motonave}</p>
        <p><strong>Cliente:</strong> ${dt.cliente?.nombre ?? "-"}</p>
        <p><strong>Puerto:</strong> ${dt.puerto}</p>
        <hr />
        <p>Para completar el timeline y firmas, haz clic en el siguiente enlace:</p>
        <a href="${link}" style="display: inline-block; background: #1a56db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Abrir Delivery Ticket</a>
        <p style="color: #666; font-size: 12px;">O copia este enlace en tu navegador: ${link}</p>
      </div>
    `,
  })

  return result
}

export async function finalizarPublic(token: string, cantidadEntregada?: number) {
  const dt = await prisma.deliveryTicket.findFirst({
    where: { id: token },
    include: { firmas: true, timeline: true },
  })
  if (!dt) throw new Error("Delivery Ticket no encontrado")
  if (dt.estado !== "BORRADOR") throw new Error("El Delivery Ticket ya fue confirmado o cerrado")

  // Validate: need at least COMPANIA_ENTREGA + CAPITAN or JEFE_MAQUINAS firmas
  const rolesFirmas = dt.firmas.map(f => f.rol)
  const hasProveedor = rolesFirmas.includes("REPRESENTANTE_PROVEEDOR")
  const hasCapitanOjefe = rolesFirmas.includes("CAPITAN") || rolesFirmas.includes("JEFE_MAQUINAS")
  if (!hasProveedor) throw new Error("Falta la firma de la compañía de entrega")
  if (!hasCapitanOjefe) throw new Error("Falta la firma del Capitán o Jefe de Máquinas")

  const data: any = { estado: "CONFIRMADO" }
  if (cantidadEntregada != null && cantidadEntregada > 0) {
    data.cantidadEntregada = cantidadEntregada
  }

  const updated = await prisma.deliveryTicket.update({
    where: { id: token },
    data,
  })

  revalidatePath(`/public/delivery/${token}`)
  return { id: updated.id, estado: updated.estado }
}
