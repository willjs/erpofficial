"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Plus, Trash2, FileText, Image, CheckCircle, X, Clock, User, Ship, Beaker, Gauge, FlaskConical, Eye, Edit3, Stamp, Link as LinkIcon, Copy, Printer, FileSpreadsheet, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { formatDate, formatDateTime } from "@/lib/utils"
import { VistaPrevia } from "@/components/delivery/vista-previa"
import {
  getDeliveryTicket, confirmarEntrega, addTimelineEvent, deleteTimelineEvent,
  addEvidencia, deleteEvidencia,
  addFirma, deleteFirma, cerrarDeliveryTicket, deleteDeliveryTicket,
  getVehiculosForDelivery, getConductoresForDelivery,
  updateDeliveryQuality, getFacturasDeliveryTicket,
} from "@/actions/operaciones-delivery"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SignaturePad } from "@/components/ui/signature-pad"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const ESTADO_STYLES: Record<string, "secondary" | "success" | "destructive" | "default"> = {
  BORRADOR: "secondary",
  CONFIRMADO: "default",
  CERRADO: "success",
  CANCELADO: "destructive",
}

const ESTADO_LABELS: Record<string, string> = { BORRADOR: "Borrador", CONFIRMADO: "Confirmado", CERRADO: "Cerrado", CANCELADO: "Cancelado" }

const EVENTOS_TIMELINE = [
  "Barcaza Acoderada al Buque",
  "Manguera Conectada",
  "Inicio Bombeo",
  "Finalización Bombeo",
  "Barcaza Libre",
]

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5 text-sm gap-2">
      <span className="font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words">{value ?? "-"}</span>
    </div>
  )
}

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="py-3 bg-muted/30">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="py-3">
        {children}
      </CardContent>
    </Card>
  )
}

