"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useSidebar } from "@/components/sidebar-provider"
import { X, Key, ShieldCheck, ChevronDown, Zap } from "lucide-react"
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
  ShoppingBag,
  ClipboardList,
  Truck,
  ArrowRightLeft,
  Wrench,
  Building2,
  Shield,
  Anchor,
  Ship,
  Receipt,
  CalendarDays,
} from "lucide-react"

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard, ShoppingCart, Users, DollarSign, CheckSquare, Package,
  FileText, BookOpen, Wallet, Briefcase, CalendarOff, Settings, PiggyBank,
  Boxes, ShoppingBag, ClipboardList, Truck, ArrowRightLeft, Wrench,
  Building2, Shield, Anchor, Ship, Receipt, CalendarDays, Zap,
}

const adminMenuItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { href: "/admin", label: "Dashboard Global", icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", icon: Building2 },
  { href: "/admin/usuarios", label: "Usuarios", icon: Users },
  { href: "/codigos-aprobacion", label: "Códigos Aprobación", icon: Key },
]

// Fallback estático (cuando no hay menús en DB)
const menuItems: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; modulo: string }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, modulo: "" },
  { href: "/compras", label: "Compras", icon: ShoppingCart, modulo: "COMPRAS" },
  { href: "/proveedores", label: "Proveedores", icon: Users, modulo: "PROVEEDORES" },
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
  { href: "/operaciones", label: "Operaciones", icon: Anchor, modulo: "OPERACIONES" },
  { href: "/cuentas-cobrar", label: "Ctas. por Cobrar", icon: Receipt, modulo: "CUENTAS_COBRAR" },
  { href: "/configuracion?tab=automatizaciones", label: "Automatizaciones", icon: Zap, modulo: "CORE" },
]

type MenuItemDB = {
  id: string
  modulo: string
  label: string
  href: string | null
  icon: string | null
  children: MenuItemDB[]
}

function SidebarMenuItem({
  item,
  isActive,
  close,
}: {
  item: MenuItemDB
  isActive: (href: string) => boolean
  close: () => void
}) {
  const [open, setOpen] = useState(false)
  const hasChildren = item.children.length > 0
  const active = item.href ? isActive(item.href) : false
  const childActive = hasChildren && item.children.some((c) => c.href && isActive(c.href))
  const Icon = item.icon && iconMap[item.icon] ? iconMap[item.icon] : Package

  if (!hasChildren) {
    return (
      <li>
        <Link
          href={item.href || "#"}
          onClick={close}
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
  }

  return (
    <li>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-3.5 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
          childActive || active
            ? "bg-muted text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <ul className="ml-4 mt-0.5 space-y-0.5 border-l pl-3">
          {item.children.map((child) => {
            const ChildIcon = child.icon && iconMap[child.icon] ? iconMap[child.icon] : null
            const childActive = child.href ? isActive(child.href) : false
            return (
              <li key={child.id}>
                <Link
                  href={child.href || "#"}
                  onClick={close}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    childActive
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {ChildIcon && <ChildIcon className="h-4 w-4 shrink-0" />}
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

export function Sidebar({
  superAdmin,
  empresaNombre,
  empresaLogo,
  modulosActivos,
  roles,
  puedeVerDashboard,
  menus,
}: {
  superAdmin?: boolean
  empresaNombre?: string
  empresaLogo?: string | null
  modulosActivos?: string[]
  roles?: string[]
  puedeVerDashboard?: boolean
  menus?: MenuItemDB[]
}) {
  const pathname = usePathname()
  const { isOpen, close } = useSidebar()
  const tieneAccesoConfig = superAdmin || (roles ?? []).includes("ADMIN")

  const isActive = (href: string) =>
    pathname === href || (href !== "/" && href !== "/operaciones" && pathname.startsWith(href + "/"))

  // Usar menús de DB si están disponibles, si no fallback estático
  const useDBMenus = menus && menus.length > 0

  const visibleItems = useDBMenus
    ? menus
    : menuItems.filter((item) => {
        if (!item.modulo) return puedeVerDashboard ?? true
        if (!modulosActivos) return true
        return modulosActivos.includes(item.modulo)
      })

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col bg-card overflow-y-auto transition-transform duration-300 shadow-xl lg:shadow-none lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-4 py-5 lg:justify-center">
          <img
            src={empresaLogo || "/images/fuel_logo.png"}
            alt="Logo"
            style={{ width: "72px", height: "auto" }}
            onError={(e) => { (e.target as HTMLImageElement).src = "/images/fuel_logo.png" }}
          />
          <button onClick={close} className="lg:hidden text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        {empresaNombre && (
          <div className="flex flex-col items-center gap-1 px-6 pb-3">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground text-center">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              {empresaNombre}
            </span>
          </div>
        )}
        <nav className="flex-1 px-4 pb-6">
        <ul className="space-y-0.5">
          {superAdmin && !empresaNombre
            ? adminMenuItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={close}
                      className={cn(
                        "flex items-center gap-3.5 rounded-md px-4 py-3 text-sm font-medium transition-colors",
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
              })
            : useDBMenus
              ? (visibleItems as MenuItemDB[]).map((item) => (
                  <SidebarMenuItem
                    key={item.id}
                    item={item}
                    isActive={isActive}
                    close={close}
                  />
                ))
              : (visibleItems as typeof menuItems).map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={close}
                        className={cn(
                          "flex items-center gap-3.5 rounded-md px-4 py-3 text-sm font-medium transition-colors",
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
          {tieneAccesoConfig && (modulosActivos === undefined || modulosActivos.includes("CORE")) && (
            <li className="pt-3 border-t mt-3">
              <Link
                href="/configuracion"
                onClick={close}
                className={cn(
                  "flex items-center gap-3.5 rounded-md px-4 py-3 text-sm font-medium transition-colors",
                  isActive("/configuracion")
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Settings className="h-5 w-5 shrink-0" />
                Configuración
              </Link>
            </li>
          )}
          {superAdmin && empresaNombre && (
            <li className="pt-3 border-t mt-3">
              <Link
                href="/admin"
                onClick={close}
                className={cn(
                  "flex items-center gap-3.5 rounded-md px-4 py-3 text-sm font-medium transition-colors",
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
        </ul>
      </nav>
    </aside>
    </>
  )
}
