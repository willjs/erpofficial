import "server-only"
import { auth } from "./auth"
import { redirect } from "next/navigation"
import { cache } from "react"

export const verifySession = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }
  const sessionUser = session.user as any
  return {
    userId: sessionUser.id,
    empresaId: sessionUser.empresaId as string,
    empresas: (sessionUser.empresas ?? []) as { id: string; nombre: string; rfc: string | null }[],
    roles: (sessionUser.roles ?? []) as string[],
    superAdmin: (sessionUser.superAdmin ?? false) as boolean,
  }
})

export const getCurrentUser = cache(async () => {
  const session = await verifySession()
  return session
})

export function requireSuperAdmin(session: { superAdmin: boolean }): void {
  if (!session.superAdmin) {
    throw new Error("Acceso denegado: se requieren privilegios de super administrador")
  }
}
