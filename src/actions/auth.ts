"use server"

import { signIn, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { redirect } from "next/navigation"

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Contraseña requerida"),
})

export type LoginState = { error?: string } | undefined

export async function login(prevState: LoginState, formData: FormData): Promise<LoginState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!validated.success) {
    return { error: "Credenciales inválidas" }
  }

  try {
    await signIn("credentials", {
      email: validated.data.email,
      password: validated.data.password,
      redirectTo: "/",
    })
  } catch (error: any) {
    if (error?.type === "CredentialsSignin") {
      return { error: "Email o contraseña incorrectos" }
    }
    throw error
  }
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}

const registerSchema = z.object({
  nombre: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
})

export async function registerEmpresa(formData: FormData) {
  const validated = registerSchema.safeParse({
    nombre: formData.get("nombre"),
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors }
  }

  const { nombre, email, password } = validated.data

  const exists = await prisma.usuario.findUnique({ where: { email } })
  if (exists) {
    return { error: "El email ya está registrado" }
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const empresa = await prisma.empresa.create({
    data: {
      nombre: `Empresa de ${nombre}`,
      email,
    },
  })

  const depto = await prisma.departamento.create({
    data: {
      empresaId: empresa.id,
      nombre: "Dirección General",
    },
  })

  const user = await prisma.usuario.create({
    data: {
      empresaId: empresa.id,
      empresaActivaId: empresa.id,
      departamentoId: depto.id,
      email,
      password: hashedPassword,
      nombre,
    },
  })

  await prisma.usuarioEmpresa.create({
    data: {
      usuarioId: user.id,
      empresaId: empresa.id,
    },
  })

  const adminRol = await prisma.rol.create({
    data: {
      empresaId: empresa.id,
      nombre: "ADMIN",
      descripcion: "Administrador del sistema",
      esSistema: true,
    },
  })

  const todosPermisos = await prisma.permiso.findMany()
  await prisma.rolPermiso.createMany({
    data: todosPermisos.map((p) => ({
      rolId: adminRol.id,
      permisoId: p.id,
    })),
  })

  await prisma.usuarioRol.create({
    data: {
      usuarioId: user.id,
      rolId: adminRol.id,
    },
  })

  await signIn("credentials", {
    email,
    password,
    redirectTo: "/",
  })
}
