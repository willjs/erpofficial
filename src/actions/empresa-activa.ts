"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { auth, signOut } from "@/lib/auth"
import { revalidatePath } from "next/cache"

export async function cambiarEmpresaActiva(empresaId: string) {
  const { userId, empresas } = await verifySession()

  const pertenece = empresas.some((e) => e.id === empresaId)
  if (!pertenece) {
    return { error: "No perteneces a esta empresa" }
  }

  await prisma.usuario.update({
    where: { id: userId },
    data: { empresaActivaId: empresaId },
  })

  revalidatePath("/", "layout")
}

export async function salirDeEmpresa(empresaId: string) {
  const { userId, empresas } = await verifySession()

  const pertenece = empresas.some((e) => e.id === empresaId)
  if (!pertenece) {
    return { error: "No perteneces a esta empresa" }
  }

  await prisma.usuarioEmpresa.delete({
    where: { usuarioId_empresaId: { usuarioId: userId, empresaId } },
  })

  const empresasActualizadas = await prisma.usuarioEmpresa.findMany({
    where: { usuarioId: userId },
  })

  if (empresasActualizadas.length === 0) {
    // Eliminar usuario o cerrar sesión
    await signOut()
    return { success: true }
  }

  // Si la empresa activa fue removida, cambiar a la primera disponible
  const session = await auth()
  const sessionUser = session?.user as any
  if (sessionUser?.empresaId === empresaId) {
    await prisma.usuario.update({
      where: { id: userId },
      data: { empresaActivaId: empresasActualizadas[0].empresaId },
    })
  }

  revalidatePath("/", "layout")
}
