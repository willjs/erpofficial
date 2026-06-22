import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"

export async function GET(request: NextRequest) {
  try {
    const { empresaId } = await verifySession()

    const { searchParams } = new URL(request.url)
    const entidadTipo = searchParams.get("entidadTipo")
    const entidadId = searchParams.get("entidadId")

    if (!entidadTipo || !entidadId) {
      return NextResponse.json({ error: "entidadTipo y entidadId son requeridos" }, { status: 400 })
    }

    const data = await prisma.historialEstado.findMany({
      where: { empresaId, entidadTipo, entidadId },
      include: { usuario: { select: { nombre: true, email: true } } },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(
      data.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error("Error en GET /api/historial:", error)
    return NextResponse.json({ error: "Error interno" }, { status: 500 })
  }
}
