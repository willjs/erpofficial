import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrismaClient() {
  const url = new URL(process.env.DATABASE_URL ?? "mysql://root:@localhost:3306/oficina_db")
  return new PrismaClient({
    adapter: new PrismaMariaDb({
      host: url.hostname,
      port: parseInt(url.port) || 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      connectionLimit: 5,
      acquireTimeout: 30000,
      idleTimeout: 60000,
      connectTimeout: 30000,
    } as any),
  })
}

export const prisma = globalForPrisma.prisma ?? getPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
