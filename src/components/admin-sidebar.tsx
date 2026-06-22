"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Building2,
  Users,
  ArrowLeft,
  Shield,
} from "lucide-react"

const menuItems = [
  { href: "/admin", label: "Dashboard Global", icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
]

export function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"))

  return (
    <aside className="flex w-[290px] flex-col bg-card overflow-y-auto border-r border-border">
      <div className="flex h-[72px] items-center gap-3 px-6 border-b border-border">
        <Shield className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Super<span className="font-light">Admin</span>
        </span>
      </div>
      <nav className="flex-1 px-4 pb-6 pt-4">
        <ul className="space-y-0.5">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3.5 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
        <div className="mt-6 pt-4 border-t border-border">
          <Link
            href="/"
            className="flex items-center gap-3.5 rounded-md px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            Volver al Dashboard
          </Link>
        </div>
      </nav>
    </aside>
  )
}
