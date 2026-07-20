"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams } from "next/navigation"
import { Ship, User, FileText, CheckCircle, AlertCircle, Loader2, Truck, Clock, Plus, Trash2, Stamp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SignaturePad } from "@/components/ui/signature-pad"
import { Badge } from "@/components/ui/badge"
import { getDeliveryTicketPublic, saveTimelinePublic, saveVehiculosPublic, saveConductoresPublic, firmarDeliveryTicketPublic, finalizarPublic } from "@/actions/operaciones-delivery-public"
import { formatDate } from "@/lib/utils"

const EVENTOS_TIMELINE = [
  "Barcaza Acoderada al Buque / Barge Alongside",
  "Manguera Conectada / Hose Connected",
  "Inicio Bombeo / Pumping Started",
  "Finalización Bombeo / Pumping Finished",
  "Barcaza Libre / Barge Released",
]

const ROL_LABELS: Record<string, string> = {
  REPRESENTANTE_PROVEEDOR: "Compañía de Entrega",
  CAPITAN: "Capitán",
  JEFE_MAQUINAS: "Jefe de Máquinas",
}

const ROL_ICONS: Record<string, React.ReactNode> = {
  REPRESENTANTE_PROVEEDOR: <Truck className="h-4 w-4" />,
  CAPITAN: <User className="h-4 w-4" />,
  JEFE_MAQUINAS: <User className="h-4 w-4" />,
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5 text-sm gap-2">
      <span className="font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-right break-words">{value ?? "-"}</span>
    </div>
  )
}

