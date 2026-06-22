import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { empresaId, apiKey } = body

    if (!empresaId) {
      return NextResponse.json({ error: "empresaId requerido" }, { status: 400 })
    }

    const empresa = await prisma.empresa.findUnique({
      where: { id: empresaId },
      include: { tipoContabilidadConfig: true },
    })

    if (!empresa) {
      return NextResponse.json({ error: "Empresa no encontrada" }, { status: 404 })
    }

    const config = empresa.tipoContabilidadConfig
    if (config?.config && typeof config.config === "object") {
      const cfg = config.config as Record<string, unknown>
      if (cfg.apiKey && cfg.apiKey !== apiKey) {
        return NextResponse.json({ error: "API key inválida" }, { status: 401 })
      }
    }

    const { asiento } = body
    if (!asiento || !asiento.detalles || asiento.detalles.length === 0) {
      return NextResponse.json({ error: "asiento.detalles requerido" }, { status: 400 })
    }

    const numero = await getNextNumero(empresaId)

    const created = await prisma.asientoContable.create({
      data: {
        empresaId,
        numero,
        fecha: asiento.fecha ? new Date(asiento.fecha) : new Date(),
        concepto: asiento.concepto ?? "Importado vía API",
        tipo: "TRASPASO",
        estado: "CONTABILIZADO",
        detalles: {
          create: asiento.detalles.map((d: any) => ({
            planCuentaId: d.planCuentaId,
            debe: d.debe ?? 0,
            haber: d.haber ?? 0,
            descripcion: d.descripcion ?? null,
          })),
        },
      },
      include: {
        detalles: {
          include: {
            planCuenta: { select: { id: true, codigo: true, nombre: true } },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      asientoId: created.id,
      numero: created.numero,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function getNextNumero(empresaId: string): Promise<number> {
  const last = await prisma.asientoContable.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (last?.numero ?? 0) + 1
}
