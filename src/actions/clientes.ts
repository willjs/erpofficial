"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import type { TipoInteraccion } from "@prisma/client"
import { z } from "zod"

const clienteSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  email: z.string().optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  direccion: z.string().optional().or(z.literal("")),
  rfc: z.string().optional().or(z.literal("")),
  tipo: z.string().default("EMPRESA"),
  notas: z.string().optional().or(z.literal("")),
})

const contactoSchema = z.object({
  clienteId: z.string().min(1),
  nombre: z.string().min(1, "El nombre es requerido"),
  cargo: z.string().optional().or(z.literal("")),
  email: z.string().optional().or(z.literal("")),
  telefono: z.string().optional().or(z.literal("")),
  principal: z.boolean().default(false),
})

const interaccionSchema = z.object({
  clienteId: z.string().min(1),
  tipo: z.enum(["LLAMADA", "EMAIL", "REUNION", "NOTA", "PROPUESTA"]),
  fecha: z.string().min(1, "La fecha es requerida"),
  descripcion: z.string().min(1, "La descripción es requerida"),
})

export async function getClientes(search?: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cliente", accion: "READ" })
  const where: Record<string, unknown> = { empresaId }
  if (search) {
    where.OR = [
      { nombre: { contains: search } },
      { email: { contains: search } },
      { rfc: { contains: search } },
    ]
  }
  return prisma.cliente.findMany({
    where,
    orderBy: { nombre: "asc" },
    include: { _count: { select: { contactos: true, interacciones: true } } },
  })
}

export async function getCliente(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cliente", accion: "READ" })
  return prisma.cliente.findFirst({
    where: { id, empresaId },
    include: { contactos: { orderBy: { principal: "desc" } } },
  })
}

export async function createCliente(formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cliente", accion: "CREATE" })
  const data = clienteSchema.parse(Object.fromEntries(formData))
  await prisma.cliente.create({ data: { ...data, empresaId } })
  revalidatePath("/clientes")
}

export async function updateCliente(id: string, formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cliente", accion: "UPDATE" })
  const existing = await prisma.cliente.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Cliente no encontrado")
  const data = clienteSchema.parse(Object.fromEntries(formData))
  await prisma.cliente.update({ where: { id }, data })
  revalidatePath("/clientes")
}

export async function toggleClienteActivo(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cliente", accion: "UPDATE" })
  const cliente = await prisma.cliente.findFirst({ where: { id, empresaId } })
  if (!cliente) throw new Error("Cliente no encontrado")
  await prisma.cliente.update({ where: { id }, data: { activo: !cliente.activo } })
  revalidatePath("/clientes")
}

export async function deleteCliente(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "cliente", accion: "DELETE" })
  await prisma.cliente.delete({ where: { id, empresaId } })
  revalidatePath("/clientes")
}

export async function getContactos(clienteId: string) {
  const { userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contacto_cliente", accion: "READ" })
  return prisma.contactoCliente.findMany({
    where: { clienteId },
    orderBy: [{ principal: "desc" }, { nombre: "asc" }],
  })
}

export async function createContacto(formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contacto_cliente", accion: "CREATE" })
  const data = contactoSchema.parse(Object.fromEntries(formData))
  const cliente = await prisma.cliente.findFirst({ where: { id: data.clienteId, empresaId } })
  if (!cliente) throw new Error("Cliente no encontrado")
  if (data.principal) {
    await prisma.contactoCliente.updateMany({
      where: { clienteId: data.clienteId, principal: true },
      data: { principal: false },
    })
  }
  await prisma.contactoCliente.create({ data })
  revalidatePath("/clientes")
}

export async function updateContacto(id: string, formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contacto_cliente", accion: "UPDATE" })
  const data = contactoSchema.parse(Object.fromEntries(formData))
  const existing = await prisma.contactoCliente.findFirst({
    where: { id, cliente: { empresaId } },
  })
  if (!existing) throw new Error("Contacto no encontrado")
  if (data.principal) {
    await prisma.contactoCliente.updateMany({
      where: { clienteId: data.clienteId, principal: true, NOT: { id } },
      data: { principal: false },
    })
  }
  await prisma.contactoCliente.update({ where: { id }, data })
  revalidatePath("/clientes")
}

export async function setContactoPrincipal(id: string, clienteId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contacto_cliente", accion: "UPDATE" })
  const existing = await prisma.contactoCliente.findFirst({
    where: { id, cliente: { empresaId } },
  })
  if (!existing) throw new Error("Contacto no encontrado")
  await prisma.contactoCliente.updateMany({
    where: { clienteId, principal: true },
    data: { principal: false },
  })
  await prisma.contactoCliente.update({ where: { id }, data: { principal: true } })
  revalidatePath("/clientes")
}

export async function deleteContacto(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contacto_cliente", accion: "DELETE" })
  const existing = await prisma.contactoCliente.findFirst({
    where: { id, cliente: { empresaId } },
  })
  if (!existing) throw new Error("Contacto no encontrado")
  await prisma.contactoCliente.delete({ where: { id } })
  revalidatePath("/clientes")
}

export async function getInteracciones() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "interaccion_cliente", accion: "READ" })
  return prisma.interaccionCliente.findMany({
    where: { cliente: { empresaId } },
    orderBy: { fecha: "desc" },
    include: { cliente: { select: { id: true, nombre: true } } },
  })
}

export async function createInteraccion(formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "interaccion_cliente", accion: "CREATE" })
  const data = interaccionSchema.parse(Object.fromEntries(formData))
  const cliente = await prisma.cliente.findFirst({ where: { id: data.clienteId, empresaId } })
  if (!cliente) throw new Error("Cliente no encontrado")
  await prisma.interaccionCliente.create({
    data: {
      clienteId: data.clienteId,
      tipo: data.tipo as TipoInteraccion,
      fecha: new Date(data.fecha),
      descripcion: data.descripcion,
      usuarioId: userId,
    },
  })
  revalidatePath("/clientes")
}

export async function updateInteraccion(id: string, formData: FormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "interaccion_cliente", accion: "UPDATE" })
  const data = interaccionSchema.parse(Object.fromEntries(formData))
  const existing = await prisma.interaccionCliente.findFirst({
    where: { id, cliente: { empresaId } },
  })
  if (!existing) throw new Error("Interacción no encontrada")
  await prisma.interaccionCliente.update({
    where: { id },
    data: {
      clienteId: data.clienteId,
      tipo: data.tipo as TipoInteraccion,
      fecha: new Date(data.fecha),
      descripcion: data.descripcion,
    },
  })
  revalidatePath("/clientes")
}

export async function deleteInteraccion(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "interaccion_cliente", accion: "DELETE" })
  const existing = await prisma.interaccionCliente.findFirst({
    where: { id, cliente: { empresaId } },
  })
  if (!existing) throw new Error("Interacción no encontrada")
  await prisma.interaccionCliente.delete({ where: { id } })
  revalidatePath("/clientes")
}
