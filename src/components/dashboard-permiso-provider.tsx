"use client"

import { createContext, useContext } from "react"

interface DashboardPermiso {
  puedeVerDashboard: boolean
}

const DashboardPermisoContext = createContext<DashboardPermiso>({ puedeVerDashboard: false })

export function DashboardPermisoProvider({
  children,
  puedeVerDashboard,
}: {
  children: React.ReactNode
  puedeVerDashboard: boolean
}) {
  return (
    <DashboardPermisoContext.Provider value={{ puedeVerDashboard }}>
      {children}
    </DashboardPermisoContext.Provider>
  )
}

export function useDashboardPermiso() {
  return useContext(DashboardPermisoContext)
}
