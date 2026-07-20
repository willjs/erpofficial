"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Eye, DollarSign, Upload, FileText, X } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatMoney, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  getCuentasCobrar, createReciboCaja, getVentasSinCobrar, getDeliveryTicketsParaFactura, generarCuentaCobrar,
  type ReciboFormData, type GenerarFacturaData,
} from "@/actions/cuentas-cobrar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import Link from "next/link"

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  PENDIENTE: "warning",
  PARCIAL: "info",
  PAGADA: "success",
  CANCELADA: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
  PAGADA: "Pagada",
  CANCELADA: "Cancelada",
}

export default function CuentasCobrarPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [ventasSinCobrar, setVentasSinCobrar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reciboOpen, setReciboOpen] = useState(false)
  const [selectedCC, setSelectedCC] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [generarOpen, setGenerarOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedDetail, setSelectedDetail] = useState<any>(null)
  const [selectedVentaId, setSelectedVentaId] = useState<string>("")
  const [deliveryTickets, setDeliveryTickets] = useState<any[]>([])
  const [archivo, setArchivo] = useState<{ nombre: string; base64: string } | null>(null)
  const [archivoNombre, setArchivoNombre] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [reciboDocumento, setReciboDocumento] = useState<{ nombre: string; base64: string } | null>(null)
  const [reciboDocumentoNombre, setReciboDocumentoNombre] = useState("")
  const [reciboComprobante, setReciboComprobante] = useState<{ nombre: string; base64: string } | null>(null)
  const [reciboComprobanteNombre, setReciboComprobanteNombre] = useState("")
  const reciboDocRef = useRef<HTMLInputElement>(null)
  const reciboCompRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ccs, vsc] = await Promise.all([getCuentasCobrar(), getVentasSinCobrar()])
      setItems(ccs)
      setVentasSinCobrar(vsc)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handleVentaChange = async (ventaId: string) => {
    setSelectedVentaId(ventaId)
    const venta = ventasSinCobrar.find((v) => v.id === ventaId)
    if (venta?.cliente?.id) {
      try {
        const dts = await getDeliveryTicketsParaFactura(venta.cliente.id)
        setDeliveryTickets(dts)
      } catch {
        setDeliveryTickets([])
      }
    } else {
      setDeliveryTickets([])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivoNombre(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const base64 = result.split(",")[1]
      setArchivo({ nombre: file.name, base64 })
    }
    reader.readAsDataURL(file)
  }

  const columns: Column<any>[] = [
    { key: "cliente", header: "Cliente", render: (r) => r.cliente?.nombre },
    { key: "factura", header: "Factura", render: (r) => r.numeroFactura || "-" },
    { key: "venta", header: "Venta #", render: (r) => r.venta?.numero ?? "-" },
    { key: "valor", header: "Valor", render: (r) => formatMoney(Number(r.valor)) },
    { key: "saldo", header: "Saldo", render: (r) => formatMoney(Number(r.saldoPendiente)) },
    { key: "vencimiento", header: "Vencimiento", render: (r) => r.fechaVencimiento ? formatDate(r.fechaVencimiento) : "-" },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={ESTADO_STYLES[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge> },
    { key: "acciones", header: "", render: (row) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openDetail(row)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
        {row.estado !== "PAGADA" && row.estado !== "CANCELADA" && (
          <Button variant="ghost" size="icon" onClick={() => openRecibo(row)} title="Registrar pago"><DollarSign className="h-4 w-4 text-green-600" /></Button>
        )}
      </div>
    )},
  ]

  async function handleReciboSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      const data: ReciboFormData = {
        cuentaCobrarId: form.get("cuentaCobrarId") as string,
        clienteId: form.get("clienteId") as string,
        fecha: form.get("fecha") as string,
        monto: Number(form.get("monto")),
        metodo: (form.get("metodo") as string) || "TRANSFERENCIA",
        referencia: form.get("referencia") as string,
        observaciones: form.get("observaciones") as string,
        documentoFile: reciboDocumento,
        comprobanteFile: reciboComprobante,
      }
      await createReciboCaja(data)
      toast({ title: "Recibo registrado", description: "Recibo de caja aplicado correctamente", variant: "success" })
      setReciboOpen(false)
      setReciboDocumento(null)
      setReciboDocumentoNombre("")
      setReciboComprobante(null)
      setReciboComprobanteNombre("")
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleGenerarCC(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      const data: GenerarFacturaData = {
        ventaId: form.get("ventaId") as string,
        deliveryTicketId: (form.get("deliveryTicketId") as string) || undefined,
        numeroFactura: (form.get("numeroFactura") as string) || "",
        fechaVencimiento: (form.get("fechaVencimiento") as string) || undefined,
        observaciones: (form.get("observaciones") as string) || undefined,
        archivo,
      }
      await generarCuentaCobrar(data)
      toast({ title: "Factura generada", description: "Cuenta por cobrar creada correctamente", variant: "success" })
      setGenerarOpen(false)
      setArchivo(null)
      setArchivoNombre("")
      setSelectedVentaId("")
      setDeliveryTickets([])
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  function openRecibo(cc: any) {
    setSelectedCC(cc)
    setReciboOpen(true)
  }

  async function openDetail(cc: any) {
    try {
      const { getCuentaCobrar } = await import("@/actions/cuentas-cobrar")
      const detail = await getCuentaCobrar(cc.id)
      setSelectedDetail(detail)
      setDetailOpen(true)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cuentas por Cobrar"
        description="Gestión de cuentas por cobrar y recibos de caja"
        actions={<Button variant="outline" onClick={() => setGenerarOpen(true)} disabled={ventasSinCobrar.length === 0}><Plus className="h-4 w-4 mr-2" /> Generar desde Venta</Button>}
      />

      <DataTable columns={columns} data={items} loading={loading} searchable />

      <FormDialog
        open={reciboOpen}
        onOpenChange={setReciboOpen}
        title="Registrar Recibo de Caja"
        onSubmit={handleReciboSubmit}
        loading={submitting}
      >
        <input type="hidden" name="cuentaCobrarId" value={selectedCC?.id} />
        <input type="hidden" name="clienteId" value={selectedCC?.cliente?.id ?? selectedCC?.clienteId} />
        <div className="grid gap-4">
          <div className="text-sm">
            <strong>Cliente:</strong> {selectedCC?.cliente?.nombre}<br />
            <strong>Saldo pendiente:</strong> {formatMoney(Number(selectedCC?.saldoPendiente))}
          </div>
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input name="fecha" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div className="space-y-2">
            <Label>Monto</Label>
            <Input name="monto" type="number" step="0.01" required max={Number(selectedCC?.saldoPendiente)} defaultValue={Number(selectedCC?.saldoPendiente)} />
          </div>
          <div className="space-y-2">
            <Label>Método</Label>
            <Select name="metodo" defaultValue="TRANSFERENCIA">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="TRANSFERENCIA">Transferencia</SelectItem>
                <SelectItem value="EFECTIVO">Efectivo</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="TARJETA">Tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input name="referencia" />
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Input name="observaciones" />
          </div>
          <div className="space-y-2">
            <Label>Documento (PDF)</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => reciboDocRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo
              </Button>
              <input ref={reciboDocRef} type="file" accept=".pdf,application/pdf,image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setReciboDocumentoNombre(file.name)
                const reader = new FileReader()
                reader.onload = () => {
                  const result = reader.result as string
                  setReciboDocumento({ nombre: file.name, base64: result.split(",")[1] })
                }
                reader.readAsDataURL(file)
              }} />
              {reciboDocumentoNombre && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{reciboDocumentoNombre}</span>
                  <button type="button" onClick={() => { setReciboDocumento(null); setReciboDocumentoNombre("") }} className="text-red-500 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Comprobante de pago del cliente</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => reciboCompRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Seleccionar comprobante
              </Button>
              <input ref={reciboCompRef} type="file" accept=".pdf,application/pdf,image/*" className="hidden" onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setReciboComprobanteNombre(file.name)
                const reader = new FileReader()
                reader.onload = () => {
                  const result = reader.result as string
                  setReciboComprobante({ nombre: file.name, base64: result.split(",")[1] })
                }
                reader.readAsDataURL(file)
              }} />
              {reciboComprobanteNombre && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{reciboComprobanteNombre}</span>
                  <button type="button" onClick={() => { setReciboComprobante(null); setReciboComprobanteNombre("") }} className="text-red-500 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={generarOpen}
        onOpenChange={(v) => { setGenerarOpen(v); if (!v) { setArchivo(null); setArchivoNombre(""); setDeliveryTickets([]); setSelectedVentaId("") } }}
        title="Generar Factura"
        onSubmit={handleGenerarCC}
        loading={submitting}
      >
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Venta</Label>
            <Select name="ventaId" required value={selectedVentaId} onValueChange={handleVentaChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar venta" /></SelectTrigger>
              <SelectContent>
                {ventasSinCobrar.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    Venta #{v.numero} - {v.cliente?.nombre} - ${Number(v.total).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {deliveryTickets.length > 0 && (
            <div className="space-y-2">
              <Label>Delivery Ticket</Label>
              <Select name="deliveryTicketId">
                <SelectTrigger><SelectValue placeholder="Seleccionar DT (opcional)" /></SelectTrigger>
                <SelectContent>
                  {deliveryTickets.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>
                      DT #{dt.numero} - {dt.motonave} - {formatDate(dt.fecha)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Número de Factura</Label>
            <Input name="numeroFactura" placeholder="Ej: F-001-2026" />
          </div>

          <div className="space-y-2">
            <Label>Fecha vencimiento</Label>
            <Input name="fechaVencimiento" type="date" />
          </div>

          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea name="observaciones" rows={3} placeholder="Observaciones de la factura..." />
          </div>

          <div className="space-y-2">
            <Label>Adjuntar Factura (PDF)</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Seleccionar archivo
              </Button>
              <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleFileSelect} />
              {archivoNombre && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{archivoNombre}</span>
                  <button type="button" onClick={() => { setArchivo(null); setArchivoNombre("") }} className="text-red-500 hover:text-red-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </FormDialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Cuenta por Cobrar - {selectedDetail?.cliente?.nombre}</DialogTitle>
            <DialogDescription />
            {selectedDetail?.estado && (
              <div className="px-6 pb-2">
                <Badge variant={ESTADO_STYLES[selectedDetail.estado]}>{ESTADO_LABELS[selectedDetail.estado]}</Badge>
              </div>
            )}
          </DialogHeader>
          {selectedDetail && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Factura:</strong> {selectedDetail.numeroFactura || "-"}</div>
                <div><strong>Venta #:</strong> {selectedDetail.venta?.numero}</div>
                <div><strong>DT #:</strong> {selectedDetail.deliveryTicket?.numero ? `DT #${selectedDetail.deliveryTicket.numero} - ${selectedDetail.deliveryTicket.motonave}` : "-"}</div>
                <div><strong>Valor:</strong> {formatMoney(Number(selectedDetail.valor))}</div>
                <div><strong>Saldo:</strong> {formatMoney(Number(selectedDetail.saldoPendiente))}</div>
                <div><strong>Vencimiento:</strong> {selectedDetail.fechaVencimiento ? formatDate(selectedDetail.fechaVencimiento) : "-"}</div>
              </div>

              {selectedDetail.observaciones && (
                <div className="text-sm">
                  <strong>Observaciones:</strong>
                  <p className="text-muted-foreground mt-1">{selectedDetail.observaciones}</p>
                </div>
              )}

              {selectedDetail.documentoUrl && (
                <div className="text-sm">
                  <strong>Documento:</strong>
                  <Link href={selectedDetail.documentoUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1 mt-1">
                    <FileText className="h-4 w-4" /> Ver factura
                  </Link>
                </div>
              )}

              {selectedDetail.recibos?.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-2">Recibos de Caja</h4>
                  <div className="space-y-2">
                    {selectedDetail.recibos.map((r: any) => (
                      <div key={r.id} className="border rounded p-3 text-sm">
                        <div className="flex justify-between">
                          <span><strong>Recibo #{r.numero}</strong> - {formatDate(r.fecha)}</span>
                          <span className="font-medium">{formatMoney(Number(r.monto))}</span>
                        </div>
                        <div className="text-muted-foreground mt-1">
                          {r.metodo}{r.referencia ? ` - Ref: ${r.referencia}` : ""}
                        </div>
                        {r.observaciones && <div className="text-muted-foreground mt-1">{r.observaciones}</div>}
                        <div className="flex gap-3 mt-1">
                          {r.documentoUrl && (
                            <Link href={r.documentoUrl} target="_blank" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Documento Zeus
                            </Link>
                          )}
                          {r.comprobanteUrl && (
                            <Link href={r.comprobanteUrl} target="_blank" className="text-blue-600 hover:underline text-xs flex items-center gap-1">
                              <FileText className="h-3 w-3" /> Comprobante pago
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