export default function PublicDeliveryPage() {
  const params = useParams()
  const token = params.token as string
  const [dt, setDt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [paso, setPaso] = useState<"timeline" | "firmas">("timeline")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState("")

  // Vehiculos
  const [placas, setPlacas] = useState<string[]>([""])
  // Conductores
  const [conductores, setConductores] = useState<string[]>([""])
  // Timeline events
  const [timelineData, setTimelineData] = useState<{ evento: string; fecha: string; hora: string }[]>(
    EVENTOS_TIMELINE.map(e => ({ evento: e, fecha: "", hora: "" }))
  )
  // Cantidad entregada
  const [cantidadEntregada, setCantidadEntregada] = useState("")
  const [unidadMedida, setUnidadMedida] = useState("MT")
  // Sondeos
  const [sondajeAntesRealizado, setSondajeAntesRealizado] = useState("")
  const [sondajeDespuesRealizado, setSondajeDespuesRealizado] = useState("")
  const [sondajeTestificado, setSondajeTestificado] = useState("")

  const UNIDADES = [
    { value: "MT", label: "MT (Tonelada Métrica)" },
    { value: "BBL", label: "BBL (Barril)" },
    { value: "GAL", label: "GAL (Galón)" },
    { value: "LTR", label: "LTR (Litro)" },
    { value: "m³", label: "m³ (Metro Cúbico)" },
  ]
  // Firmas
  const [firmaRol, setFirmaRol] = useState<"REPRESENTANTE_PROVEEDOR" | "CAPITAN" | "JEFE_MAQUINAS">("REPRESENTANTE_PROVEEDOR")
  const [firmaNombre, setFirmaNombre] = useState("")
  const [firmaData, setFirmaData] = useState("")
  const [firmaMode, setFirmaMode] = useState<"draw" | "upload">("draw")
  const [selloFile, setSelloFile] = useState<{ nombre: string; base64: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDeliveryTicketPublic(token)
      if (!data) { setError("Delivery Ticket no encontrado"); return }
      setDt(data)

      // Cargar cantidad entregada y unidad existentes
      if (data.cantidadEntregada > 0) {
        setCantidadEntregada(String(data.cantidadEntregada))
      }
      if (data.unidadMedida) {
        setUnidadMedida(data.unidadMedida)
      }

      // Cargar sondeos existentes
      if (data.sondajeAntesRealizado) setSondajeAntesRealizado(data.sondajeAntesRealizado)
      if (data.sondajeDespuesRealizado) setSondajeDespuesRealizado(data.sondajeDespuesRealizado)
      if (data.sondajeTestificado) setSondajeTestificado(data.sondajeTestificado)

      // Cargar vehiculos existentes
      if (data.vehiculos?.length > 0) {
        setPlacas(data.vehiculos.map((v: any) => v.placa))
      }

      // Cargar conductores existentes
      if (data.conductores?.length > 0) {
        setConductores(data.conductores.map((c: any) => c.nombre))
      }

      // Cargar timeline existente
      if (data.timeline?.length > 0) {
        const existing = EVENTOS_TIMELINE.map(evt => {
          const match = data.timeline.find((t: any) => t.evento === evt)
          return {
            evento: evt,
            fecha: match ? match.fecha.split("T")[0] : "",
            hora: match ? (match.hora ?? "") : "",
          }
        })
        setTimelineData(existing)
        setPaso("firmas")
      }

      // Verificar firmas existentes
      if (data.firmas?.length > 0) {
        // Already has signatures
      }
    } catch { setError("Error al cargar") } finally { setLoading(false) }
  }, [token])

  useEffect(() => { load() }, [load])

  async function handleGuardarTimeline() {
    setSubmitting(true)
    try {
      const qty = parseFloat(cantidadEntregada)
      await Promise.all([
        saveVehiculosPublic(token, placas.filter(p => p.trim())),
        saveConductoresPublic(token, conductores.filter(c => c.trim())),
        saveTimelinePublic(
          token,
          timelineData.filter(t => t.fecha),
          !isNaN(qty) && qty > 0 ? qty : undefined,
          unidadMedida,
          sondajeAntesRealizado || undefined,
          sondajeDespuesRealizado || undefined,
          sondajeTestificado || undefined,
        ),
      ])
      setSuccess("Timeline guardado exitosamente")
      setError("")
      setPaso("firmas")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar")
    } finally { setSubmitting(false) }
  }

  function updateTimeline(index: number, field: "fecha" | "hora", value: string) {
    const copy = [...timelineData]
    copy[index] = { ...copy[index], [field]: value }
    setTimelineData(copy)
  }

  function addPlaca() { setPlacas([...placas, ""]) }
  function updatePlaca(index: number, value: string) {
    const copy = [...placas]; copy[index] = value; setPlacas(copy)
  }
  function removePlaca(index: number) {
    if (placas.length > 1) setPlacas(placas.filter((_, i) => i !== index))
  }

  function addConductor() { setConductores([...conductores, ""]) }
  function updateConductor(index: number, value: string) {
    const copy = [...conductores]; copy[index] = value; setConductores(copy)
  }
  function removeConductor(index: number) {
    if (conductores.length > 1) setConductores(conductores.filter((_, i) => i !== index))
  }

  async function handleFirmar() {
    if (!firmaNombre || !firmaData) return
    setSubmitting(true)
    try {
      const selloBase64 = selloFile?.base64
      await firmarDeliveryTicketPublic(token, {
        rol: firmaRol,
        nombre: firmaNombre,
        firma: firmaData,
        sello: selloBase64,
      })
      setFirmaNombre(""); setFirmaData(""); setSelloFile(null)
      setSuccess("Firma registrada exitosamente")
      setError("")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al firmar")
    } finally { setSubmitting(false) }
  }

  async function handleFinalizar() {
    setSubmitting(true)
    try {
      const qty = parseFloat(cantidadEntregada)
      await finalizarPublic(token, !isNaN(qty) && qty > 0 ? qty : undefined)
      setSuccess("Documento finalizado exitosamente")
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al finalizar")
    } finally { setSubmitting(false) }
  }

  function handleFirmaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFirmaData(reader.result as string)
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p className="mt-2 text-sm text-muted-foreground">Cargando...</p></div>
    </div>
  )

  if (error && !dt) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="max-w-md w-full mx-4"><CardContent className="py-12 text-center">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Documento no encontrado</h2>
        <p className="text-sm text-muted-foreground">El enlace no es válido o el documento ha sido eliminado.</p>
      </CardContent></Card>
    </div>
  )

  const firmas = dt?.firmas ?? []
  const firmasPorRol: Record<string, any> = {}
  firmas.forEach((f: any) => { firmasPorRol[f.rol] = f })

  const timelineComplete = timelineData.every(t => t.fecha)
  const tieneFirmaProveedor = !!firmasPorRol["REPRESENTANTE_PROVEEDOR"]
  const tieneFirmaCapitan = !!firmasPorRol["CAPITAN"]
  const tieneFirmaJefe = !!firmasPorRol["JEFE_MAQUINAS"]

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <Ship className="h-10 w-10 mx-auto text-primary mb-2" />
          <h1 className="text-2xl font-bold">Delivery Ticket</h1>
          <p className="text-sm text-muted-foreground">#{dt.numero} — {formatDate(dt.fecha)}</p>
          <Badge variant={dt.estado === "BORRADOR" ? "secondary" : dt.estado === "CONFIRMADO" ? "default" : "success"} className="mt-1">
            {dt.estado === "BORRADOR" ? "Pendiente" : dt.estado === "CONFIRMADO" ? "Confirmado" : "Cerrado"}
          </Badge>
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-800 font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Info del DT */}
        <Card className="shadow-sm">
          <CardHeader className="py-3 bg-muted/30">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />Información del Documento
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <div className="space-y-1">
                <InfoRow label="Cliente / Customer" value={dt.cliente} />
                <InfoRow label="Motonave / Vessel" value={dt.motonave} />
                <InfoRow label="IMO" value={dt.imo} />
                <InfoRow label="Bandera / Flag" value={dt.bandera} />
                <InfoRow label="Puerto / Port" value={dt.puerto} />
                <InfoRow label="Lugar / Place" value={dt.lugarSuministro} />
              </div>
              <div className="space-y-1">
                <InfoRow label="Producto" value={`${dt.producto} (${dt.productoUnidad})`} />
                <InfoRow label="Cantidad / Quantity" value={dt.cantidadEntregada > 0 ? `${dt.cantidadEntregada} ${dt.unidadMedida}` : `Pendiente (${dt.unidadMedida})`} />
                <InfoRow label="Tipo" value={dt.tipoSuministro === "BARGE" ? "Barcaza" : dt.tipoSuministro === "TRUCKS" ? "Camión" : "-"} />
                <InfoRow label="Barcaza" value={dt.barcaza} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* PASO 1: Timeline */}
        {dt.estado === "BORRADOR" && paso === "timeline" && (
          <>
            {/* Vehículos / Placas */}
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="py-3 bg-blue-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-800">
                  <Truck className="h-4 w-4" />Vehículos / Vehicles
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                {placas.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={p} onChange={(e) => updatePlaca(i, e.target.value)} placeholder="Placa / License Plate" className="flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => removePlaca(i)} disabled={placas.length <= 1}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addPlaca}><Plus className="h-3 w-3 mr-1" />Agregar vehículo</Button>
              </CardContent>
            </Card>

            {/* Conductores / Drivers */}
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="py-3 bg-blue-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-800">
                  <User className="h-4 w-4" />Conductores / Drivers
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                {conductores.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input value={c} onChange={(e) => updateConductor(i, e.target.value)} placeholder="Nombre del conductor" className="flex-1" />
                    <Button variant="ghost" size="icon" onClick={() => removeConductor(i)} disabled={conductores.length <= 1}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addConductor}><Plus className="h-3 w-3 mr-1" />Agregar conductor</Button>
              </CardContent>
            </Card>

            {/* Cantidad Entregada */}
            <Card className="shadow-sm border-yellow-200">
              <CardHeader className="py-3 bg-yellow-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-800">
                  <FileText className="h-4 w-4" />Cantidad Entregada / Delivered Quantity
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-2">
                <p className="text-xs text-muted-foreground">Registra la cantidad total de producto entregado.</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cantidadEntregada}
                    onChange={(e) => setCantidadEntregada(e.target.value)}
                    placeholder="Cantidad"
                    className="flex-1"
                  />
                  <Select value={unidadMedida} onValueChange={setUnidadMedida}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIDADES.map((u) => (
                        <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Sondeos */}
            <Card className="shadow-sm border-yellow-200">
              <CardHeader className="py-3 bg-yellow-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-yellow-800">
                  <FileText className="h-4 w-4" />Sondeos / Draft Surveys
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Sondeo Antes / Draft Survey Before</Label>
                    <Select value={sondajeAntesRealizado} onValueChange={setSondajeAntesRealizado}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Sondeo Después / Draft Survey After</Label>
                    <Select value={sondajeDespuesRealizado} onValueChange={setSondajeDespuesRealizado}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Testificado por Representante del Barco / Witnessed by Ship Representative</Label>
                    <Select value={sondajeTestificado} onValueChange={setSondajeTestificado}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Seleccionar" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SI">Sí</SelectItem>
                        <SelectItem value="NO">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="shadow-sm border-blue-200">
              <CardHeader className="py-3 bg-blue-50">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-blue-800">
                  <Clock className="h-4 w-4" />Estado de Hechos / Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-4">
                <p className="text-xs text-muted-foreground">Registra la fecha y hora de cada evento del suministro.</p>
                {timelineData.map((ev, i) => (
                  <div key={i} className="border rounded p-3 space-y-2">
                    <p className="text-sm font-medium">{ev.evento}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Fecha / Date</Label>
                        <Input type="date" value={ev.fecha} onChange={(e) => updateTimeline(i, "fecha", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Hora / Time</Label>
                        <Input type="time" value={ev.hora} onChange={(e) => updateTimeline(i, "hora", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
                <Button onClick={handleGuardarTimeline} disabled={submitting} className="w-full bg-blue-600 hover:bg-blue-700">
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</> : "Guardar y Continuar a Firmas"}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

          {/* PASO 2: Firmas */}
        {dt.estado === "BORRADOR" && paso === "firmas" && (
          <>
            {/* Timeline summary */}
            {dt.timeline?.length > 0 && (
              <Card className="shadow-sm bg-green-50 border-green-200">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-green-800">
                    <CheckCircle className="h-4 w-4" />Timeline Completado
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 space-y-1">
                  {dt.timeline.map((t: any) => (
                    <div key={t.id} className="flex justify-between text-xs text-green-700">
                      <span>{t.evento}</span>
                      <span>{formatDate(t.fecha)}{t.hora ? ` - ${t.hora}` : ""}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Firmas existentes */}
            {firmas.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-muted/30">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Stamp className="h-4 w-4" />Firmas Registradas
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {firmas.map((f: any) => (
                      <div key={f.id} className="border rounded p-3">
                        <Badge variant="success" className="text-[10px] mb-1">{ROL_LABELS[f.rol] || f.rol}</Badge>
                        <p className="text-sm font-medium">{f.nombre}</p>
                        <div className="flex gap-3 mt-2 items-end">
                          {f.firma && <div className="border rounded p-1 bg-white flex-1"><img src={f.firma} alt="Firma" className="max-h-12" /></div>}
                          {f.sello && <div className="border rounded p-1 bg-white"><img src={f.sello} alt="Sello" className="max-h-14" /></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Formulario de firma */}
            <Card className="shadow-sm">
              <CardHeader className="py-3 bg-muted/30">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4" />Agregar Firma
                </CardTitle>
              </CardHeader>
              <CardContent className="py-3 space-y-4">
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Select value={firmaRol} onValueChange={(v) => setFirmaRol(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REPRESENTANTE_PROVEEDOR" disabled={tieneFirmaProveedor}>
                        Compañía de Entrega {tieneFirmaProveedor ? "(ya firmó)" : ""}
                      </SelectItem>
                      <SelectItem value="CAPITAN" disabled={tieneFirmaCapitan}>
                        Capitán {tieneFirmaCapitan ? "(ya firmó)" : ""}
                      </SelectItem>
                      <SelectItem value="JEFE_MAQUINAS" disabled={tieneFirmaJefe}>
                        Jefe de Máquinas {tieneFirmaJefe ? "(ya firmó)" : ""}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nombre completo</Label>
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
                      <Input type="file" accept="image/*" onChange={handleFirmaUpload} />
                      {firmaData && <div className="border rounded p-2 mt-2"><img src={firmaData} alt="Firma" className="max-h-20 mx-auto" /></div>}
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
                <Button onClick={handleFirmar} disabled={!firmaNombre || !firmaData || submitting} className="w-full">
                  {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Firmando...</> : "Registrar Firma"}
                </Button>
              </CardContent>
            </Card>

            {/* Botón Finalizar */}
            {tieneFirmaProveedor && (tieneFirmaCapitan || tieneFirmaJefe) && (
              <Button onClick={handleFinalizar} disabled={submitting} className="w-full bg-green-600 hover:bg-green-700 text-lg py-6">
                {submitting ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Finalizando...</> : "Finalizar Documento"}
              </Button>
            )}
          </>
        )}

        {/* CONFIRMADO */}
        {dt.estado === "CONFIRMADO" && (
          <>
            <Card className="shadow-sm bg-green-50 border-green-200">
              <CardContent className="py-6 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h2 className="text-lg font-semibold text-green-800">Documento Confirmado</h2>
                <p className="text-sm text-green-600">El Delivery Ticket ha sido completado y confirmado.</p>
              </CardContent>
            </Card>

            {firmas.length > 0 && (
              <Card className="shadow-sm">
                <CardHeader className="py-3 bg-muted/30">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Stamp className="h-4 w-4" />Firmas
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {firmas.map((f: any) => (
                      <div key={f.id} className="border rounded p-3">
                        <Badge variant="success" className="text-[10px] mb-1">{ROL_LABELS[f.rol] || f.rol}</Badge>
                        <p className="text-sm font-medium">{f.nombre}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(f.fecha)}</p>
                        <div className="flex gap-3 mt-2 items-end">
                          {f.firma && <div className="border rounded p-1 bg-white flex-1"><img src={f.firma} alt="Firma" className="max-h-12" /></div>}
                          {f.sello && <div className="border rounded p-1 bg-white"><img src={f.sello} alt="Sello" className="max-h-14" /></div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* CERRADO */}
        {dt.estado === "CERRADO" && (
          <Card className="shadow-sm bg-gray-100">
            <CardContent className="py-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h2 className="text-lg font-semibold">Delivery Ticket Cerrado</h2>
              <p className="text-sm text-muted-foreground">Este documento ya ha sido cerrado.</p>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground">Plataforma de Gestión de Suministro — © {new Date().getFullYear()}</p>
      </div>
    </div>
  )
}
