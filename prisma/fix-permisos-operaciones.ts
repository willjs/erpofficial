import { PrismaClient, Modulo, TipoPermisoAcceso } from "@prisma/client"
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

const MODULOS_NUEVOS: { modulo: Modulo; recursos: string[] }[] = [
  {
    modulo: "OPERACIONES",
    recursos: ["programacion_operativa", "orden_operativa", "recurso_operacion", "delivery_ticket"],
  },
  {
    modulo: "CUENTAS_COBRAR",
    recursos: ["cuenta_cobrar", "recibo_caja"],
  },
]

const acciones: TipoPermisoAcceso[] = ["CREATE", "READ", "UPDATE", "DELETE"]

async function main() {
  console.log("Agregando permisos faltantes de OPERACIONES y CUENTAS_COBRAR...")

  // 1. Crear permisos faltantes
  for (const { modulo, recursos } of MODULOS_NUEVOS) {
    for (const recurso of recursos) {
      for (const accion of acciones) {
        const nombre = `${modulo}_${recurso}_${accion.toLowerCase()}`
        await prisma.permiso.upsert({
          where: { nombre },
          update: {},
          create: { nombre, modulo, accion, recurso, descripcion: `${accion} en ${recurso} (${modulo})` },
        })
      }
      const allName = `${modulo}_${recurso}_all`
      await prisma.permiso.upsert({
        where: { nombre: allName },
        update: {},
        create: { nombre: allName, modulo, accion: "ALL", recurso, descripcion: `Acceso total a ${recurso} (${modulo})` },
      })
    }
  }

  // 2. Agregar modulos a modulosActivos de todas las empresas
  const empresas = await prisma.empresa.findMany()
  for (const empresa of empresas) {
    const activos = (empresa.modulosActivos ?? "").replace(/[\[\]"]/g, "").split(",").map((s: string) => s.trim()).filter(Boolean)
    const nuevos = ["OPERACIONES", "CUENTAS_COBRAR"]
    let changed = false
    for (const m of nuevos) {
      if (!activos.includes(m)) {
        activos.push(m)
        changed = true
      }
    }
    if (changed) {
      await prisma.empresa.update({
        where: { id: empresa.id },
        data: { modulosActivos: `[${activos.join(",")}]` },
      })
      console.log(`  Modulos agregados a empresa: ${empresa.nombre}`)
    }
  }

  // 3. Asignar permisos de OPERACIONES y CUENTAS_COBRAR a roles existentes
  const roles = await prisma.rol.findMany()
  for (const rol of roles) {
    const esAdmin = rol.nombre === "ADMIN"

    for (const { modulo, recursos } of MODULOS_NUEVOS) {
      if (esAdmin) {
        const permisos = await prisma.permiso.findMany({ where: { modulo } })
        for (const permiso of permisos) {
          await prisma.rolPermiso.upsert({
            where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
            update: {},
            create: { rolId: rol.id, permisoId: permiso.id },
          })
        }
      } else {
        for (const recurso of recursos) {
          const permiso = await prisma.permiso.findFirst({ where: { modulo, recurso, accion: "READ" } })
          if (permiso) {
            await prisma.rolPermiso.upsert({
              where: { rolId_permisoId: { rolId: rol.id, permisoId: permiso.id } },
              update: {},
              create: { rolId: rol.id, permisoId: permiso.id },
            })
          }
        }
      }
    }
    console.log(`  Permisos asignados a rol: ${rol.nombre} (${rol.empresaId})`)
  }

  console.log("Fix completado. Los usuarios deben cerrar sesion y volver a entrar.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
