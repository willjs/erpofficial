"use client"

import { usePathname } from "next/navigation"
import { PermissionGuard } from "@/components/permission-guard"

const MODULE_MAP: Record<string, string> = {
  compras: "COMPRAS",
  proveedores: "COMPRAS",
  presupuestos: "PRESUPUESTOS",
  empleados: "RRHH",
  nomina: "NOMINA",
  tareas: "TAREAS",
  inventario: "INVENTARIO",
  inventarios: "INVENTARIOS",
  servicios: "INVENTARIOS",
  traspasos: "TRASPASOS",
  documentos: "DOCUMENTOS",
  contabilidad: "CONTABILIDAD",
  tesoreria: "TESORERIA",
  clientes: "CLIENTES",
  pedidos: "PEDIDOS",
  despachos: "DESPACHOS",
  ventas: "VENTAS",
  permisos: "PERMISOS",
  reportes: "REPORTES",
  operaciones: "OPERACIONES",
  "cuentas-cobrar": "CUENTAS_COBRAR",
  configuracion: "CORE",
}

export function ModuleGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0] ?? ""

  if (firstSegment === "") {
    return <>{children}</>
  }

  const modulo = MODULE_MAP[firstSegment]

  if (!modulo) {
    return <>{children}</>
  }

  return <PermissionGuard modulo={modulo}>{children}</PermissionGuard>
}
