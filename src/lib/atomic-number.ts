import { prisma } from "./prisma"

const MAX_RETRIES = 5

export async function getSiguienteNumero(
  model: string,
  empresaId: string
): Promise<number> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const last = await (prisma as any)[model].findFirst({
        where: { empresaId },
        orderBy: { numero: "desc" },
        select: { numero: true },
      })
      return (last?.numero ?? 0) + 1
    } catch {
      if (attempt === MAX_RETRIES - 1) throw new Error(`No se pudo generar número para ${model}`)
    }
  }
  throw new Error(`No se pudo generar número para ${model}`)
}
