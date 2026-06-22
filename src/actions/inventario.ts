"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"

const INVENTARIO_PATH = "/inventario"

// ============================================================
// CATEGORÍAS
// ============================================================

export async function getCategorias() {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "categoria_activo", accion: "READ" })
  return prisma.categoriaActivo.findMany({
    where: { empresaId },
    orderBy: { nombre: "asc" },
    include: { _count: { select: { activos: true } } },
  })
}

export async function createCategoria(formData: FormData) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "categoria_activo", accion: "CREATE" })
  const nombre = formData.get("nombre") as string
  const descripcion = (formData.get("descripcion") as string) || null

  const dup = await prisma.categoriaActivo.findFirst({ where: { empresaId, nombre } })
  if (dup) throw new Error("Ya existe una categoría con ese nombre")

  await prisma.categoriaActivo.create({
    data: { empresaId, nombre, descripcion },
  })
  revalidatePath(INVENTARIO_PATH)
}

export async function updateCategoria(id: string, formData: FormData) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "categoria_activo", accion: "UPDATE" })
  const nombre = formData.get("nombre") as string
  const descripcion = (formData.get("descripcion") as string) || null

  const dup = await prisma.categoriaActivo.findFirst({ where: { empresaId, nombre, id: { not: id } } })
  if (dup) throw new Error("Ya existe otra categoría con ese nombre")

  await prisma.categoriaActivo.update({
    where: { id, empresaId },
    data: { nombre, descripcion },
  })
  revalidatePath(INVENTARIO_PATH)
}

export async function toggleCategoria(id: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "categoria_activo", accion: "UPDATE" })
  const cat = await prisma.categoriaActivo.findFirst({ where: { id, empresaId } })
  if (!cat) throw new Error("Categoría no encontrada")
  await prisma.categoriaActivo.update({
    where: { id },
    data: { activo: !cat.activo },
  })
  revalidatePath(INVENTARIO_PATH)
}

export async function deleteCategoria(id: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "categoria_activo", accion: "DELETE" })
  await prisma.categoriaActivo.delete({ where: { id, empresaId } })
  revalidatePath(INVENTARIO_PATH)
}

// ============================================================
// ACTIVOS
// ============================================================

export async function getActivos() {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "activo", accion: "READ" })
  return prisma.activo.findMany({
    where: { empresaId },
    include: { categoria: { select: { id: true, nombre: true } } },
    orderBy: { createdAt: "desc" },
  })
}

async function generateCodigo(empresaId: string): Promise<string> {
  const last = await prisma.activo.findFirst({
    where: { empresaId },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  })
  const nextNum = last ? (parseInt(last.codigo.split("-")[1] ?? "0", 10) || 0) + 1 : 1
  return `ACT-${String(nextNum).padStart(5, "0")}`
}

export async function createActivo(formData: FormData) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "activo", accion: "CREATE" })
  const codigo = await generateCodigo(empresaId)

  const data: Record<string, unknown> = {
    empresaId,
    codigo,
    nombre: formData.get("nombre") as string,
    descripcion: (formData.get("descripcion") as string) || null,
    marca: (formData.get("marca") as string) || null,
    modelo: (formData.get("modelo") as string) || null,
    numeroSerie: (formData.get("numeroSerie") as string) || null,
    ubicacion: (formData.get("ubicacion") as string) || null,
  }

  const categoriaId = formData.get("categoriaId") as string
  if (categoriaId) data.categoriaId = categoriaId

  const fechaAdq = formData.get("fechaAdquisicion") as string
  if (fechaAdq) data.fechaAdquisicion = new Date(fechaAdq)

  const valAdq = formData.get("valorAdquisicion") as string
  if (valAdq) data.valorAdquisicion = parseFloat(valAdq)

  const valAct = formData.get("valorActual") as string
  if (valAct) data.valorActual = parseFloat(valAct)

  await prisma.activo.create({ data: data as any })
  revalidatePath(INVENTARIO_PATH)
}

export async function updateActivo(id: string, formData: FormData) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "activo", accion: "UPDATE" })

  const data: Record<string, unknown> = {
    nombre: formData.get("nombre") as string,
    descripcion: (formData.get("descripcion") as string) || null,
    marca: (formData.get("marca") as string) || null,
    modelo: (formData.get("modelo") as string) || null,
    numeroSerie: (formData.get("numeroSerie") as string) || null,
    ubicacion: (formData.get("ubicacion") as string) || null,
    categoriaId: (formData.get("categoriaId") as string) || null,
  }

  const fechaAdq = formData.get("fechaAdquisicion") as string
  data.fechaAdquisicion = fechaAdq ? new Date(fechaAdq) : null

  const valAdq = formData.get("valorAdquisicion") as string
  data.valorAdquisicion = valAdq ? parseFloat(valAdq) : null

  const valAct = formData.get("valorActual") as string
  data.valorActual = valAct ? parseFloat(valAct) : null

  const estado = formData.get("estado") as string
  if (estado) data.estado = estado

  await prisma.activo.update({ where: { id, empresaId }, data: data as any })
  revalidatePath(INVENTARIO_PATH)
}

export async function deleteActivo(id: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "activo", accion: "DELETE" })
  await prisma.activo.delete({ where: { id, empresaId } })
  revalidatePath(INVENTARIO_PATH)
}

// ============================================================
// MOVIMIENTOS
// ============================================================

export async function getMovimientos(activoId?: string) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_activo", accion: "READ" })
  const where: Record<string, unknown> = { activo: { empresaId } }
  if (activoId) where.activoId = activoId
  return prisma.movimientoActivo.findMany({
    where: where as any,
    include: {
      responsable: { select: { nombre: true, apellido: true } },
      activo: { select: { codigo: true, nombre: true } },
    },
    orderBy: { fecha: "desc" },
  })
}

export async function createMovimiento(formData: FormData) {
  const { userId, empresaId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_activo", accion: "CREATE" })

  const activoId = formData.get("activoId") as string
  const tipo = formData.get("tipo") as string
  const observaciones = (formData.get("observaciones") as string) || null
  const fechaRaw = formData.get("fecha") as string
  const fecha = fechaRaw ? new Date(fechaRaw) : new Date()

  await prisma.movimientoActivo.create({
    data: {
      activoId,
      tipo: tipo as any,
      fecha,
      responsableId: userId,
      observaciones,
    },
  })

  if (tipo === "ASIGNACION") {
    await prisma.activo.update({
      where: { id: activoId, empresaId },
      data: { estado: "ASIGNADO" },
    })
  } else if (tipo === "BAJA") {
    await prisma.activo.update({
      where: { id: activoId, empresaId },
      data: { estado: "DADO_BAJA" },
    })
  } else if (tipo === "DEVOLUCION") {
    await prisma.activo.update({
      where: { id: activoId, empresaId },
      data: { estado: "DISPONIBLE" },
    })
  }

  revalidatePath(INVENTARIO_PATH)
}
