import { PrismaClient, Modulo, TipoPermisoAcceso } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "oficina_db",
  }),
})

const recursosPorModulo: Record<Modulo, string[]> = {
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
  COMPRAS: ["centro_costos", "proveedor", "requisicion", "cotizacion", "orden_compra", "recepcion", "cuenta_pagar", "pago", "egreso"],
  PEDIDOS: ["pedido"],
  VENTAS: ["venta"],
  DESPACHOS: ["despacho"],
  TRASPASOS: ["traspaso"],
}

const acciones: TipoPermisoAcceso[] = ["CREATE", "READ", "UPDATE", "DELETE"]

async function main() {
  console.log("🌱 Iniciando seed...")

  // Crear permisos
  const permisosCreados: string[] = []

  for (const [modulo, recursos] of Object.entries(recursosPorModulo)) {
    for (const recurso of recursos) {
      for (const accion of acciones) {
        const nombre = `${modulo}_${recurso}_${accion.toLowerCase()}`
        const exists = await prisma.permiso.findUnique({ where: { nombre } })
        if (!exists) {
          await prisma.permiso.create({
            data: {
              nombre,
              modulo: modulo as Modulo,
              accion,
              recurso,
              descripcion: `${accion} en ${recurso} (${modulo})`,
            },
          })
        }
        permisosCreados.push(nombre)
      }
    }
  }

  // Crear permiso ALL para cada recurso
  for (const [modulo, recursos] of Object.entries(recursosPorModulo)) {
    for (const recurso of recursos) {
      const nombre = `${modulo}_${recurso}_all`
      const exists = await prisma.permiso.findUnique({ where: { nombre } })
      if (!exists) {
        await prisma.permiso.create({
          data: {
            nombre,
            modulo: modulo as Modulo,
            accion: "ALL",
            recurso,
            descripcion: `Acceso total a ${recurso} (${modulo})`,
          },
        })
      }
    }
  }

  console.log(`✅ ${permisosCreados.length} permisos creados/verificados`)

  // Crear empresa demo
  const modulosCompleta = ["CORE","RRHH","NOMINA","TAREAS","INVENTARIO","INVENTARIOS","DOCUMENTOS","CONTABILIDAD","PRESUPUESTOS","TESORERIA","CLIENTES","PEDIDOS","DESPACHOS","VENTAS","TRASPASOS","PERMISOS","REPORTES","COMPRAS"]
  const empresa = await prisma.empresa.upsert({
    where: { rfc: "DEMO-001" },
    update: {},
    create: {
      nombre: "Empresa Demo",
      rfc: "DEMO-001",
      email: "demo@empresa.com",
      tipo: "COMPLETA",
      modulosActivos: `[${modulosCompleta.join(",")}]`,
    },
  })

  // Crear departamentos
  const deptos = [
    "Dirección General",
    "Gerencia",
    "Recursos Humanos",
    "Contabilidad",
    "Tesorería",
    "Ventas",
    "Operaciones",
    "Sistemas",
  ]

  for (const nombre of deptos) {
    await prisma.departamento.upsert({
      where: { empresaId_nombre: { empresaId: empresa.id, nombre } },
      update: {},
      create: { empresaId: empresa.id, nombre },
    })
  }

  // ─── Segunda empresa ──────────────────────────────────────

  // Crear segunda empresa demo para multi-empresa
  const empresa2 = await prisma.empresa.upsert({
    where: { rfc: "DEMO-002" },
    update: {},
    create: {
      nombre: "Empresa Secundaria",
      rfc: "DEMO-002",
      email: "contacto@secundaria.com",
      tipo: "COMPLETA",
      modulosActivos: `[${modulosCompleta.join(",")}]`,
    },
  })

  for (const nombre of deptos) {
    await prisma.departamento.upsert({
      where: { empresaId_nombre: { empresaId: empresa2.id, nombre } },
      update: {},
      create: { empresaId: empresa2.id, nombre },
    })
  }

  // Crear usuario admin
  const password = await bcrypt.hash("admin123", 10)
  const admin = await prisma.usuario.upsert({
    where: { email: "admin@empresa.com" },
    update: {},
    create: {
      empresaId: empresa.id,
      empresaActivaId: empresa.id,
      email: "admin@empresa.com",
      password,
      nombre: "Admin",
      apellido: "Sistema",
      puesto: "Administrador",
    },
  })

  // Vincular admin a ambas empresas
  await prisma.usuarioEmpresa.upsert({
    where: { usuarioId_empresaId: { usuarioId: admin.id, empresaId: empresa.id } },
    update: {},
    create: { usuarioId: admin.id, empresaId: empresa.id },
  })
  await prisma.usuarioEmpresa.upsert({
    where: { usuarioId_empresaId: { usuarioId: admin.id, empresaId: empresa2.id } },
    update: {},
    create: { usuarioId: admin.id, empresaId: empresa2.id },
  })

  // Crear rol ADMIN si no existe
  const adminRol = await prisma.rol.upsert({
    where: { empresaId_nombre: { empresaId: empresa.id, nombre: "ADMIN" } },
    update: {},
    create: {
      empresaId: empresa.id,
      nombre: "ADMIN",
      descripcion: "Administrador del sistema",
      esSistema: true,
    },
  })

  // Asignar todos los permisos al rol ADMIN
  const todosPermisos = await prisma.permiso.findMany()
  for (const permiso of todosPermisos) {
    await prisma.rolPermiso.upsert({
      where: { rolId_permisoId: { rolId: adminRol.id, permisoId: permiso.id } },
      update: {},
      create: { rolId: adminRol.id, permisoId: permiso.id },
    })
  }

  // Asignar rol admin al usuario
  await prisma.usuarioRol.upsert({
    where: { usuarioId_rolId: { usuarioId: admin.id, rolId: adminRol.id } },
    update: {},
    create: { usuarioId: admin.id, rolId: adminRol.id },
  })

  // ─── Roles por defecto (editables) ────────────────────────────
  interface RolDef {
    nombre: string
    descripcion: string
    modulosAcceso: Record<string, "ALL" | "READ">
  }

  const rolesPorDefecto: RolDef[] = [
    {
      nombre: "CONTADOR",
      descripcion: "Contabilidad y tesorería",
      modulosAcceso: {
        CONTABILIDAD: "ALL",
        PRESUPUESTOS: "ALL",
        TESORERIA: "ALL",
        COMPRAS: "ALL",
        CORE: "READ",
        REPORTES: "ALL",
      },
    },
    {
      nombre: "GERENTE",
      descripcion: "Gerencia - visibilidad general y gestión de equipos",
      modulosAcceso: {
        CORE: "READ",
        RRHH: "READ",
        TAREAS: "ALL",
        CLIENTES: "ALL",
        REPORTES: "ALL",
        PRESUPUESTOS: "ALL",
        COMPRAS: "ALL",
        DOCUMENTOS: "ALL",
      },
    },
    {
      nombre: "ALMACEN",
      descripcion: "Gestión de almacén e inventarios",
      modulosAcceso: {
        INVENTARIOS: "ALL",
        INVENTARIO: "ALL",
        CORE: "READ",
        COMPRAS: "READ",
      },
    },
    {
      nombre: "RRHH",
      descripcion: "Recursos Humanos - nómina y empleados",
      modulosAcceso: {
        RRHH: "ALL",
        NOMINA: "ALL",
        PERMISOS: "ALL",
        CORE: "READ",
      },
    },
    {
      nombre: "EMPLEADO",
      descripcion: "Empleado regular - acceso básico",
      modulosAcceso: {
        PERMISOS: "ALL",
        TAREAS: "ALL",
        DOCUMENTOS: "ALL",
        CORE: "READ",
      },
    },
  ]

  async function asignarPermisosModulo(rolId: string, modulosAcceso: Record<string, "ALL" | "READ">) {
    for (const [modulo, tipo] of Object.entries(modulosAcceso)) {
      const permisos = tipo === "ALL"
        ? await prisma.permiso.findMany({ where: { modulo: modulo as Modulo } })
        : await prisma.permiso.findMany({ where: { modulo: modulo as Modulo, accion: "READ" } })

      for (const permiso of permisos) {
        await prisma.rolPermiso.upsert({
          where: { rolId_permisoId: { rolId, permisoId: permiso.id } },
          update: {},
          create: { rolId, permisoId: permiso.id },
        })
      }
    }
  }

  for (const empresaRoles of [empresa, empresa2]) {
    for (const def of rolesPorDefecto) {
      const rol = await prisma.rol.upsert({
        where: { empresaId_nombre: { empresaId: empresaRoles.id, nombre: def.nombre } },
        update: { descripcion: def.descripcion },
        create: {
          empresaId: empresaRoles.id,
          nombre: def.nombre,
          descripcion: def.descripcion,
          esSistema: false,
        },
      })
      await asignarPermisosModulo(rol.id, def.modulosAcceso)
    }
  }

  console.log(`✅ ${rolesPorDefecto.length} roles por defecto creados en ambas empresas`)

  // ─── Notificaciones demo inteligentes ─────────────────────
  const notifsDemo: { tipo: string; titulo: string; mensaje: string; recurso: string; accion: string }[] = [
    { tipo: "REQUISICION_PENDIENTE", titulo: "Requisición pendiente de aprobación", mensaje: "La requisición #1 de Juan Pérez está esperando aprobación.", recurso: "requisicion", accion: "UPDATE" },
    { tipo: "TAREA_ASIGNADA", titulo: "Nueva tarea asignada", mensaje: "Se te ha asignado la tarea 'Revisar presupuesto Q1'", recurso: "tarea", accion: "READ" },
    { tipo: "ORDEN_COMPRA", titulo: "OC generada", mensaje: "La orden de compra #5 ha sido generada y enviada al proveedor.", recurso: "orden_compra", accion: "READ" },
    { tipo: "PERMISO", titulo: "Solicitud de permiso", mensaje: "María García ha solicitado permiso del 15 al 17 de junio.", recurso: "solicitud_permiso", accion: "READ" },
  ]
  for (const n of notifsDemo) {
    const usuariosNotif = await prisma.usuario.findMany({
      where: {
        empresaId: empresa.id,
        OR: [
          { superAdmin: true },
          {
            roles: {
              some: {
                rol: {
                  permisos: {
                    some: {
                      permiso: {
                        recurso: n.recurso,
                        accion: { in: [n.accion as TipoPermisoAcceso, "ALL"] },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    })
    for (const u of usuariosNotif) {
      await prisma.notificacion.create({
        data: {
          empresaId: empresa.id,
          usuarioId: u.id,
          tipo: n.tipo,
          titulo: n.titulo,
          mensaje: n.mensaje,
          referenciaId: null,
          referenciaTipo: n.tipo,
        },
      })
    }
  }

  // ─── Super Admin ───────────────────────────────────────────
  const superAdminPassword = await bcrypt.hash("superadmin123", 10)
  const superAdmin = await prisma.usuario.upsert({
    where: { email: "super@admin.com" },
    update: {},
    create: {
      empresaId: empresa.id,
      empresaActivaId: empresa.id,
      email: "super@admin.com",
      password: superAdminPassword,
      nombre: "Super",
      apellido: "Admin",
      puesto: "Super Administrador",
      superAdmin: true,
    },
  })

  await prisma.usuarioEmpresa.upsert({
    where: { usuarioId_empresaId: { usuarioId: superAdmin.id, empresaId: empresa.id } },
    update: {},
    create: { usuarioId: superAdmin.id, empresaId: empresa.id },
  })
  await prisma.usuarioEmpresa.upsert({
    where: { usuarioId_empresaId: { usuarioId: superAdmin.id, empresaId: empresa2.id } },
    update: {},
    create: { usuarioId: superAdmin.id, empresaId: empresa2.id },
  })

  console.log("✅ Datos demo creados exitosamente")
  console.log("📧 Email: admin@empresa.com")
  console.log("🔑 Password: admin123")
  console.log("📧 Super Admin: super@admin.com")
  console.log("🔑 Super Admin Password: superadmin123")
  console.log("📧 Admin puede cambiar entre: Empresa Demo y Empresa Secundaria")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
