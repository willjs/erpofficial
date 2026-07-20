export const MODULOS_DISPONIBLES = [
  { clave: "CORE", label: "Core (usuarios, roles, empresas)" },
  { clave: "RRHH", label: "RRHH (empleados, contratos)" },
  { clave: "NOMINA", label: "Nómina" },
  { clave: "TAREAS", label: "Tareas y Proyectos" },
  { clave: "INVENTARIO", label: "Activos Fijos" },
  { clave: "INVENTARIOS", label: "Inventarios (stock)" },
  { clave: "DOCUMENTOS", label: "Documentos" },
  { clave: "CONTABILIDAD", label: "Contabilidad" },
  { clave: "PRESUPUESTOS", label: "Presupuestos" },
  { clave: "TESORERIA", label: "Tesorería" },
  { clave: "CLIENTES", label: "Clientes" },
  { clave: "PEDIDOS", label: "Pedidos (órdenes de clientes)" },
  { clave: "DESPACHOS", label: "Despachos (envíos)" },
  { clave: "VENTAS", label: "Ventas (facturación)" },
  { clave: "TRASPASOS", label: "Traspasos entre almacenes" },
  { clave: "PERMISOS", label: "Permisos (vacaciones)" },
  { clave: "REPORTES", label: "Reportes" },
  { clave: "COMPRAS", label: "Compras (procurement)" },
  { clave: "PROVEEDORES", label: "Proveedores" },
  { clave: "OPERACIONES", label: "Operaciones Marítimas" },
  { clave: "CUENTAS_COBRAR", label: "Cuentas por Cobrar" },
]

export const MODULOS_BASICA = ["CORE", "CONTABILIDAD", "CLIENTES", "PEDIDOS", "VENTAS", "DESPACHOS", "TRASPASOS", "RRHH", "NOMINA", "REPORTES", "PERMISOS", "TESORERIA", "PRESUPUESTOS", "DOCUMENTOS", "TAREAS"]
export const MODULOS_COMPLETA = MODULOS_DISPONIBLES.map(m => m.clave)
