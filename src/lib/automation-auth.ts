import { SignJWT, jwtVerify } from "jose"
import { NextRequest, NextResponse } from "next/server"

const SECRET = new TextEncoder().encode(
  process.env.AUTOMATION_JWT_SECRET || "fuelcore-automation-secret-key-change-in-production"
)

const EXPIRATION = "24h"

export interface AutomationPayload {
  empresaId: string
  tipo: "automation"
}

export async function signAutomationToken(empresaId: string): Promise<string> {
  return new SignJWT({ empresaId, tipo: "automation" } satisfies AutomationPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRATION)
    .sign(SECRET)
}

export async function verifyAutomationToken(
  token: string
): Promise<AutomationPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    if (payload.tipo !== "automation") return null
    return { empresaId: payload.empresaId as string, tipo: "automation" }
  } catch {
    return null
  }
}

export async function requireAutomationAuth(
  req: NextRequest
): Promise<{ payload: AutomationPayload; response?: NextResponse }> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      payload: { empresaId: "", tipo: "automation" },
      response: NextResponse.json(
        { success: false, error: "Token de autorización requerido" },
        { status: 401 }
      ),
    }
  }

  const token = authHeader.slice(7)
  const payload = await verifyAutomationToken(token)
  if (!payload) {
    return {
      payload: { empresaId: "", tipo: "automation" },
      response: NextResponse.json(
        { success: false, error: "Token inválido o expirado" },
        { status: 401 }
      ),
    }
  }

  return { payload }
}
