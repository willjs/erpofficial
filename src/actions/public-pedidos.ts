"use server"

import { prisma } from "@/lib/prisma"
import { z } from "zod"

const publicPedidoItemSchema = z.object({
  tipoItem: z.enum(["PRODUCTO", "SERVICIO"]).default("PRODUCTO"),
  descripcion: z.string().min(1, "Descripción requerida"),
  unidadMedida: z.string().min(1, "Unidad requerida"),
  cantidad: z.coerce.number().positive("Cantidad debe ser mayor a 0"),
})

const publicPedidoSchema = z.object({
  clienteNombre: z.string().min(1, "Nombre del cliente requerido"),
  clienteEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  clienteTelefono: z.string().optional().or(z.literal("")),
  notas: z.string().optional().or(z.literal("")),
  items: z.array(publicPedidoItemSchema).min(1, "Al menos un ítem requerido"),
})

export type PublicPedidoFormData = z.infer<typeof publicPedidoSchema>

export type PublicPedidoState = { success?: boolean; error?: string } | undefined

export async function crearPedidoPublico(
  _prevState: PublicPedidoState,
  formData: FormData
): Promise<PublicPedidoState> {
  const itemsRaw: { tipoItem: string; descripcion: string; unidadMedida: string; cantidad: string }[] = []
  let i = 0
  while (formData.has(`items.${i}.descripcion`)) {
    itemsRaw.push({
      tipoItem: formData.get(`items.${i}.tipoItem`) as string || "PRODUCTO",
      descripcion: formData.get(`items.${i}.descripcion`) as string,
      unidadMedida: formData.get(`items.${i}.unidadMedida`) as string,
      cantidad: formData.get(`items.${i}.cantidad`) as string,
    })
    i++
  }

  const raw = {
    clienteNombre: formData.get("clienteNombre"),
    clienteEmail: formData.get("clienteEmail") || "",
    clienteTelefono: formData.get("clienteTelefono") || "",
    notas: formData.get("notas") || "",
    items: itemsRaw,
  }

  const validated = publicPedidoSchema.safeParse(raw)
  if (!validated.success) {
    return { error: validated.error.issues.map((e) => e.message).join(". ") }
  }

  try {
    const empresa = await prisma.empresa.findFirst({ orderBy: { fechaCreacion: "asc" } })
    if (!empresa) return { error: "No hay empresa configurada en el sistema" }

    let cliente = await prisma.cliente.findFirst({
      where: { empresaId: empresa.id, nombre: validated.data.clienteNombre },
    })

    if (!cliente) {
      cliente = await prisma.cliente.create({
        data: {
          empresaId: empresa.id,
          nombre: validated.data.clienteNombre,
          email: validated.data.clienteEmail || null,
          telefono: validated.data.clienteTelefono || null,
          activo: true,
        },
      })
    }

    const last = await prisma.pedido.findFirst({
      where: { empresaId: empresa.id },
      orderBy: { numero: "desc" },
    })
    const numero = (last?.numero ?? 0) + 1

    await prisma.pedido.create({
      data: {
        empresaId: empresa.id,
        numero,
        clienteId: cliente.id,
        fecha: new Date(),
        estado: "BORRADOR",
        subtotal: 0,
        descuento: 0,
        impuesto: 0,
        total: 0,
        notas: validated.data.notas || null,
        items: {
          create: validated.data.items.map((item, idx) => ({
            item: idx + 1,
            tipoItem: item.tipoItem as "PRODUCTO" | "SERVICIO",
            descripcion: item.descripcion,
            unidadMedida: item.unidadMedida,
            cantidad: item.cantidad,
            precioUnitario: 0,
            descuento: 0,
            subtotal: 0,
            impuesto: 0,
            total: 0,
          })),
        },
      },
    })

    return { success: true }
  } catch {
    return { error: "Error al enviar el pedido. Intente nuevamente." }
  }
}
