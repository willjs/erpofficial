import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(__dirname, "../.env") })

const url = new URL(process.env.DATABASE_URL ?? "mysql://root:@localhost:3306/oficina_db")
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
  } as any),
})

async function main() {
  const empresas = await prisma.empresa.findMany()
  for (const emp of empresas) {
    if (!emp.modulosActivos) continue
    const modulos = emp.modulosActivos
      .replace(/[\[\]"\s]/g, "")
      .split(",")
      .filter(Boolean)
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
      console.log(`Actualizada: ${emp.nombre}`)
    }
  }
  console.log("Done")
  await prisma.$disconnect()
}

main()
