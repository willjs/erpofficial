"use server"

import { verifySession, requireSuperAdmin } from "@/lib/dal"
import { prisma } from "@/lib/prisma"
import { MODULOS_BASICA, MODULOS_COMPLETA } from "@/lib/modulos"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { Modulo, TipoPermisoAcceso } from "@prisma/client"

function modulosSegunTipo(tipo: string, modulosPersonalizados?: string[]): string[] {
  if (tipo === "BASICA") return [...MODULOS_BASICA]
  if (tipo === "COMPLETA") return [...MODULOS_COMPLETA]
  return modulosPersonalizados ?? [...MODULOS_BASICA]
}

// ─── Empresas ─────────────────────────────────────────────

export async function getEmpresas() {
  const session = await verifySession()
  requireSuperAdmin(session)
  return prisma.empresa.findMany({
    orderBy: { nombre: "asc" },
    include: {
      _count: { select: { usuarios: true } },
    },
  })
}

export async function getEmpresaById(id: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  return prisma.empresa.findUnique({
    where: { id },
    include: {
      _count: { select: { usuarios: true, departamentos: true } },
    },
  })
}

const empresaSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  rfc: z.string().optional(),
  direccion: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  tipoContabilidad: z.string().optional().nullable(),
  activo: z.boolean().optional(),
  tipo: z.enum(["BASICA", "COMPLETA", "PERSONALIZADA"]).default("COMPLETA"),
  modulos: z.array(z.string()).optional(),
})

async function seedPermisosSiVacio() {
  const count = await prisma.permiso.count()
  if (count > 0) return

  const recursosPorModulo: Record<string, string[]> = {
    CORE: ["empresa", "departamento", "usuario", "rol", "permiso"],
    RRHH: ["empleado", "contrato", "expediente"],
    NOMINA: ["nomina", "nomina_detalle", "incidencia", "concepto"],
    TAREAS: ["proyecto", "tarea", "comentario"],
    INVENTARIO: ["categoria_activo", "activo", "movimiento_activo"],
    INVENTARIOS: ["almacen", "producto", "inventario_stock", "movimiento_inventario"],
    DOCUMENTOS: ["carpeta", "documento"],
    CONTABILIDAD: ["plan_cuenta", "asiento_contable", "asiento_detalle", "plantilla_contable"],
    PRESUPUESTOS: ["presupuesto"],
    TESORERIA: ["cuenta_bancaria", "movimiento_bancario"],
    CLIENTES: ["cliente", "contacto_cliente", "interaccion_cliente"],
    PERMISOS: ["tipo_permiso", "solicitud_permiso"],
    REPORTES: ["reporte", "dashboard"],
    COMPRAS: ["centro_costos", "requisicion", "cotizacion", "orden_compra", "recepcion", "cuenta_pagar", "pago", "egreso"],
    PROVEEDORES: ["proveedor"],
    PEDIDOS: ["pedido"],
    VENTAS: ["venta"],
    DESPACHOS: ["despacho"],
    TRASPASOS: ["traspaso"],
    OPERACIONES: ["programacion_operativa", "orden_operativa", "recurso_operacion", "delivery_ticket"],
    CUENTAS_COBRAR: ["cuenta_cobrar", "recibo_caja"],
    DASHBOARD: ["presidencia"],
  }

  const acciones: TipoPermisoAcceso[] = ["CREATE", "READ", "UPDATE", "DELETE"]
  const records: { nombre: string; modulo: Modulo; accion: TipoPermisoAcceso; recurso: string; descripcion: string }[] = []

  for (const [modulo, recursos] of Object.entries(recursosPorModulo)) {
    for (const recurso of recursos) {
      for (const accion of acciones) {
        records.push({
          nombre: `${modulo}_${recurso}_${accion.toLowerCase()}`,
          modulo: modulo as Modulo,
          accion,
          recurso,
          descripcion: `${accion} en ${recurso} (${modulo})`,
        })
      }
      records.push({
        nombre: `${modulo}_${recurso}_all`,
        modulo: modulo as Modulo,
        accion: "ALL",
        recurso,
        descripcion: `Acceso total a ${recurso} (${modulo})`,
      })
    }
  }

  await prisma.permiso.createMany({ data: records })
}

