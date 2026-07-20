"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Eye, Trash2, CheckCircle, Copy, Send, ExternalLink, Loader2, TicketCheck, Lock } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  getDeliveryTickets, confirmarEntrega, cerrarDeliveryTicket, deleteDeliveryTicket,
} from "@/actions/operaciones-delivery"
import { getOrdenesOperativasParaTicket, generarTicketDesdeOrden } from "@/actions/operaciones-generar-ticket"
import { enviarEnlaceCorreo } from "@/actions/operaciones-delivery-public"

const ESTADO_STYLES: Record<string, "secondary" | "success" | "destructive" | "default"> = {
  BORRADOR: "secondary",
  CONFIRMADO: "default",
  CERRADO: "success",
  CANCELADO: "destructive",
}

const ESTADO_LABELS: Record<string, string> = { BORRADOR: "Borrador", CONFIRMADO: "Confirmado", CERRADO: "Cerrado", CANCELADO: "Cancelado" }

export default function DeliveryListPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Generar Ticket
  const [genOpen, setGenOpen] = useState(false)
  const [genSubmitting, setGenSubmitting] = useState(false)
  const [selectedOrdenId, setSelectedOrdenId] = useState("")
  const [createdTicket, setCreatedTicket] = useState<any>(null)
  const [emailDestino, setEmailDestino] = useState("")
  const [emailSubmitting, setEmailSubmitting] = useState(false)

  // Confirmar entrega (manual)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dts, ords] = await Promise.all([
        getDeliveryTickets(), getOrdenesOperativasParaTicket(),
      ])
      setItems(dts)
      setOrdenes(ords)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const columns: Column<any>[] = [
    { key: "numero", header: "#" },
    { key: "fecha", header: "Fecha", render: (r) => formatDate(r.fecha) },
    { key: "cliente", header: "Cliente", render: (r) => r.cliente?.nombre },
    { key: "motonave", header: "Motonave" },
    { key: "puerto", header: "Puerto" },
    { key: "tipo", header: "Tipo", render: (r) => r.tipoSuministro === "BARGE" ? "Barcaza" : r.tipoSuministro === "TRUCKS" ? "Camión" : "-" },
    { key: "barcaza", header: "Barcaza", render: (r) => r.barcaza?.nombre ?? "-" },
    { key: "producto", header: "Producto", render: (r) => r.producto?.nombre },
    { key: "cantidad", header: "Cant.", render: (r) => Number(r.cantidadEntregada) > 0 ? `${Number(r.cantidadEntregada)} TON` : "-" },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={ESTADO_STYLES[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge> },
    { key: "acciones", header: "", render: (row) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/operaciones/delivery/${row.id}`)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
        {row.estado === "BORRADOR" && (
          <>
            <Button variant="ghost" size="icon" onClick={() => { setConfirmId(row.id); setConfirmOpen(true) }} title="Confirmar entrega"><CheckCircle className="h-4 w-4 text-blue-600" /></Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
      </div>
    )},
  ]

  async function handleGenerar() {
    if (!selectedOrdenId) return
    setGenSubmitting(true)
    try {
      const dt = await generarTicketDesdeOrden(selectedOrdenId)
      setCreatedTicket(dt)
      toast({ title: "Ticket generado", description: `Delivery Ticket #${dt.numero}`, variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setGenSubmitting(false)
    }
  }

  async function handleEnviarCorreo() {
    if (!createdTicket || !emailDestino) return
    setEmailSubmitting(true)
    try {
      const result = await enviarEnlaceCorreo(createdTicket.id, emailDestino)
      if (result.success) {
        toast({ title: "Correo enviado", description: `Enlace enviado a ${emailDestino}`, variant: "success" })
      } else {
        toast({ title: "Error", description: result.error ?? "No se pudo enviar", variant: "destructive" })
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setEmailSubmitting(false)
    }
  }

  async function handleConfirmar() {
    if (!confirmId) return
    const form = document.getElementById("confirmForm") as HTMLFormElement
    if (!form) return
    const fd = new FormData(form)
    const cantidad = Number(fd.get("cantidadEntregada"))
    if (!cantidad || cantidad <= 0) { toast({ title: "Error", description: "Ingresa una cantidad válida", variant: "destructive" }); return }
    setConfirmSubmitting(true)
    try {
      await confirmarEntrega(confirmId, { cantidadEntregada: cantidad })
      toast({ title: "Confirmado", description: "Entrega confirmada", variant: "success" })
      setConfirmOpen(false); setConfirmId(null)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally { setConfirmSubmitting(false) }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDeliveryTicket(id)
      toast({ title: "Eliminado", variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  function resetGenDialog() {
    setSelectedOrdenId(""); setCreatedTicket(null); setEmailDestino("")
  }

  const confirmTicket = items.find(i => i.id === confirmId)
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""
  const publicLink = createdTicket ? `${baseUrl}/delivery/${createdTicket.id}` : ""

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Tickets"
        description="Gestión de Delivery Tickets de suministro"
        actions={<Button onClick={() => { resetGenDialog(); setGenOpen(true) }}><TicketCheck className="h-4 w-4 mr-2" /> Generar Ticket</Button>}
      />

      <DataTable columns={columns} data={items} loading={loading} searchable />

      {/* Dialog: Generar Ticket */}
      <Dialog open={genOpen} onOpenChange={(v) => { setGenOpen(v); if (!v) resetGenDialog() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{createdTicket ? "Ticket Generado" : "Generar Delivery Ticket"}</DialogTitle>
          </DialogHeader>

          {!createdTicket ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Selecciona una orden operativa para generar el Delivery Ticket.
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Orden Operativa</Label>
                <Select value={selectedOrdenId} onValueChange={setSelectedOrdenId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar orden" /></SelectTrigger>
                  <SelectContent>
                    {ordenes.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        #{o.numero} — {o.motonave} — {o.cliente?.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedOrdenId && (() => {
                const o = ordenes.find(ord => ord.id === selectedOrdenId)
                if (!o) return null
                return (
                  <div className="text-xs text-muted-foreground border rounded p-2 grid grid-cols-2 gap-1">
                    <span>Cliente: {o.cliente?.nombre}</span>
                    <span>Motonave: {o.motonave}</span>
                    <span>Puerto: {o.puerto}</span>
                    <span>Producto: {o.producto?.nombre}</span>
                    <span>IMO: {o.programacion?.imo ?? "-"}</span>
                    <span>Bandera: {o.programacion?.bandera ?? "-"}</span>
                  </div>
                )
              })()}
              <Button onClick={handleGenerar} disabled={!selectedOrdenId || genSubmitting} className="w-full">
                {genSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generando...</> : "Generar Ticket"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="font-semibold text-green-800">Delivery Ticket #{createdTicket.numero}</p>
                <p className="text-xs text-green-600 mt-1">Comparte el enlace para que el responsable complete el timeline y firme.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Enlace público</Label>
                <div className="flex gap-2">
                  <Input value={publicLink} readOnly className="flex-1 text-xs" />
                  <Button variant="outline" size="sm" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(publicLink); toast({ title: "Copiado", variant: "success" }) }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.open(publicLink, "_blank")}>
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Enviar por correo</Label>
                <div className="flex gap-2">
                  <Input type="email" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)} placeholder="correo@ejemplo.com" className="flex-1" />
                  <Button variant="secondary" onClick={handleEnviarCorreo} disabled={!emailDestino || emailSubmitting}>
                    {emailSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={resetGenDialog}>
                Generar otro ticket
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar entrega (manual) */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setConfirmId(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar Entrega</DialogTitle></DialogHeader>
          {confirmTicket && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                DT #{confirmTicket.numero} — {confirmTicket.cliente?.nombre} — {confirmTicket.motonave}
              </div>
              <form id="confirmForm" className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Cantidad Entregada / Delivered Quantity (TON)</Label>
                  <Input name="cantidadEntregada" type="number" step="0.001" required />
                </div>
              </form>
              <p className="text-xs text-muted-foreground">
                Al confirmar, el DT pasará a "Confirmado" y se habilitarán las firmas y el cierre.
              </p>
              <Button onClick={handleConfirmar} disabled={confirmSubmitting} className="w-full">
                {confirmSubmitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Confirmando...</> : "Confirmar Entrega"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
