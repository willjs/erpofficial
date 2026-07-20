import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: "localhost",
    port: 3306,
    user: "root",
    password: "",
    database: "oficina_db",
  }),
})

async function main() {
  console.log("=== INICIANDO RESET DE DATOS ===")

  // 1. Find superadmin users to keep
  const superadmins = await prisma.usuario.findMany({ where: { superAdmin: true } })
  if (superadmins.length === 0) {
    console.log("No se encontró ningún superadmin. Abortando.")
    return
  }
  console.log(`Superadmins encontrados: ${superadmins.map(u => u.email).join(", ")}`)
  const superadminIds = superadmins.map(u => u.id)

  // 2. Disassociate superadmin from empresas
  await prisma.usuarioEmpresa.deleteMany({
    where: { usuarioId: { in: superadminIds } },
  })
  await prisma.usuarioRol.deleteMany({
    where: { usuarioId: { in: superadminIds } },
  })
  await prisma.session.deleteMany({
    where: { userId: { in: superadminIds } },
  })
  await prisma.account.deleteMany({
    where: { userId: { in: superadminIds } },
  })
  // Clear empresa references for superadmin
  await prisma.usuario.updateMany({
    where: { id: { in: superadminIds } },
    data: { empresaId: null, empresaActivaId: null, departamentoId: null },
  })

  console.log("✅ Superadmin desvinculado de empresas")

  // 3. Delete all non-superadmin users and their related data
  const nonSuperAdminIds = (await prisma.usuario.findMany({
    where: { superAdmin: false },
    select: { id: true },
  })).map(u => u.id)

  // Delete data that references non-superadmin users (before deleting the users)
  await prisma.historialEstado.deleteMany({
    where: { usuarioId: { in: nonSuperAdminIds } },
  })
  await prisma.notificacion.deleteMany({
    where: { usuarioId: { in: nonSuperAdminIds } },
  })
  await prisma.presupuestoRevision.deleteMany({
    where: { aprobadoPorId: { in: nonSuperAdminIds } },
  })
  await prisma.presupuesto.deleteMany({
    where: { creadoPorId: { in: nonSuperAdminIds } },
  })
  await prisma.solicitudPermiso.deleteMany({
    where: { solicitanteId: { in: nonSuperAdminIds } },
  })
  await prisma.solicitudPermiso.deleteMany({
    where: { aprobadoPorId: { in: nonSuperAdminIds } },
  })
  await prisma.movimientoActivo.deleteMany({
    where: { responsableId: { in: nonSuperAdminIds } },
  })
  await prisma.tarea.deleteMany({
    where: { asignadoAId: { in: nonSuperAdminIds } },
  })
  await prisma.tarea.deleteMany({
    where: { creadoPorId: { in: nonSuperAdminIds } },
  })
  await prisma.comentarioTarea.deleteMany({
    where: { usuarioId: { in: nonSuperAdminIds } },
  })
  await prisma.movimientoInventario.deleteMany({
    where: { usuarioId: { in: nonSuperAdminIds } },
  })
  await prisma.empleado.deleteMany({
    where: { creadoPorId: { in: nonSuperAdminIds } },
  })
  await prisma.departamento.updateMany({
    where: { gerenteId: { in: nonSuperAdminIds } },
    data: { gerenteId: null },
  })

  // Now delete the non-superadmin users
  await prisma.usuarioRol.deleteMany({
    where: { usuarioId: { in: nonSuperAdminIds } },
  })
  await prisma.usuarioEmpresa.deleteMany({
    where: { usuarioId: { in: nonSuperAdminIds } },
  })
  await prisma.session.deleteMany({
    where: { userId: { in: nonSuperAdminIds } },
  })
  await prisma.account.deleteMany({
    where: { userId: { in: nonSuperAdminIds } },
  })
  await prisma.usuario.deleteMany({
    where: { id: { in: nonSuperAdminIds } },
  })

  console.log("✅ Usuarios no-superadmin eliminados")

  // 4. Delete all child tables (bottom-up deletion)
  await prisma.comentarioTarea.deleteMany()
  await prisma.tarea.deleteMany()
  await prisma.proyecto.deleteMany()

  await prisma.nominaDetalle.deleteMany()
  await prisma.nomina.deleteMany()
  await prisma.incidencia.deleteMany()
  await prisma.contrato.deleteMany()
  await prisma.empleado.deleteMany()

  await prisma.ventaPago.deleteMany()
  await prisma.ventaItem.deleteMany()
  await prisma.venta.deleteMany()
  await prisma.pedidoItem.deleteMany()
  await prisma.pedido.deleteMany()
  await prisma.despachoItem.deleteMany()
  await prisma.despacho.deleteMany()
  await prisma.traspasoItem.deleteMany()
  await prisma.traspaso.deleteMany()

  await prisma.movimientoInventario.deleteMany()
  await prisma.inventarioStock.deleteMany()
  await prisma.servicio.deleteMany()
  await prisma.producto.deleteMany()
  await prisma.almacen.deleteMany()

  await prisma.movimientoActivo.deleteMany()
  await prisma.activo.deleteMany()
  await prisma.categoriaActivo.deleteMany()

  await prisma.solicitudPermiso.deleteMany()
  await prisma.tipoPermiso.deleteMany()

  await prisma.documento.deleteMany()
  await prisma.carpeta.deleteMany()

  await prisma.recepcionItem.deleteMany()
  await prisma.recepcion.deleteMany()
  await prisma.ordenCompraItem.deleteMany()
  await prisma.ordenCompra.deleteMany()
  await prisma.cotizacionItem.deleteMany()
  await prisma.cotizacion.deleteMany()
  await prisma.requisicionItem.deleteMany()
  await prisma.requisicion.deleteMany()
  await prisma.cuentaPagar.deleteMany()
  await prisma.pago.deleteMany()
  await prisma.egreso.deleteMany()
  await prisma.proveedor.deleteMany()
  await prisma.centroCostos.deleteMany()

  await prisma.contactoCliente.deleteMany()
  await prisma.interaccionCliente.deleteMany()
  await prisma.cliente.deleteMany()

  await prisma.historialEstado.deleteMany()
  await prisma.notificacion.deleteMany()

  await prisma.presupuestoItem.deleteMany()
  await prisma.presupuestoRevision.deleteMany()
  await prisma.presupuesto.deleteMany()

  await prisma.plantillaContableLinea.deleteMany()
  await prisma.plantillaContable.deleteMany()
  await prisma.asientoDetalle.deleteMany()
  await prisma.asientoContable.deleteMany()
  await prisma.planCuenta.deleteMany()
  await prisma.tipoContabilidad.deleteMany()

  await prisma.movimientoBancario.deleteMany()
  await prisma.cuentaBancaria.deleteMany()

  await prisma.rolPermiso.deleteMany()
  await prisma.usuarioRol.deleteMany()
  await prisma.rol.deleteMany()

  await prisma.departamento.deleteMany()

  await prisma.usuarioEmpresa.deleteMany()

  // 5. Delete all Empresas
  await prisma.empresa.deleteMany()

  console.log("✅ Todas las empresas y sus datos eliminados")

  // 6. Verify superadmin still exists
  const remainingSuperadmin = await prisma.usuario.findMany({ where: { superAdmin: true } })
  console.log(`✅ Superadmin preservado: ${remainingSuperadmin.map(u => u.email).join(", ")}`)
  console.log("=== RESET COMPLETADO ===")
  console.log("")
  console.log("La base de datos está limpia. Solo queda el superadmin.")
  console.log("Para sembrar datos demo nuevamente, ejecuta: npm run db:seed")
}

main()
  .catch((e) => {
    console.error("ERROR:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