async function crearRolesPorDefecto(empresaId: string) {
  type RolDef = {
    nombre: string
    descripcion: string
    esSistema: boolean
    modulosAcceso: Record<string, "ALL" | "READ">
  }

  const rolesPorDefecto: RolDef[] = [
    {
      nombre: "ADMIN",
      descripcion: "Administrador del sistema",
      esSistema: true,
      modulosAcceso: {},
    },
    {
      nombre: "CONTADOR",
      descripcion: "Contabilidad y tesorería",
      esSistema: false,
      modulosAcceso: {
        CONTABILIDAD: "ALL", PRESUPUESTOS: "ALL", TESORERIA: "ALL",
        COMPRAS: "ALL", CORE: "READ", REPORTES: "ALL",
      },
    },
    {
      nombre: "GERENTE",
      descripcion: "Gerencia - visibilidad general y gestión de equipos",
      esSistema: false,
      modulosAcceso: {
        CORE: "READ", RRHH: "READ", TAREAS: "ALL", CLIENTES: "ALL",
        REPORTES: "ALL", PRESUPUESTOS: "ALL", COMPRAS: "ALL", DOCUMENTOS: "ALL",
      },
    },
    {
      nombre: "ALMACEN",
      descripcion: "Gestión de almacén e inventarios",
      esSistema: false,
      modulosAcceso: { INVENTARIOS: "ALL", INVENTARIO: "ALL", CORE: "READ", COMPRAS: "READ" },
    },
    {
      nombre: "RRHH",
      descripcion: "Recursos Humanos - nómina y empleados",
      esSistema: false,
      modulosAcceso: { RRHH: "ALL", NOMINA: "ALL", PERMISOS: "ALL", CORE: "READ" },
    },
    {
      nombre: "EMPLEADO",
      descripcion: "Empleado regular - acceso básico",
      esSistema: false,
      modulosAcceso: { PERMISOS: "ALL", TAREAS: "ALL", DOCUMENTOS: "ALL", CORE: "READ" },
    },
    {
      nombre: "OPERADOR",
      descripcion: "Operador - acceso a todos los módulos operativos sin configuración",
      esSistema: false,
      modulosAcceso: {
        COMPRAS: "ALL", VENTAS: "ALL", PEDIDOS: "ALL", DESPACHOS: "ALL",
        TRASPASOS: "ALL", INVENTARIOS: "ALL", INVENTARIO: "ALL",
        CLIENTES: "ALL", CONTABILIDAD: "ALL", TESORERIA: "ALL",
        PRESUPUESTOS: "ALL", NOMINA: "ALL", RRHH: "ALL",
        TAREAS: "ALL", DOCUMENTOS: "ALL", PERMISOS: "ALL",
        REPORTES: "ALL",
      },
    },
  ]

  await seedPermisosSiVacio()

  for (const def of rolesPorDefecto) {
    const rol = await prisma.rol.create({
      data: {
        empresaId,
        nombre: def.nombre,
        descripcion: def.descripcion,
        esSistema: def.esSistema,
      },
    })

    let permisos: { id: string }[]

    if (def.nombre === "ADMIN") {
      permisos = await prisma.permiso.findMany({ select: { id: true } })
    } else {
      const modulos = Object.keys(def.modulosAcceso) as Modulo[]
      const condiciones = modulos.flatMap((modulo) => {
        const tipo = def.modulosAcceso[modulo]
        return tipo === "ALL"
          ? [{ modulo, accion: "ALL" as TipoPermisoAcceso }]
          : [{ modulo, accion: "READ" as TipoPermisoAcceso }]
      })
      permisos = await prisma.permiso.findMany({
        where: { OR: condiciones.map((c) => ({ modulo: c.modulo, accion: c.accion })) },
        select: { id: true },
      })
    }

    if (permisos.length > 0) {
      await prisma.rolPermiso.createMany({
        data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
      })
    }
  }
}

export async function createEmpresa(data: z.infer<typeof empresaSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = empresaSchema.parse(data)
  const modulos = validated.modulos ?? modulosSegunTipo(validated.tipo)
  const empresa = await prisma.empresa.create({
    data: {
      nombre: validated.nombre,
      rfc: validated.rfc || null,
      direccion: validated.direccion || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      tipoContabilidad: validated.tipoContabilidad || null,
      tipo: validated.tipo as any,
      modulosActivos: `[${modulos.join(",")}]`,
    },
  })

  // Crear roles por defecto para la nueva empresa
  await crearRolesPorDefecto(empresa.id)

  // Vincular superadmin a la nueva empresa automáticamente
  const superAdminId = session.userId!
  await prisma.usuarioEmpresa.create({
    data: { usuarioId: superAdminId, empresaId: empresa.id },
  })
  revalidatePath("/admin")
  revalidatePath("/")
  return empresa
}

export async function updateEmpresa(id: string, data: z.infer<typeof empresaSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = empresaSchema.parse(data)
  const modulos = validated.modulos ?? modulosSegunTipo(validated.tipo)
  const empresa = await prisma.empresa.update({
    where: { id },
    data: {
      nombre: validated.nombre,
      rfc: validated.rfc || null,
      direccion: validated.direccion || null,
      telefono: validated.telefono || null,
      email: validated.email || null,
      tipoContabilidad: validated.tipoContabilidad || null,
      activo: validated.activo,
      tipo: validated.tipo as any,
      modulosActivos: `[${modulos.join(",")}]`,
    },
  })
  revalidatePath("/admin")
  return empresa
}

