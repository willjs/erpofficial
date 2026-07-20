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
  CORE: ["empresa", "departamento", "usuario", "rol", "permiso", "automatizacion"],
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
  OPERACIONES: ["programacion_operativa", "orden_operativa", "barcaza", "remolcador", "vehiculo_operativo", "conductor_operativo", "capitan", "recurso_asignacion", "delivery_ticket"],
  CUENTAS_COBRAR: ["cuenta_cobrar", "recibo_caja"],
  DASHBOARD: ["presidencia"],
}

const accionesBase: TipoPermisoAcceso[] = ["CREATE", "READ", "UPDATE", "DELETE"]

const accionesExtraPorRecurso: Record<string, TipoPermisoAcceso[]> = {
  requisicion: ["APROBAR", "RECHAZAR", "ENVIAR"],
  cotizacion: ["APROBAR", "RECHAZAR"],
  orden_compra: ["ANULAR", "DUPLICAR", "ENVIAR"],
  cuenta_pagar: ["APROBAR", "ENVIAR"],
  pago: ["APROBAR", "CONCILIAR"],
  egreso: ["APROBAR", "ANULAR"],
  venta: ["ANULAR", "ENVIAR", "EXPORTAR"],
  pedido: ["ANULAR"],
  despacho: ["ENVIAR"],
  traspaso: ["ANULAR"],
  asiento_contable: ["APROBAR", "CERRAR", "REABRIR"],
  movimiento_bancario: ["CONCILIAR", "APROBAR"],
  solicitud_permiso: ["APROBAR", "RECHAZAR"],
  cliente: ["EXPORTAR"],
  empleado: ["EXPORTAR"],
  nomina: ["APROBAR", "EXPORTAR"],
  presupuesto: ["APROBAR", "RECHAZAR"],
  proveedor: ["EXPORTAR"],
  producto: ["IMPORTAR", "EXPORTAR"],
  cuenta_cobrar: ["CONCILIAR", "ENVIAR"],
  recibo_caja: ["ENVIAR"],
}

type ModuloMod = Modulo

const menusDefinicion: {
  modulo: ModuloMod
  label: string
  href: string
  icon: string
  children: { label: string; href: string }[]
}[] = [
  { modulo: "COMPRAS", label: "Compras", href: "/compras", icon: "ShoppingCart", children: [] },
  { modulo: "COMPRAS", label: "Proveedores", href: "/proveedores", icon: "Users", children: [] },
  { modulo: "PRESUPUESTOS", label: "Presupuestos", href: "/presupuestos", icon: "PiggyBank", children: [] },
  { modulo: "RRHH", label: "Empleados", href: "/empleados", icon: "Users", children: [] },
  { modulo: "NOMINA", label: "Nómina", href: "/nomina", icon: "DollarSign", children: [] },
  { modulo: "TAREAS", label: "Tareas", href: "/tareas", icon: "CheckSquare", children: [] },
  { modulo: "INVENTARIO", label: "Activos Fijos", href: "/inventario", icon: "Package", children: [] },
  { modulo: "INVENTARIOS", label: "Inventarios", href: "/inventarios", icon: "Boxes", children: [] },
  { modulo: "INVENTARIOS", label: "Servicios", href: "/servicios", icon: "Wrench", children: [] },
  { modulo: "TRASPASOS", label: "Traspasos", href: "/traspasos", icon: "ArrowRightLeft", children: [] },
  { modulo: "DOCUMENTOS", label: "Documentos", href: "/documentos", icon: "FileText", children: [] },
  { modulo: "CONTABILIDAD", label: "Contabilidad", href: "/contabilidad", icon: "BookOpen", children: [] },
  { modulo: "TESORERIA", label: "Tesorería", href: "/tesoreria", icon: "Wallet", children: [] },
  { modulo: "CLIENTES", label: "Clientes", href: "/clientes", icon: "Briefcase", children: [] },
  { modulo: "PEDIDOS", label: "Pedidos", href: "/pedidos", icon: "ClipboardList", children: [] },
  { modulo: "DESPACHOS", label: "Despachos", href: "/despachos", icon: "Truck", children: [] },
  { modulo: "VENTAS", label: "Ventas", href: "/ventas", icon: "ShoppingBag", children: [] },
  { modulo: "PERMISOS", label: "Permisos", href: "/permisos", icon: "CalendarOff", children: [] },
  { modulo: "REPORTES", label: "Reportes", href: "/reportes", icon: "FileText", children: [] },
  { modulo: "OPERACIONES", label: "Operaciones", href: "/operaciones", icon: "Anchor", children: [] },
  { modulo: "CUENTAS_COBRAR", label: "Ctas. por Cobrar", href: "/cuentas-cobrar", icon: "Receipt", children: [] },
  { modulo: "CORE", label: "Automatizaciones", href: "/configuracion?tab=automatizaciones", icon: "Zap", children: [] },
]

