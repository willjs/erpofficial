import { auth } from "@/lib/auth"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { ToastWrapper } from "@/components/shared/toast-provider"
import { SidebarProvider } from "@/components/sidebar-provider"
import { DashboardPermisoProvider } from "@/components/dashboard-permiso-provider"
import { ModuleGuard } from "@/components/module-guard"
import { redirect } from "next/navigation"
import { usuarioTienePermiso, obtenerModulosPermitidos, obtenerMenusPermitidos } from "@/lib/permisos"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sessionUser = session.user as any
  const superAdmin = sessionUser?.superAdmin ?? false
  const userName = (sessionUser?.name as string) || ""
  const avatarUrl = (sessionUser?.image as string) || ""
  const empresas = (sessionUser?.empresas ?? []) as { id: string; nombre: string; rfc: string | null; logo: string | null }[]
  const empresaActualId = sessionUser?.empresaId as string | undefined
  const empresaActual = empresas.find((e) => e.id === empresaActualId)
  const empresaLogo = empresaActual?.logo as string | undefined
  const modulosActivos = (sessionUser?.modulosActivos ?? []) as string[]
  const roles = (sessionUser?.roles ?? []) as string[]
  const sessionUserId = sessionUser?.id as string

  // Verificar permiso del Dashboard Presidencia
  const puedeVerDashboard = superAdmin || roles.includes("ADMIN") ||
    await usuarioTienePermiso(sessionUserId, { recurso: "presidencia", accion: "READ" })

  // Obtener módulos que el usuario puede ver (basado en permisos RBAC)
  const modulosPermitidos = superAdmin || roles.includes("ADMIN")
    ? modulosActivos
    : await obtenerModulosPermitidos(sessionUserId)

  // Obtener menús jerárquicos permitidos (con fallback seguro)
  let menusPermitidos: any[] = []
  try {
    menusPermitidos = await obtenerMenusPermitidos(sessionUserId)
  } catch (e) {
    console.error("Error al obtener menús, usando fallback estático:", e)
  }

  // Redirigir al panel de admin si es superadmin sin empresa activa
  if (superAdmin && !empresaActualId) {
    redirect("/admin")
  }

  return (
    <ToastWrapper>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar superAdmin={superAdmin} empresaNombre={empresaActual?.nombre} empresaLogo={empresaLogo} modulosActivos={modulosPermitidos} roles={roles} puedeVerDashboard={puedeVerDashboard} menus={menusPermitidos} />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header superAdmin={superAdmin} empresas={empresas} empresaActualId={empresaActualId} userName={userName} avatarUrl={avatarUrl} />
            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              <DashboardPermisoProvider puedeVerDashboard={puedeVerDashboard}>
                <ModuleGuard>{children}</ModuleGuard>
              </DashboardPermisoProvider>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ToastWrapper>
  )
}
