import { cache } from "react"
import { prisma } from "./prisma"

export type TipoAccion =
  | "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL"
  | "APROBAR" | "RECHAZAR" | "ANULAR" | "CERRAR" | "REABRIR"
  | "EXPORTAR" | "IMPORTAR" | "ENVIAR" | "DUPLICAR" | "CONCILIAR"

export type PermisoRequerido = {
  recurso: string
  accion: TipoAccion
}

const getUsuarioConRoles = cache(async (usuarioId: string) => {
  return prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      roles: {
        include: {
          rol: {
            include: {
              permisos: {
                include: { permiso: true },
              },
            },
          },
        },
      },
    },
  })
})

export async function usuarioTienePermiso(
  usuarioId: string,
  permiso: PermisoRequerido
): Promise<boolean> {
  const usuario = await getUsuarioConRoles(usuarioId)

  if (!usuario) return false

  // Super admin tiene todos los permisos
  if (usuario.superAdmin) return true

  // Usuario con rol ADMIN tiene todos los permisos
  if (usuario.roles.some((ur) => ur.rol.nombre === "ADMIN")) return true

  for (const ur of usuario.roles) {
    for (const rp of ur.rol.permisos) {
      if (
        rp.permiso.recurso === permiso.recurso &&
        (rp.permiso.accion === "ALL" || rp.permiso.accion === permiso.accion)
      ) {
        return true
      }
    }
  }

  return false
}

export async function verificarPermiso(
  usuarioId: string,
  permiso: PermisoRequerido
): Promise<void> {
  const tiene = await usuarioTienePermiso(usuarioId, permiso)
  if (!tiene) {
    throw new Error(`Acceso denegado: no tienes permiso para ${permiso.accion} en ${permiso.recurso}`)
  }
}

// Mapeo de nombres de sidebar → módulo real en la DB
// PROVEEDORES vive bajo COMPRAS en la tabla Permiso
const SIDEBAR_TO_DB_MODULO: Record<string, string> = {
  COMPRAS: "COMPRAS",
  PROVEEDORES: "COMPRAS",
  PRESUPUESTOS: "PRESUPUESTOS",
  RRHH: "RRHH",
  NOMINA: "NOMINA",
  TAREAS: "TAREAS",
  INVENTARIO: "INVENTARIO",
  INVENTARIOS: "INVENTARIOS",
  TRASPASOS: "TRASPASOS",
  DOCUMENTOS: "DOCUMENTOS",
  CONTABILIDAD: "CONTABILIDAD",
  TESORERIA: "TESORERIA",
  CLIENTES: "CLIENTES",
  PEDIDOS: "PEDIDOS",
  DESPACHOS: "DESPACHOS",
  VENTAS: "VENTAS",
  PERMISOS: "PERMISOS",
  REPORTES: "REPORTES",
  OPERACIONES: "OPERACIONES",
  CUENTAS_COBRAR: "CUENTAS_COBRAR",
  DASHBOARD: "DASHBOARD",
}

export async function obtenerModulosPermitidos(usuarioId: string): Promise<string[]> {
  const usuario = await getUsuarioConRoles(usuarioId)

  if (!usuario) return []

  if (usuario.superAdmin) {
    return Object.keys(SIDEBAR_TO_DB_MODULO)
  }

  if (usuario.roles.some((ur) => ur.rol.nombre === "ADMIN")) {
    return Object.keys(SIDEBAR_TO_DB_MODULO)
  }

  const modulosDB = new Set<string>()
  for (const ur of usuario.roles) {
    for (const rp of ur.rol.permisos) {
      modulosDB.add(rp.permiso.modulo)
    }
  }

  const permitidos: string[] = []
  for (const [sidebarName, dbName] of Object.entries(SIDEBAR_TO_DB_MODULO)) {
    if (modulosDB.has(dbName)) {
      permitidos.push(sidebarName)
    }
  }

  return permitidos
}

export async function asegurarPermisosOperaciones(empresaId: string) {
  const modulosNuevos = ["OPERACIONES", "CUENTAS_COBRAR"] as const
  const roles = await prisma.rol.findMany({
    where: { empresaId, nombre: { not: "ADMIN" } },
    select: { id: true, nombre: true },
  })
  if (roles.length === 0) return

  for (const rol of roles) {
    for (const modulo of modulosNuevos) {
      const existente = await prisma.rolPermiso.findFirst({
        where: { rolId: rol.id, permiso: { modulo: modulo as any } },
      })
      if (existente) continue

      const esOperador = rol.nombre === "OPERADOR"
      const accion = esOperador ? "ALL" : "READ"
      const permisos = await prisma.permiso.findMany({
        where: { modulo: modulo as any, accion },
        select: { id: true },
      })
      if (permisos.length > 0) {
        await prisma.rolPermiso.createMany({
          data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
          skipDuplicates: true,
        })
      }
    }
  }
}

