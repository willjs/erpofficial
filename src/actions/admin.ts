"use server"

import { verifySession, requireSuperAdmin } from "@/lib/dal"
import { prisma } from "@/lib/prisma"
import { MODULOS_BASICA, MODULOS_COMPLETA } from "@/lib/modulos"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { revalidatePath } from "next/cache"

function modulosSegunTipo(tipo: string, modulosPersonalizados?: string[]): string[] {
  if (tipo === "BASICA") return [...MODULOS_BASICA]
  if (tipo === "COMPLETA") return [...MODULOS_COMPLETA]
  return modulosPersonalizados ?? [...MODULOS_BASICA]
}

// ─── Empresas ─────────────────────────────────────────────

export async function getEmpresas() {
  const session = await verifySession()
  requireSuperAdmin(session)
  return prisma.empresa.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { usuarios: true } },
    },
  })
}

export async function getEmpresaById(id: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  return prisma.empresa.findUnique({
    where: { id },
    include: {
      _count: { select: { usuarios: true, departamentos: true } },
    },
  })
}

const empresaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  tipoContabilidad: z.string().optional().nullable(),
  activo: z.boolean().optional(),
  tipo: z.enum(["BASICA", "COMPLETA", "PERSONALIZADA"]).default("COMPLETA"),
  modulos: z.array(z.string()).optional(),
})

export async function createEmpresa(data: z.infer<typeof empresaSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = empresaSchema.parse(data)
  const modulos = validated.modulos ?? modulosSegunTipo(validated.tipo)
  const empresa = await prisma.empresa.create({
    data: {
      nombre: validated.nombre,
      rfc: validated.rfc || null,
      direccion: validated.direccion || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      tipoContabilidad: validated.tipoContabilidad || null,
      tipo: validated.tipo as any,
      modulosActivos: `[${modulos.join(",")}]`,
    },
  })
  // Vincular superadmin a la nueva empresa automáticamente
  const superAdminId = session.userId!
  await prisma.usuarioEmpresa.create({
    data: { usuarioId: superAdminId, empresaId: empresa.id },
  })
  revalidatePath("/admin")
  return empresa
}

export async function updateEmpresa(id: string, data: z.infer<typeof empresaSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = empresaSchema.parse(data)
  const modulos = validated.modulos ?? modulosSegunTipo(validated.tipo)
  const empresa = await prisma.empresa.update({
    where: { id },
    data: {
      nombre: validated.nombre,
      rfc: validated.rfc || null,
      direccion: validated.direccion || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      tipoContabilidad: validated.tipoContabilidad || null,
      activo: validated.activo,
      tipo: validated.tipo as any,
      modulosActivos: `[${modulos.join(",")}]`,
    },
  })
  revalidatePath("/admin")
  return empresa
}

export async function deleteEmpresa(id: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  await prisma.empresa.delete({ where: { id } })
  revalidatePath("/admin")
}

// ─── Usuarios (cross-empresa) ────────────────────────────

export async function getUsuariosAdmin(empresaId?: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const where = empresaId ? { empresaId } : {}
  return prisma.usuario.findMany({
    where,
    include: {
      empresa: { select: { id: true, nombre: true } },
      empresas: { include: { empresa: { select: { id: true, nombre: true } } } },
      roles: { include: { rol: { select: { id: true, nombre: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function toggleSuperAdmin(usuarioId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuario) throw new Error("Usuario no encontrado")
  const updated = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { superAdmin: !usuario.superAdmin },
  })
  revalidatePath("/admin")
  return updated
}

export async function toggleUsuarioActivoAdmin(usuarioId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuario) throw new Error("Usuario no encontrado")
  const updated = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { activo: !usuario.activo },
  })
  revalidatePath("/admin")
  return updated
}

const usuarioAdminSchema = z.object({
  empresaId: z.string().min(1, "Empresa requerida"),
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  departamentoId: z.string().optional().nullable(),
})

export async function createUsuarioAdmin(data: z.infer<typeof usuarioAdminSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = usuarioAdminSchema.parse(data)

  const existente = await prisma.usuario.findUnique({ where: { email: validated.email } })
  if (existente) throw new Error("El email ya está registrado")

  const hashedPassword = await bcrypt.hash(validated.password, 10)

  const usuario = await prisma.usuario.create({
    data: {
      empresaId: validated.empresaId,
      empresaActivaId: validated.empresaId,
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
      empresaId: validated.empresaId,
    },
  })

  revalidatePath("/admin")
  return usuario
}

const usuarioUpdateAdminSchema = z.object({
  empresaId: z.string().nullable().optional(),
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional().nullable(),
  email: z.string().email("Email inválido"),
  password: z.string().optional().nullable().or(z.literal("")),
})

export async function updateUsuarioAdmin(id: string, data: z.infer<typeof usuarioUpdateAdminSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = usuarioUpdateAdminSchema.parse(data)

  const existing = await prisma.usuario.findUnique({ where: { id } })
  if (!existing) throw new Error("Usuario no encontrado")

  if (validated.email !== existing.email) {
    const dup = await prisma.usuario.findUnique({ where: { email: validated.email } })
    if (dup) throw new Error("El email ya está registrado")
  }

  const updateData: any = {
    nombre: validated.nombre,
    apellido: validated.apellido ?? null,
    email: validated.email,
  }

  if (validated.password) {
    updateData.password = await bcrypt.hash(validated.password, 10)
  }

  if (validated.empresaId) {
    updateData.empresaId = validated.empresaId
    updateData.empresaActivaId = validated.empresaId
  } else {
    updateData.empresaId = null
    updateData.empresaActivaId = null
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: updateData,
  })

  if (validated.empresaId) {
    await prisma.usuarioEmpresa.upsert({
      where: {
        usuarioId_empresaId: {
          usuarioId: id,
          empresaId: validated.empresaId,
        },
      },
      update: {},
      create: {
        usuarioId: id,
        empresaId: validated.empresaId,
      },
    })
  }

  revalidatePath("/admin")
  return updated
}

// ─── Estadísticas globales ────────────────────────────────

export async function getEstadisticasGlobales() {
  const session = await verifySession()
  requireSuperAdmin(session)

  const [totalEmpresas, totalUsuarios, totalEmpleados, totalRequisiciones, totalOrdenesCompra] = await Promise.all([
    prisma.empresa.count({ where: { activo: true } }),
    prisma.usuario.count(),
    prisma.empleado.count(),
    prisma.requisicion.count(),
    prisma.ordenCompra.count(),
  ])

  return {
    totalEmpresas,
    totalUsuarios,
    totalEmpleados,
    totalRequisiciones,
    totalOrdenesCompra,
  }
}
