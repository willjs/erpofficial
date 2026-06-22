import type { Exportador, DatosAsiento, ConfigExportacion, ResultadoExportacion } from "./types"

export const zeusExportador: Exportador = {
  tipo: "ZEUS",

  async exportar(asiento: DatosAsiento, config: ConfigExportacion): Promise<ResultadoExportacion> {
    try {
      const formato = config.formato ?? "PLANO"

      if (formato === "JSON") {
        const json = JSON.stringify(
          {
            comprobante: {
              fecha: formatFecha(asiento.fecha),
              concepto: asiento.concepto,
              numero: asiento.numeroAsiento,
              evento: asiento.evento,
              detalles: asiento.lineas.map((l) => ({
                cuenta: l.cuentaCodigo,
                nombreCuenta: l.cuentaNombre,
                debe: l.debe,
                haber: l.haber,
                centroCostos: l.centroCostosCodigo ?? null,
                tercero: l.terceroId ?? null,
              })),
              totales: {
                debe: asiento.totalDebe,
                haber: asiento.totalHaber,
              },
            },
          },
          null,
          2
        )

        return { success: true, formato: "JSON", destino: "Zeus API", data: json }
      }

      const lines = asiento.lineas.map(
        (l) =>
          [
            padEnd(l.cuentaCodigo, 15),
            padEnd(asiento.concepto, 40),
            padStart(l.debe.toFixed(2), 14),
            padStart(l.haber.toFixed(2), 14),
            padEnd(l.centroCostosCodigo ?? "", 10),
            padEnd(l.terceroId ?? "", 12),
            formatFecha(asiento.fecha),
          ].join("|")
      )

      const header = [
        padEnd("COD_CUENTA", 15),
        padEnd("CONCEPTO", 40),
        padStart("DEBE", 14),
        padStart("HABER", 14),
        padEnd("CC_COSTO", 10),
        padEnd("TERCERO", 12),
        padEnd("FECHA", 10),
      ].join("|")

      const plano = [header, ...lines].join("\n")

      return { success: true, formato: "PLANO", destino: "Zeus", data: plano }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      return { success: false, formato: config.formato ?? "PLANO", destino: "Zeus", error: message }
    }
  },
}

function padEnd(s: string, len: number): string {
  return s.padEnd(len, " ")
}

function padStart(s: string, len: number): string {
  return s.padStart(len, " ")
}

function formatFecha(d: Date): string {
  return d.toISOString().split("T")[0]
}
