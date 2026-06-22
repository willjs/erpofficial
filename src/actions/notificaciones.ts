"use server"

import "server-only"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/dal"
import type { TipoPermisoAcceso } from "@prisma/client"

export async function notificarPorPermiso(params: {
  empresaId: string
  tipo: string
  titulo: string
  mensaje: string
  referenciaId?: string | null
  referenciaTipo?: string | null
  recurso: string
  accion: TipoPermisoAcceso
  excluirUsuarioId?: string
}) {
  try {
    const usuarios = await prisma.usuario.findMany({
      where: {
        empresaId: params.empresaId,
        id: params.excluirUsuarioId ? { not: params.excluirUsuarioId } : undefined,
        OR: [
          { superAdmin: true },
          {
            roles: {
              some: {
                rol: {
                  permisos: {
                    some: {
                      permiso: {
                        recurso: params.recurso,
                        accion: { in: [params.accion, "ALL"] },
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    })

    if (usuarios.length === 0) return { count: 0, error: null }

    const result = await prisma.notificacion.createMany({
      data: usuarios.map((u) => ({
        empresaId: params.empresaId,
        usuarioId: u.id,
        tipo: params.tipo,
        titulo: params.titulo,
        mensaje: params.mensaje,
        referenciaId: params.referenciaId ?? null,
        referenciaTipo: params.referenciaTipo ?? null,
      })),
    })

    return { count: result.count, error: null }
  } catch {
    return { count: 0, error: "Error al enviar notificaciones" }
  }
}

export async function getNotificaciones() {
  try {
    const { empresaId, userId, roles } = await getCurrentUser()
    const notifs = await prisma.notificacion.findMany({
      where: {
        empresaId,
        OR: [
          { usuarioId: userId },
          { usuarioId: null },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    return { data: notifs, error: null }
  } catch {
    return { data: null, error: "Error al cargar notificaciones" }
  }
}

export async function getNotificacionesNoLeidas() {
  try {
    const { empresaId, userId } = await getCurrentUser()
    const count = await prisma.notificacion.count({
      where: {
        empresaId,
        leida: false,
        OR: [
          { usuarioId: userId },
          { usuarioId: null },
        ],
      },
    })
    return { count, error: null }
  } catch {
    return { count: 0, error: "Error al contar notificaciones" }
  }
}

export async function marcarLeida(id: string) {
  try {
    const { empresaId } = await getCurrentUser()
    const notif = await prisma.notificacion.findFirst({
      where: { id, empresaId },
      select: { id: true },
    })
    if (!notif) {
      return { error: "Notificación no encontrada" }
    }
    await prisma.notificacion.update({
      where: { id },
      data: { leida: true },
    })
    return { error: null }
  } catch {
    return { error: "Error al marcar como leída" }
  }
}

export async function marcarTodasLeidas() {
  try {
    const { empresaId, userId } = await getCurrentUser()
    await prisma.notificacion.updateMany({
      where: {
        empresaId,
        leida: false,
        OR: [
          { usuarioId: userId },
          { usuarioId: null },
        ],
      },
      data: { leida: true },
    })
    return { error: null }
  } catch {
    return { error: "Error al marcar como leídas" }
  }
}
