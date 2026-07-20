import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const protectedRoutes = [
  "/",
  "/admin",
  "/clientes",
  "/compras",
  "/configuracion",
  "/contabilidad",
  "/cuentas-cobrar",
  "/despachos",
  "/documentos",
  "/empleados",
  "/inventario",
  "/inventarios",
  "/nomina",
  "/operaciones",
  "/pedidos",
  "/perfil",
  "/permisos",
  "/presupuestos",
  "/reportes",
  "/servicios",
  "/tareas",
  "/tesoreria",
  "/traspasos",
  "/ventas",
]

const publicRoutes = ["/login", "/solicitar-requisicion", "/solicitar-pedido", "/delivery"]

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = protectedRoutes.some((route) => path.startsWith(route))
  const isPublic = publicRoutes.some((route) => path.startsWith(route))

  if (!isProtected && !isPublic) return NextResponse.next()

  const session = await auth()

  if (isProtected && !session?.user) {
    const loginUrl = new URL("/login", req.nextUrl)
    loginUrl.searchParams.set("callbackUrl", path)
    return NextResponse.redirect(loginUrl)
  }

  if (isPublic && session?.user && path === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|_nextjs_font|favicon.ico).*)"],
}
