"use server"

import { verifySession } from "@/lib/dal"
import { verificarPermiso, asegurarPermisosOperaciones } from "@/lib/permisos"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import path from "path"
import { mkdir, writeFile, unlink } from "fs/promises"

// ─── Empresa ─────────────────────────────────────────────

export async function getEmpresa() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "READ" })
  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId } })
  return empresa
}

const empresaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  tipoContabilidad: z.string().optional().nullable(),
})

export async function updateEmpresa(data: z.infer<typeof empresaSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "UPDATE" })
  const validated = empresaSchema.parse(data)
  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data: {
      nombre: validated.nombre,
      rfc: validated.rfc || null,
      direccion: validated.direccion || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      tipoContabilidad: validated.tipoContabilidad || null,
    },
  })
  revalidatePath("/configuracion")
  return empresa
}

export async function uploadLogo(base64: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "UPDATE" })

  const buffer = Buffer.from(base64, "base64")
  const uploadDir = path.join(process.cwd(), "public", "uploads", "logos")
  await mkdir(uploadDir, { recursive: true })

  const ext = "png"
  const fileName = `${empresaId}_logo.${ext}`

  const filePath = path.join(uploadDir, fileName)
  await writeFile(filePath, buffer)

  const url = `/uploads/logos/${fileName}`

  const empresa = await prisma.empresa.update({
    where: { id: empresaId },
    data: { logo: url },
  })

  revalidatePath("/configuracion")
  revalidatePath("/")
  return empresa
}

export async function removeLogo() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "UPDATE" })

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { logo: true } })
  if (empresa?.logo) {
    const filePath = path.join(process.cwd(), "public", empresa.logo)
    await unlink(filePath).catch(() => {})
  }

  await prisma.empresa.update({
    where: { id: empresaId },
    data: { logo: null },
  })

  revalidatePath("/configuracion")
  revalidatePath("/")
}

// ─── Departamentos ────────────────────────────────────────

export async function getDepartamentos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "departamento", accion: "READ" })
  return prisma.departamento.findMany({
    where: { empresaId },
    include: { gerente: { select: { id: true, nombre: true, apellido: true } } },
    orderBy: { nombre: "asc" },
  })
}

const departamentoSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  gerenteId: z.string().optional().nullable(),
})

export async function createDepartamento(data: z.infer<typeof departamentoSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "departamento", accion: "CREATE" })
  const validated = departamentoSchema.parse(data)
  const depto = await prisma.departamento.create({
    data: { ...validated, empresaId },
  })
  revalidatePath("/configuracion")
  return depto
}

export async function updateDepartamento(id: string, data: z.infer<typeof departamentoSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "departamento", accion: "UPDATE" })
  const validated = departamentoSchema.parse(data)
  const depto = await prisma.departamento.updateMany({
    where: { id, empresaId },
    data: validated,
  })
  revalidatePath("/configuracion")
  return depto
}

export async function deleteDepartamento(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "departamento", accion: "DELETE" })
  await prisma.departamento.deleteMany({ where: { id, empresaId } })
  revalidatePath("/configuracion")
}

// ─── Usuarios ────────────────────────────────────────────

export async function getUsuarios() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "READ" })
  return prisma.usuario.findMany({
    where: { empresaId, superAdmin: false },
    include: {
      departamento: { select: { id: true, nombre: true } },
      roles: { include: { rol: { select: { id: true, nombre: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

const usuarioSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").optional(),
  departamentoId: z.string().optional().nullable(),
})

export async function createUsuario(data: z.infer<typeof usuarioSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "CREATE" })
  const validated = usuarioSchema.parse(data)

  const existente = await prisma.usuario.findUnique({ where: { email: validated.email } })
  if (existente) throw new Error("El email ya está registrado")

  const hashedPassword = await bcrypt.hash(validated.password!, 10)

  const usuario = await prisma.usuario.create({
    data: {
      empresaId,
      empresaActivaId: empresaId,
      nombre: validated.nombre,
      apellido: validated.apellido ?? null,
      email: validated.email,
      password: hashedPassword,
      departamentoId: validated.departamentoId ?? null,
    },
  })

  await prisma.usuarioEmpresa.create({
    data: {
      usuarioId: usuario.id,
      empresaId,
    },
  })

  revalidatePath("/configuracion")
  return usuario
}

const usuarioUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").optional(),
  departamentoId: z.string().optional().nullable(),
})

export async function updateUsuario(id: string, data: z.infer<typeof usuarioUpdateSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "UPDATE" })
  const validated = usuarioUpdateSchema.parse(data)

  const existing = await prisma.usuario.findFirst({ where: { email: validated.email, empresaId, NOT: { id } } })
  if (existing) throw new Error("El email ya está registrado por otro usuario")

  const updateData: Record<string, unknown> = {
    nombre: validated.nombre,
    apellido: validated.apellido ?? null,
    email: validated.email,
    departamentoId: validated.departamentoId ?? null,
  }

  if (validated.password) {
    updateData.password = await bcrypt.hash(validated.password, 10)
  }

  const usuario = await prisma.usuario.updateMany({
    where: { id, empresaId },
    data: updateData,
  })

  revalidatePath("/configuracion")
  return usuario
}

