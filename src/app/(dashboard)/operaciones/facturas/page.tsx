"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { getFacturasDeliveryTicketAll, pagarFacturaDeliveryTicket } from "@/actions/operaciones-delivery"
import { useToast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FileText, ExternalLink, Eye, DollarSign } from "lucide-react"
import { formatMoney, formatDate } from "@/lib/utils"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const ESTADO_STYLES: Record<string, "secondary" | "success" | "destructive"> = {
  PENDIENTE: "secondary",
  PAGADA: "success",
  CANCELADA: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  CANCELADA: "Cancelada",
}

export default function FacturasDeliveryPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [pagarOpen, setPagarOpen] = useState(false)
  const [selectedPagar, setSelectedPagar] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [comprobante, setComprobante] = useState<{ nombre: string; base64: string } | null>(null)
  const [comprobanteNombre, setComprobanteNombre] = useState("")
  const comprobanteRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFacturasDeliveryTicketAll()
      setItems(data)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openDetail(r: any) {
    setSelectedDetail(r)
    setDetailOpen(true)
  }

  function openPagar(r: any) {
    setSelectedPagar(r)
    setComprobante(null)
    setComprobanteNombre("")
    setPagarOpen(true)
  }

  async function handlePagar() {
    if (!selectedPagar) return
    setSubmitting(true)
    try {
      await pagarFacturaDeliveryTicket(selectedPagar.id, { comprobanteFile: comprobante })
      toast({ title: "Factura pagada", description: "Factura Delivery Ticket marcada como PAGADA", variant: "success" })
      setPagarOpen(false)
      setSelectedPagar(null)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setComprobanteNombre(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1]
      setComprobante({ nombre: file.name, base64 })
    }
    reader.readAsDataURL(file)
  }

  const dt = (r: any) => r.deliveryTicket ?? {}

  const columns: Column<any>[] = [
    { key: "dt", header: "DT #", render: (r) => `DT #${dt(r).numero ?? "-"}` },
    { key: "cliente", header: "Cliente", render: (r) => dt(r).cliente?.nombre ?? "-" },
    { key: "motonave", header: "Motonave", render: (r) => dt(r).motonave ?? "-" },
    { key: "factura", header: "Factura", render: (r) => r.numeroFactura || "-" },
    { key: "valor", header: "Valor", render: (r) => formatMoney(Number(r.valor)) },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={ESTADO_STYLES[r.estado] ?? "secondary"}>{ESTADO_LABELS[r.estado] ?? r.estado}</Badge> },
    { key: "documentos", header: "Docs", render: (r) => (
      <div className="flex gap-2">
        {r.documentoUrl && (
          <Link href={r.documentoUrl} target="_blank">
            <Button variant="ghost" size="icon" title="Documento"><FileText className="h-4 w-4" /></Button>
          </Link>
        )}
        {r.comprobanteUrl && (
          <Link href={r.comprobanteUrl} target="_blank">
            <Button variant="ghost" size="icon" title="Comprobante"><ExternalLink className="h-4 w-4" /></Button>
          </Link>
        )}
      </div>
    )},
    { key: "acciones", header: "", render: (r) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openDetail(r)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
        {r.estado === "PENDIENTE" && (
          <Button variant="ghost" size="icon" onClick={() => openPagar(r)} title="Marcar pagada"><DollarSign className="h-4 w-4 text-green-600" /></Button>
        )}
      </div>
    )},
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturas Delivery Tickets"
        description="Facturas generadas desde Delivery Tickets"
      />

      <DataTable columns={columns} data={items} loading={loading} searchable />

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Factura Delivery Ticket - {selectedDetail?.deliveryTicket?.cliente?.nombre}</DialogTitle>
            <DialogDescription />
            {selectedDetail?.estado && (
              <div className="px-6 pb-2">
                <Badge variant={ESTADO_STYLES[selectedDetail.estado] ?? "secondary"}>{ESTADO_LABELS[selectedDetail.estado] ?? selectedDetail.estado}</Badge>
              </div>
            )}
          </DialogHeader>
          {selectedDetail && (() => {
            const d = selectedDetail.deliveryTicket ?? {}
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><strong>DT #:</strong> {d.numero ? `DT #${d.numero}` : "-"}</div>
                  <div><strong>Fecha DT:</strong> {d.fecha ? formatDate(d.fecha) : "-"}</div>
                  <div><strong>Cliente:</strong> {d.cliente?.nombre ?? "-"}</div>
                  <div><strong>RFC:</strong> {d.cliente?.rfc ?? "-"}</div>
                  <div><strong>Motonave:</strong> {d.motonave ?? "-"}</div>
                  <div><strong>IMO:</strong> {d.imo ?? "-"}</div>
                  <div><strong>Bandera:</strong> {d.bandera ?? "-"}</div>
                  <div><strong>Puerto:</strong> {d.puerto ?? "-"}</div>
                  <div><strong>Lugar Suministro:</strong> {d.lugarSuministro ?? "-"}</div>
                  <div><strong>Tipo Suministro:</strong> {d.tipoSuministro ?? "-"}</div>
                  <div><strong>Dirección:</strong> {d.direccion ?? "-"}</div>
                  <div><strong>Ciudad:</strong> {d.ciudad ?? "-"}</div>
                  <div><strong>Producto:</strong> {d.producto?.nombre ?? "-"}</div>
                  <div><strong>Cantidad Entregada:</strong> {d.cantidadEntregada != null ? `${d.cantidadEntregada} ${d.unidadMedida ?? ""}` : "-"}</div>
                  <div><strong>Agente:</strong> {d.agente ?? "-"}</div>
                </div>

                <div className="border-t pt-4 grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Factura #:</strong> {selectedDetail.numeroFactura || "-"}</div>
                  <div><strong>Valor:</strong> {formatMoney(Number(selectedDetail.valor))}</div>
                </div>

                {selectedDetail.observaciones && (
                  <div className="text-sm border-t pt-4">
                    <strong>Observaciones:</strong>
                    <p className="text-muted-foreground mt-1">{selectedDetail.observaciones}</p>
                  </div>
                )}

                <div className="text-sm border-t pt-4">
                  <strong>Documentos:</strong>
                  <div className="flex gap-4 mt-1">
                    {selectedDetail.documentoUrl ? (
                      <Link href={selectedDetail.documentoUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                        <FileText className="h-4 w-4" /> Ver factura
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">Sin documento</span>
                    )}
                    {selectedDetail.comprobanteUrl && (
                      <Link href={selectedDetail.comprobanteUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                        <FileText className="h-4 w-4" /> Ver comprobante
                      </Link>
                    )}
                  </div>
                </div>

                {/* Calidad */}
                {(d.api || d.gravedadEspecifica || d.densidad || d.viscosidad || d.azufre || d.agua || d.puntoChispa || d.temperatura) && (
                  <div className="text-sm border-t pt-4">
                    <strong>Calidad del Producto:</strong>
                    <div className="grid grid-cols-4 gap-2 mt-1 text-muted-foreground">
                      {d.api && <div>API: {d.api}</div>}
                      {d.gravedadEspecifica && <div>GE: {d.gravedadEspecifica}</div>}
                      {d.densidad && <div>Densidad: {d.densidad}</div>}
                      {d.viscosidad && <div>Viscosidad: {d.viscosidad}</div>}
                      {d.azufre && <div>Azufre: {d.azufre}</div>}
                      {d.agua && <div>Agua: {d.agua}</div>}
                      {d.puntoChispa && <div>P. Chispa: {d.puntoChispa}</div>}
                      {d.temperatura && <div>Temp: {d.temperatura}</div>}
                    </div>
                    {d.otrasPropiedades && <p className="text-muted-foreground mt-1">{d.otrasPropiedades}</p>}
                  </div>
                )}

                {/* Sondeos */}
                {d.sondajeAntes && (
                  <div className="text-sm border-t pt-4">
                    <strong>Sondeos:</strong>
                    <div className="grid grid-cols-3 gap-2 mt-1 text-muted-foreground">
                      <div>Antes: {d.sondajeAntes} {d.sondajeAntesRealizado ? `(${d.sondajeAntesRealizado})` : ""}</div>
                      <div>Después: {d.sondajeDespues ?? "-"} {d.sondajeDespuesRealizado ? `(${d.sondajeDespuesRealizado})` : ""}</div>
                      <div>Testificado: {d.sondajeTestificado ?? "-"}</div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <Link href={`/operaciones/delivery/${selectedDetail.deliveryTicketId}`}>
                    <Button variant="outline" size="sm"><ExternalLink className="h-4 w-4 mr-1" /> Ver Delivery Ticket</Button>
                  </Link>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* Pagar Dialog */}
      <Dialog open={pagarOpen} onOpenChange={setPagarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar Factura como Pagada</DialogTitle>
            <DialogDescription>
              Confirma el pago de la factura de {selectedPagar?.deliveryTicket?.cliente?.nombre} por {selectedPagar ? formatMoney(Number(selectedPagar.valor)) : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm space-y-1">
              <p><strong>DT #:</strong> {selectedPagar?.deliveryTicket?.numero ? `DT #${selectedPagar.deliveryTicket.numero}` : "-"}</p>
              <p><strong>Motonave:</strong> {selectedPagar?.deliveryTicket?.motonave ?? "-"}</p>
              <p><strong>Producto:</strong> {selectedPagar?.deliveryTicket?.producto?.nombre ?? "-"}</p>
              <p><strong>Factura:</strong> {selectedPagar?.numeroFactura || "-"}</p>
              <p><strong>Valor:</strong> {selectedPagar ? formatMoney(Number(selectedPagar.valor)) : ""}</p>
            </div>

            <div>
              <label className="text-sm font-medium">Comprobante de pago (opcional)</label>
              <div className="mt-1 flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => comprobanteRef.current?.click()}>
                  {comprobante ? "Cambiar archivo" : "Seleccionar archivo"}
                </Button>
                {comprobanteNombre && <span className="text-sm text-muted-foreground truncate">{comprobanteNombre}</span>}
                {comprobante && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => { setComprobante(null); setComprobanteNombre("") }}>
                    Quitar
                  </Button>
                )}
                <input ref={comprobanteRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} className="hidden" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPagarOpen(false)}>Cancelar</Button>
              <Button onClick={handlePagar} disabled={submitting}>
                {submitting ? "Procesando..." : "Confirmar Pago"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
