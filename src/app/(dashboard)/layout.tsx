import { auth } from "@/lib/auth"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { ToastWrapper } from "@/components/shared/toast-provider"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  const sessionUser = session?.user as any
  const superAdmin = sessionUser?.superAdmin ?? false
  const empresas = (sessionUser?.empresas ?? []) as { id: string; nombre: string; rfc: string | null }[]
  const empresaActualId = sessionUser?.empresaId as string | undefined
  const empresaActual = empresas.find((e) => e.id === empresaActualId)
  const modulosActivos = (sessionUser?.modulosActivos ?? []) as string[]

  return (
    <ToastWrapper>
      <div className="flex h-screen overflow-hidden">
        <Sidebar superAdmin={superAdmin} empresaNombre={empresaActual?.nombre} modulosActivos={modulosActivos} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header superAdmin={superAdmin} empresas={empresas} empresaActualId={empresaActualId} />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ToastWrapper>
  )
}
