import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const url = new URL(process.env.DATABASE_URL ?? "mysql://root:@localhost:3306/oficina_db")
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 5,
  } as any),
})

async function main() {
  const r = await prisma.centroCostos.deleteMany()
  console.log(`Eliminados ${r.count} centros de costo`)
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
