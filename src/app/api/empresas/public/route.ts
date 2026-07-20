import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const empresas = await prisma.empresa.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, logo: true },
    orderBy: { nombre: "asc" },
  })
  return NextResponse.json(empresas)
}
