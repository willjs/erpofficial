import { PrismaClient } from "@prisma/client"
import { PrismaMariaDb } from "@prisma/adapter-mariadb"

function deepConvertDecimals(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== "object") return obj
  if ((obj as any).constructor?.name === "Decimal") {
    return (obj as any).toNumber()
  }
  // Pass non-plain, non-Decimal objects (Date, Buffer, etc.) through untouched
  if ((obj as any).constructor?.name !== "Object" && !Array.isArray(obj)) {
    return obj
  }
  if (Array.isArray(obj)) return obj.map(deepConvertDecimals)
  const plain: Record<string, unknown> = {}
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    plain[key] = deepConvertDecimals((obj as Record<string, unknown>)[key])
  }
  return plain
}

// globalForPrisma defined below
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

const globalForPrisma = global as unknown as { prisma2: ReturnType<typeof getPrismaClient> }
const basePrisma = globalForPrisma.prisma2 ?? getPrismaClient()
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma2 = basePrisma

function wrapModelCalls(model: any): any {
  return new Proxy(model, {
    get(target, methodName: string) {
      const method = target[methodName]
      if (typeof method === "function") {
        return async (...args: any[]) => {
          const result = await method.apply(target, args)
          return deepConvertDecimals(result)
        }
      }
      return method
    },
  })
}

const prisma = new Proxy(basePrisma, {
  get(target, prop: string | symbol) {
    const value = (target as any)[prop]
    if (typeof value === "object" && value !== null) {
      return wrapModelCalls(value)
    }
    return typeof value === "function" ? value.bind(target) : value
  },
})

export { prisma }