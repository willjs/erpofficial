"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import * as XLSX from "xlsx"
import * as Tabs from "@radix-ui/react-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import {
  Plus, Pencil, Trash2, Eye, Send, CheckCircle, FileText,
  ShoppingCart, DollarSign, Truck, Building2, Save, Copy,
  Link as LinkIcon, Loader2, Undo2,
} from "lucide-react"
import { formatMoney, formatDate, uuid } from "@/lib/utils"
import HistorialEstados from "@/components/compras/historial-estados"

type CentroCostos = { id: string; codigo: string; nombre: string; descripcion: string | null }
type Proveedor = { id: string; razonSocial: string; nit: string; contacto: string | null; telefono: string | null; email: string | null; direccion: string | null }

type ReqItem = { id: string; item: number; descripcion: string; centroCostosId: string | null; centroCostos: CentroCostos | null; unidadMedida: string; cantidadSolicitada: number }
type Requisicion = { id: string; empresaId: string; numero: number; fecha: string; areaSolicitante: string; requeridoPor: string; autorizadoPor: string | null; destino: string | null; prioridad: string; estado: string; observaciones: string | null; items: ReqItem[]; _count?: { cotizaciones: number; ordenesCompra: number } }

type CotItem = { id: string; item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number; valorProveedor1: number | null; valorProveedor2: number | null; valorProveedor3: number | null }
type CotPanelItem = { item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number }
type CotPanelArchivo = { key: string; nombre: string; base64?: string; url?: string }
type CotPanel = {
  proveedorId: string
  tiempoEntrega: string
  formaPago: string
  observaciones: string
  items: CotPanelItem[]
  archivos: CotPanelArchivo[]
}
type Cotizacion = { id: string; requisicionId: string; requisicion?: { id: string; numero: number }; proveedorId: string; proveedor: Proveedor; numero: number; fecha: string; valorTotal: number; tiempoEntrega: string | null; formaPago: string | null; ganadora: boolean; observaciones: string | null; items: CotItem[]; tokenPublico?: string | null; aprobadaPublicamente?: boolean; fechaAprobacionPublica?: string | null }



type OCItem = { id: string; item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number; tipoIva?: string }
type OrdenCompra = { id: string; numero: number; fecha: string; proveedor: Proveedor; requisicion: { id: string; numero: number }; valorTotal: number; estado: string; items: OCItem[]; _count?: { recepciones: number; cuentasPagar: number } }

type RecepcionItem = { id: string; item: number; descripcion: string; cantidadRecibida: number; observaciones: string | null }
type Recepcion = { id: string; ordenCompraId: string; ordenCompra: { id: string; numero: number; proveedor: Proveedor; items: OCItem[] }; remision: string | null; observaciones: string | null; estado: string; fechaRecepcion: string; items: RecepcionItem[] }

const PRIORIDAD_STYLES: Record<string, "default" | "warning" | "destructive"> = { NORMAL: "default", URGENTE: "warning", EMERGENCIA: "destructive" }
const ESTADO_REQ_STYLES: Record<string, string> = { BORRADOR: "secondary", EN_COTIZACION: "default", ORDEN_COMPRA_GENERADA: "info", CERRADA: "default" }
const ESTADO_OC_STYLES: Record<string, "secondary" | "success" | "warning" | "info"> = { EMITIDA: "info", RECIBIDA: "success", FACTURADA: "warning", CERRADA: "secondary" }
const PRIORIDAD_LABELS: Record<string, string> = { NORMAL: "Normal", URGENTE: "Urgente", EMERGENCIA: "Emergencia" }
const ESTADO_REQ_LABELS: Record<string, string> = { BORRADOR: "Borrador", EN_COTIZACION: "En Cotización", ORDEN_COMPRA_GENERADA: "OC Generada", CERRADA: "Cerrada" }
const FORMAS_DE_PAGO = ["Contado", "Contra entrega", "Anticipo", "Pago parcial", "Crédito 15 días", "Crédito 30 días", "Crédito 45 días", "Crédito 60 días", "Crédito 90 días", "Crédito 120 días", "Pago por cuotas", "Pago programado", "Pago recurrente", "Consignación", "Otra (especificar)"]

function defaultReqItem(): { item: number; descripcion: string; centroCostosId: string | null; unidadMedida: string; cantidadSolicitada: number } {
  return { item: 0, descripcion: "", centroCostosId: null, unidadMedida: "", cantidadSolicitada: 0 }
}
function defaultCotItem() { return { item: 0, descripcion: "", unidadMedida: "", cantidad: 0, valorUnitario: 0, valorTotal: 0, valorProveedor1: null, valorProveedor2: null, valorProveedor3: null } }
function defaultPanelItem(): CotPanelItem { return { item: 0, descripcion: "", unidadMedida: "", cantidad: 0, valorUnitario: 0, valorTotal: 0 } }

function defaultOCItem() { return { item: 0, descripcion: "", unidadMedida: "", cantidad: 0, valorUnitario: 0, valorTotal: 0, tipoIva: "EXENTO" } }

