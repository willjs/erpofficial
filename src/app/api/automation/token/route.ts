import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { signAutomationToken } from "@/lib/automation-auth"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { codigo, token } = body

    if (!codigo || !token) {
      return NextResponse.json(
        { success: false, error: "codigo y token son requeridos" },
        { status: 400 }
      )
    }

    const automatizacion = await prisma.automatizacion.findFirst({
      where: { codigo, token, activo: true },
      select: { id: true, empresaId: true, codigo: true },
    })

    if (!automatizacion) {
      return NextResponse.json(
        { success: false, error: "Automatización no encontrada o inactiva" },
        { status: 401 }
      )
    }

    const jwt = await signAutomationToken(automatizacion.empresaId)

    return NextResponse.json({
      success: true,
      token: jwt,
      empresaId: automatizacion.empresaId,
      expires_in: "24h",
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Error interno" },
      { status: 500 }
    )
  }
}
