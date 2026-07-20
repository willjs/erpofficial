"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function getPerfil() {
  const { userId } = await verifySession()

  const usuario = await prisma.usuario.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      avatar: true,
      superAdmin: true,
      activo: true,
      roles: {
        include: { rol: { select: { nombre: true } } },
      },
      empresas: {
        include: { empresa: { select: { id: true, nombre: true, rfc: true } } },
      },
      empresaActiva: { select: { nombre: true } },
    },
  })

  if (!usuario) throw new Error("Usuario no encontrado")

  return {
    ...usuario,
    roles: usuario.roles.map((r) => r.rol.nombre),
    empresas: usuario.empresas.map((e) => e.empresa),
    empresaNombre: usuario.empresaActiva?.nombre ?? "",
  }
}

const perfilUpdateSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres").optional().or(z.literal("")),
})

export type PerfilFormData = z.infer<typeof perfilUpdateSchema>

export async function updatePerfil(data: PerfilFormData) {
  const { userId, empresaId } = await verifySession()
  const validated = perfilUpdateSchema.parse(data)

  const existing = await prisma.usuario.findFirst({
    where: { email: validated.email, empresaId, NOT: { id: userId } },
  })
  if (existing) throw new Error("El email ya está registrado por otro usuario")

  const updateData: Record<string, unknown> = {
    nombre: validated.nombre,
    apellido: validated.apellido ?? null,
    email: validated.email,
  }

  if (validated.password && validated.password.length >= 6) {
    updateData.password = await bcrypt.hash(validated.password, 10)
  }

  await prisma.usuario.update({
    where: { id: userId },
    data: updateData,
  })

  revalidatePath("/perfil")
  return { success: true }
}

export async function uploadAvatar(base64: string) {
  const { userId } = await verifySession()

  const buffer = Buffer.from(base64, "base64")
  const uploadDir = path.join(process.cwd(), "public", "uploads", "avatars")
  await mkdir(uploadDir, { recursive: true })

  const ext = "png"
  const fileName = `${userId}.${ext}`
  await writeFile(path.join(uploadDir, fileName), buffer)

  const url = `/uploads/avatars/${fileName}`

  await prisma.usuario.update({
    where: { id: userId },
    data: { avatar: url },
  })

  revalidatePath("/perfil")
  return { url }
}

export async function removeAvatar() {
  const { userId } = await verifySession()

  await prisma.usuario.update({
    where: { id: userId },
    data: { avatar: null },
  })

  revalidatePath("/perfil")
  return { success: true }
}
