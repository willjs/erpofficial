"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const barcazaSchema = z.object({ nombre: z.string().min(1), capacidad: z.coerce.number().positive(), estado: z.string().default("DISPONIBLE") })
const remolcadorSchema = z.object({ nombre: z.string().min(1), matricula: z.string().optional().or(z.literal("")) })
const vehiculoSchema = z.object({ placa: z.string().min(1), tipo: z.string().default("CISTERNA") })
const conductorSchema = z.object({ nombre: z.string().min(1), documento: z.string().optional().or(z.literal("")), licencia: z.string().optional().or(z.literal("")) })
const capitanSchema = z.object({ nombre: z.string().min(1), licencia: z.string().optional().or(z.literal("")) })

type RecursoNombre = "barcaza" | "remolcador" | "vehiculo" | "conductor" | "capitan"

const MODEL_MAP: Record<RecursoNombre, { model: any; nameField: string }> = {
  barcaza: { model: prisma.barcaza, nameField: "nombre" },
  remolcador: { model: prisma.remolcador, nameField: "nombre" },
  vehiculo: { model: prisma.vehiculo, nameField: "placa" },
  conductor: { model: prisma.conductor, nameField: "documento" },
  capitan: { model: prisma.capitan, nameField: "nombre" },
}

async function getEmpresaId() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "READ" })
  return { empresaId, userId }
}

// --- Barcazas ---
export async function getBarcazas() {
  const { empresaId, userId } = await getEmpresaId()
  return prisma.barcaza.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } })
}
export async function createBarcaza(data: z.infer<typeof barcazaSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "CREATE" })
  const validated = barcazaSchema.parse(data)
  const item = await prisma.barcaza.create({ data: { ...validated, empresaId } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function updateBarcaza(id: string, data: z.infer<typeof barcazaSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "UPDATE" })
  const validated = barcazaSchema.parse(data)
  const item = await prisma.barcaza.update({ where: { id, empresaId }, data: validated })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function deleteBarcaza(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "DELETE" })
  await prisma.barcaza.delete({ where: { id, empresaId } })
  revalidatePath("/operaciones/recursos")
}

// --- Remolcadores ---
export async function getRemolcadores() {
  const { empresaId, userId } = await getEmpresaId()
  return prisma.remolcador.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } })
}
export async function createRemolcador(data: z.infer<typeof remolcadorSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "CREATE" })
  const validated = remolcadorSchema.parse(data)
  const item = await prisma.remolcador.create({ data: { ...validated, empresaId, matricula: validated.matricula || null } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function updateRemolcador(id: string, data: z.infer<typeof remolcadorSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "UPDATE" })
  const validated = remolcadorSchema.parse(data)
  const item = await prisma.remolcador.update({ where: { id, empresaId }, data: { ...validated, matricula: validated.matricula || null } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function deleteRemolcador(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "DELETE" })
  await prisma.remolcador.delete({ where: { id, empresaId } })
  revalidatePath("/operaciones/recursos")
}

// --- Vehiculos ---
export async function getVehiculos() {
  const { empresaId, userId } = await getEmpresaId()
  return prisma.vehiculo.findMany({ where: { empresaId }, orderBy: { placa: "asc" } })
}
export async function createVehiculo(data: z.infer<typeof vehiculoSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "CREATE" })
  const validated = vehiculoSchema.parse(data)
  const item = await prisma.vehiculo.create({ data: { ...validated, empresaId } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function updateVehiculo(id: string, data: z.infer<typeof vehiculoSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "UPDATE" })
  const validated = vehiculoSchema.parse(data)
  const item = await prisma.vehiculo.update({ where: { id, empresaId }, data: validated })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function deleteVehiculo(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "DELETE" })
  await prisma.vehiculo.delete({ where: { id, empresaId } })
  revalidatePath("/operaciones/recursos")
}

// --- Conductores ---
export async function getConductores() {
  const { empresaId, userId } = await getEmpresaId()
  return prisma.conductor.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } })
}
export async function createConductor(data: z.infer<typeof conductorSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "CREATE" })
  const validated = conductorSchema.parse(data)
  const item = await prisma.conductor.create({ data: { ...validated, empresaId, documento: validated.documento || null, licencia: validated.licencia || null } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function updateConductor(id: string, data: z.infer<typeof conductorSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "UPDATE" })
  const validated = conductorSchema.parse(data)
  const item = await prisma.conductor.update({ where: { id, empresaId }, data: { ...validated, documento: validated.documento || null, licencia: validated.licencia || null } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function deleteConductor(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "DELETE" })
  await prisma.conductor.delete({ where: { id, empresaId } })
  revalidatePath("/operaciones/recursos")
}

// --- Capitanes ---
export async function getCapitanes() {
  const { empresaId, userId } = await getEmpresaId()
  return prisma.capitan.findMany({ where: { empresaId }, orderBy: { nombre: "asc" } })
}
export async function createCapitan(data: z.infer<typeof capitanSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "CREATE" })
  const validated = capitanSchema.parse(data)
  const item = await prisma.capitan.create({ data: { ...validated, empresaId, licencia: validated.licencia || null } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function updateCapitan(id: string, data: z.infer<typeof capitanSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "UPDATE" })
  const validated = capitanSchema.parse(data)
  const item = await prisma.capitan.update({ where: { id, empresaId }, data: { ...validated, licencia: validated.licencia || null } })
  revalidatePath("/operaciones/recursos")
  return item
}
export async function deleteCapitan(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "recurso_operacion", accion: "DELETE" })
  await prisma.capitan.delete({ where: { id, empresaId } })
  revalidatePath("/operaciones/recursos")
}
