import type { Exportador, DatosAsiento, ConfigExportacion, ResultadoExportacion } from "./types"

export const wordOfficeExportador: Exportador = {
  tipo: "WORD_OFFICE",

  async exportar(asiento: DatosAsiento, _: ConfigExportacion): Promise<ResultadoExportacion> {
    try {
      const lineasXml = asiento.lineas
        .map(
          (l) => `    <Movimiento>
      <Cuenta>${l.cuentaCodigo}</Cuenta>
      <NombreCuenta>${escXml(l.cuentaNombre)}</NombreCuenta>
      <Tercero>${l.terceroId ?? ""}</Tercero>
      <NombreTercero>${escXml(l.terceroNombre ?? "")}</NombreTercero>
      <CentroCosto>${l.centroCostosCodigo ?? ""}</CentroCosto>
      <Debe>${l.debe.toFixed(2)}</Debe>
      <Haber>${l.haber.toFixed(2)}</Haber>
      <Descripcion>${escXml(l.descripcion ?? asiento.concepto)}</Descripcion>
    </Movimiento>`
        )
        .join("\n")

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AsientoContable>
  <Cabecera>
    <Empresa>${escXml(asiento.empresaNombre)}</Empresa>
    <Fecha>${formatFecha(asiento.fecha)}</Fecha>
    <Concepto>${escXml(asiento.concepto)}</Concepto>
    <Numero>${asiento.numeroAsiento}</Numero>
    <Evento>${asiento.evento}</Evento>
  </Cabecera>
  <Movimientos>
${lineasXml}
  </Movimientos>
  <Totales>
    <TotalDebe>${asiento.totalDebe.toFixed(2)}</TotalDebe>
    <TotalHaber>${asiento.totalHaber.toFixed(2)}</TotalHaber>
  </Totales>
</AsientoContable>`

      return {
        success: true,
        formato: "XML",
        destino: "Word Office",
        data: xml,
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido"
      return { success: false, formato: "XML", destino: "Word Office", error: message }
    }
  },
}

function escXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function formatFecha(d: Date): string {
  return d.toISOString().split("T")[0]
}