async function main() {
  console.log("🌱 Iniciando seed...")

  // Crear permisos con acciones base
  const permisosCreados: string[] = []

  for (const [modulo, recursos] of Object.entries(recursosPorModulo)) {
    for (const recurso of recursos) {
      for (const accion of accionesBase) {
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

  // Crear permisos de acciones expandidas por recurso
  for (const [modulo, recursos] of Object.entries(recursosPorModulo)) {
    for (const recurso of recursos) {
      const extras = accionesExtraPorRecurso[recurso] || []
      for (const accion of extras) {
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

  console.log(`✅ ${permisosCreados.length} permisos creados/verificados`)

  // Crear empresa demo
  const modulosCompleta = ["CORE","RRHH","NOMINA","TAREAS","INVENTARIO","INVENTARIOS","DOCUMENTOS","CONTABILIDAD","PRESUPUESTOS","TESORERIA","CLIENTES","PEDIDOS","DESPACHOS","VENTAS","TRASPASOS","PERMISOS","REPORTES","COMPRAS","PROVEEDORES"]
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

  // ─── Seed de Menús jerárquicos ────────────────────────────
  console.log("🌱 Creando menús jerárquicos...")

  // Eliminar menús existentes para re-crear
  await prisma.menuPermiso.deleteMany()
  await prisma.menu.deleteMany()

  let ordenMenu = 0
  for (const menuDef of menusDefinicion) {
    const parentMenu = await prisma.menu.create({
      data: {
        modulo: menuDef.modulo as Modulo,
        label: menuDef.label,
        href: menuDef.href,
        icon: menuDef.icon,
        orden: ordenMenu++,
        visible: true,
      },
    })

    for (const child of menuDef.children) {
      await prisma.menu.create({
        data: {
          modulo: menuDef.modulo as Modulo,
          label: child.label,
          href: child.href,
          parentId: parentMenu.id,
          orden: ordenMenu++,
          visible: true,
        },
      })
    }
  }

  console.log(`✅ ${ordenMenu} menús creados`)

  // ─── Asignar permisos a menús (solo menús padre) ──────────
  console.log("🔗 Asignando permisos a menús...")

  const menusPadre = await prisma.menu.findMany({
    where: { parentId: null },
    include: { children: true },
  })

  let permisosAsignados = 0
  for (const menu of menusPadre) {
    const modulo = menu.modulo
    const permisosDelModulo = await prisma.permiso.findMany({
      where: { modulo },
      select: { id: true },
    })

    for (const permiso of permisosDelModulo) {
      await prisma.menuPermiso.upsert({
        where: { menuId_permisoId: { menuId: menu.id, permisoId: permiso.id } },
        update: {},
        create: { menuId: menu.id, permisoId: permiso.id },
      })
      permisosAsignados++
    }
  }

  console.log(`✅ ${permisosAsignados} permisos de menú asignados`)

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

  // ─── Automatizaciones predefinidas ──────────────────────────
  console.log("🤖 Creando automatizaciones predefinidas...")

  const crypto = await import("crypto")

  const eventosPredefinidos: { codigo: string; nombre: string; descripcion: string; modulo: string; evento: string }[] = [
    // COMPRAS
    { codigo: "REQUISICION_CREADA", nombre: "Requisición Creada", descripcion: "Se dispara cuando se crea una nueva requisición de compra", modulo: "COMPRAS", evento: "REQUISICION_CREADA" },
    { codigo: "REQUISICION_ENVIADA", nombre: "Requisición Enviada", descripcion: "Se dispara cuando se envía una requisición a cotización", modulo: "COMPRAS", evento: "REQUISICION_ENVIADA" },
    { codigo: "OC_CREADA", nombre: "Orden de Compra Creada", descripcion: "Se dispara cuando se genera una orden de compra desde una requisición", modulo: "COMPRAS", evento: "OC_CREADA" },
    { codigo: "OC_APROBADA", nombre: "Orden de Compra Aprobada", descripcion: "Se dispara cuando se aprueba una orden de compra", modulo: "COMPRAS", evento: "OC_APROBADA" },
    { codigo: "FACTURA_REGISTRADA", nombre: "Factura Registrada", descripcion: "Se dispara cuando se registra una cuenta por pagar (factura de proveedor)", modulo: "COMPRAS", evento: "FACTURA_REGISTRADA" },
    // TESORERIA
    { codigo: "PAGO_REALIZADO", nombre: "Pago a Proveedor", descripcion: "Se dispara cuando se realiza un pago a proveedor", modulo: "TESORERIA", evento: "PAGO_REALIZADO" },
    // OPERACIONES
    { codigo: "PROGRAMACION_CREADA", nombre: "Programación Creada", descripcion: "Se dispara cuando se crea una programación operativa", modulo: "OPERACIONES", evento: "PROGRAMACION_CREADA" },
    { codigo: "PROGRAMACION_APROBADA", nombre: "Programación Aprobada", descripcion: "Se dispara cuando se aprueba una programación operativa", modulo: "OPERACIONES", evento: "PROGRAMACION_APROBADA" },
    { codigo: "ORDEN_CREADA", nombre: "Orden Operativa Creada", descripcion: "Se dispara cuando se crea una orden operativa", modulo: "OPERACIONES", evento: "ORDEN_CREADA" },
    { codigo: "ORDEN_ASIGNADA", nombre: "Orden Operativa Asignada", descripcion: "Se dispara cuando se asignan recursos a una orden operativa", modulo: "OPERACIONES", evento: "ORDEN_ASIGNADA" },
    { codigo: "DELIVERY_TICKET_CREADO", nombre: "Delivery Ticket Creado", descripcion: "Se dispara cuando se crea un delivery ticket", modulo: "OPERACIONES", evento: "DELIVERY_TICKET_CREADO" },
    { codigo: "DELIVERY_TICKET_CONFIRMADO", nombre: "Delivery Ticket Confirmado", descripcion: "Se dispara cuando se confirma la entrega de un delivery ticket", modulo: "OPERACIONES", evento: "DELIVERY_TICKET_CONFIRMADO" },
    { codigo: "DELIVERY_TICKET_CERRADO", nombre: "Delivery Ticket Cerrado", descripcion: "Se dispara cuando se cierra un delivery ticket (genera venta automática)", modulo: "OPERACIONES", evento: "DELIVERY_TICKET_CERRADO" },
    // PEDIDOS
    { codigo: "PEDIDO_CREADO", nombre: "Pedido Creado", descripcion: "Se dispara cuando se crea un nuevo pedido de cliente", modulo: "PEDIDOS", evento: "PEDIDO_CREADO" },
    { codigo: "PEDIDO_CONFIRMADO", nombre: "Pedido Confirmado", descripcion: "Se dispara cuando se confirma un pedido de cliente", modulo: "PEDIDOS", evento: "PEDIDO_CONFIRMADO" },
    // VENTAS
    { codigo: "VENTA_CREADA", nombre: "Venta Creada", descripcion: "Se dispara cuando se crea una nueva venta/factura", modulo: "VENTAS", evento: "VENTA_CREADA" },
    { codigo: "VENTA_CONFIRMADA", nombre: "Venta Confirmada", descripcion: "Se dispara cuando se confirma una venta (genera asiento contable)", modulo: "VENTAS", evento: "VENTA_CONFIRMADA" },
    // DESPACHOS
    { codigo: "DESPACHO_CREADO", nombre: "Despacho Creado", descripcion: "Se dispara cuando se crea un nuevo despacho/envío", modulo: "DESPACHOS", evento: "DESPACHO_CREADO" },
    { codigo: "DESPACHO_ENVIADO", nombre: "Despacho Enviado", descripcion: "Se dispara cuando se marca un despacho como enviado", modulo: "DESPACHOS", evento: "DESPACHO_ENVIADO" },
    // INVENTARIOS
    { codigo: "PRODUCTO_CREADO", nombre: "Producto Creado", descripcion: "Se dispara cuando se registra un nuevo producto en inventario", modulo: "INVENTARIOS", evento: "PRODUCTO_CREADO" },
    { codigo: "STOCK_MINIMO", nombre: "Stock Mínimo Alcanzado", descripcion: "Se dispara cuando el stock de un producto baja del mínimo configurado", modulo: "INVENTARIOS", evento: "STOCK_MINIMO" },
    // TRASPASOS
    { codigo: "TRASPASO_COMPLETADO", nombre: "Traspaso Completado", descripcion: "Se dispara cuando se completa un traspaso entre almacenes", modulo: "TRASPASOS", evento: "TRASPASO_COMPLETADO" },
    // RRHH
    { codigo: "EMPLEADO_CREADO", nombre: "Empleado Creado", descripcion: "Se dispara cuando se registra un nuevo empleado", modulo: "RRHH", evento: "EMPLEADO_CREADO" },
    { codigo: "NOMINA_APROBADA", nombre: "Nómina Aprobada", descripcion: "Se dispara cuando se aprueba una nómina para pago", modulo: "NOMINA", evento: "NOMINA_APROBADA" },
    // CUENTAS POR COBRAR
    { codigo: "CUENTA_COBRAR_CREADA", nombre: "Cuenta por Cobrar Creada", descripcion: "Se dispara cuando se genera una cuenta por cobrar desde una venta", modulo: "CUENTAS_COBRAR", evento: "CUENTA_COBRAR_CREADA" },
    { codigo: "RECIBO_CAJA_REGISTRADO", nombre: "Recibo de Caja Registrado", descripcion: "Se dispara cuando se registra un recibo de cobro de un cliente", modulo: "CUENTAS_COBRAR", evento: "RECIBO_CAJA_REGISTRADO" },
  ]

  for (const evento of eventosPredefinidos) {
    const existing = await prisma.automatizacion.findFirst({
      where: { empresaId: empresa.id, codigo: evento.codigo },
    })
    if (!existing) {
      await prisma.automatizacion.create({
        data: {
          empresaId: empresa.id,
          codigo: evento.codigo,
          nombre: evento.nombre,
          descripcion: evento.descripcion,
          modulo: evento.modulo,
          evento: evento.evento,
          urlPowerAutomate: "",
          activo: false,
          token: crypto.randomBytes(32).toString("hex"),
        },
      })
    }
  }

  console.log(`✅ ${eventosPredefinidos.length} automatizaciones predefinidas creadas`)

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
