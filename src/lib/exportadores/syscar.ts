import type { Exportador, DatosAsiento, ConfigExportacion, ResultadoExportacion } from "./types"

export const syscarExportador: Exportador = {
  tipo: "SYSCAR",

  async exportar(asiento: DatosAsiento, config: ConfigExportacion): Promise<ResultadoExportacion> {
    try {
      const formato = config.formato ?? "CSV"

      if (formato === "XML") {
        const lineasXml = asiento.lineas
          .map(
            (l) => `    <Detalle>
      <Cuenta>${l.cuentaCodigo}</Cuenta>
      <Debe>${l.debe.toFixed(2)}</Debe>
      <Haber>${l.haber.toFixed(2)}</Haber>
      <CentroCostos>${l.centroCostosCodigo ?? ""}</CentroCostos>
      <Tercero>${l.terceroId ?? ""}</Tercero>
    </Detalle>`
          )
          .join("\n")

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<ComprobanteSyscar>
  <Fecha>${formatFecha(asiento.fecha)}</Fecha>
  <Concepto>${escCsv(asiento.concepto)}</Concepto>
  <Numero>${asiento.numeroAsiento}</Numero>
  <Detalles>
${lineasXml}
  </Detalles>
</ComprobanteSyscar>`

        return { success: true, formato: "XML", destino: "Syscar", data: xml }
      }

      const header = "Cuenta;Debe;Haber;CentroCostos;Tercero;Concepto"
      const rows = asiento.lineas
        .map(
          (l) =>
            `${l.cuentaCodigo};${l.debe.toFixed(2)};${l.haber.toFixed(2)};${l.centroCostosCodigo ?? ""};${l.terceroId ?? ""};${escCsv(l.descripcion ?? asiento.concepto)}`
        )
        .join("\n")
      const csv = `${header}\n${rows}`

      return { success: true, formato: "CSV", destino: "Syscar", data: csv }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      return { success: false, formato: "CSV", destino: "Syscar", error: message }
    }
  },
}

function escCsv(s: string): string {
  return `"${s.replace(/"/g, '""')}"`
}

function formatFecha(d: Date): string {
  return d.toISOString().split("T")[0]
}
