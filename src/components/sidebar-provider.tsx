"use client"

import { createContext, useContext, useState, useCallback } from "react"

type SidebarContext = {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

const SidebarCtx = createContext<SidebarContext>({
  isOpen: false,
  toggle: () => {},
  close: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  const close = useCallback(() => setIsOpen(false), [])

  return (
    <SidebarCtx.Provider value={{ isOpen, toggle, close }}>
      {children}
    </SidebarCtx.Provider>
  )
}

export const useSidebar = () => useContext(SidebarCtx)
