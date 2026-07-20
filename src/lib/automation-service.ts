import { prisma } from "./prisma"

interface EjecutarEventoParams {
  empresaId: string
  codigoEvento: string
  entidadTipo: string
  entidadId: string
  usuarioId?: string
}

/**
 * Servicio central de automatizaciones.
 * Envía eventos a Power Automate de forma fire-and-forget.
 * Nunca lanza errores — los registra en auditoría.
 */
export class AutomationService {
  static async ejecutarEvento(params: EjecutarEventoParams): Promise<void> {
    const { empresaId, codigoEvento, entidadTipo, entidadId, usuarioId } = params

    try {
      const automatizacion = await prisma.automatizacion.findFirst({
        where: {
          empresaId,
          codigo: codigoEvento,
          activo: true,
        },
      })

      if (!automatizacion) return
      if (!automatizacion.urlPowerAutomate) return

      const payload = {
        idDocumento: entidadId,
        evento: codigoEvento,
      }

      const inicio = Date.now()
      let respuestaHTTP: number | null = null
      let mensajeError: string | null = null

      try {
        const response = await fetch(automatizacion.urlPowerAutomate, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${automatizacion.token}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30000),
        })

        respuestaHTTP = response.status
        if (!response.ok) {
          mensajeError = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (fetchError: any) {
        mensajeError = fetchError?.message || "Error de conexión"
      }

      const tiempoMs = Date.now() - inicio

      await prisma.automatizacionAuditoria.create({
        data: {
          empresaId,
          automatizacionId: automatizacion.id,
          codigoEvento,
          entidadTipo,
          entidadId,
          usuarioId: usuarioId || null,
          respuestaHTTP,
          tiempoEjecucionMs: tiempoMs,
          mensajeError,
          payloadEnviado: payload,
        },
      })
    } catch (error: any) {
      console.error(`[AutomationService] Error ejecutando evento ${codigoEvento}:`, error?.message)
    }
  }
}
