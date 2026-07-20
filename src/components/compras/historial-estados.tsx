"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/utils"
import {
  DollarSign, FileText, Package, CheckCircle, XCircle,
  Clock, Send, Ban, CircleDot,
} from "lucide-react"

type HistorialEntry = {
  id: string
  entidadTipo: string
  entidadId: string
  estadoAnterior: string | null
  estadoNuevo: string
  descripcion: string | null
  usuarioId: string | null
  referenciaId: string | null
  createdAt: string
  usuario: { nombre: string; email: string } | null
}

const ENUM_ESTILOS: Record<string, { color: string; bg: string; icon: any; label: string }> = {
  BORRADOR:              { color: "text-gray-500", bg: "bg-gray-100", icon: Clock, label: "Borrador" },
  EN_COTIZACION:         { color: "text-blue-600", bg: "bg-blue-100", icon: DollarSign, label: "En Cotización" },
  ORDEN_COMPRA_GENERADA: { color: "text-purple-600", bg: "bg-purple-100", icon: FileText, label: "OC Generada" },
  CERRADA:               { color: "text-gray-600", bg: "bg-gray-100", icon: Ban, label: "Cerrada" },
  EMITIDA:               { color: "text-purple-600", bg: "bg-purple-100", icon: FileText, label: "Emitida" },
  FACTURADA:             { color: "text-orange-600", bg: "bg-orange-100", icon: FileText, label: "Facturada" },
  PENDIENTE:             { color: "text-amber-600", bg: "bg-amber-100", icon: Clock, label: "Pendiente" },
  PAGADA:                { color: "text-emerald-600", bg: "bg-emerald-100", icon: CheckCircle, label: "Pagada" },
  REGISTRADA:            { color: "text-blue-600", bg: "bg-blue-100", icon: CircleDot, label: "Registrada" },
  SELECCIONADA:          { color: "text-green-600", bg: "bg-green-100", icon: CheckCircle, label: "Seleccionada" },
  PARCIAL:               { color: "text-blue-600", bg: "bg-blue-100", icon: Package, label: "Parcial" },
  COMPLETA:              { color: "text-green-600", bg: "bg-green-100", icon: Package, label: "Completa" },
  ENVIADA_TESORERIA:     { color: "text-indigo-600", bg: "bg-indigo-100", icon: Send, label: "En Tesorería" },
}

const ENTIDAD_COLORS: Record<string, string> = {
  REQUISICION: "border-l-blue-500",
  COTIZACION: "border-l-amber-500",
  ORDEN_COMPRA: "border-l-purple-500",
  RECEPCION: "border-l-green-500",
  CUENTA_PAGAR: "border-l-orange-500",
  PAGO: "border-l-emerald-500",
}

function EstadoBadge({ estado }: { estado: string }) {
  const estilo = ENUM_ESTILOS[estado]
  if (!estilo) return <Badge variant="outline">{estado}</Badge>
  const Icon = estilo.icon
  return (
    <Badge variant="outline" className={`gap-1 ${estilo.color} ${estilo.bg} border-0`}>
      <Icon className="h-3 w-3" />
      {estilo.label}
    </Badge>
  )
}

export default function HistorialEstados({ entidadTipo, entidadId }: { entidadTipo: string; entidadId: string }) {
  const [entries, setEntries] = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!entidadId) return
    let mounted = true

    fetch(`/api/historial?entidadTipo=${encodeURIComponent(entidadTipo)}&entidadId=${encodeURIComponent(entidadId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (mounted) {
          setEntries(data as HistorialEntry[])
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error("Error cargando historial:", err)
        if (mounted) {
          setError(err?.message || "Error al cargar historial")
          setLoading(false)
        }
      })

    return () => { mounted = false }
  }, [entidadTipo, entidadId])

  if (loading) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Cargando historial...</div>
  }

  if (error) {
    return <div className="text-sm text-destructive py-4 text-center">Error: {error}</div>
  }

  if (entries.length === 0) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Sin historial disponible</div>
  }

  const borderColor = ENTIDAD_COLORS[entidadTipo] ?? "border-l-gray-400"

  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        Historial de estados
      </h4>
      <div className={`space-y-0 border-l-2 ${borderColor} ml-2`}>
        {entries.map((entry) => {
          const estiloAnt = entry.estadoAnterior ? ENUM_ESTILOS[entry.estadoAnterior] : null
          const estiloNue = ENUM_ESTILOS[entry.estadoNuevo]
          return (
            <div key={entry.id} className="relative pl-6 pb-4 last:pb-0">
              <div className={`absolute left-[-9px] top-1 w-4 h-4 rounded-full border-2 border-white ${estiloNue?.bg ?? "bg-gray-100"}`} />
              <div className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</div>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {entry.estadoAnterior && estiloAnt && (
                  <>
                    <EstadoBadge estado={entry.estadoAnterior} />
                    <span className="text-muted-foreground text-sm">→</span>
                  </>
                )}
                <EstadoBadge estado={entry.estadoNuevo} />
              </div>
              {entry.descripcion && (
                <p className="text-sm mt-0.5">{entry.descripcion}</p>
              )}
              {entry.usuario && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  por {entry.usuario.nombre}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
