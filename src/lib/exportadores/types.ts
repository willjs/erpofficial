export type EventoContable =
  | "FACTURA_PROVEEDOR"
  | "PAGO_PROVEEDOR"
  | "RECEPCION_OC"
  | "EGRESO"
  | "NOTA_DEBITO"
  | "NOTA_CREDITO"
  | "FACTURA_CLIENTE"

export type TipoExportacion = "WORD_OFFICE" | "SYSCAR" | "ZEUS" | "OTRO"

export interface LineaAsiento {
  cuentaCodigo: string
  cuentaNombre: string
  debe: number
  haber: number
  centroCostosCodigo?: string
  centroCostosNombre?: string
  terceroId?: string
  terceroNombre?: string
  descripcion?: string
}

export interface DatosAsiento {
  empresaId: string
  empresaNombre: string
  evento: EventoContable
  fecha: Date
  concepto: string
  numeroAsiento: number
  lineas: LineaAsiento[]
  totalDebe: number
  totalHaber: number
}

export interface ConfigExportacion {
  apiUrl?: string
  token?: string
  formato?: "XML" | "CSV" | "JSON" | "PLANO"
  endpoint?: string
  [key: string]: unknown
}

export interface ResultadoExportacion {
  success: boolean
  formato: string
  destino: string
  data?: string
  error?: string
}

export interface Exportador {
  tipo: TipoExportacion
  exportar(asiento: DatosAsiento, config: ConfigExportacion): Promise<ResultadoExportacion>
}
