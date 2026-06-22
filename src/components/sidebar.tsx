"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  DollarSign,
  CheckSquare,
  Package,
  FileText,
  BookOpen,
  Wallet,
  Briefcase,
  CalendarOff,
  Settings,
  PiggyBank,
  Boxes,
  Shield,
  ShoppingBag,
  ClipboardList,
  Truck,
  ArrowRightLeft,
  Wrench,
} from "lucide-react"

const menuItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; modulo: string }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, modulo: "" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, modulo: "COMPRAS" },
  { href: "/presupuestos", label: "Presupuestos", icon: PiggyBank, modulo: "PRESUPUESTOS" },
  { href: "/empleados", label: "Empleados", icon: Users, modulo: "RRHH" },
  { href: "/nomina", label: "Nómina", icon: DollarSign, modulo: "NOMINA" },
  { href: "/tareas", label: "Tareas", icon: CheckSquare, modulo: "TAREAS" },
  { href: "/inventario", label: "Activos Fijos", icon: Package, modulo: "INVENTARIO" },
  { href: "/inventarios", label: "Inventarios", icon: Boxes, modulo: "INVENTARIOS" },
  { href: "/servicios", label: "Servicios", icon: Wrench, modulo: "INVENTARIOS" },
  { href: "/traspasos", label: "Traspasos", icon: ArrowRightLeft, modulo: "TRASPASOS" },
  { href: "/documentos", label: "Documentos", icon: FileText, modulo: "DOCUMENTOS" },
  { href: "/contabilidad", label: "Contabilidad", icon: BookOpen, modulo: "CONTABILIDAD" },
  { href: "/tesoreria", label: "Tesorería", icon: Wallet, modulo: "TESORERIA" },
  { href: "/clientes", label: "Clientes", icon: Briefcase, modulo: "CLIENTES" },
  { href: "/pedidos", label: "Pedidos", icon: ClipboardList, modulo: "PEDIDOS" },
  { href: "/despachos", label: "Despachos", icon: Truck, modulo: "DESPACHOS" },
  { href: "/ventas", label: "Ventas", icon: ShoppingBag, modulo: "VENTAS" },
  { href: "/permisos", label: "Permisos", icon: CalendarOff, modulo: "PERMISOS" },
  { href: "/reportes", label: "Reportes", icon: FileText, modulo: "REPORTES" },
  { href: "/configuracion", label: "Configuración", icon: Settings, modulo: "CORE" },
]

import { Building2 } from "lucide-react"

export function Sidebar({
  superAdmin,
  empresaNombre,
  modulosActivos,
}: {
  superAdmin?: boolean
  empresaNombre?: string
  modulosActivos?: string[]
}) {
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"))

  const visibleItems = menuItems.filter((item) => {
    if (!item.modulo) return true // Dashboard siempre visible
    if (!modulosActivos || modulosActivos.length === 0) return true // fallback: mostrar todo
    return modulosActivos.includes(item.modulo)
  })

  return (
    <aside className="flex w-[290px] flex-col bg-card overflow-y-auto">
      <div className="flex h-[72px] items-center gap-3 px-6">
        <img src="/images/logo.png" alt="OficinaApp" className="h-8 w-auto" />
        <div className="min-w-0 flex-1">
          <span className="text-lg font-semibold tracking-tight text-foreground block leading-tight">
            Oficina<span className="font-light">App</span>
          </span>
          {empresaNombre && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
              <Building2 className="h-3 w-3 shrink-0" />
              {empresaNombre}
            </span>
          )}
        </div>
      </div>
      <nav className="flex-1 px-4 pb-6">
        <ul className="space-y-0.5">
          {superAdmin && (
            <li>
              <Link
                href="/admin"
                className={cn(
                  "flex items-center gap-3.5 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
                  isActive("/admin")
                    ? "bg-primary text-white"
                    : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                )}
              >
                <Shield className="h-5 w-5 shrink-0" />
                Admin Global
              </Link>
            </li>
          )}
          {visibleItems.map((item) => {
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
      </nav>
    </aside>
  )
}