export async function deleteEmpresa(id: string) {
  const session = await verifySession()
  requireSuperAdmin(session)

  const [userCount, pedidoCount, ventaCount] = await Promise.all([
    prisma.usuarioEmpresa.count({ where: { empresaId: id } }),
    prisma.pedido.count({ where: { empresaId: id } }),
    prisma.venta.count({ where: { empresaId: id } }),
  ])
  if (userCount > 0 || pedidoCount > 0 || ventaCount > 0) {
    throw new Error("No se puede eliminar una empresa con usuarios, pedidos o ventas asociados. Desactívela en su lugar.")
  }

  await prisma.empresa.delete({ where: { id } })
  revalidatePath("/admin")
}

// ─── Roles (cross-empresa) ─────────────────────────────

export async function getRolesAdmin(empresaId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)

  const existing = await prisma.rol.findFirst({ where: { empresaId }, select: { id: true } })
  if (!existing) {
    await crearRolesPorDefecto(empresaId)
  } else {
    // Asegurar que exista el rol OPERADOR en empresas existentes
    const operador = await prisma.rol.findFirst({ where: { empresaId, nombre: "OPERADOR" }, select: { id: true } })
    if (!operador) {
      await seedPermisosSiVacio()
      const rol = await prisma.rol.create({
        data: {
          empresaId,
          nombre: "OPERADOR",
          descripcion: "Operador - acceso a todos los módulos operativos sin configuración",
          esSistema: false,
        },
      })
      const modulosOperador = {
        COMPRAS: "ALL" as const, VENTAS: "ALL" as const, PEDIDOS: "ALL" as const,
        DESPACHOS: "ALL" as const, TRASPASOS: "ALL" as const, INVENTARIOS: "ALL" as const,
        INVENTARIO: "ALL" as const, CLIENTES: "ALL" as const, CONTABILIDAD: "ALL" as const,
        TESORERIA: "ALL" as const, PRESUPUESTOS: "ALL" as const, NOMINA: "ALL" as const,
        RRHH: "ALL" as const, TAREAS: "ALL" as const, DOCUMENTOS: "ALL" as const,
        PERMISOS: "ALL" as const, REPORTES: "ALL" as const,
        OPERACIONES: "ALL" as const, CUENTAS_COBRAR: "ALL" as const,
      }
      const condiciones = Object.entries(modulosOperador).flatMap(([modulo, tipo]) =>
        tipo === "ALL"
          ? [{ modulo: modulo as Modulo, accion: "ALL" as TipoPermisoAcceso }]
          : [{ modulo: modulo as Modulo, accion: "READ" as TipoPermisoAcceso }]
      )
      const permisos = await prisma.permiso.findMany({
        where: { OR: condiciones.map((c) => ({ modulo: c.modulo, accion: c.accion })) },
        select: { id: true },
      })
      if (permisos.length > 0) {
        await prisma.rolPermiso.createMany({
          data: permisos.map((p) => ({ rolId: rol.id, permisoId: p.id })),
        })
      }
    }
  }

  return prisma.rol.findMany({
    where: { empresaId },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  })
}

// ─── Usuarios (cross-empresa) ────────────────────────────

export async function getUsuariosAdmin(empresaId?: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const where = empresaId ? { empresaId } : {}
  return prisma.usuario.findMany({
    where,
    include: {
      empresa: { select: { id: true, nombre: true } },
      empresas: { include: { empresa: { select: { id: true, nombre: true } } } },
      roles: { include: { rol: { select: { id: true, nombre: true } } } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function toggleSuperAdmin(usuarioId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  if (session.userId === usuarioId) {
    throw new Error("No puedes desactivar tu propio acceso de super administrador")
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuario) throw new Error("Usuario no encontrado")
  const updated = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { superAdmin: !usuario.superAdmin },
  })
  revalidatePath("/admin")
  return updated
}

export async function toggleUsuarioActivoAdmin(usuarioId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  if (session.userId === usuarioId) {
    throw new Error("No puedes desactivar tu propia cuenta")
  }
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (!usuario) throw new Error("Usuario no encontrado")
  const updated = await prisma.usuario.update({
    where: { id: usuarioId },
    data: { activo: !usuario.activo },
  })
  revalidatePath("/admin")
  return updated
}

export async function asignarEmpresaAUsuario(usuarioId: string, empresaId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  await prisma.usuarioEmpresa.upsert({
    where: { usuarioId_empresaId: { usuarioId, empresaId } },
    update: {},
    create: { usuarioId, empresaId },
  })
  revalidatePath("/admin")
}

export async function removerEmpresaDeUsuario(usuarioId: string, empresaId: string) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } })
  if (usuario?.empresaId === empresaId) {
    throw new Error("No se puede desvincular la empresa activa del usuario. Cambie primero la empresa activa.")
  }
  const empresasCount = await prisma.usuarioEmpresa.count({ where: { usuarioId } })
  if (empresasCount <= 1) {
    throw new Error("No se puede remover la última empresa de un usuario")
  }
  await prisma.usuarioEmpresa.deleteMany({
    where: { usuarioId, empresaId },
  })
  revalidatePath("/admin")
}

