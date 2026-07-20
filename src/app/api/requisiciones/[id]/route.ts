import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAutomationAuth } from "@/lib/automation-auth"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAutomationAuth(req)
  if (auth.response) return auth.response

  try {
    const { id } = await params
    const requisicion = await prisma.requisicion.findFirst({
      where: { id, empresaId: auth.payload.empresaId },
      include: {
        items: true,
        cotizaciones: {
          select: { id: true, numero: true, valorTotal: true, ganadora: true, fecha: true },
          orderBy: { createdAt: "desc" },
        },
        ordenesCompra: {
          select: { id: true, numero: true, estado: true, fecha: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!requisicion) {
      return NextResponse.json(
        { success: false, error: "Requisición no encontrada" },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: requisicion })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}
