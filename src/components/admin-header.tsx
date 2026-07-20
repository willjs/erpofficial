"use client"

import { useState, useRef, useEffect } from "react"
import { logout } from "@/actions/auth"
import { LogOut, User, Shield } from "lucide-react"
import Link from "next/link"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"

export function AdminHeader({
  userName,
  avatarUrl,
}: {
  userName?: string
  avatarUrl?: string
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const initials = userName
    ? userName.split(" ").map((n) => n.charAt(0)).join("").toUpperCase().slice(0, 2)
    : "SA"

  return (
    <header className="flex h-[72px] items-center justify-between bg-card px-6 border-b border-border">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">
          Panel de Administración Global
        </h2>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors overflow-hidden"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initials}</AvatarFallback>
            </Avatar>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card p-1 shadow-lg z-50">
              <div className="flex items-center gap-3 border-b border-border px-3 py-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">{initials}</AvatarFallback>
                </Avatar>
                <div className="text-sm">
                  <p className="font-medium text-foreground">{userName || "Super Admin"}</p>
                  <p className="text-xs text-muted-foreground">Acceso global</p>
                </div>
              </div>
              <div className="py-1">
                <Link
                  href="/perfil"
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