const usuarioAdminSchema = z.object({
  empresaId: z.string().min(1, "Empresa requerida"),
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional(),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  departamentoId: z.string().optional().nullable(),
  rolId: z.string().optional().nullable(),
})

export async function createUsuarioAdmin(data: z.infer<typeof usuarioAdminSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = usuarioAdminSchema.parse(data)

  const existente = await prisma.usuario.findUnique({ where: { email: validated.email } })
  if (existente) throw new Error("El email ya está registrado")

  const hashedPassword = await bcrypt.hash(validated.password, 10)

  const usuario = await prisma.usuario.create({
    data: {
      empresaId: validated.empresaId,
      empresaActivaId: validated.empresaId,
      nombre: validated.nombre,
      apellido: validated.apellido ?? null,
      email: validated.email,
      password: hashedPassword,
      departamentoId: validated.departamentoId ?? null,
    },
  })

  await prisma.usuarioEmpresa.create({
    data: {
      usuarioId: usuario.id,
      empresaId: validated.empresaId,
    },
  })

  // Asignar rol
  const rolId = validated.rolId || (
    await prisma.rol.findFirst({
      where: { empresaId: validated.empresaId, nombre: "ADMIN" },
      select: { id: true },
    })
  )?.id
  if (rolId) {
    await prisma.usuarioRol.create({
      data: { usuarioId: usuario.id, rolId },
    })
  }

  revalidatePath("/admin")
  return usuario
}

const usuarioUpdateAdminSchema = z.object({
  empresaId: z.string().nullable().optional(),
  nombre: z.string().min(1, "Nombre requerido"),
  apellido: z.string().optional().nullable(),
  email: z.string().email("Email inválido"),
  password: z.string().optional().nullable().or(z.literal("")),
  rolId: z.string().optional().nullable(),
})

export async function updateUsuarioAdmin(id: string, data: z.infer<typeof usuarioUpdateAdminSchema>) {
  const session = await verifySession()
  requireSuperAdmin(session)
  const validated = usuarioUpdateAdminSchema.parse(data)

  const existing = await prisma.usuario.findUnique({ where: { id } })
  if (!existing) throw new Error("Usuario no encontrado")

  if (validated.email !== existing.email) {
    const dup = await prisma.usuario.findUnique({ where: { email: validated.email } })
    if (dup) throw new Error("El email ya está registrado")
  }

  const updateData: any = {
    nombre: validated.nombre,
    apellido: validated.apellido ?? null,
    email: validated.email,
  }

  if (validated.password) {
    updateData.password = await bcrypt.hash(validated.password, 10)
  }

  if (validated.empresaId) {
    updateData.empresaId = validated.empresaId
    updateData.empresaActivaId = validated.empresaId
  } else {
    updateData.empresaId = null
    updateData.empresaActivaId = null
  }

  const updated = await prisma.usuario.update({
    where: { id },
    data: updateData,
  })

  if (validated.empresaId) {
    await prisma.usuarioEmpresa.upsert({
      where: {
        usuarioId_empresaId: {
          usuarioId: id,
          empresaId: validated.empresaId,
        },
      },
      update: {},
      create: {
        usuarioId: id,
        empresaId: validated.empresaId,
      },
    })
  }

  // Actualizar rol si se proporcionó
  if (validated.rolId !== undefined) {
    await prisma.usuarioRol.deleteMany({ where: { usuarioId: id } })
    if (validated.rolId) {
      await prisma.usuarioRol.create({
        data: { usuarioId: id, rolId: validated.rolId },
      })
    }
  }

  revalidatePath("/admin")
  return updated
}

// ─── Estadísticas globales ────────────────────────────────

export async function getEstadisticasGlobales() {
  const session = await verifySession()
  requireSuperAdmin(session)

  const [totalEmpresas, totalUsuarios, totalEmpleados, totalRequisiciones, totalOrdenesCompra] = await Promise.all([
    prisma.empresa.count({ where: { activo: true } }),
    prisma.usuario.count(),
    prisma.empleado.count(),
    prisma.requisicion.count(),
    prisma.ordenCompra.count(),
  ])

  return {
    totalEmpresas,
    totalUsuarios,
    totalEmpleados,
    totalRequisiciones,
    totalOrdenesCompra,
  }
}
