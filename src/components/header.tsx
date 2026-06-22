"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { logout } from "@/actions/auth"
import { getNotificaciones, getNotificacionesNoLeidas, marcarLeida } from "@/actions/notificaciones"
import { useToast } from "@/components/ui/use-toast"
import { Input } from "@/components/ui/input"
import { EmpresaSwitcher } from "@/components/empresa-switcher"
import { LogOut, Bell, Search, User, CheckCheck, Loader2, Shield } from "lucide-react"
import Link from "next/link"

interface Notificacion {
  id: string
  tipo: string
  titulo: string
  mensaje: string
  referenciaId: string | null
  referenciaTipo: string | null
  leida: boolean
  createdAt: Date | string
}

interface EmpresaItem {
  id: string
  nombre: string
  rfc: string | null
}

export function Header({
  superAdmin,
  empresas,
  empresaActualId,
}: {
  superAdmin?: boolean
  empresas?: EmpresaItem[]
  empresaActualId?: string
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [noLeidas, setNoLeidas] = useState(0)
  const [loading, setLoading] = useState(true)
  const [marcando, setMarcando] = useState<string | null>(null)
  const { toast } = useToast()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const cargar = useCallback(async () => {
    const [res, countRes] = await Promise.all([
      getNotificaciones(),
      getNotificacionesNoLeidas(),
    ])
    if (res.error) {
      toast({ title: res.error, variant: "destructive" })
    } else if (res.data) {
      setNotificaciones(res.data)
    }
    if (countRes.error) {
      toast({ title: countRes.error, variant: "destructive" })
    }
    setNoLeidas(countRes.count)
    setLoading(false)
  }, [toast])

  useEffect(() => {
    setLoading(true)
    cargar()
    const interval = setInterval(cargar, 30000)
    return () => clearInterval(interval)
  }, [cargar])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleMarcarLeida = async (id: string) => {
    setMarcando(id)
    const res = await marcarLeida(id)
    if (res.error) {
      toast({ title: res.error, variant: "destructive" })
    }
    cargar()
    setMarcando(null)
  }

  const handleToggleNotif = () => {
    setNotifOpen(!notifOpen)
    setDropdownOpen(false)
  }

  return (
    <header className="flex h-[72px] items-center justify-between bg-card px-6">
      <div className="relative hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          className="h-10 w-72 rounded-md border-border bg-muted pl-9 text-sm focus-visible:ring-primary"
        />
      </div>

      <div className="flex items-center gap-4 ml-auto">
        {empresas && empresaActualId && (
          <EmpresaSwitcher empresas={empresas} empresaActualId={empresaActualId} />
        )}

        <div className="relative" ref={notifRef}>
          <button
            onClick={handleToggleNotif}
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <Bell className="h-5 w-5" />
            {noLeidas > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {noLeidas > 9 ? "9+" : noLeidas}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-border bg-card shadow-lg z-50">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
                {noLeidas > 0 && (
                  <button
                    onClick={async () => {
                      const { marcarTodasLeidas } = await import("@/actions/notificaciones")
                      const res = await marcarTodasLeidas()
                      if (res.error) {
                        toast({ title: res.error, variant: "destructive" })
                      }
                      cargar()
                    }}
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <CheckCheck className="h-3 w-3" />
                    Marcar todas
                  </button>
                )}
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : notificaciones.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No hay notificaciones
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {notificaciones.map((n) => (
                      <li
                        key={n.id}
                        className={`relative flex gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${!n.leida ? "bg-primary/5" : ""}`}
                      >
                        {n.referenciaId ? (
                          <Link
                            href={`/${n.referenciaTipo?.toLowerCase() ?? "#"}/${n.referenciaId}`}
                            className="flex gap-3 min-w-0"
                            onClick={() => handleMarcarLeida(n.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{n.titulo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.mensaje}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground/60">
                                {new Date(n.createdAt).toLocaleString("es-MX")}
                              </p>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex gap-3 min-w-0" onClick={() => handleMarcarLeida(n.id)}>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground truncate">{n.titulo}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.mensaje}</p>
                              <p className="mt-1 text-[10px] text-muted-foreground/60">
                                {new Date(n.createdAt).toLocaleString("es-MX")}
                              </p>
                            </div>
                          </div>
                        )}
                        {!n.leida && (
                          <span className="absolute right-2 top-3 h-2 w-2 rounded-full bg-primary" />
                        )}
                        {marcando === n.id && (
                          <Loader2 className="absolute right-2 top-3 h-3 w-3 animate-spin text-primary" />
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => { setDropdownOpen(!dropdownOpen); setNotifOpen(false) }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            U
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg z-50">
              <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                  U
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">Usuario</p>
                  <p className="text-xs text-muted-foreground">
                    {superAdmin ? "Super Admin" : "Admin"}
                  </p>
                </div>
              </div>
              {superAdmin && (
                <div className="py-1">
                  <Link
                    href="/admin"
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-amber-600 hover:bg-amber-50 transition-colors"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Shield className="h-4 w-4" />
                    Panel Super Admin
                  </Link>
                </div>
              )}
              <div className="py-1">
                <Link
                  href="/configuracion"
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  <User className="h-4 w-4" />
                  Mi Perfil
                </Link>
              </div>
              <div className="border-t border-border pt-1">
                <form action={logout}>
                  <button
                    type="submit"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
