import type { Exportador, DatosAsiento, ConfigExportacion, ResultadoExportacion } from "./types"

export const genericApiExportador: Exportador = {
  tipo: "OTRO",

  async exportar(asiento: DatosAsiento, config: ConfigExportacion): Promise<ResultadoExportacion> {
    try {
      const body = JSON.stringify({
        empresaId: asiento.empresaId,
        empresaNombre: asiento.empresaNombre,
        evento: asiento.evento,
        asiento: {
          fecha: asiento.fecha.toISOString(),
          concepto: asiento.concepto,
          numero: asiento.numeroAsiento,
          detalles: asiento.lineas.map((l) => ({
            cuenta: l.cuentaCodigo,
            nombreCuenta: l.cuentaNombre,
            debe: l.debe,
            haber: l.haber,
            centroCostos: l.centroCostosCodigo ?? null,
            centroCostosNombre: l.centroCostosNombre ?? null,
            terceroId: l.terceroId ?? null,
            terceroNombre: l.terceroNombre ?? null,
            descripcion: l.descripcion ?? null,
          })),
          totalDebe: asiento.totalDebe,
          totalHaber: asiento.totalHaber,
        },
      })

      if (config.apiUrl) {
        try {
          const res = await fetch(config.apiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: config.token ? `Bearer ${config.token}` : "",
            },
            body,
          })

          if (!res.ok) {
            return {
              success: false,
              formato: "REST",
              destino: config.apiUrl,
              data: body,
              error: `HTTP ${res.status}: ${await res.text()}`,
            }
          }

          return {
            success: true,
            formato: "REST",
            destino: config.apiUrl,
            data: body,
          }
        } catch (err: any) {
          return {
            success: false,
            formato: "REST",
            destino: config.apiUrl,
            data: body,
            error: err.message,
          }
        }
      }

      return {
        success: true,
        formato: "JSON",
        destino: "API Genérica",
        data: body,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      return { success: false, formato: "JSON", destino: "API Genérica", error: message }
    }
  },
}
