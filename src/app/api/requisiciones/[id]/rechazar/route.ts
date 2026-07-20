import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAutomationAuth } from "@/lib/automation-auth"

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAutomationAuth(req)
  if (auth.response) return auth.response

  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const requisicion = await prisma.requisicion.findFirst({
      where: { id, empresaId: auth.payload.empresaId },
    })

    if (!requisicion) {
      return NextResponse.json(
        { success: false, error: "Requisición no encontrada" },
        { status: 404 }
      )
    }

    if (requisicion.estado === "CERRADA") {
      return NextResponse.json(
        { success: false, error: "La requisición ya está cerrada" },
        { status: 400 }
      )
    }

    const estadoAnterior = requisicion.estado

    await prisma.requisicion.update({
      where: { id },
      data: { estado: "CERRADA" },
    })

    await prisma.historialEstado.create({
      data: {
        empresaId: auth.payload.empresaId,
        entidadTipo: "REQUISICION",
        entidadId: id,
        estadoAnterior,
        estadoNuevo: "CERRADA",
        descripcion: body.observacion || "Rechazada vía Power Automate",
      },
    })

    return NextResponse.json({
      success: true,
      message: "Requisición rechazada y cerrada",
      data: { id: requisicion.id, numero: requisicion.numero, estado: "CERRADA" },
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}