export default function ComprasPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [tab, setTab] = useState("requisiciones")

  // ─── Shared data ───────────────────────────────────
  const [centrosCostos, setCentrosCostos] = useState<CentroCostos[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])

  // ─── Requisiciones ─────────────────────────────────
  const [requisiciones, setRequisiciones] = useState<Requisicion[]>([])
  const [reqLoading, setReqLoading] = useState(true)
  const [reqSearch, setReqSearch] = useState("")
  const [reqDialogOpen, setReqDialogOpen] = useState(false)
  const [reqEditId, setReqEditId] = useState<string | null>(null)
  const [reqForm, setReqForm] = useState({ areaSolicitante: "", requeridoPor: "", prioridad: "NORMAL", observaciones: "", items: [defaultReqItem()] })
  const [reqSaving, setReqSaving] = useState(false)
  const [reqDetailId, setReqDetailId] = useState<string | null>(null)
  const [reqArchivos, setReqArchivos] = useState<{ key: string; file: File }[]>([])
  const [reqDragOver, setReqDragOver] = useState(false)
  const reqFileInputRef = useRef<HTMLInputElement>(null)

  // ─── Cotizaciones ──────────────────────────────────
  const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([])
  const [cotLoading, setCotLoading] = useState(true)
  const [cotDialogOpen, setCotDialogOpen] = useState(false)
  const [cotEditId, setCotEditId] = useState<string | null>(null)
  const [cotRequisicionId, setCotRequisicionId] = useState("")
  const [cotNumero, setCotNumero] = useState(0)
  const [cotPanels, setCotPanels] = useState<CotPanel[]>([])
  const [cotPanelOpen, setCotPanelOpen] = useState<number | null>(null)
  const [cotSaving, setCotSaving] = useState(false)
  const [cotFilterReq, setCotFilterReq] = useState("")
  const [cotDetailId, setCotDetailId] = useState<string | null>(null)
  const [cotLinkData, setCotLinkData] = useState<Record<string, { token: string; url: string }>>({})
  const [cotGenerandoLink, setCotGenerandoLink] = useState<string | null>(null)
  const [cotSelectedIds, setCotSelectedIds] = useState<string[]>([])
  const [comparativoLink, setComparativoLink] = useState<string | null>(null)
  const [origin, setOrigin] = useState("")
  useEffect(() => { setOrigin(window.location.origin) }, [])

  // ─── Ordenes de Compra ─────────────────────────────
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [ocLoading, setOcLoading] = useState(true)
  const [ocSearch, setOcSearch] = useState("")
  const [ocDialogOpen, setOcDialogOpen] = useState(false)
  const [ocForm, setOcForm] = useState({ requisicionId: "", cotizacionId: "", proveedorId: "", condicionesComerciales: "", fechaEntrega: "", sitioEntrega: "", centroCostosId: "", formaPago: "", correoFacturacion: "", observaciones: "", aplicaIVA: true, items: [defaultOCItem()] })
  const [ocSaving, setOcSaving] = useState(false)
  const [ocDetailId, setOcDetailId] = useState<string | null>(null)
  const [ocLinkData, setOcLinkData] = useState<Record<string, { token: string; url: string }>>({})
  const [ocGenerandoLink, setOcGenerandoLink] = useState<string | null>(null)

  // ─── Recepciones ────────────────────────────────────
  const [recepciones, setRecepciones] = useState<Recepcion[]>([])
  const [recLoading, setRecLoading] = useState(true)
  const [recSearch, setRecSearch] = useState("")
  const [recDialogOpen, setRecDialogOpen] = useState(false)
  const [recEditId, setRecEditId] = useState<string | null>(null)
  const [recForm, setRecForm] = useState({ ordenCompraId: "", remision: "", observaciones: "", items: [{ item: 1, descripcion: "", cantidadRecibida: 0, observaciones: "" }] })
  const [recSaving, setRecSaving] = useState(false)
  const [recDetailId, setRecDetailId] = useState<string | null>(null)

  // ─── Centros Costos CRUD ───────────────────────────
  const [ccDialogOpen, setCcDialogOpen] = useState(false)
  const [ccEditId, setCcEditId] = useState<string | null>(null)
  const [ccForm, setCcForm] = useState({ codigo: "", nombre: "", descripcion: "" })
  const [ccSaving, setCcSaving] = useState(false)

  // ─── Loaders ───────────────────────────────────────
  const loadCentrosCostos = useCallback(async () => {
    const { getCentrosCostos } = await import("@/actions/compras")
    const data = await getCentrosCostos()
    setCentrosCostos(data as CentroCostos[])
  }, [])

  const loadProveedores = useCallback(async () => {
    const { getProveedores } = await import("@/actions/compras")
    const data = await getProveedores()
    setProveedores(data as Proveedor[])
  }, [])

  const loadRequisiciones = useCallback(async () => {
    setReqLoading(true)
    try {
      const { getRequisiciones } = await import("@/actions/compras")
      const data = await getRequisiciones()
      setRequisiciones(data as Requisicion[])
    } finally { setReqLoading(false) }
  }, [])

  const loadCotizaciones = useCallback(async () => {
    setCotLoading(true)
    try {
      const { getCotizaciones } = await import("@/actions/compras")
      const data = await getCotizaciones()
      setCotizaciones(data as Cotizacion[])
    } finally { setCotLoading(false) }
  }, [])

  const loadOrdenes = useCallback(async () => {
    setOcLoading(true)
    try {
      const { getOrdenesCompra } = await import("@/actions/compras")
      const data = await getOrdenesCompra()
      setOrdenes(data as OrdenCompra[])
    } finally { setOcLoading(false) }
  }, [])

  const loadRecepciones = useCallback(async () => {
    setRecLoading(true)
    try {
      const { getRecepciones } = await import("@/actions/compras")
      const data = await getRecepciones()
      setRecepciones(data as Recepcion[])
    } finally { setRecLoading(false) }
  }, [])

  const loadAll = useCallback(() => {
    loadCentrosCostos()
    loadProveedores()
    loadRequisiciones()
    loadCotizaciones()
    loadOrdenes()
    loadRecepciones()
  }, [loadCentrosCostos, loadProveedores, loadRequisiciones, loadCotizaciones, loadOrdenes, loadRecepciones])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── Helpers ───────────────────────────────────────
  function getRequisicionesAprobadas() {
    return requisiciones.filter(r => r.estado === "EN_COTIZACION")
  }

  function getReqItemsForOC(requisicionId: string) {
    const req = requisiciones.find(r => r.id === requisicionId)
    if (!req) return [defaultOCItem()]
  return req.items.map((i, idx) => ({
    item: idx + 1,
    descripcion: i.descripcion,
    unidadMedida: i.unidadMedida,
    cantidad: Number(i.cantidadSolicitada),
    valorUnitario: 0,
    valorTotal: 0,
    tipoIva: "EXENTO",
  }))
  }

  // ════════════════════════════════════════════════════════
  // REQUISICIONES
  // ════════════════════════════════════════════════════════
  const filteredReqs = reqSearch
    ? requisiciones.filter(r =>
      r.numero.toString().includes(reqSearch) ||
      r.areaSolicitante.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.requeridoPor.toLowerCase().includes(reqSearch.toLowerCase()))
    : requisiciones

  function openReqCreate() {
    setReqEditId(null)
    setReqForm({ areaSolicitante: "", requeridoPor: "", prioridad: "NORMAL", observaciones: "", items: [defaultReqItem()] })
    setReqDialogOpen(true)
  }

  async function openReqEdit(id: string) {
    try {
      const { getRequisicion } = await import("@/actions/compras")
      const data = await getRequisicion(id) as Requisicion
      setReqEditId(id)
      setReqForm({
        areaSolicitante: data.areaSolicitante,
        requeridoPor: data.requeridoPor,
        prioridad: data.prioridad,
        observaciones: data.observaciones ?? "",
        items: data.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          centroCostosId: i.centroCostos?.id ?? null,
          unidadMedida: i.unidadMedida,
          cantidadSolicitada: Number(i.cantidadSolicitada),
        })),
      })
      setReqDialogOpen(true)
    } catch {
      toast({ title: "Error al cargar requisición", variant: "destructive" })
    }
  }

  function addReqItem() {
    setReqForm(prev => ({
      ...prev,
      items: [...prev.items, defaultReqItem()],
    }))
  }

  function removeReqItem(idx: number) {
    setReqForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }))
  }

  function updateReqItem(idx: number, field: string, value: any) {
    setReqForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, items }
    })
  }

  async function handleReqSave(e: React.FormEvent) {
    e.preventDefault()
    setReqSaving(true)
    try {
      const actions = await import("@/actions/compras")
      const payload = {
        areaSolicitante: reqForm.areaSolicitante,
        requeridoPor: reqForm.requeridoPor,
        autorizadoPor: null,
        destino: null,
        prioridad: reqForm.prioridad as any,
        observaciones: reqForm.observaciones || null,
        items: reqForm.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          centroCostosId: i.centroCostosId,
          unidadMedida: i.unidadMedida,
          cantidadSolicitada: i.cantidadSolicitada,
        })),
      }
      if (reqEditId) {
        await actions.updateRequisicion(reqEditId, payload as any)
      } else {
        await actions.createRequisicion(payload as any)
      }
      setReqDialogOpen(false)
      loadRequisiciones()
      toast({ title: reqEditId ? "Requisición actualizada" : "Requisición creada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar requisición", description: err?.message, variant: "destructive" })
    } finally { setReqSaving(false) }
  }

  async function handleReqDelete(id: string) {
    if (!confirm("¿Eliminar esta requisición?")) return
    try {
      const { deleteRequisicion } = await import("@/actions/compras")
      await deleteRequisicion(id)
      loadRequisiciones()
      toast({ title: "Requisición eliminada", variant: "success" })
    } catch (err: any) { toast({ title: "Error al eliminar", description: err?.message, variant: "destructive" }) }
  }

  async function handleReqEnviar(id: string) {
    if (!confirm("¿Enviar requisición para aprobación?")) return
    try {
      const { enviarRequisicion } = await import("@/actions/compras")
      await enviarRequisicion(id)
      loadRequisiciones()
      toast({ title: "Requisición enviada para aprobación", variant: "success" })
    } catch (err: any) { toast({ title: "Error al enviar", description: err?.message, variant: "destructive" }) }
  }

  // ─── Excel / Archivos ────────────────────────────────
  function handleReqExcel(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rowsArr: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        let headerRow: string[] | null = null
        let dataStartIdx = -1

        for (let i = 0; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const joined = row.map(String).join(" ").toLowerCase()
          if (
            joined.includes("descripción") || joined.includes("descripcion") ||
            joined.includes("concepto") || (joined.includes("cantidad") && joined.includes("und"))
          ) {
            headerRow = row.map(String)
            dataStartIdx = i + 1
            break
          }
        }

        if (!headerRow) {
          for (let i = 0; i < rowsArr.length; i++) {
            if (rowsArr[i] && rowsArr[i].length >= 2) {
              headerRow = rowsArr[i].map(String)
              dataStartIdx = i + 1
              break
            }
          }
        }

        if (!headerRow) return

        const descIdx = headerRow.findIndex((h) =>
          /descripci[oó]n|concepto|art[ií]culo|producto|item/i.test(h)
        )
        const undIdx = headerRow.findIndex((h) => {
          const v = (h ?? "").trim()
          return /^und$/i.test(v) || /^und$/i.test(v.replace(/\s+/g, "")) ||
            /unidad/i.test(v) || /medida/i.test(v) || /umedida/i.test(v)
        })
        const cantIdx = headerRow.findIndex((h) => /cantidad/i.test(h))

        const parsed: { descripcion: string; unidadMedida: string; cantidadSolicitada: number }[] = []
        for (let i = dataStartIdx; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const desc = descIdx >= 0 ? String(row[descIdx] ?? "").trim() : ""
          const und = undIdx >= 0 ? String(row[undIdx] ?? "").trim() : ""
          const cant = cantIdx >= 0 ? Number(row[cantIdx]) || 0 : 0
          if (!desc && cant === 0) continue
          parsed.push({ descripcion: desc, unidadMedida: und, cantidadSolicitada: cant })
        }

        if (parsed.length > 0) {
          setReqForm(prev => ({
            ...prev,
            items: parsed.map(p => ({ item: 0, descripcion: p.descripcion, centroCostosId: null, unidadMedida: p.unidadMedida, cantidadSolicitada: p.cantidadSolicitada })),
          }))
        }
      } catch {
        toast({ title: "Error al leer archivo Excel", variant: "destructive" })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function addReqArchivos(files: FileList) {
    const nuevos: { key: string; file: File }[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.match(/\.xlsx?$/i)) {
        handleReqExcel(file)
      }
      nuevos.push({ key: uuid(), file })
    }
    setReqArchivos(prev => [...prev, ...nuevos])
  }

  function removeReqArchivo(key: string) {
    setReqArchivos(prev => prev.filter(a => a.key !== key))
  }

  function formatReqSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function onReqDrop(e: React.DragEvent) {
    e.preventDefault()
    setReqDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addReqArchivos(e.dataTransfer.files)
    }
  }

  // ════════════════════════════════════════════════════════
  // COTIZACIONES
  // ════════════════════════════════════════════════════════
  const filteredCots = cotFilterReq
    ? cotizaciones.filter(c => c.requisicionId === cotFilterReq)
    : cotizaciones

  const reqsAprobadas = getRequisicionesAprobadas()

  function openCotCreate() {
    setCotEditId(null)
    setCotRequisicionId("")
    setCotNumero(0)
    setCotPanels([])
    setCotPanelOpen(null)
    setCotDialogOpen(true)
  }

  async function openCotEdit(id: string) {
    try {
      const { getCotizacion } = await import("@/actions/compras")
      const data = await getCotizacion(id) as any
      setCotEditId(id)
      setCotRequisicionId(data.requisicionId)
      setCotNumero(1)
      setCotPanels([{
        proveedorId: data.proveedorId,
        tiempoEntrega: data.tiempoEntrega ?? "",
        formaPago: data.formaPago ?? "",
        observaciones: data.observaciones ?? "",
        items: data.items.map((i: any, idx: number) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: Number(i.cantidad),
          valorTotal: Number(i.valorTotal),
        })),
        archivos: (data.archivos || []).map((a: any) => ({ key: uuid(), nombre: a.nombre, url: a.url })),
      }])
      setCotPanelOpen(0)
      setCotDialogOpen(true)
    } catch {
      toast({ title: "Error al cargar cotización", variant: "destructive" })
    }
  }

  function initCotPanels(reqId: string, num: number) {
    const req = requisiciones.find(r => r.id === reqId)
    const baseItems = req ? req.items.map((i, idx) => ({
      item: idx + 1,
      descripcion: i.descripcion,
      unidadMedida: i.unidadMedida,
      cantidad: Number(i.cantidadSolicitada),
      valorUnitario: 0,
      valorTotal: 0,
    })) : [defaultPanelItem()]
    const panels: CotPanel[] = Array.from({ length: num }, () => ({
      proveedorId: "",
      tiempoEntrega: "",
      formaPago: "",
      observaciones: "",
      items: baseItems.map(i => ({ ...i })),
      archivos: [],
    }))
    setCotPanels(panels)
    setCotPanelOpen(0)
  }

  function updatePanel(panelIdx: number, field: string, value: any) {
    setCotPanels(prev => {
      const copy = [...prev]
      copy[panelIdx] = { ...copy[panelIdx], [field]: value }
      return copy
    })
  }

  function updatePanelItemUnit(panelIdx: number, itemIdx: number, value: number) {
    setCotPanels(prev => {
      const copy = [...prev]
      const items = [...copy[panelIdx].items]
      const item = items[itemIdx]
      items[itemIdx] = { ...item, valorUnitario: value, valorTotal: Number(item.cantidad) * value }
      copy[panelIdx] = { ...copy[panelIdx], items }
      return copy
    })
  }

  function addPanelArchivos(panelIdx: number, files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const key = uuid()
      setCotPanels(prev => {
        const copy = [...prev]
        copy[panelIdx] = { ...copy[panelIdx], archivos: [...copy[panelIdx].archivos, { key, nombre: file.name }] }
        return copy
      })
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(",")[1] ?? ""
        setCotPanels(prev => {
          const copy = [...prev]
          copy[panelIdx] = { ...copy[panelIdx], archivos: copy[panelIdx].archivos.map(a => a.key === key ? { ...a, base64 } : a) }
          return copy
        })
      }
      reader.readAsDataURL(file)
    }
  }

  function removePanelArchivo(panelIdx: number, key: string) {
    setCotPanels(prev => {
      const copy = [...prev]
      copy[panelIdx] = { ...copy[panelIdx], archivos: copy[panelIdx].archivos.filter(a => a.key !== key) }
      return copy
    })
  }

  function handleCotSave(e: React.FormEvent) {
    e.preventDefault()
    setCotSaving(true)
    saveCotizaciones()
  }

  async function saveCotizaciones() {
    try {
      const emptyProv = cotPanels.find(p => !p.proveedorId)
      if (emptyProv) {
        setCotSaving(false)
        toast({ title: "Error", description: "Todos los paneles deben tener un proveedor seleccionado", variant: "destructive" })
        return
      }
      const actions = await import("@/actions/compras")
      if (cotEditId) {
        const panel = cotPanels[0]
        const payload = {
          requisicionId: cotRequisicionId,
          proveedorId: panel.proveedorId,
          tiempoEntrega: panel.tiempoEntrega || null,
          formaPago: panel.formaPago || null,
          observaciones: panel.observaciones || null,
          items: panel.items.map(i => ({
            item: i.item,
            descripcion: i.descripcion,
            unidadMedida: i.unidadMedida,
            cantidad: i.cantidad,
            valorUnitario: i.valorUnitario,
            valorTotal: i.valorTotal,
          })),
          archivos: panel.archivos.map(a => a.base64 ? { nombre: a.nombre, base64: a.base64 } : { nombre: a.nombre, url: a.url }),
        } as any
        await actions.updateCotizacion(cotEditId, payload)
      } else {
        await actions.createMultipleCotizaciones({
          requisicionId: cotRequisicionId,
          cotizaciones: cotPanels.map(p => ({
            proveedorId: p.proveedorId,
            tiempoEntrega: p.tiempoEntrega || null,
            formaPago: p.formaPago || null,
            observaciones: p.observaciones || null,
            items: p.items.map(i => ({
              descripcion: i.descripcion,
              unidadMedida: i.unidadMedida,
              cantidad: i.cantidad,
              valorUnitario: i.valorUnitario,
              valorTotal: i.valorTotal,
            })),
            archivos: p.archivos.map(a => a.base64 ? { nombre: a.nombre, base64: a.base64 } : { nombre: a.nombre, url: a.url }),
          })),
        })
      }
      setCotDialogOpen(false)
      loadCotizaciones()
      loadRequisiciones()
      toast({ title: cotEditId ? "Cotización actualizada" : `${cotPanels.length} cotización(es) creada(s)`, variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar cotización", description: err?.message, variant: "destructive" })
    } finally { setCotSaving(false) }
  }

  async function handleSeleccionarCot(id: string) {
    if (!confirm("¿Seleccionar esta cotización como ganadora?")) return
    try {
      const { seleccionarCotizacion } = await import("@/actions/compras")
      await seleccionarCotizacion(id)
      loadCotizaciones()
      toast({ title: "Cotización seleccionada como ganadora", variant: "success" })
    } catch (err: any) { toast({ title: "Error al seleccionar", description: err?.message, variant: "destructive" }) }
  }

  async function handleCotDelete(id: string) {
    if (!confirm("¿Eliminar esta cotización?")) return
    try {
      const { deleteCotizacion } = await import("@/actions/compras")
      await deleteCotizacion(id)
      loadCotizaciones()
      toast({ title: "Cotización eliminada", variant: "success" })
    } catch (err: any) { toast({ title: "Error al eliminar", description: err?.message, variant: "destructive" }) }
  }

  async function handleGenerarLink(id: string) {
    setCotGenerandoLink(id)
    try {
      const { generarLinkPublicoCotizacion } = await import("@/actions/compras")
      const res = await generarLinkPublicoCotizacion(id)
      setCotLinkData((prev) => ({ ...prev, [id]: { ...res, url: `${origin}/publico/cotizacion/${res.token}` } }))
      loadCotizaciones()
      toast({ title: "Link público generado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    } finally {
      setCotGenerandoLink(null)
    }
  }

  async function handleLimpiarLink(id: string) {
    if (!confirm("¿Eliminar el link público?")) return
    try {
      const { limpiarLinkPublicoCotizacion } = await import("@/actions/compras")
      await limpiarLinkPublicoCotizacion(id)
      setCotLinkData((prev) => { const copy = { ...prev }; delete copy[id]; return copy })
      loadCotizaciones()
      toast({ title: "Link público eliminado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  async function handleOCGenerarLink(id: string) {
    setOcGenerandoLink(id)
    try {
      const { generarLinkPublicoOrdenCompra } = await import("@/actions/compras")
      const res = await generarLinkPublicoOrdenCompra(id)
      setOcLinkData((prev) => ({ ...prev, [id]: { ...res, url: `${origin}/publico/orden-compra/${res.token}` } }))
      loadOrdenes()
      toast({ title: "Link público generado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    } finally {
      setOcGenerandoLink(null)
    }
  }

  async function handleOCLimpiarLink(id: string) {
    if (!confirm("¿Eliminar el link público?")) return
    try {
      const { limpiarLinkPublicoOrdenCompra } = await import("@/actions/compras")
      await limpiarLinkPublicoOrdenCompra(id)
      setOcLinkData((prev) => { const copy = { ...prev }; delete copy[id]; return copy })
      loadOrdenes()
      toast({ title: "Link público eliminado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  async function handleGenerarComparativo() {
    if (cotSelectedIds.length < 2) return
    const selected = cotizaciones.filter(c => cotSelectedIds.includes(c.id))
    const reqIds = new Set(selected.map(c => c.requisicionId))
    if (reqIds.size > 1) {
      toast({ title: "Error", description: "Seleccione cotizaciones de la misma requisición", variant: "destructive" })
      return
    }

    setCotGenerandoLink("comparativo")
    try {
      const { generarLinkComparativo } = await import("@/actions/compras")
      const res = await generarLinkComparativo({ requisicionId: selected[0].requisicionId, cotizacionesIds: cotSelectedIds })
      setComparativoLink(`${origin}/publico/comparativo/${res.token}`)
      setCotSelectedIds([])
      toast({ title: "Link comparativo generado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    } finally {
      setCotGenerandoLink(null)
    }
  }

  // ─── Cotización Utils ──────────────────────────────
  function panelSum(panel: CotPanel): number {
    return panel.items.reduce((s, i) => s + Number(i.valorTotal), 0)
  }

  // ════════════════════════════════════════════════════════
  // ORDENES DE COMPRA
  // ════════════════════════════════════════════════════════
  const filteredOCs = ocSearch
    ? ordenes.filter(o =>
      o.numero.toString().includes(ocSearch) ||
      o.proveedor.razonSocial.toLowerCase().includes(ocSearch.toLowerCase()))
    : ordenes

  function openOCCreate() {
    setOcForm({ requisicionId: "", cotizacionId: "", proveedorId: "", condicionesComerciales: "", fechaEntrega: "", sitioEntrega: "", centroCostosId: "", formaPago: "", correoFacturacion: "", observaciones: "", aplicaIVA: true, items: [defaultOCItem()] })
    setOcDialogOpen(true)
  }

  function addOCItem() {
    setOcForm(prev => ({ ...prev, items: [...prev.items, defaultOCItem()] }))
  }

  function removeOCItem(idx: number) {
    setOcForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  function updateOCItem(idx: number, field: string, value: any) {
    setOcForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === "cantidad" || field === "valorUnitario") {
        items[idx].valorTotal = (Number(items[idx].cantidad) || 0) * (Number(items[idx].valorUnitario) || 0)
      }
      return { ...prev, items }
    })
  }

  function handleReqSelectForOC(reqId: string) {
    const req = requisiciones.find(r => r.id === reqId)
    if (req) {
      const cot = cotizaciones.find(c => c.requisicionId === reqId && c.ganadora) || cotizaciones.find(c => c.requisicionId === reqId)
      const cc = centrosCostos.find(c => c.nombre === req.areaSolicitante)
      setOcForm(prev => ({
        ...prev,
        requisicionId: reqId,
        cotizacionId: cot?.id ?? "",
        proveedorId: cot?.proveedorId ?? "",
        formaPago: cot?.formaPago ?? "",
        centroCostosId: cc?.id ?? "",
        items: cot ? cot.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: Number(i.cantidad),
          valorUnitario: Number(i.valorProveedor1) || Number(i.valorUnitario) || (Number(i.cantidad) > 0 ? Number(i.valorTotal) / Number(i.cantidad) : 0),
          valorTotal: Number(i.valorTotal),
          tipoIva: "EXENTO",
        })) : req.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: Number(i.cantidadSolicitada),
          valorUnitario: 0,
          valorTotal: 0,
          tipoIva: "EXENTO",
        })),
      }))
    }
  }

  async function handleOCSave(e: React.FormEvent) {
    e.preventDefault()
    setOcSaving(true)
    try {
      const { generarOrdenCompra } = await import("@/actions/compras")
      await generarOrdenCompra({
        requisicionId: ocForm.requisicionId,
        cotizacionId: ocForm.cotizacionId || null,
        proveedorId: ocForm.proveedorId,
        condicionesComerciales: ocForm.condicionesComerciales || null,
        fechaEntrega: ocForm.fechaEntrega || null,
        sitioEntrega: ocForm.sitioEntrega || null,
        centroCostosId: ocForm.centroCostosId || null,
        formaPago: ocForm.formaPago || null,
        correoFacturacion: ocForm.correoFacturacion || null,
        observaciones: ocForm.observaciones || null,
        items: ocForm.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: i.cantidad,
          valorUnitario: i.valorUnitario,
          valorTotal: i.valorTotal,
          tipoIva: i.tipoIva,
        })),
      } as any)
      setOcDialogOpen(false)
      loadOrdenes()
      loadRequisiciones()
      toast({ title: "Orden de compra generada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al generar OC", description: err?.message, variant: "destructive" })
    } finally { setOcSaving(false) }
  }

  async function handleEnviarATesoreria(ocId: string) {
    try {
      const { crearCuentaPagar, enviarATesoreria } = await import("@/actions/compras")
      const cp = await crearCuentaPagar(ocId)
      await enviarATesoreria((cp as any).id)
      loadOrdenes()
      toast({ title: "Cuenta por Pagar enviada a Tesorería", description: "Redirigiendo...", variant: "success" })
      setTimeout(() => router.push("/tesoreria"), 800)
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  async function handleRevertirOC(id: string) {
    if (!confirm("¿Está seguro de revertir esta OC a EMITIDA? Se eliminarán las cuentas por pagar asociadas.")) return
    try {
      const { revertirOCFacturada } = await import("@/actions/compras")
      await revertirOCFacturada(id)
      loadOrdenes()
      toast({ title: "OC revertida a EMITIDA", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  async function handleDuplicarOC(id: string) {
    try {
      const { duplicarOrdenCompra } = await import("@/actions/compras")
      const nueva = await duplicarOrdenCompra(id)
      loadOrdenes()
      toast({ title: `OC #${nueva.numero} creada`, description: "Orden de compra duplicada exitosamente", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al duplicar OC", description: err?.message, variant: "destructive" })
    }
  }

  // ════════════════════════════════════════════════════════
  // RECEPCIONES
  // ════════════════════════════════════════════════════════

  const ESTADO_REC_STYLES: Record<string, "success" | "warning" | "secondary"> = { COMPLETA: "success", PARCIAL: "warning", PENDIENTE: "secondary" }

  function openRecCreate() {
    setRecEditId(null)
    setRecForm({ ordenCompraId: "", remision: "", observaciones: "", items: [{ item: 1, descripcion: "", cantidadRecibida: 0, observaciones: "" }] })
    setRecDialogOpen(true)
  }

  function openRecEdit(rec: Recepcion) {
    setRecEditId(rec.id)
    setRecForm({
      ordenCompraId: rec.ordenCompraId,
      remision: rec.remision ?? "",
      observaciones: rec.observaciones ?? "",
      items: rec.items.map(i => ({ item: i.item, descripcion: i.descripcion, cantidadRecibida: i.cantidadRecibida, observaciones: i.observaciones ?? "" })),
    })
    setRecDialogOpen(true)
  }

  function addRecItem() {
    setRecForm(p => ({ ...p, items: [...p.items, { item: p.items.length + 1, descripcion: "", cantidadRecibida: 0, observaciones: "" }] }))
  }

  function removeRecItem(idx: number) {
    setRecForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, item: i + 1 })) }))
  }

  function updateRecItem(idx: number, field: string, value: any) {
    setRecForm(p => ({ ...p, items: p.items.map((it, i) => i === idx ? { ...it, [field]: value } : it) }))
  }

  function autoFillRecItems(ocId: string) {
    const oc = ordenes.find(o => o.id === ocId)
    if (!oc) return
    setRecForm(p => ({
      ...p,
      ordenCompraId: ocId,
      items: oc.items.map(i => ({ item: i.item, descripcion: i.descripcion, cantidadRecibida: Number(i.cantidad), observaciones: "" })),
    }))
  }

  async function handleRecSave(e: React.FormEvent) {
    e.preventDefault()
    setRecSaving(true)
    try {
      const { createRecepcion, updateRecepcion } = await import("@/actions/compras")
      if (recEditId) {
        await updateRecepcion(recEditId, recForm as any)
        toast({ title: "Recepción actualizada", variant: "success" })
      } else {
        await createRecepcion(recForm as any)
        toast({ title: "Recepción registrada — stock y contabilidad actualizados", variant: "success" })
      }
      setRecDialogOpen(false)
      await loadRecepciones()
      await loadOrdenes()
    } catch (err: any) {
      toast({ title: "Error al guardar recepción", description: err?.message, variant: "destructive" })
    } finally { setRecSaving(false) }
  }

  async function handleRecDelete(id: string) {
    if (!confirm("¿Eliminar esta recepción?")) return
    try {
      const { deleteRecepcion } = await import("@/actions/compras")
      await deleteRecepcion(id)
      await loadRecepciones()
      toast({ title: "Recepción eliminada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err?.message, variant: "destructive" })
    }
  }

  const filteredRec = recSearch ? recepciones.filter(r => {
    const q = recSearch.toLowerCase()
    return String(r.ordenCompra?.numero).includes(q) || r.ordenCompra?.proveedor?.razonSocial?.toLowerCase().includes(q) || r.estado.toLowerCase().includes(q) || (r.remision ?? "").toLowerCase().includes(q)
  }) : recepciones

  const recColumns: Column<Recepcion>[] = [
    { key: "ordenCompra", header: "OC", render: (r) => <span className="font-mono">#{r.ordenCompra?.numero}</span> },
    { key: "proveedor", header: "Proveedor", render: (r) => r.ordenCompra?.proveedor?.razonSocial ?? "—" },
    { key: "remision", header: "Remisión", render: (r) => r.remision ?? "—" },
    { key: "fechaRecepcion", header: "Fecha", render: (r) => formatDate(r.fechaRecepcion) },
    { key: "items", header: "Items", render: (r) => r.items.length },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={(ESTADO_REC_STYLES as any)[r.estado] ?? "default"}>{r.estado}</Badge> },
    {
      key: "acciones", header: "", className: "w-[100px] text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => setRecDetailId(r.id)}><Eye className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Editar" onClick={() => openRecEdit(r)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" title="Eliminar" onClick={() => handleRecDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  // ════════════════════════════════════════════════════════
  // CENTROS COSTOS CRUD
  // ════════════════════════════════════════════════════════
  function openCCCreate() {
    setCcEditId(null)
    setCcForm({ codigo: "", nombre: "", descripcion: "" })
    setCcDialogOpen(true)
  }

  function openCCEdit(cc: CentroCostos) {
    setCcEditId(cc.id)
    setCcForm({ codigo: cc.codigo, nombre: cc.nombre, descripcion: cc.descripcion ?? "" })
    setCcDialogOpen(true)
  }

  async function handleCCSave(e: React.FormEvent) {
    e.preventDefault()
    setCcSaving(true)
    try {
      const { createCentroCostos, updateCentroCostos } = await import("@/actions/compras")
      if (ccEditId) {
        await updateCentroCostos(ccEditId, ccForm as any)
      } else {
        await createCentroCostos(ccForm as any)
      }
      setCcDialogOpen(false)
      loadCentrosCostos()
      toast({ title: ccEditId ? "Centro de costos actualizado" : "Centro de costos creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar centro de costos", description: err?.message, variant: "destructive" })
    } finally { setCcSaving(false) }
  }

  async function handleCCDelete(id: string) {
    if (!confirm("¿Desactivar este centro de costos?")) return
    try {
      const { deleteCentroCostos } = await import("@/actions/compras")
      await deleteCentroCostos(id)
      loadCentrosCostos()
      toast({ title: "Centro de costos desactivado", variant: "success" })
    } catch (err: any) { toast({ title: "Error al desactivar centro de costos", description: err?.message, variant: "destructive" }) }
  }

  // ════════════════════════════════════════════════════════
  // COLUMNAS
  // ════════════════════════════════════════════════════════
  const reqColumns: Column<Requisicion>[] = [
    { key: "numero", header: "No.", render: (r) => <span className="font-mono">{r.numero}</span>, className: "w-16" },
    { key: "fecha", header: "Fecha", render: (r) => formatDate(r.fecha), className: "w-24" },
    { key: "areaSolicitante", header: "Centro de Costo" },
    { key: "requeridoPor", header: "Solicitante" },
    { key: "prioridad", header: "Prioridad", render: (r) => <Badge variant={PRIORIDAD_STYLES[r.prioridad] ?? "default"}>{PRIORIDAD_LABELS[r.prioridad]}</Badge>, className: "w-24" },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={(ESTADO_REQ_STYLES as any)[r.estado] ?? "secondary"}>{ESTADO_REQ_LABELS[r.estado] ?? r.estado}</Badge>, className: "w-32" },
    {
      key: "acciones", header: "", render: (r) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setReqDetailId(reqDetailId === r.id ? null : r.id)} title="Ver detalles"><Eye className="h-4 w-4" /></Button>
          {r.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleReqEnviar(r.id)} title="Enviar"><Send className="h-4 w-4 text-blue-600" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openReqEdit(r.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleReqDelete(r.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
            </>
          )}
        </div>
      ), className: "w-40"
    },
  ]

  const cotColumns: Column<Cotizacion>[] = [
    {
      key: "select", header: "", render: (c) => (
        <input type="checkbox" className="h-4 w-4 cursor-pointer"
          checked={cotSelectedIds.includes(c.id)}
          onChange={(e) => {
            if (e.target.checked) setCotSelectedIds(p => [...p, c.id])
            else setCotSelectedIds(p => p.filter(id => id !== c.id))
          }}
        />
      ), className: "w-10 text-center"
    },
    { key: "numero", header: "No.", render: (c) => <span className="font-mono">{c.numero}</span>, className: "w-16" },
    { key: "fecha", header: "Fecha", render: (c) => formatDate(c.fecha), className: "w-24" },
    { key: "requisicion", header: "Requisición", render: (c) => c.requisicion ? <span className="font-mono text-primary">#{c.requisicion.numero}</span> : "—", className: "w-24" },
    { key: "proveedor", header: "Proveedor", render: (c) => c.proveedor?.razonSocial },
    { key: "valorTotal", header: "Valor Total", render: (c) => formatMoney(c.valorTotal), className: "w-28 text-right" },
    { key: "ganadora", header: "Ganadora", render: (c) => c.ganadora ? <Badge variant="success">Sí</Badge> : <Badge variant="secondary">No</Badge>, className: "w-20" },
    {
      key: "acciones", header: "", render: (c) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCotDetailId(c.id)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
          {!c.ganadora && <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleSeleccionarCot(c.id)} title="Seleccionar"><CheckCircle className="h-4 w-4" /></Button>}
          {!c.ganadora && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCotEdit(c.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>}
          {!c.ganadora && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleCotDelete(c.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>}
        </div>
      ), className: "w-40"
    },
  ]

  const ocColumns: Column<OrdenCompra>[] = [
    { key: "numero", header: "OC No.", render: (o) => <span className="font-mono">{o.numero}</span>, className: "w-20" },
    { key: "fecha", header: "Fecha", render: (o) => formatDate(o.fecha), className: "w-24" },
    { key: "proveedor", header: "Proveedor", render: (o) => o.proveedor?.razonSocial },
    { key: "valorTotal", header: "Valor Total", render: (o) => formatMoney(o.valorTotal), className: "w-28 text-right" },
    { key: "estado", header: "Estado", render: (o) => <Badge variant={(ESTADO_OC_STYLES as any)[o.estado] ?? "default"}>{o.estado}</Badge>, className: "w-24" },
    {
      key: "acciones", header: "", render: (o) => (
        <div className="flex gap-1">
          {o.estado === "EMITIDA" && (
            <Button variant="ghost" size="sm" className="text-blue-600 h-7" onClick={() => handleEnviarATesoreria(o.id)} title="Enviar a Tesorería">
              <DollarSign className="h-4 w-4 mr-1" />Tesorería
            </Button>
          )}
          {o.estado === "FACTURADA" && (
            <Button variant="ghost" size="sm" className="text-amber-600 h-7" onClick={() => handleRevertirOC(o.id)} title="Retroceder a EMITIDA">
              <Undo2 className="h-4 w-4 mr-1" />Retroceder
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-green-600 h-7" onClick={() => handleDuplicarOC(o.id)} title="Duplicar OC">
            <Copy className="h-4 w-4 mr-1" />Duplicar
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOcDetailId(ocDetailId === o.id ? null : o.id)} title="Ver"><Eye className="h-4 w-4" /></Button>
        </div>
      ), className: "w-32"
    },
  ]

  const ccColumns: Column<CentroCostos>[] = [
    { key: "codigo", header: "Código", render: (c) => <span className="font-mono">{c.codigo}</span> },
    { key: "nombre", header: "Nombre" },
    { key: "descripcion", header: "Descripción" },
    {
      key: "acciones", header: "", render: (c) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCCEdit(c)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleCCDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      ), className: "w-20"
    },
  ]

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      <PageHeader title="Compras" description="Gestión de compras, proveedores y recepción" />

      <Tabs.Root value={tab} onValueChange={setTab} className="space-y-4">
        <Tabs.List className="flex gap-1 border-b flex-wrap">
          {[
            { value: "requisiciones", label: "Requisiciones", icon: ShoppingCart },
            { value: "cotizaciones", label: "Cotizaciones", icon: DollarSign },
            { value: "ordenes", label: "Órdenes de Compra", icon: FileText },
            { value: "recepciones", label: "Recepciones", icon: Truck },
            { value: "centros-costos", label: "Centros Costo", icon: Building2 },
          ].map(t => (
            <Tabs.Trigger key={t.value} value={t.value}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* ═══ REQUISICIONES ═══ */}
        <Tabs.Content value="requisiciones" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Input placeholder="Buscar por número, centro de costo o solicitante..." value={reqSearch} onChange={(e) => setReqSearch(e.target.value)} className="w-full sm:max-w-sm" />
            <Button onClick={openReqCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nueva Requisición</Button>
          </div>
          <DataTable columns={reqColumns} data={filteredReqs} loading={reqLoading} mobileCardTitle={(r) => <><span className="font-mono">#{r.numero}</span> — {r.areaSolicitante}</>} />

          {/* Detalle Requisición */}
          <Dialog open={reqDetailId !== null} onOpenChange={(o) => !o && setReqDetailId(null)}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Detalle de Requisición</DialogTitle></DialogHeader>
              {reqDetailId && (() => {
                const r = requisiciones.find(x => x.id === reqDetailId)
                if (!r) return null
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">No.: </span><span className="font-mono">#{r.numero}</span></div>
                      <div><span className="text-muted-foreground">Fecha: </span>{formatDate(r.fecha)}</div>
                      <div><span className="text-muted-foreground">Centro de Costo: </span>{r.areaSolicitante}</div>
                      <div><span className="text-muted-foreground">Solicitante: </span>{r.requeridoPor}</div>
                      <div><span className="text-muted-foreground">Prioridad: </span><Badge variant={PRIORIDAD_STYLES[r.prioridad]}>{PRIORIDAD_LABELS[r.prioridad]}</Badge></div>
                      <div><span className="text-muted-foreground">Estado: </span><Badge variant={(ESTADO_REQ_STYLES as any)[r.estado]}>{ESTADO_REQ_LABELS[r.estado]}</Badge></div>
                    </div>
                    <Separator />
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">#</th><th className="text-left py-2">Descripción</th><th className="text-left py-2">Centro Costo</th><th className="text-left py-2">Unidad</th><th className="text-right py-2">Cantidad</th></tr></thead>
                      <tbody>
                        {r.items.map((i) => (
                          <tr key={i.id} className="border-b last:border-0">
                            <td className="py-2">{i.item}</td>
                            <td className="py-2">{i.descripcion}</td>
                            <td className="py-2">{i.centroCostos?.nombre ?? "—"}</td>
                            <td className="py-2">{i.unidadMedida}</td>
                            <td className="py-2 text-right font-mono">{Number(i.cantidadSolicitada)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {r.observaciones && <p className="text-sm"><span className="text-muted-foreground">Observaciones: </span>{r.observaciones}</p>}
                    <Separator />
                    <HistorialEstados entidadTipo="REQUISICION" entidadId={r.id} />
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          {/* Requisicion Form */}
          <FormDialog open={reqDialogOpen} onOpenChange={setReqDialogOpen} title={reqEditId ? "Editar Requisición" : "Nueva Requisición"} description="Registra una solicitud de compra" loading={reqSaving} onSubmit={handleReqSave as any}>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>Nombre del Solicitante</Label>
                <Input value={reqForm.requeridoPor} onChange={(e) => setReqForm(p => ({ ...p, requeridoPor: e.target.value }))} placeholder="Nombre completo" required />
              </div>

              <div className="space-y-2">
                <Label>Prioridad</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="reqPrioridad" value="NORMAL" checked={reqForm.prioridad === "NORMAL"} onChange={(e) => setReqForm(p => ({ ...p, prioridad: e.target.value }))} className="h-4 w-4 text-primary" />
                    <span>Normal</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="reqPrioridad" value="URGENTE" checked={reqForm.prioridad === "URGENTE"} onChange={(e) => setReqForm(p => ({ ...p, prioridad: e.target.value }))} className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-600">Urgente</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="radio" name="reqPrioridad" value="EMERGENCIA" checked={reqForm.prioridad === "EMERGENCIA"} onChange={(e) => setReqForm(p => ({ ...p, prioridad: e.target.value }))} className="h-4 w-4 text-destructive" />
                    <span className="text-destructive">Emergencia</span>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Centro de Costo</Label>
                <Select value={reqForm.areaSolicitante} onValueChange={(v) => setReqForm(p => ({ ...p, areaSolicitante: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar centro de costo" /></SelectTrigger>
                  <SelectContent>
                    {centrosCostos.map(cc => <SelectItem key={cc.id} value={cc.nombre}>{cc.codigo} - {cc.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* ─── Carga Excel ─────────────────────────────── */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${reqDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                  }`}
                onDragOver={(e) => { e.preventDefault(); setReqDragOver(true) }}
                onDragLeave={() => setReqDragOver(false)}
                onDrop={onReqDrop}
                onClick={() => reqFileInputRef.current?.click()}
              >
                <p className="text-sm font-medium">Arrastre archivos aquí o haga clic para seleccionar</p>
                <p className="text-xs text-muted-foreground mt-1">Soporta Excel (.xlsx, .xls), PDF, imágenes y otros</p>
                <input ref={reqFileInputRef} type="file" multiple accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.doc,.docx,.txt" className="hidden"
                  onChange={(e) => { if (e.target.files?.length) { addReqArchivos(e.target.files) }; e.target.value = "" }} />
              </div>

              {reqArchivos.length > 0 && (
                <div className="space-y-2">
                  <Label>Archivos adjuntos</Label>
                  <div className="divide-y rounded-md border">
                    {reqArchivos.map(a => (
                      <div key={a.key} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          {a.file.name.match(/\.xlsx?$/i) && <span className="text-green-600 font-medium shrink-0">XLSX</span>}
                          <span className="truncate">{a.file.name}</span>
                          <span className="text-muted-foreground shrink-0">({formatReqSize(a.file.size)})</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeReqArchivo(a.key)}>✕</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Artículos / Servicios</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addReqItem}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium w-2/5">Descripción</th>
                        <th className="text-left px-3 py-2 font-medium w-[120px]">Unidad</th>
                        <th className="text-left px-3 py-2 font-medium w-[100px]">Cantidad</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {reqForm.items.map((det, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-3 py-1.5">
                            <Input value={det.descripcion} onChange={(e) => updateReqItem(idx, "descripcion", e.target.value)} placeholder="Descripción del ítem" required />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input value={det.unidadMedida} onChange={(e) => updateReqItem(idx, "unidadMedida", e.target.value)} placeholder="Und" required />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input type="number" step="0.01" min="0" value={det.cantidadSolicitada} onChange={(e) => updateReqItem(idx, "cantidadSolicitada", parseFloat(e.target.value) || 0)} placeholder="Cant." required />
                          </td>
                          <td className="px-1 py-1.5">
                            {reqForm.items.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeReqItem(idx)}>✕</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observaciones (opcional)</Label>
                <Textarea value={reqForm.observaciones} onChange={(e) => setReqForm(p => ({ ...p, observaciones: e.target.value }))} placeholder="Información adicional..." rows={3} />
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ═══ COTIZACIONES ═══ */}
        <Tabs.Content value="cotizaciones" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <Select value={cotFilterReq} onValueChange={setCotFilterReq}>
                <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Filtrar por requisición..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Todas</SelectItem>
                  {reqsAprobadas.map(r => <SelectItem key={r.id} value={r.id}>Req #{r.numero} - {r.areaSolicitante}</SelectItem>)}
                </SelectContent>
              </Select>
              {cotSelectedIds.length >= 2 && (
                <Button variant="secondary" onClick={handleGenerarComparativo} disabled={cotGenerandoLink === "comparativo"} className="w-full sm:w-auto whitespace-nowrap">
                  {cotGenerandoLink === "comparativo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                  Generar Comparativo
                </Button>
              )}
            </div>
            <Button onClick={openCotCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nueva Cotización</Button>
          </div>
          <DataTable columns={cotColumns} data={filteredCots} loading={cotLoading} mobileCardTitle={(c) => <><span className="font-mono">#{c.numero}</span> — {c.proveedor?.razonSocial}</>} />

          <Dialog open={!!comparativoLink} onOpenChange={(o) => !o && setComparativoLink(null)}>
            <DialogContent>
              <DialogHeader><DialogTitle>Link Comparativo Generado</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">Comparte este link para que el aprobador pueda visualizar y elegir la cotización ganadora:</p>
                <div className="flex items-center gap-2">
                  <Input value={comparativoLink || ""} readOnly />
                  <Button variant="outline" size="icon" onClick={() => {
                    if (navigator.clipboard) navigator.clipboard.writeText(comparativoLink || "")
                    toast({ title: "Copiado al portapapeles" })
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <FormDialog open={cotDialogOpen} onOpenChange={setCotDialogOpen} title={cotEditId ? "Editar Cotización" : "Nueva Cotización"} description="Registra cotización de proveedor" loading={cotSaving} onSubmit={handleCotSave as any} className="sm:max-w-[800px]">
            <div className="space-y-4">
              {cotEditId ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Requisición</Label>
                      <Input value={`Req #${requisiciones.find(r => r.id === cotRequisicionId)?.numero ?? ""}`} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Proveedor</Label>
                      <Select value={cotPanels[0]?.proveedorId ?? ""} onValueChange={(v) => updatePanel(0, "proveedorId", v)}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.razonSocial}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tiempo de Entrega</Label>
                      <Input value={cotPanels[0]?.tiempoEntrega ?? ""} onChange={(e) => updatePanel(0, "tiempoEntrega", e.target.value)} placeholder="Ej: 15 días" />
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de Pago</Label>
                      <Select
                        value={cotPanels[0]?.formaPago && !FORMAS_DE_PAGO.includes(cotPanels[0].formaPago) ? "Otra (especificar)" : (cotPanels[0]?.formaPago ?? "")}
                        onValueChange={(v) => updatePanel(0, "formaPago", v === "Otra (especificar)" ? "" : v)}
                      >
                        <SelectTrigger><SelectValue placeholder="Seleccionar forma de pago" /></SelectTrigger>
                        <SelectContent>
                          {FORMAS_DE_PAGO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {cotPanels[0]?.formaPago && !FORMAS_DE_PAGO.includes(cotPanels[0].formaPago) && (
                        <Input value={cotPanels[0].formaPago} onChange={(e) => updatePanel(0, "formaPago", e.target.value)} placeholder="Especifique la forma de pago" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observaciones</Label>
                    <Textarea value={cotPanels[0]?.observaciones ?? ""} onChange={(e) => updatePanel(0, "observaciones", e.target.value)} rows={2} />
                  </div>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-2 py-2 font-medium text-xs">Descripción</th>
                          <th className="text-left px-2 py-2 font-medium w-[70px] text-xs">Und</th>
                          <th className="text-right px-2 py-2 font-medium w-[70px] text-xs">Cant</th>
                          <th className="text-right px-2 py-2 font-medium w-[130px] text-xs">V. Unidad</th>
                          <th className="text-right px-2 py-2 font-medium w-[130px] text-xs">V. Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cotPanels[0]?.items.map((det, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-2 py-1">{det.descripcion}</td>
                            <td className="px-2 py-1">{det.unidadMedida}</td>
                            <td className="px-2 py-1 text-right font-mono">{Number(det.cantidad)}</td>
                            <td className="px-2 py-1">
                              <MoneyInput value={det.valorUnitario} onChange={(v) => updatePanelItemUnit(0, idx, v)} />
                            </td>
                            <td className="px-2 py-1 text-right font-mono">{formatMoney(det.valorTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end text-sm font-medium">
                    Total: {formatMoney(panelSum(cotPanels[0] ?? { items: [], proveedorId: "", tiempoEntrega: "", formaPago: "", observaciones: "", archivos: [] }))}
                  </div>
                  <div className="space-y-1">
                    <Label>Archivos adjuntos</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("cot-edit-file")?.click()}>
                        + Adjuntar
                      </Button>
                      <input id="cot-edit-file" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx" className="hidden"
                        onChange={(e) => { if (e.target.files?.length) { addPanelArchivos(0, e.target.files); e.target.value = "" } }} />
                    </div>
                    {cotPanels[0]?.archivos.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {cotPanels[0].archivos.map(a => (
                          <div key={a.key} className="flex items-center justify-between px-3 py-1.5 text-sm border rounded-md">
                            {a.url ? <a href={a.url} target="_blank" className="truncate underline hover:text-primary">{a.nombre}</a> : <span className="truncate">{a.nombre}</span>}
                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removePanelArchivo(0, a.key)}>✕</Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Requisición</Label>
                      <Select value={cotRequisicionId} onValueChange={(v) => {
                        setCotRequisicionId(v)
                        if (cotNumero > 0) initCotPanels(v, cotNumero)
                      }}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const allReqs = [...reqsAprobadas]
                            if (cotRequisicionId && !allReqs.some(r => r.id === cotRequisicionId)) {
                              const req = requisiciones.find(r => r.id === cotRequisicionId)
                              if (req) allReqs.unshift(req)
                            }
                            return allReqs.map(r => <SelectItem key={r.id} value={r.id}>Req #{r.numero} - {r.areaSolicitante}</SelectItem>)
                          })()}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>N° de Cotizaciones</Label>
                      <Input type="number" min={1} max={20} value={cotNumero || ""} onChange={(e) => {
                        const n = parseInt(e.target.value) || 0
                        setCotNumero(n)
                        if (cotRequisicionId && n > 0) initCotPanels(cotRequisicionId, n)
                      }} placeholder="Ej: 3" />
                    </div>
                  </div>
                  {cotPanels.length > 0 && (
                    <div className="space-y-3">
                      {cotPanels.map((panel, pIdx) => (
                        <Card key={pIdx}>
                          <CardHeader className="py-3 cursor-pointer select-none" onClick={() => setCotPanelOpen(cotPanelOpen === pIdx ? null : pIdx)}>
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium">Cotización #{pIdx + 1}{panel.proveedorId ? ` — ${proveedores.find(p => p.id === panel.proveedorId)?.razonSocial ?? ""}` : ""}</CardTitle>
                              <span className="text-xs text-muted-foreground">{cotPanelOpen === pIdx ? "▲" : "▼"}</span>
                            </div>
                          </CardHeader>
                          {cotPanelOpen === pIdx && (
                            <CardContent className="pt-0 space-y-3">
                              <div className="space-y-2">
                                <Label>Proveedor</Label>
                                <Select value={panel.proveedorId} onValueChange={(v) => updatePanel(pIdx, "proveedorId", v)}>
                                  <SelectTrigger><SelectValue placeholder="Seleccionar proveedor..." /></SelectTrigger>
                                  <SelectContent>
                                    {proveedores.filter(p => p.id === panel.proveedorId || !cotPanels.some((other, oIdx) => oIdx !== pIdx && other.proveedorId === p.id)).map(p => <SelectItem key={p.id} value={p.id}>{p.razonSocial}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="overflow-x-auto rounded-md border">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b bg-muted/50">
                                      <th className="text-left px-2 py-2 font-medium text-xs">Descripción</th>
                                      <th className="text-left px-2 py-2 font-medium w-[60px] text-xs">Und</th>
                                      <th className="text-right px-2 py-2 font-medium w-[60px] text-xs">Cant</th>
                                      <th className="text-right px-2 py-2 font-medium w-[130px] text-xs">V. Unidad</th>
                                      <th className="text-right px-2 py-2 font-medium w-[130px] text-xs">V. Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {panel.items.map((det, iIdx) => (
                                      <tr key={iIdx} className="border-b last:border-0">
                                        <td className="px-2 py-1 text-sm">{det.descripcion}</td>
                                        <td className="px-2 py-1 text-sm">{det.unidadMedida}</td>
                                        <td className="px-2 py-1 text-right font-mono text-sm">{Number(det.cantidad)}</td>
                                        <td className="px-2 py-1">
                                          <MoneyInput value={det.valorUnitario} onChange={(v) => updatePanelItemUnit(pIdx, iIdx, v)} />
                                        </td>
                                        <td className="px-2 py-1 text-right font-mono text-sm">{formatMoney(det.valorTotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex justify-end text-sm font-medium">
                                Total cotización: {formatMoney(panelSum(panel))}
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Tiempo de Entrega</Label>
                                  <Input value={panel.tiempoEntrega} onChange={(e) => updatePanel(pIdx, "tiempoEntrega", e.target.value)} placeholder="Ej: 15 días" className="h-8 text-sm" />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Forma de Pago</Label>
                                  <Select value={panel.formaPago && !FORMAS_DE_PAGO.includes(panel.formaPago) ? "Otra (especificar)" : panel.formaPago}
                                    onValueChange={(v) => updatePanel(pIdx, "formaPago", v === "Otra (especificar)" ? "" : v)}>
                                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                    <SelectContent>
                                      {FORMAS_DE_PAGO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  {panel.formaPago && !FORMAS_DE_PAGO.includes(panel.formaPago) && (
                                    <Input value={panel.formaPago} onChange={(e) => updatePanel(pIdx, "formaPago", e.target.value)} placeholder="Especifique" className="h-8 text-sm" />
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Observaciones</Label>
                                <Textarea value={panel.observaciones} onChange={(e) => updatePanel(pIdx, "observaciones", e.target.value)} rows={2} className="text-sm" />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Archivos adjuntos</Label>
                                <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById(`cot-file-${pIdx}`)?.click()}>
                                  + Adjuntar
                                </Button>
                                <input id={`cot-file-${pIdx}`} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx" className="hidden"
                                  onChange={(e) => { if (e.target.files?.length) { addPanelArchivos(pIdx, e.target.files); e.target.value = "" } }} />
                                {panel.archivos.length > 0 && (
                                  <div className="space-y-1 mt-1">
                                    {panel.archivos.map(a => (
                                      <div key={a.key} className="flex items-center justify-between px-2 py-1 text-xs border rounded-md">
                                        {a.url ? <a href={a.url} target="_blank" className="truncate underline hover:text-primary">{a.nombre}</a> : <span className="truncate">{a.nombre}</span>}
                                        <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => removePanelArchivo(pIdx, a.key)}>✕</Button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </FormDialog>

          {/* Detalle Cotización */}
          <Dialog open={cotDetailId !== null} onOpenChange={(o) => !o && setCotDetailId(null)}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Detalle de Cotización</DialogTitle></DialogHeader>
              {cotDetailId && (() => {
                const c = cotizaciones.find(x => x.id === cotDetailId)
                if (!c) return null
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">No.: </span><span className="font-mono">#{c.numero}</span></div>
                      <div><span className="text-muted-foreground">Fecha: </span>{formatDate(c.fecha)}</div>
                      <div><span className="text-muted-foreground">Proveedor: </span>{c.proveedor?.razonSocial}</div>
                      <div><span className="text-muted-foreground">Valor Total: </span>{formatMoney(c.valorTotal)}</div>
                      <div><span className="text-muted-foreground">Forma de Pago: </span>{c.formaPago || "—"}</div>
                      <div><span className="text-muted-foreground">Tiempo Entrega: </span>{c.tiempoEntrega || "—"}</div>
                      <div><span className="text-muted-foreground">Ganadora: </span>{c.ganadora ? <Badge variant="success">Sí</Badge> : <Badge variant="secondary">No</Badge>}</div>
                      {c.aprobadaPublicamente && (
                        <div><span className="text-muted-foreground">Aprobación pública: </span><Badge variant="success">Aprobada{c.fechaAprobacionPublica ? ` ${formatDate(c.fechaAprobacionPublica)}` : ""}</Badge></div>
                      )}
                    </div>
                    {c.observaciones && <p className="text-sm"><span className="text-muted-foreground">Observaciones: </span>{c.observaciones}</p>}
                    <Separator />
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">#</th><th className="text-left py-2">Descripción</th><th className="text-center py-2">Und</th><th className="text-right py-2">Cant</th><th className="text-right py-2">V. Unitario</th><th className="text-right py-2">V. Total</th></tr></thead>
                      <tbody>
                        {(c as any).items?.map((i: any) => (
                          <tr key={i.id} className="border-b last:border-0">
                            <td className="py-2">{i.item}</td>
                            <td className="py-2">{i.descripcion}</td>
                            <td className="py-2 text-center">{i.unidadMedida}</td>
                            <td className="py-2 text-right font-mono">{Number(i.cantidad)}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorUnitario || 0))}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorTotal))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {(c as any).archivos?.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-1">
                          <Label>Archivos adjuntos</Label>
                          {(c as any).archivos.map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">📎</span>
                              <a href={a.url} target="_blank" className="underline hover:text-primary">{a.nombre}</a>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    {(() => {
                      const linkLocal = cotLinkData[c.id]
                      const token = c.tokenPublico || linkLocal?.token
                      const urlLink = linkLocal?.url || (token ? `${origin}/publico/cotizacion/${token}` : "")
                      return (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <Label>Link público</Label>
                            {token ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm">
                                  <Input
                                    readOnly
                                    value={urlLink}
                                    className="text-xs font-mono"
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                  />
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      if (navigator.clipboard) navigator.clipboard.writeText(urlLink)
                                      toast({ title: "Link copiado", variant: "success" })
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                  </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Los códigos de aprobación se administran en{" "}
                                  <Link href="/codigos-aprobacion" className="underline underline-offset-2 hover:text-primary">
                                    Códigos Aprobación
                                  </Link>
                                </p>
                                <Button variant="outline" size="sm" onClick={() => handleLimpiarLink(c.id)}>
                                  Eliminar link
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleGenerarLink(c.id)}
                                disabled={cotGenerandoLink === c.id}
                              >
                                <LinkIcon className="mr-2 h-4 w-4" />
                                {cotGenerandoLink === c.id ? "Generando..." : "Generar link público"}
                              </Button>
                            )}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

        </Tabs.Content>

        {/* ═══ ORDENES DE COMPRA ═══ */}
        <Tabs.Content value="ordenes" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Input placeholder="Buscar por número o proveedor..." value={ocSearch} onChange={(e) => setOcSearch(e.target.value)} className="w-full sm:max-w-sm" />
            <Button onClick={openOCCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Generar OC</Button>
          </div>
          <DataTable columns={ocColumns} data={filteredOCs} loading={ocLoading} mobileCardTitle={(o) => <>OC <span className="font-mono">#{o.numero}</span> — {o.proveedor?.razonSocial}</>} />

          <Dialog open={ocDetailId !== null} onOpenChange={(o) => !o && setOcDetailId(null)}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Detalle de Orden de Compra</DialogTitle></DialogHeader>
              {ocDetailId && (() => {
                const o = ordenes.find(x => x.id === ocDetailId)
                if (!o) return null
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">OC No.: </span><span className="font-mono">#{o.numero}</span></div>
                      <div><span className="text-muted-foreground">Fecha: </span>{formatDate(o.fecha)}</div>
                      <div><span className="text-muted-foreground">Proveedor: </span>{o.proveedor?.razonSocial}</div>
                      <div><span className="text-muted-foreground">Estado: </span><Badge variant={(ESTADO_OC_STYLES as any)[o.estado] ?? "default"}>{o.estado}</Badge></div>
                    </div>
                    <Separator />
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">#</th><th className="text-left py-2">Descripción</th><th className="text-left py-2">Unidad</th><th className="text-right py-2">Cantidad</th><th className="text-right py-2">V. Unitario</th><th className="text-right py-2">V. Total</th><th className="text-center py-2">IVA</th></tr></thead>
                      <tbody>
                        {o.items.map((i: any) => (
                          <tr key={i.id} className="border-b last:border-0">
                            <td className="py-2">{i.item}</td>
                            <td className="py-2">{i.descripcion}</td>
                            <td className="py-2">{i.unidadMedida}</td>
                            <td className="py-2 text-right font-mono">{Number(i.cantidad)}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorUnitario))}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorTotal))}</td>
                            <td className="py-2 text-center text-xs">{i.tipoIva === "IVA_19" ? "19%" : i.tipoIva === "IVA_5" ? "5%" : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-medium"><td colSpan={6} className="py-2 text-right">Subtotal:</td><td className="py-2 text-right font-mono">{formatMoney(o.items.reduce((s: number, i: any) => s + Number(i.valorTotal), 0))}</td></tr>
                        <tr className="font-medium"><td colSpan={6} className="py-2 text-right">IVA:</td><td className="py-2 text-right font-mono">{formatMoney(o.items.reduce((s: number, i: any) => s + (i.tipoIva === "IVA_19" ? Number(i.valorTotal) * 0.19 : i.tipoIva === "IVA_5" ? Number(i.valorTotal) * 0.05 : 0), 0))}</td></tr>
                        <tr className="font-medium text-lg"><td colSpan={6} className="py-2 text-right">Total:</td><td className="py-2 text-right font-mono">{formatMoney(o.valorTotal)}</td></tr>
                      </tfoot>
                    </table>
                    <Separator />
                    <HistorialEstados entidadTipo="ORDEN_COMPRA" entidadId={o.id} />
                    <Separator />
                    {(() => {
                      const linkLocal = ocLinkData[o.id]
                      const token = (o as any).tokenPublico || linkLocal?.token
                      const urlLink = linkLocal?.url || (token ? `${origin}/publico/orden-compra/${token}` : "")
                      return (
                        <div className="space-y-3">
                          <Label>Compartir orden</Label>
                          {token ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-sm">
                                <Input
                                  readOnly
                                  value={urlLink}
                                  className="text-xs font-mono"
                                  onClick={(e) => (e.target as HTMLInputElement).select()}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (navigator.clipboard) navigator.clipboard.writeText(urlLink)
                                    toast({ title: "Link copiado", variant: "success" })
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                              <Button variant="outline" size="sm" onClick={() => handleOCLimpiarLink(o.id)}>
                                Eliminar link
                              </Button>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOCGenerarLink(o.id)}
                              disabled={ocGenerandoLink === o.id}
                            >
                              <LinkIcon className="mr-2 h-4 w-4" />
                              {ocGenerandoLink === o.id ? "Generando..." : "Generar link público"}
                            </Button>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          <FormDialog open={ocDialogOpen} onOpenChange={setOcDialogOpen} title="Generar Orden de Compra" description="Genera una orden a partir de una requisición aprobada" loading={ocSaving} onSubmit={handleOCSave as any}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Requisición</Label>
                <Select value={ocForm.requisicionId} onValueChange={handleReqSelectForOC}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar requisición aprobada..." /></SelectTrigger>
                  <SelectContent>
                    {requisiciones.filter(r => r.estado === "EN_COTIZACION").map(r => (
                      <SelectItem key={r.id} value={r.id}>Req #{r.numero} - {r.areaSolicitante}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={ocForm.proveedorId} onValueChange={(v) => setOcForm(p => ({ ...p, proveedorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>{proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.razonSocial}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro Costos</Label>
                  <Select value={ocForm.centroCostosId} onValueChange={(v) => setOcForm(p => ({ ...p, centroCostosId: v }))}>
                    <SelectTrigger><SelectValue placeholder="01 - Principal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=" ">Ninguno</SelectItem>
                      {centrosCostos.map(cc => <SelectItem key={cc.id} value={cc.id}>{cc.codigo} - {cc.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pago</Label>
                  <Select value={ocForm.formaPago && !FORMAS_DE_PAGO.includes(ocForm.formaPago) ? "Otra (especificar)" : ocForm.formaPago}
                    onValueChange={(v) => setOcForm(p => ({ ...p, formaPago: v === "Otra (especificar)" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar forma de pago" /></SelectTrigger>
                    <SelectContent>
                      {FORMAS_DE_PAGO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {ocForm.formaPago && !FORMAS_DE_PAGO.includes(ocForm.formaPago) && (
                    <Input value={ocForm.formaPago} onChange={(e) => setOcForm(p => ({ ...p, formaPago: e.target.value }))} placeholder="Especifique la forma de pago" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Fecha Entrega</Label>
                  <Input type="date" value={ocForm.fechaEntrega} onChange={(e) => setOcForm(p => ({ ...p, fechaEntrega: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Sitio Entrega</Label>
                  <Input value={ocForm.sitioEntrega} onChange={(e) => setOcForm(p => ({ ...p, sitioEntrega: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Correo Facturación</Label>
                  <Input type="email" value={ocForm.correoFacturacion} onChange={(e) => setOcForm(p => ({ ...p, correoFacturacion: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Condiciones Comerciales</Label>
                <Input value={ocForm.condicionesComerciales} onChange={(e) => setOcForm(p => ({ ...p, condicionesComerciales: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Input value={ocForm.observaciones} onChange={(e) => setOcForm(p => ({ ...p, observaciones: e.target.value }))} />
              </div>

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">Items</Label>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium w-12">#</th>
                          <th className="text-left px-3 py-2 font-medium">Descripción</th>
                          <th className="text-left px-3 py-2 font-medium w-20">Und</th>
                          <th className="text-right px-3 py-2 font-medium w-24">Cant</th>
                          <th className="text-right px-3 py-2 font-medium w-28">V. Unitario</th>
                          <th className="text-right px-3 py-2 font-medium w-28">V. Total</th>
                          <th className="text-center px-3 py-2 font-medium w-24">IVA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ocForm.items.map((det, idx) => (
                          <tr key={idx} className="border-b last:border-0">
                            <td className="px-3 py-2 text-sm text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <Input
                                value={det.descripcion}
                                onChange={(e) => updateOCItem(idx, "descripcion", e.target.value)}
                                className="h-8 border-0 focus-visible:ring-1 px-0"
                                required
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                value={det.unidadMedida}
                                onChange={(e) => updateOCItem(idx, "unidadMedida", e.target.value)}
                                className="h-8 border-0 focus-visible:ring-1 px-0"
                                required
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={det.cantidad || ""}
                                onChange={(e) => updateOCItem(idx, "cantidad", parseFloat(e.target.value) || 0)}
                                className="h-8 border-0 focus-visible:ring-1 px-0 text-right font-mono"
                                required
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={det.valorUnitario || ""}
                                onChange={(e) => updateOCItem(idx, "valorUnitario", parseFloat(e.target.value) || 0)}
                                className="h-8 border-0 focus-visible:ring-1 px-0 text-right font-mono"
                                required
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-sm">
                              {formatMoney(det.cantidad * det.valorUnitario)}
                            </td>
                            <td className="px-3 py-2">
                              <Select value={det.tipoIva} onValueChange={(v) => updateOCItem(idx, "tipoIva", v)}>
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="EXENTO">Exento</SelectItem>
                                  <SelectItem value="IVA_5">5%</SelectItem>
                                  <SelectItem value="IVA_19">19%</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                  </table>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addOCItem} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />Agregar Item
                </Button>
              </div>

              <Separator />
              {/* ─── Totales ──────────────────────────────── */}
              {(() => {
                const sub = ocForm.items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0), 0)
                const iva5 = ocForm.items.reduce((s, i) => {
                  if (i.tipoIva !== "IVA_5") return s
                  const base = (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0)
                  return s + Math.round(base * 0.05 * 100) / 100
                }, 0)
                const iva19 = ocForm.items.reduce((s, i) => {
                  if (i.tipoIva !== "IVA_19") return s
                  const base = (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0)
                  return s + Math.round(base * 0.19 * 100) / 100
                }, 0)
                const iva = iva5 + iva19
                const total = sub + iva
                return (
                  <div className="space-y-3">
                    <div className="rounded-md border p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-mono">{formatMoney(sub)}</span>
                      </div>
                      {iva5 > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>IVA (5%)</span>
                          <span className="font-mono">{formatMoney(iva5)}</span>
                        </div>
                      )}
                      {iva19 > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>IVA (19%)</span>
                          <span className="font-mono">{formatMoney(iva19)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-medium text-base">
                        <span>Total</span>
                        <span className="font-mono">{formatMoney(total)}</span>
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ═══ RECEPCIONES ═══ */}
        <Tabs.Content value="recepciones" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Input placeholder="Buscar por OC, proveedor, remisión..." value={recSearch} onChange={(e) => setRecSearch(e.target.value)} className="w-full sm:max-w-sm" />
            <Button onClick={openRecCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nueva Recepción</Button>
          </div>
          <DataTable columns={recColumns} data={filteredRec} loading={recLoading} mobileCardTitle={(r) => <>OC <span className="font-mono">#{r.ordenCompra?.numero}</span> — {r.ordenCompra?.proveedor?.razonSocial}</>} />

          {/* Detalle Recepción */}
          <Dialog open={recDetailId !== null} onOpenChange={(o) => !o && setRecDetailId(null)}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Detalle de Recepción</DialogTitle></DialogHeader>
              {recDetailId && (() => {
                const r = recepciones.find(x => x.id === recDetailId)
                if (!r) return null
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="text-muted-foreground">OC No.: </span><span className="font-mono">#{r.ordenCompra?.numero}</span></div>
                      <div><span className="text-muted-foreground">Proveedor: </span>{r.ordenCompra?.proveedor?.razonSocial}</div>
                      <div><span className="text-muted-foreground">Remisión: </span>{r.remision ?? "—"}</div>
                      <div><span className="text-muted-foreground">Fecha: </span>{formatDate(r.fechaRecepcion)}</div>
                      <div><span className="text-muted-foreground">Estado: </span><Badge variant={(ESTADO_REC_STYLES as any)[r.estado] ?? "default"}>{r.estado}</Badge></div>
                    </div>
                    {r.observaciones && <div className="text-sm"><span className="text-muted-foreground">Observaciones: </span>{r.observaciones}</div>}
                    <Separator />
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">#</th><th className="text-left py-2">Descripción</th><th className="text-right py-2">Cant. Recibida</th><th className="text-left py-2">Observaciones</th></tr></thead>
                      <tbody>
                        {r.items.map((i) => (
                          <tr key={i.id} className="border-b last:border-0">
                            <td className="py-2">{i.item}</td>
                            <td className="py-2">{i.descripcion}</td>
                            <td className="py-2 text-right font-mono">{i.cantidadRecibida}</td>
                            <td className="py-2">{i.observaciones ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Separator />
                    <HistorialEstados entidadTipo="RECEPCION" entidadId={r.id} />
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          {/* Formulario Recepción */}
          <FormDialog open={recDialogOpen} onOpenChange={setRecDialogOpen} title={recEditId ? "Editar Recepción" : "Nueva Recepción"} description="Registra la recepción de mercancía contra una orden de compra" loading={recSaving} onSubmit={handleRecSave as any}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Orden de Compra *</Label>
                <Select value={recForm.ordenCompraId} onValueChange={(v) => autoFillRecItems(v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar OC" /></SelectTrigger>
                  <SelectContent>
                    {ordenes.filter(o => o.estado !== "CERRADA").map(o => (
                      <SelectItem key={o.id} value={o.id}>OC #{o.numero} — {o.proveedor?.razonSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Remisión</Label><Input value={recForm.remision} onChange={(e) => setRecForm(p => ({ ...p, remision: e.target.value }))} placeholder="N° de remisión" /></div>
                <div className="space-y-2"><Label>Observaciones</Label><Input value={recForm.observaciones} onChange={(e) => setRecForm(p => ({ ...p, observaciones: e.target.value }))} /></div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label className="font-medium">Items a recibir</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRecItem}><Plus className="mr-1 h-3 w-3" />Agregar</Button>
              </div>
              <div className="space-y-2">
                {recForm.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-[auto_1fr_120px_120px_auto] gap-2 items-center">
                    <span className="text-xs text-muted-foreground font-mono w-6 text-center">{it.item}</span>
                    <Input value={it.descripcion} onChange={(e) => updateRecItem(idx, "descripcion", e.target.value)} placeholder="Descripción" />
                    <Input type="number" min="0" value={it.cantidadRecibida || ""} onChange={(e) => updateRecItem(idx, "cantidadRecibida", Number(e.target.value))} placeholder="Cant." />
                    <Input value={it.observaciones} onChange={(e) => updateRecItem(idx, "observaciones", e.target.value)} placeholder="Obs." />
                    {recForm.items.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeRecItem(idx)}><Trash2 className="h-3 w-3 text-destructive" /></Button>}
                  </div>
                ))}
              </div>
              {recForm.ordenCompraId && (() => {
                const oc = ordenes.find(o => o.id === recForm.ordenCompraId)
                if (!oc) return null
                return (
                  <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                    <div className="flex justify-between"><span className="text-muted-foreground">OC Total:</span><span className="font-mono font-medium">{formatMoney(Number(oc.valorTotal))}</span></div>
                    <div className="text-xs text-muted-foreground">Al recibir, el sistema actualizará automáticamente el inventario y generará el asiento contable.</div>
                  </div>
                )
              })()}
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ═══ CENTROS COSTOS ═══ */}
        <Tabs.Content value="centros-costos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCCCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nuevo Centro Costos</Button>
          </div>
          <DataTable columns={ccColumns} data={centrosCostos} mobileCardTitle={(c) => <><span className="font-mono">{c.codigo}</span> — {c.nombre}</>} />

          <FormDialog open={ccDialogOpen} onOpenChange={setCcDialogOpen} title={ccEditId ? "Editar Centro Costos" : "Nuevo Centro Costos"} loading={ccSaving} onSubmit={handleCCSave as any}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Código</Label><Input value={ccForm.codigo} onChange={(e) => setCcForm(p => ({ ...p, codigo: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Nombre</Label><Input value={ccForm.nombre} onChange={(e) => setCcForm(p => ({ ...p, nombre: e.target.value }))} required /></div>
              </div>
              <div className="space-y-2"><Label>Descripción</Label><Input value={ccForm.descripcion} onChange={(e) => setCcForm(p => ({ ...p, descripcion: e.target.value }))} /></div>
            </div>
          </FormDialog>
        </Tabs.Content>

      </Tabs.Root>
    </div>
  )
}