export async function toggleUsuarioActivo(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "UPDATE" })
  const usuario = await prisma.usuario.findFirst({ where: { id, empresaId } })
  if (!usuario) throw new Error("Usuario no encontrado")

  const updated = await prisma.usuario.update({
    where: { id },
    data: { activo: !usuario.activo },
  })

  revalidatePath("/configuracion")
  return updated
}

// ─── Roles ───────────────────────────────────────────────

export async function getRoles() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "rol", accion: "READ" })
  const roles = await prisma.rol.findMany({
    where: { empresaId },
    include: {
      _count: { select: { permisos: true, usuarios: true } },
    },
    orderBy: { nombre: "asc" },
  })
  return roles.map((r) => ({
    ...r,
    totalPermisos: r._count.permisos,
    totalUsuarios: r._count.usuarios,
  }))
}

const rolSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
})

export async function createRol(data: z.infer<typeof rolSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "rol", accion: "CREATE" })
  const validated = rolSchema.parse(data)
  const rol = await prisma.rol.create({
    data: { ...validated, empresaId },
  })
  revalidatePath("/configuracion")
  return rol
}

export async function updateRol(id: string, data: z.infer<typeof rolSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "rol", accion: "UPDATE" })
  const validated = rolSchema.parse(data)
  const rol = await prisma.rol.updateMany({
    where: { id, empresaId },
    data: validated,
  })
  revalidatePath("/configuracion")
  return rol
}

export async function deleteRol(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "rol", accion: "DELETE" })
  const rol = await prisma.rol.findFirst({ where: { id, empresaId } })
  if (rol?.esSistema) throw new Error("No se puede eliminar un rol del sistema")
  await prisma.rol.deleteMany({ where: { id, empresaId } })
  revalidatePath("/configuracion")
}

// ─── Centros de Costo ───────────────────────────────────

export async function getCentrosCostos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "READ" })
  return prisma.centroCostos.findMany({
    where: { empresaId },
    orderBy: [{ codigo: "asc" }],
  })
}

const centroCostosSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
})

export async function createCentroCostos(data: z.infer<typeof centroCostosSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "CREATE" })
  const validated = centroCostosSchema.parse(data)
  const cc = await prisma.centroCostos.create({
    data: { ...validated, empresaId },
  })
  revalidatePath("/configuracion")
  return cc
}

export async function updateCentroCostos(id: string, data: z.infer<typeof centroCostosSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "UPDATE" })
  const validated = centroCostosSchema.parse(data)
  const cc = await prisma.centroCostos.updateMany({
    where: { id, empresaId },
    data: validated,
  })
  revalidatePath("/configuracion")
  return cc
}

export async function deleteCentroCostos(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "DELETE" })
  await prisma.centroCostos.deleteMany({ where: { id, empresaId } })
  revalidatePath("/configuracion")
}

export async function toggleCentroCostosActivo(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "centro_costos", accion: "UPDATE" })
  const cc = await prisma.centroCostos.findFirst({ where: { id, empresaId } })
  if (!cc) throw new Error("Centro de costo no encontrado")
  const updated = await prisma.centroCostos.update({
    where: { id },
    data: { activo: !cc.activo },
  })
  revalidatePath("/configuracion")
  return updated
}

// ─── Permisos ────────────────────────────────────────────

export async function getPermisos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "permiso", accion: "READ" })
  return prisma.permiso.findMany({ orderBy: [{ modulo: "asc" }, { recurso: "asc" }] })
}

export async function getPermisosByRol(rolId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "permiso", accion: "READ" })
  const rol = await prisma.rol.findFirst({ where: { id: rolId, empresaId } })
  if (!rol) throw new Error("Rol no encontrado")

  const permisos = await prisma.rolPermiso.findMany({
    where: { rolId },
    select: { permisoId: true },
  })
  return permisos.map((p) => p.permisoId)
}

export async function getSuperAdmin() {
  const { superAdmin } = await verifySession()
  return { superAdmin }
}

