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
        empresa: { select: { nombre: true, rfc: true, direccion: true, telefono: true, email: true } },
      },
    })

    if (!requisicion) {
      return NextResponse.json(
        { success: false, error: "Requisición no encontrada" },
        { status: 404 }
      )
    }

    const pdfData = {
      tipo: "REQUISICION",
      numero: requisicion.numero,
      fecha: requisicion.fecha,
      estado: requisicion.estado,
      prioridad: requisicion.prioridad,
      areaSolicitante: requisicion.areaSolicitante,
      requeridoPor: requisicion.requeridoPor,
      autorizadoPor: requisicion.autorizadoPor,
      destino: requisicion.destino,
      observaciones: requisicion.observaciones,
      empresa: requisicion.empresa,
      items: requisicion.items.map((item) => ({
        item: item.item,
        descripcion: item.descripcion,
        unidadMedida: item.unidadMedida,
        cantidadSolicitada: item.cantidadSolicitada,
      })),
    }

    return NextResponse.json({ success: true, data: pdfData })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}
