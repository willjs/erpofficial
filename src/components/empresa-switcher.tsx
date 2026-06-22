"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useSession } from "next-auth/react"
import { Building2, Check, ChevronsUpDown } from "lucide-react"
import { cambiarEmpresaActiva } from "@/actions/empresa-activa"
import { cn } from "@/lib/utils"

interface Empresa {
  id: string
  nombre: string
  rfc: string | null
}

export function EmpresaSwitcher({
  empresas,
  empresaActualId,
}: {
  empresas: Empresa[]
  empresaActualId: string
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { update } = useSession()

  const empresaActual = empresas.find((e) => e.id === empresaActualId)
  const otrasEmpresas = empresas.filter((e) => e.id !== empresaActualId)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (empresas.length <= 1) return null

  const handleChange = (empresaId: string) => {
    startTransition(async () => {
      await cambiarEmpresaActiva(empresaId)
      await update({ empresaId })
      setOpen(false)
      window.location.reload()
    })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={pending}
        className={cn(
          "flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm transition-colors",
          "hover:bg-muted disabled:opacity-50",
          pending && "animate-pulse"
        )}
      >
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="max-w-[140px] truncate font-medium">
          {empresaActual?.nombre ?? "Seleccionar empresa"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-border bg-card p-1 shadow-lg z-50">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Cambiar empresa
          </div>
          {otrasEmpresas.map((emp) => (
            <button
              key={emp.id}
              onClick={() => handleChange(emp.id)}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
            >
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex-1 text-left">
                <p className="font-medium">{emp.nombre}</p>
                {emp.rfc && (
                  <p className="text-xs text-muted-foreground">{emp.rfc}</p>
                )}
              </div>
              {emp.id === empresaActualId && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <p className="px-3 py-1.5 text-xs text-muted-foreground">
              Mostrando datos de: <strong>{empresaActual?.nombre}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