export async function updateRolPermisos(rolId: string, permisoIds: string[]) {
  const { empresaId, userId, superAdmin } = await verifySession()
  await verificarPermiso(userId, { recurso: "rol", accion: "UPDATE" })
  const rol = await prisma.rol.findFirst({ where: { id: rolId, empresaId } })
  if (!rol) throw new Error("Rol no encontrado")

  let finalIds = permisoIds

  if (!superAdmin) {
    const corePermisos = await prisma.permiso.findMany({
      where: { modulo: "CORE" },
      select: { id: true },
    })
    const coreIds = new Set(corePermisos.map((p) => p.id))

    const existingCoreIds = await prisma.rolPermiso.findMany({
      where: { rolId, permisoId: { in: [...coreIds] } },
      select: { permisoId: true },
    })

    finalIds = [
      ...permisoIds.filter((id) => !coreIds.has(id)),
      ...existingCoreIds.map((rp) => rp.permisoId),
    ]
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.rolPermiso.deleteMany({ where: { rolId } })
    await tx.rolPermiso.createMany({
      data: finalIds.map((permisoId) => ({ rolId, permisoId })),
    })
  })

  revalidatePath("/configuracion")
}

// ─── Usuario-Rol ─────────────────────────────────────

export async function assignRolToUser(usuarioId: string, rolId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "UPDATE" })

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, empresaId } })
  if (!usuario) throw new Error("Usuario no encontrado")

  const rol = await prisma.rol.findFirst({ where: { id: rolId, empresaId } })
  if (!rol) throw new Error("Rol no encontrado")

  const exists = await prisma.usuarioRol.findUnique({
    where: { usuarioId_rolId: { usuarioId, rolId } },
  })
  if (exists) throw new Error("El usuario ya tiene este rol")

  await prisma.usuarioRol.create({ data: { usuarioId, rolId } })
  revalidatePath("/configuracion")
}

export async function removeRolFromUser(usuarioId: string, rolId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "usuario", accion: "UPDATE" })

  const usuario = await prisma.usuario.findFirst({ where: { id: usuarioId, empresaId } })
  if (!usuario) throw new Error("Usuario no encontrado")

  await prisma.usuarioRol.deleteMany({ where: { usuarioId, rolId, rol: { empresaId } } })
  revalidatePath("/configuracion")
}

// ─── Tipo Contabilidad ──────────────────────────────

export async function getTipoContabilidad() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "UPDATE" })
  return prisma.tipoContabilidad.findUnique({ where: { empresaId } })
}

const tipoContabilidadSchema = z.object({
  tipo: z.enum(["INTERNA", "WORD_OFFICE", "SYSCAR", "ZEUS", "OTRO"]),
  config: z.any().optional(),
})

export async function saveTipoContabilidad(data: z.infer<typeof tipoContabilidadSchema>) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "UPDATE" })
  const validated = tipoContabilidadSchema.parse(data)

  const existing = await prisma.tipoContabilidad.findUnique({ where: { empresaId } })
  if (existing) {
    return prisma.tipoContabilidad.update({
      where: { empresaId },
      data: { tipo: validated.tipo, config: validated.config ?? null },
    })
  }
  return prisma.tipoContabilidad.create({
    data: { empresaId, tipo: validated.tipo, config: validated.config ?? null },
  })
}

export async function probarConexionContable(tipo: string, config: Record<string, unknown>) {
  const { userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empresa", accion: "UPDATE" })

  if (tipo === "INTERNA") {
    return { success: true, mensaje: "La contabilidad interna siempre está disponible" }
  }

  const apiUrl = config?.apiUrl as string | undefined
  if (!apiUrl) {
    return { success: false, mensaje: "Se requiere apiUrl en la configuración" }
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }

    const authType = (config?.authType as string) ?? "bearer"
    if (config?.token) {
      const prefix = authType === "basic" ? "Basic" : "Bearer"
      headers["Authorization"] = `${prefix} ${config.token}`
    }

    const healthEndpoint = (config?.healthEndpoint as string) ?? ""
    const healthMethod = ((config?.healthMethod as string) ?? "GET").toUpperCase()
    const testUrl = healthEndpoint ? `${apiUrl.replace(/\/+$/, "")}/${healthEndpoint.replace(/^\/+/, "")}` : apiUrl

    const res = await fetch(testUrl, {
      method: healthMethod,
      headers,
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { success: false, mensaje: `Error ${res.status}: ${res.statusText}` }
    }
    return { success: true, mensaje: `Conexión exitosa (${res.status})` }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return { success: false, mensaje: `No se pudo conectar: ${msg}` }
  }
}
