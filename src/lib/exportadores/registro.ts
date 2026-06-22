import type { Exportador } from "./types"
import { wordOfficeExportador } from "./word-office"
import { syscarExportador } from "./syscar"
import { zeusExportador } from "./zeus"
import { genericApiExportador } from "./generic-api"

const exportadores: Exportador[] = [
  wordOfficeExportador,
  syscarExportador,
  zeusExportador,
  genericApiExportador,
]

const mapa = new Map(exportadores.map((e) => [e.tipo, e]))

export function getExportador(tipo: string): Exportador | undefined {
  return mapa.get(tipo as any)
}

export function getExportadoresDisponibles(): { tipo: string; nombre: string }[] {
  return [
    { tipo: "WORD_OFFICE", nombre: "Word Office" },
    { tipo: "SYSCAR", nombre: "Syscar" },
    { tipo: "ZEUS", nombre: "Zeus" },
    { tipo: "OTRO", nombre: "API Genérica / Otro" },
  ]
}
