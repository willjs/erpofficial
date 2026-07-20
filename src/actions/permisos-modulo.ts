"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"

export async function verificarAccesoModulo(modulo: string): Promise<{ permitido: boolean }> {
  try {
    const { userId, roles } = await verifySession()

    if (roles.includes("ADMIN")) {
      return { permitido: true }
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            rol: {
              include: {
                permisos: {
                  include: { permiso: true },
                },
              },
            },
          },
        },
      },
    })

    if (!usuario) return { permitido: false }
    if (usuario.superAdmin) return { permitido: true }

    for (const ur of usuario.roles) {
      for (const rp of ur.rol.permisos) {
        if (rp.permiso.modulo === modulo) {
          return { permitido: true }
        }
      }
    }

    return { permitido: false }
  } catch {
    return { permitido: false }
  }
}

export async function verificarPermisoSilenciosoAction(
  recurso: string,
  accion: string
): Promise<{ tienePermiso: boolean }> {
  try {
    const { userId } = await verifySession()

    const usuario = await prisma.usuario.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            rol: {
              include: {
                permisos: {
                  include: { permiso: true },
                },
              },
            },
          },
        },
      },
    })

    if (!usuario) return { tienePermiso: false }
    if (usuario.superAdmin) return { tienePermiso: true }
    if (usuario.roles.some((ur) => ur.rol.nombre === "ADMIN")) return { tienePermiso: true }

    for (const ur of usuario.roles) {
      for (const rp of ur.rol.permisos) {
        if (
          rp.permiso.recurso === recurso &&
          (rp.permiso.accion === "ALL" || rp.permiso.accion === accion)
        ) {
          return { tienePermiso: true }
        }
      }
    }

    return { tienePermiso: false }
  } catch {
    return { tienePermiso: false }
  }
}
