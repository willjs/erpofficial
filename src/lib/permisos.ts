import { prisma } from "./prisma"

export type PermisoRequerido = {
  recurso: string
  accion: "CREATE" | "READ" | "UPDATE" | "DELETE" | "ALL"
}

export async function usuarioTienePermiso(
  usuarioId: string,
  permiso: PermisoRequerido
): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: {
      roles: {
        include: {
          rol: {
            include: {
              permisos: {
                include: {
                  permiso: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!usuario) return false

  // Super admin tiene todos los permisos
  if (usuario.superAdmin) return true

  for (const ur of usuario.roles) {
    for (const rp of ur.rol.permisos) {
      if (
        rp.permiso.recurso === permiso.recurso &&
        (rp.permiso.accion === "ALL" || rp.permiso.accion === permiso.accion)
      ) {
        return true
      }
    }
  }

  return false
}

export async function verificarPermiso(
  usuarioId: string,
  permiso: PermisoRequerido
): Promise<void> {
  const tiene = await usuarioTienePermiso(usuarioId, permiso)
  if (!tiene) {
    throw new Error(`Acceso denegado: no tienes permiso para ${permiso.accion} en ${permiso.recurso}`)
  }
}
