import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { readFileSync } from "fs"
import { parse } from "dotenv"

const envRaw = readFileSync(".env", "utf-8")
const env = parse(envRaw)
const dbUrl = new URL(env.DATABASE_URL || "mysql://root:@localhost:3306/oficina_db")

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port) || 3306,
    user: decodeURIComponent(dbUrl.username),
    password: decodeURIComponent(dbUrl.password),
    database: dbUrl.pathname.replace(/^\//, ""),
  }),
})

const empresas = await prisma.empresa.findMany()
for (const emp of empresas) {
  if (!emp.modulosActivos) continue
  let modulos = emp.modulosActivos.replace(/[\[\]"\s]/g, "").split(",").filter(Boolean)
  const nuevos = ["PEDIDOS", "VENTAS", "DESPACHOS", "TRASPASOS"]
  let changed = false
  for (const m of nuevos) {
    if (!modulos.includes(m)) {
      modulos.push(m)
      changed = true
    }
  }
  if (changed) {
    await prisma.empresa.update({
      where: { id: emp.id },
      data: { modulosActivos: `[${modulos.join(",")}]` },
    })
    console.log("Actualizada:", emp.nombre)
  }
}
console.log("Done")
await prisma.$disconnect()
