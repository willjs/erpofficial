"use client"

import { usePermiso } from "@/hooks/use-permiso"

export function ActionGuard({
  recurso,
  accion,
  children,
  fallback = null,
}: {
  recurso: string
  accion: string
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const { tienePermiso, loading } = usePermiso(recurso, accion)

  if (loading) return null

  return tienePermiso ? <>{children}</> : <>{fallback}</>
}