function BadgeSiNo({ value }: { value: string | boolean | null | undefined }) {
  const v = typeof value === "boolean" ? (value ? "SI" : "NO") : (value || "NO")
  return (
    <Badge variant={v === "SI" ? "success" : v === "RECHAZADA" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0">
      {v === "RECHAZADA" ? "Rechazada" : v}
    </Badge>
  )
}

export default function DeliveryDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string
  const [dt, setDt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [timelineEvent, setTimelineEvent] = useState("")
  const [timelineFecha, setTimelineFecha] = useState("")
  const [timelineHora, setTimelineHora] = useState("")
  const [evidenciaFile, setEvidenciaFile] = useState<{ nombre: string; base64: string; tipo: string } | null>(null)
  const [firmaRol, setFirmaRol] = useState("REPRESENTANTE_PROVEEDOR")
  const [firmaNombre, setFirmaNombre] = useState("")
  const [firmaData, setFirmaData] = useState("")
  const [firmaMode, setFirmaMode] = useState<"draw" | "upload">("draw")
  const [selloFile, setSelloFile] = useState<{ nombre: string; base64: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [facturas, setFacturas] = useState<any[]>([])
  const [qualityForm, setQualityForm] = useState({
    api: "", gravedadEspecifica: "", densidad: "", viscosidad: "",
    azufre: "", agua: "", puntoChispa: "", temperatura: "",
    otrasPropiedades: "", selloProveedor: "", selloMotonave: "",
    marpolAnnexVi: "", otraMuestra: "",
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, vhs, cnd, fts] = await Promise.all([
        getDeliveryTicket(id),
        getVehiculosForDelivery(),
        getConductoresForDelivery(),
        getFacturasDeliveryTicket(id),
      ])
      if (!data) { toast({ title: "No encontrado", variant: "destructive" }); router.push("/operaciones/delivery") }
      setDt(data)
      setVehiculos(vhs)
      setConductores(cnd)
      setFacturas(fts ?? [])
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [id, router, toast])

  useEffect(() => { load() }, [load])

  async function handleAddTimeline() {
    if (!timelineEvent) return
    setSubmitting(true)
    try {
      const fecha = timelineFecha || new Date().toISOString().slice(0, 10)
      await addTimelineEvent(id, { evento: timelineEvent, fecha, hora: timelineHora || undefined })
      toast({ title: "Evento agregado", variant: "success" })
      setTimelineEvent(""); setTimelineFecha(""); setTimelineHora("")
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteTimeline(eventId: string) {
    try { await deleteTimelineEvent(eventId, id); load() }
    catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" }) }
  }

  async function handleAddEvidencia() {
    if (!evidenciaFile) return
    setSubmitting(true)
    try {
      await addEvidencia(id, evidenciaFile)
      toast({ title: "Evidencia agregada", variant: "success" })
      setEvidenciaFile(null)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  async function handleDeleteEvidencia(evId: string) {
    try { await deleteEvidencia(evId, id); load() }
    catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" }) }
  }

  async function handleAddFirma() {
    if (!firmaNombre || !firmaData) return
    setSubmitting(true)
    try {
      const selloBase64 = selloFile?.base64
      await addFirma(id, { rol: firmaRol, nombre: firmaNombre, firma: firmaData, sello: selloBase64 })
      toast({ title: "Firma agregada", variant: "success" })
      setFirmaNombre(""); setFirmaData(""); setSelloFile(null)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  async function handleDeleteFirma(firmaId: string) {
    try { await deleteFirma(firmaId, id); load() }
    catch (err) { toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" }) }
  }

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmCantidad, setConfirmCantidad] = useState("")
  const [confirmVehiculo, setConfirmVehiculo] = useState("")
  const [confirmConductor, setConfirmConductor] = useState("")

  async function handleConfirmarClick() {
    setConfirmCantidad(""); setConfirmVehiculo(""); setConfirmConductor("")
    setConfirmOpen(true)
  }

  async function handleConfirmarSubmit() {
    if (!confirmCantidad || Number(confirmCantidad) <= 0) { toast({ title: "Error", description: "Ingresa una cantidad válida", variant: "destructive" }); return }
    setSubmitting(true)
    try {
      await confirmarEntrega(id, { cantidadEntregada: Number(confirmCantidad), vehiculoId: confirmVehiculo, conductorId: confirmConductor })
      toast({ title: "Confirmado", description: "Entrega confirmada", variant: "success" })
      setConfirmOpen(false); load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  useEffect(() => {
    if (dt) {
      setQualityForm({
        api: dt.api != null ? String(dt.api) : "",
        gravedadEspecifica: dt.gravedadEspecifica != null ? String(dt.gravedadEspecifica) : "",
        densidad: dt.densidad != null ? String(dt.densidad) : "",
        viscosidad: dt.viscosidad != null ? String(dt.viscosidad) : "",
        azufre: dt.azufre != null ? String(dt.azufre) : "",
        agua: dt.agua != null ? String(dt.agua) : "",
        puntoChispa: dt.puntoChispa != null ? String(dt.puntoChispa) : "",
        temperatura: dt.temperatura != null ? String(dt.temperatura) : "",
        otrasPropiedades: dt.otrasPropiedades || "",
        selloProveedor: dt.selloProveedor || "",
        selloMotonave: dt.selloMotonave || "",
        marpolAnnexVi: dt.marpolAnnexVi || "",
        otraMuestra: dt.otraMuestra || "",
      })
    }
  }, [dt])

  async function handleSaveQuality() {
    setSubmitting(true)
    try {
      await updateDeliveryQuality(id, {
        api: qualityForm.api ? Number(qualityForm.api) : undefined,
        gravedadEspecifica: qualityForm.gravedadEspecifica ? Number(qualityForm.gravedadEspecifica) : undefined,
        densidad: qualityForm.densidad ? Number(qualityForm.densidad) : undefined,
        viscosidad: qualityForm.viscosidad ? Number(qualityForm.viscosidad) : undefined,
        azufre: qualityForm.azufre ? Number(qualityForm.azufre) : undefined,
        agua: qualityForm.agua ? Number(qualityForm.agua) : undefined,
        puntoChispa: qualityForm.puntoChispa ? Number(qualityForm.puntoChispa) : undefined,
        temperatura: qualityForm.temperatura ? Number(qualityForm.temperatura) : undefined,
        otrasPropiedades: qualityForm.otrasPropiedades,
        selloProveedor: qualityForm.selloProveedor,
        selloMotonave: qualityForm.selloMotonave,
        marpolAnnexVi: qualityForm.marpolAnnexVi,
        otraMuestra: qualityForm.otraMuestra,
      })
      toast({ title: "Guardado", description: "Calidad y muestras actualizadas", variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  const [cerrarOpen, setCerrarOpen] = useState(false)
  const [cerrarSubmitting, setCerrarSubmitting] = useState(false)
  const [cerrarFacturaFile, setCerrarFacturaFile] = useState<{ nombre: string; base64: string } | null>(null)
  const [cerrarFacturaNombre, setCerrarFacturaNombre] = useState("")
  const [cerrarPagado, setCerrarPagado] = useState(false)
  const [cerrarComprobanteFile, setCerrarComprobanteFile] = useState<{ nombre: string; base64: string } | null>(null)
  const [cerrarComprobanteNombre, setCerrarComprobanteNombre] = useState("")
  const cerrarFacturaRef = useRef<HTMLInputElement>(null)
  const cerrarComprobanteRef = useRef<HTMLInputElement>(null)

  async function handleCerrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCerrarSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      await cerrarDeliveryTicket(id, "", {
        numeroFactura: (form.get("numeroFactura") as string) || undefined,
        facturaFile: cerrarFacturaFile,
        pagado: cerrarPagado,
        comprobanteFile: cerrarComprobanteFile,
      })
      toast({ title: "Cerrado", description: "Delivery Ticket cerrado. Venta y CC generadas.", variant: "success" })
      setCerrarOpen(false)
      setCerrarFacturaFile(null)
      setCerrarFacturaNombre("")
      setCerrarComprobanteFile(null)
      setCerrarComprobanteNombre("")
      setCerrarPagado(false)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    } finally {
      setCerrarSubmitting(false)
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      const tipo = file.type.startsWith("image") ? "IMAGEN" : file.type.includes("pdf") ? "PDF" : "OTRO"
      setEvidenciaFile({ nombre: file.name, base64, tipo })
    }
    reader.readAsDataURL(file)
  }

  function handleSignatureUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setFirmaData(reader.result as string) }
    reader.readAsDataURL(file)
  }

  function handleSelloUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1]
      setSelloFile({ nombre: file.name, base64 })
    }
    reader.readAsDataURL(file)
  }

  if (loading) return <div className="p-8 text-center text-muted-foreground">Cargando...</div>
  if (!dt) return null

  const isBarge = dt.tipoSuministro === "BARGE"
  const isTrucks = dt.tipoSuministro === "TRUCKS"

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => router.push("/operaciones/delivery")} size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Volver</Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Delivery Ticket #{dt.numero}</h1>
            <p className="text-sm text-muted-foreground">{formatDate(dt.fecha)}</p>
          </div>
          <Badge variant={ESTADO_STYLES[dt.estado]}>{ESTADO_LABELS[dt.estado]}</Badge>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
            <Button variant="outline" size="sm" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(`${window.location.origin}/delivery/${id}`); toast({ title: "Enlace copiado", description: "Enlace público para firmas copiado al portapapeles", variant: "success" }) }} className="w-full sm:w-auto">
              <Copy className="h-4 w-4 mr-2" />Copiar enlace
            </Button>
          )}
          {dt.estado === "BORRADOR" && (
            <Button onClick={handleConfirmarClick} className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto" size="sm">
              <CheckCircle className="h-4 w-4 mr-2" />Confirmar Entrega
            </Button>
          )}
          {dt.estado === "CONFIRMADO" && (
            <Dialog open={cerrarOpen} onOpenChange={setCerrarOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700 w-full sm:w-auto" size="sm">
                  <CheckCircle className="h-4 w-4 mr-2" />Cerrar Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Cerrar Delivery Ticket #{dt.numero}</DialogTitle></DialogHeader>
                <form onSubmit={handleCerrar} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Número de Factura</Label>
                    <Input name="numeroFactura" placeholder="Ej: F-001-2026" />
                  </div>
                  <div className="space-y-2">
                    <Label>Adjuntar Factura (PDF)</Label>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => cerrarFacturaRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> Seleccionar
                      </Button>
                      <input ref={cerrarFacturaRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]; if (!f) return
                        setCerrarFacturaNombre(f.name)
                        const reader = new FileReader()
                        reader.onload = () => { const r = reader.result as string; setCerrarFacturaFile({ nombre: f.name, base64: r.split(",")[1] }) }
                        reader.readAsDataURL(f)
                      }} />
                      {cerrarFacturaNombre && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" /><span>{cerrarFacturaNombre}</span>
                          <button type="button" onClick={() => { setCerrarFacturaFile(null); setCerrarFacturaNombre("") }} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="pagado" checked={cerrarPagado} onChange={(e) => setCerrarPagado(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
                    <Label htmlFor="pagado" className="cursor-pointer">Pagado / Cliente ya realizó el pago</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>Comprobante de pago del cliente</Label>
                    <div className="flex items-center gap-3">
                      <Button type="button" variant="outline" size="sm" onClick={() => cerrarComprobanteRef.current?.click()}>
                        <Upload className="h-4 w-4 mr-2" /> Seleccionar
                      </Button>
                      <input ref={cerrarComprobanteRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0]; if (!f) return
                        setCerrarComprobanteNombre(f.name)
                        const reader = new FileReader()
                        reader.onload = () => { const r = reader.result as string; setCerrarComprobanteFile({ nombre: f.name, base64: r.split(",")[1] }) }
                        reader.readAsDataURL(f)
                      }} />
                      {cerrarComprobanteNombre && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" /><span>{cerrarComprobanteNombre}</span>
                          <button type="button" onClick={() => { setCerrarComprobanteFile(null); setCerrarComprobanteNombre("") }} className="text-red-500 hover:text-red-700"><X className="h-4 w-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCerrarOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={cerrarSubmitting} className="bg-green-600 hover:bg-green-700">
                      {cerrarSubmitting ? "Cerrando..." : "Cerrar Ticket"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
          <Link href={`/operaciones/delivery/${dt.id}/print`} target="_blank" className="w-full sm:w-auto">
            <Button variant="outline" className="no-print w-full sm:w-auto" size="sm">
              <Printer className="h-4 w-4 mr-2" />Imprimir
            </Button>
          </Link>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="destructive" className="no-print w-full sm:w-auto" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />Reiniciar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>¿Reiniciar Delivery Ticket?</DialogTitle></DialogHeader>
              <p className="text-sm text-muted-foreground">Se eliminará el ticket completo (timeline, firmas, evidencias) para poder generarlo de nuevo desde una Orden Operativa.</p>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => { const btn = document.activeElement as HTMLElement; btn?.blur(); }}>Cancelar</Button>
                <Button variant="destructive" onClick={async () => {
                  try {
                    await deleteDeliveryTicket(dt.id)
                    toast({ title: "Eliminado", description: "Ticket eliminado. Puedes generar uno nuevo.", variant: "success" })
                    router.push("/operaciones/delivery")
                  } catch (err) {
                    toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
                  }
                }}>Eliminar y reiniciar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs: Gestión / Vista Previa */}
      <Tabs defaultValue="gestion" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="gestion" className="flex items-center gap-1.5"><Edit3 className="h-3.5 w-3.5" />Gestión</TabsTrigger>
          <TabsTrigger value="previa" className="flex items-center gap-1.5"><FileSpreadsheet className="h-3.5 w-3.5" />Vista Previa</TabsTrigger>
        </TabsList>

        <TabsContent value="gestion" className="space-y-6 mt-0">
      {/* Document Body - Grid 2 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Columna 1 */}
        <div className="space-y-4">
          <SectionCard title="Datos del Documento" icon={<FileText className="h-4 w-4" />}>
            <div className="space-y-1">
              <InfoRow label="Fecha / Date" value={formatDate(dt.fecha)} />
              <InfoRow label="N°" value={dt.numero} />
              <InfoRow label="Puerto / Port" value={dt.puerto} />
              <InfoRow label="Lugar de Suministro" value={dt.lugarSuministro} />
            </div>
          </SectionCard>

          <SectionCard title="Información del Cliente" icon={<User className="h-4 w-4" />}>
            <div className="space-y-1">
              <InfoRow label="Cliente / Customer" value={dt.cliente?.nombre} />
              <InfoRow label="Dirección / Address" value={dt.direccion} />
              <InfoRow label="Ciudad / City" value={dt.ciudad} />
              <InfoRow label="Agente / Agent" value={dt.agente} />
            </div>
          </SectionCard>

          <SectionCard title="Información de la Motonave" icon={<Ship className="h-4 w-4" />}>
            <div className="space-y-1">
              <InfoRow label="Motonave / Vessel" value={dt.motonave} />
              <InfoRow label="IMO" value={dt.imo} />
              <InfoRow label="Bandera / Flag" value={dt.bandera} />
            </div>
          </SectionCard>

          <SectionCard title="Suministro por / Delivery By">
            <div className="flex gap-4 text-sm">
              <span className={isBarge ? "font-bold text-primary" : "text-muted-foreground"}>
                {isBarge ? "☑" : "☐"} Barge (Barcaza)
              </span>
              <span className={isTrucks ? "font-bold text-primary" : "text-muted-foreground"}>
                {isTrucks ? "☑" : "☐"} Trucks (Camiones)
              </span>
            </div>
          </SectionCard>

          {/* Datos Operativos */}
          {(isBarge || isTrucks) && (
            <SectionCard title="Datos Operativos" icon={<Gauge className="h-4 w-4" />}>
              {isBarge ? (
                <div className="space-y-1">
                  <InfoRow label="Barcaza / Barge" value={dt.barcaza?.nombre} />
                  <InfoRow label="Capitán / Captain" value={dt.capitan?.nombre} />
                  <InfoRow label="Remolcador / Tug Boat" value={dt.remolcador?.nombre} />
                </div>
              ) : (
                <div className="space-y-1">
                  <InfoRow label="Placas / License Plate" value={dt.vehiculo?.placa} />
                  <InfoRow label="Conductor / Driver" value={dt.conductor?.nombre} />
                </div>
              )}
            </SectionCard>
          )}

          <SectionCard title="Producto Entregado" icon={<FlaskConical className="h-4 w-4" />}>
            <div className="space-y-1">
              <InfoRow label="Producto / Product" value={dt.producto?.nombre} />
              <InfoRow label="Cantidad Entregada / Delivered Quantity" value={`${Number(dt.cantidadEntregada)} ${dt.unidadMedida ?? "MT"}`} />
            </div>
          </SectionCard>

          {/* Calidad */}
          <SectionCard title="Calidad / Quality" icon={<Beaker className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: "api", label: "API" },
                { key: "gravedadEspecifica", label: "Gravedad Específica" },
                { key: "densidad", label: "Densidad" },
                { key: "viscosidad", label: "Viscosidad" },
                { key: "azufre", label: "Azufre %" },
                { key: "agua", label: "Agua %" },
                { key: "puntoChispa", label: "Punto Chispa" },
                { key: "temperatura", label: "Temperatura" },
              ].map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">{f.label}</Label>
                  <Input
                    type="number" step="0.0001"
                    value={(qualityForm as any)[f.key]}
                    onChange={(e) => setQualityForm({ ...qualityForm, [f.key]: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1">
              <Label className="text-xs">Otras Propiedades / Other Specs</Label>
              <Input
                value={qualityForm.otrasPropiedades}
                onChange={(e) => setQualityForm({ ...qualityForm, otrasPropiedades: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <Button size="sm" onClick={handleSaveQuality} disabled={submitting} className="mt-3 w-full">
              Guardar Calidad
            </Button>
          </SectionCard>
        </div>

        {/* Columna 2 */}
        <div className="space-y-4">
          <SectionCard title="Sondeos" icon={<Beaker className="h-4 w-4" />}>
            <div className="space-y-1">
              <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5 text-sm">
                <span className="font-medium text-muted-foreground">Sondeo Antes / Sounding Before</span>
                <span className="flex items-center gap-2"><BadgeSiNo value={dt.sondajeAntesRealizado} />{dt.sondajeAntes != null && <span className="text-xs">({Number(dt.sondajeAntes)})</span>}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5 text-sm">
                <span className="font-medium text-muted-foreground">Sondeo Después / Sounding After</span>
                <span className="flex items-center gap-2"><BadgeSiNo value={dt.sondajeDespuesRealizado} />{dt.sondajeDespues != null && <span className="text-xs">({Number(dt.sondajeDespues)})</span>}</span>
              </div>
              <div className="flex justify-between py-1.5 text-sm">
                <span className="font-medium text-muted-foreground">Testificado por Representante</span>
                <BadgeSiNo value={dt.sondajeTestificado} />
              </div>
            </div>
          </SectionCard>


          <SectionCard title="Verificación de Entrega" icon={<User className="h-4 w-4" />}>
            <div className="space-y-1">
              <InfoRow label="Compañía que Entrega / Delivering Company" value={dt.companiaEntrega} />
              <InfoRow label="Verificado por / Verified By" value={dt.verificadoPor} />
            </div>
          </SectionCard>

          {/* Muestras */}
          <SectionCard title="Muestras / Samples" icon={<FlaskConical className="h-4 w-4" />}>
            {[
              { key: "selloProveedor", label: "Sello Proveedor / Supplier Seal" },
              { key: "selloMotonave", label: "Sello Motonave / Vessel Seal" },
              { key: "marpolAnnexVi", label: "MARPOL Annex VI" },
              { key: "otraMuestra", label: "Otra Muestra / Other Sample" },
            ].map((f) => (
              <div key={f.key} className="space-y-1 mb-2">
                <Label className="text-xs">{f.label}</Label>
                <Input
                  value={(qualityForm as any)[f.key]}
                  onChange={(e) => setQualityForm({ ...qualityForm, [f.key]: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            ))}
            <Button size="sm" onClick={handleSaveQuality} disabled={submitting} className="mt-2 w-full">
              Guardar Muestras
            </Button>
          </SectionCard>
        </div>
      </div>

      {/* Observaciones */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 bg-muted/30">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4" />Observaciones / Remarks
          </CardTitle>
        </CardHeader>
        <CardContent className="py-3">
          <p className="text-sm whitespace-pre-wrap">{dt.observaciones || "Sin observaciones"}</p>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card className="shadow-sm">
        <CardHeader className="py-3 bg-muted/30 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" />Estado de Hechos (Time Log)
          </CardTitle>
          {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <Select value={timelineEvent} onValueChange={setTimelineEvent}>
                <SelectTrigger className="w-full sm:w-44 h-8 text-xs"><SelectValue placeholder="Evento" /></SelectTrigger>
                <SelectContent>
                  {EVENTOS_TIMELINE.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input type="date" value={timelineFecha} onChange={(e) => setTimelineFecha(e.target.value)} className="flex-1 sm:w-32 h-8 text-xs" />
                <Input type="time" value={timelineHora} onChange={(e) => setTimelineHora(e.target.value)} className="flex-1 sm:w-24 h-8 text-xs" />
              </div>
              <Button size="sm" onClick={handleAddTimeline} disabled={!timelineEvent || submitting} className="h-8 w-full sm:w-auto">
                <Plus className="h-3 w-3 mr-1" />Agregar
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="py-3">
          {dt.timeline?.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin eventos registrados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left font-semibold text-muted-foreground py-2 px-3">Evento</th>
                    <th className="text-left font-semibold text-muted-foreground py-2 px-3">Fecha</th>
                    <th className="text-left font-semibold text-muted-foreground py-2 px-3">Hora</th>
                    <th className="text-left font-semibold text-muted-foreground py-2 px-3">Observación</th>
                    {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && <th className="w-10" />}
                  </tr>
                </thead>
                <tbody>
                  {dt.timeline?.map((ev: any) => (
                    <tr key={ev.id} className="border-b border-gray-100 hover:bg-muted/20">
                      <td className="py-2 px-3 font-medium">{ev.evento}</td>
                      <td className="py-2 px-3 text-muted-foreground">{formatDate(ev.fecha)}</td>
                      <td className="py-2 px-3 text-muted-foreground">{ev.hora || "-"}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{ev.observacion || ""}</td>
                      {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
                        <td className="py-2 px-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteTimeline(ev.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Firmas + Evidencias en grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Firmas */}
        <Card className="shadow-sm">
          <CardHeader className="py-3 bg-muted/30 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />Firmas
            </CardTitle>
            {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8"><Plus className="h-3 w-3 mr-1" />Agregar firma</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader><DialogTitle>Agregar Firma</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Rol</Label>
                      <Select value={firmaRol} onValueChange={setFirmaRol}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="REPRESENTANTE_PROVEEDOR">Representante proveedor</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Nombre del firmante</Label>
                      <Input value={firmaNombre} onChange={(e) => setFirmaNombre(e.target.value)} placeholder="Nombre completo" />
                    </div>
                    <div className="space-y-2">
                      <Label>Firma</Label>
                      <Tabs value={firmaMode} onValueChange={(v) => setFirmaMode(v as "draw" | "upload")}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="draw">Dibujar</TabsTrigger>
                          <TabsTrigger value="upload">Subir imagen</TabsTrigger>
                        </TabsList>
                        <TabsContent value="draw" className="mt-2">
                          <SignaturePad onSave={(dataUrl) => setFirmaData(dataUrl)} />
                        </TabsContent>
                        <TabsContent value="upload" className="mt-2">
                          <Input type="file" accept="image/*" onChange={handleSignatureUpload} />
                          {firmaData && (
                            <div className="border rounded p-2 mt-2">
                              <img src={firmaData} alt="Firma" className="max-h-20 mx-auto" />
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Stamp className="h-4 w-4" /> Sello / Stamp (opcional)
                      </Label>
                      <Input type="file" accept="image/*" onChange={handleSelloUpload} />
                      {selloFile && (
                        <div className="border rounded p-2 mt-1 flex items-center gap-2">
                          <img src={`data:image/png;base64,${selloFile.base64}`} alt="Sello" className="max-h-12" />
                          <span className="text-xs text-muted-foreground">{selloFile.nombre}</span>
                        </div>
                      )}
                    </div>
                    <Button onClick={handleAddFirma} disabled={!firmaNombre || !firmaData || submitting} className="w-full">
                      Guardar firma
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="py-3">
            {dt.firmas?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin firmas registradas</p>
            ) : (
              <div className="space-y-3">
                {dt.firmas?.map((f: any) => (
                  <div key={f.id} className="border rounded p-3 relative">
                    <div className="text-sm font-medium">{f.nombre}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.rol === "REPRESENTANTE_PROVEEDOR" ? "Representante proveedor" : f.rol === "CAPITAN" ? "Capitán" : "Jefe de máquinas"}
                    </div>
                    <div className="flex gap-3 mt-2 items-end">
                      {f.firma && (
                        <div className="border rounded p-1 bg-white flex-1">
                          <img src={f.firma} alt="Firma" className="max-h-12" />
                        </div>
                      )}
                      {f.sello && (
                        <div className="border rounded p-1 bg-white">
                          <img src={f.sello} alt="Sello" className="max-h-14" title="Sello" />
                        </div>
                      )}
                    </div>
                    {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => handleDeleteFirma(f.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 p-3 bg-muted/20 rounded text-xs text-muted-foreground space-y-2">
              <p className="font-medium mb-1 flex items-center gap-2"><LinkIcon className="h-3 w-3" />Firmas vía enlace público</p>
              <p>Las firmas del Capitán y Jefe de Máquinas se realizan a través de un enlace público compartido con la motonave.</p>
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { if (navigator.clipboard) navigator.clipboard.writeText(`${window.location.origin}/delivery/${id}`); toast({ title: "Enlace copiado", variant: "success" }) }}>
                <Copy className="h-3 w-3 mr-1" />Copiar enlace público
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Evidencias */}
        <Card className="shadow-sm">
          <CardHeader className="py-3 bg-muted/30 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Image className="h-4 w-4" />Evidencias
            </CardTitle>
            {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
                <Input type="file" accept="image/*,application/pdf" onChange={handleFileSelect} className="w-full sm:w-40 h-8 text-xs" />
                <Button size="sm" onClick={handleAddEvidencia} disabled={!evidenciaFile || submitting} className="h-8 w-full sm:w-auto">
                  <Plus className="h-3 w-3 mr-1" />Subir
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="py-3">
            {dt.evidencias?.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin evidencias</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {dt.evidencias?.map((ev: any) => (
                  <div key={ev.id} className="border rounded p-1 relative group">
                    {ev.tipo === "IMAGEN" ? (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer">
                        <img src={ev.url} alt={ev.nombre} className="w-full h-20 object-cover rounded" />
                      </a>
                    ) : (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 p-1">
                        <FileText className="h-6 w-6 text-muted-foreground" />
                        <span className="text-[10px] truncate">{ev.nombre}</span>
                      </a>
                    )}
                    {(dt.estado === "BORRADOR" || dt.estado === "CONFIRMADO") && (
                      <Button variant="ghost" size="icon" className="absolute top-0 right-0 h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => handleDeleteEvidencia(ev.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ventas generadas */}
      {dt.ventas?.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />Ventas generadas
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            {dt.ventas.map((v: any) => (
              <div key={v.id} className="text-sm">
                <a href={`/ventas`} className="text-blue-600 hover:underline font-medium">Venta #{v.numero}</a>
                <span className="text-muted-foreground"> — {v.estado} — ${Number(v.total).toFixed(2)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Factura Delivery Ticket */}
      {facturas.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="py-3 bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />Factura Delivery Ticket
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 space-y-2">
            {facturas.map((f: any) => (
              <div key={f.id} className="border rounded p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span><strong>Factura:</strong> {f.numeroFactura || "-"}</span>
                  <span className="font-semibold">${Number(f.valor).toFixed(2)}</span>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <Badge variant={f.estado === "PAGADA" ? "success" : f.estado === "CANCELADA" ? "destructive" : "secondary"}>
                    {f.estado}
                  </Badge>
                  {f.documentoUrl && (
                    <a href={f.documentoUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Documento
                    </a>
                  )}
                  {f.comprobanteUrl && (
                    <a href={f.comprobanteUrl} target="_blank" className="text-blue-600 hover:underline flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Comprobante
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="previa" className="mt-0">
          <div style={{ overflowX: "auto" }}>
            <div style={{ width: 990 }}>
              <VistaPrevia dt={dt} />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Confirmar entrega */}
      <Dialog open={confirmOpen} onOpenChange={(v) => { setConfirmOpen(v); if (!v) setConfirmOpen(false) }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Confirmar Entrega</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              DT #{dt.numero} — {dt.cliente?.nombre} — {dt.motonave}
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Cantidad Entregada / Delivered Quantity ({dt.unidadMedida ?? "MT"})</Label>
              <Input type="number" step="0.001" value={confirmCantidad} onChange={(e) => setConfirmCantidad(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Placas / License Plate</Label>
              <Select value={confirmVehiculo} onValueChange={setConfirmVehiculo}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{vehiculos.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Conductor / Driver</Label>
              <Select value={confirmConductor} onValueChange={setConfirmConductor}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>{conductores.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Al confirmar, el DT pasará a estado "Confirmado" y se habilitarán las firmas y el cierre.
            </p>
            <Button onClick={handleConfirmarSubmit} disabled={submitting} className="w-full">
              Confirmar Entrega
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