export async function verificarPermisoSilencioso(
  usuarioId: string,
  permiso: PermisoRequerido
): Promise<boolean> {
  return await usuarioTienePermiso(usuarioId, permiso)
}

export type MenuItem = {
  id: string
  modulo: string
  label: string
  href: string | null
  icon: string | null
  orden: number
  visible: boolean
  children: MenuItem[]
}

export async function obtenerMenusPermitidos(usuarioId: string): Promise<MenuItem[]> {
  const usuario = await getUsuarioConRoles(usuarioId)

  if (!usuario) return []

  const esAdmin = usuario.superAdmin || usuario.roles.some((ur) => ur.rol.nombre === "ADMIN")

  const permisoIdsPermitidos = new Set<string>()
  if (!esAdmin) {
    for (const ur of usuario.roles) {
      for (const rp of ur.rol.permisos) {
        permisoIdsPermitidos.add(rp.permiso.id)
      }
    }
  }

  const todosLosMenus = await prisma.menu.findMany({
    where: { visible: true },
    orderBy: { orden: "asc" },
    include: {
      permisos: {
        select: { permisoId: true },
      },
    },
  })

  if (esAdmin) {
    return buildMenuTree(todosLosMenus, null)
  }

  const menusPermitidos = todosLosMenus.filter((menu) => {
    if (menu.permisos.length === 0) return true
    return menu.permisos.some((mp) => permisoIdsPermitidos.has(mp.permisoId))
  })

  return buildMenuTree(menusPermitidos, null)
}

function buildMenuTree(menus: any[], parentId: string | null): MenuItem[] {
  return menus
    .filter((m) => m.parentId === parentId)
    .map((m) => ({
      id: m.id,
      modulo: m.modulo,
      label: m.label,
      href: m.href,
      icon: m.icon,
      orden: m.orden,
      visible: m.visible,
      children: buildMenuTree(menus, m.id),
    }))
}

export const ACCIONES_POR_RECURSO: Record<string, TipoAccion[]> = {
  requisicion: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "RECHAZAR", "ENVIAR"],
  cotizacion: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "RECHAZAR"],
  orden_compra: ["CREATE", "READ", "UPDATE", "DELETE", "ANULAR", "DUPLICAR", "ENVIAR"],
  recepcion: ["CREATE", "READ", "UPDATE", "DELETE"],
  cuenta_pagar: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "ENVIAR"],
  pago: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "CONCILIAR"],
  egreso: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "ANULAR"],
  venta: ["CREATE", "READ", "UPDATE", "DELETE", "ANULAR", "ENVIAR", "EXPORTAR"],
  pedido: ["CREATE", "READ", "UPDATE", "DELETE", "ANULAR"],
  despacho: ["CREATE", "READ", "UPDATE", "DELETE", "ENVIAR"],
  traspaso: ["CREATE", "READ", "UPDATE", "DELETE", "ANULAR"],
  asiento_contable: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "CERRAR", "REABRIR"],
  movimiento_bancario: ["CREATE", "READ", "UPDATE", "DELETE", "CONCILIAR", "APROBAR"],
  solicitud_permiso: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "RECHAZAR"],
  cliente: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORTAR"],
  empleado: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORTAR"],
  nomina: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "EXPORTAR"],
  presupuesto: ["CREATE", "READ", "UPDATE", "DELETE", "APROBAR", "RECHAZAR"],
  proveedor: ["CREATE", "READ", "UPDATE", "DELETE", "EXPORTAR"],
  producto: ["CREATE", "READ", "UPDATE", "DELETE", "IMPORTAR", "EXPORTAR"],
  cuenta_bancaria: ["CREATE", "READ", "UPDATE", "DELETE"],
  recibo_caja: ["CREATE", "READ", "UPDATE", "DELETE", "ENVIAR"],
  cuenta_cobrar: ["CREATE", "READ", "UPDATE", "DELETE", "CONCILIAR", "ENVIAR"],
  automatizacion: ["CREATE", "READ", "UPDATE", "DELETE"],
}
