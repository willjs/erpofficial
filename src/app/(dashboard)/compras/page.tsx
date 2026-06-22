"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useToast } from "@/components/ui/use-toast"
import * as XLSX from "xlsx"
import * as Tabs from "@radix-ui/react-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Plus, Pencil, Trash2, Eye, Send, CheckCircle, XCircle, FileText,
  ShoppingCart, DollarSign, Package, Truck, Users, Building2, Settings, Save,
} from "lucide-react"
import { formatMoney, formatDate } from "@/lib/utils"
import HistorialEstados from "@/components/compras/historial-estados"

type CentroCostos = { id: string; codigo: string; nombre: string; descripcion: string | null }
type Proveedor = { id: string; razonSocial: string; nit: string; contacto: string | null; telefono: string | null; email: string | null; direccion: string | null }

type ReqItem = { id: string; item: number; descripcion: string; centroCostosId: string | null; centroCostos: CentroCostos | null; unidadMedida: string; cantidadSolicitada: number }
type Requisicion = { id: string; empresaId: string; numero: number; fecha: string; areaSolicitante: string; requeridoPor: string; autorizadoPor: string | null; destino: string | null; prioridad: string; estado: string; observaciones: string | null; items: ReqItem[]; _count?: { cotizaciones: number; ordenesCompra: number } }

type CotItem = { id: string; item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number }
type Cotizacion = { id: string; requisicionId: string; proveedorId: string; proveedor: Proveedor; numero: number; fecha: string; valorTotal: number; tiempoEntrega: string | null; formaPago: string | null; ganadora: boolean; observaciones: string | null; items: CotItem[] }

type AprobacionConfig = { id: string; empresaId: string; desde: number; hasta: number; cargoAprobador: string }

type OCItem = { id: string; item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number }
type OrdenCompra = { id: string; numero: number; fecha: string; proveedor: Proveedor; requisicion: { id: string; numero: number }; valorTotal: number; estado: string; items: OCItem[]; _count?: { recepciones: number; cuentasPagar: number } }

type Recepcion = { id: string; ordenCompraId: string; ordenCompra: { id: string; numero: number; proveedor: Proveedor }; fechaRecepcion: string; remision: string | null; estado: string; observaciones: string | null; items: { id: string; item: number; descripcion: string; cantidadRecibida: number }[] }

const PRIORIDAD_STYLES: Record<string, "default" | "warning" | "destructive"> = { NORMAL: "default", URGENTE: "warning", EMERGENCIA: "destructive" }
const ESTADO_REQ_STYLES: Record<string, string> = { BORRADOR: "secondary", PENDIENTE_APROBACION: "warning", APROBADA: "success", RECHAZADA: "destructive", EN_COTIZACION: "default", ORDEN_COMPRA_GENERADA: "info", CERRADA: "default" }
const ESTADO_OC_STYLES: Record<string, "secondary" | "success" | "warning" | "info"> = { EMITIDA: "info", RECIBIDA: "success", FACTURADA: "warning", CERRADA: "secondary" }
const ESTADO_RECEPCION_STYLES: Record<string, "warning" | "success" | "default"> = { PENDIENTE: "warning", PARCIAL: "default", COMPLETA: "success" }
const PRIORIDAD_LABELS: Record<string, string> = { NORMAL: "Normal", URGENTE: "Urgente", EMERGENCIA: "Emergencia" }
const ESTADO_REQ_LABELS: Record<string, string> = { BORRADOR: "Borrador", PENDIENTE_APROBACION: "Pendiente", APROBADA: "Aprobada", RECHAZADA: "Rechazada", EN_COTIZACION: "En Cotización", ORDEN_COMPRA_GENERADA: "OC Generada", CERRADA: "Cerrada" }
const FORMAS_DE_PAGO = ["Contado", "Contra entrega", "Anticipo", "Pago parcial", "Crédito 15 días", "Crédito 30 días", "Crédito 45 días", "Crédito 60 días", "Crédito 90 días", "Crédito 120 días", "Pago por cuotas", "Pago programado", "Pago recurrente", "Consignación", "Otra (especificar)"]

function formatPeso(n: number): string {
  return n.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function parsePeso(s: string): number {
  if (!s) return 0
  const cleaned = s.replace(/\./g, "").replace(",", ".")
  return isNaN(parseFloat(cleaned)) ? 0 : parseFloat(cleaned)
}

function defaultReqItem(): { item: number; descripcion: string; centroCostosId: string | null; unidadMedida: string; cantidadSolicitada: number } {
  return { item: 0, descripcion: "", centroCostosId: null, unidadMedida: "", cantidadSolicitada: 0 }
}
function defaultCotItem() { return { item: 0, descripcion: "", unidadMedida: "", cantidad: 0, valorUnitario: 0, valorTotal: 0 } }
function defaultOCItem() { return { item: 0, descripcion: "", unidadMedida: "", cantidad: 0, valorUnitario: 0, valorTotal: 0 } }
function defaultRecItem() { return { item: 0, descripcion: "", cantidadRecibida: 0, observaciones: "" } }

export default function ComprasPage() {
  const { toast } = useToast()
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
  const [cotForm, setCotForm] = useState({ requisicionId: "", proveedorId: "", tiempoEntrega: "", formaPago: "", observaciones: "", items: [defaultCotItem()] })
  const [cotSaving, setCotSaving] = useState(false)
  const [cotFilterReq, setCotFilterReq] = useState("")
  const [cotVuFocus, setCotVuFocus] = useState<number | null>(null)
  const [cotVuRaw, setCotVuRaw] = useState<Record<number, string>>({})
  const [cotDetailId, setCotDetailId] = useState<string | null>(null)
  const [cotArchivos, setCotArchivos] = useState<{ key: string; nombre: string; base64?: string; url?: string }[]>([])
  const [cotDragOver, setCotDragOver] = useState(false)
  const [cotConfirmOpen, setCotConfirmOpen] = useState(false)
  const cotFileInputRef = useRef<HTMLInputElement>(null)

  // ─── Aprobaciones ──────────────────────────────────
  const [aprobPendientes, setAprobPendientes] = useState<Requisicion[]>([])
  const [aprobLoading, setAprobLoading] = useState(true)
  const [aprobConfigs, setAprobConfigs] = useState<AprobacionConfig[]>([])
  const [aprobConfigDialogOpen, setAprobConfigDialogOpen] = useState(false)
  const [aprobConfigForm, setAprobConfigForm] = useState({ desde: "", hasta: "", cargoAprobador: "" })
  const [aprobConfigSaving, setAprobConfigSaving] = useState(false)
  const [aprobComentario, setAprobComentario] = useState("")
  const [aprobModalOpen, setAprobModalOpen] = useState(false)
  const [aprobModalReqId, setAprobModalReqId] = useState<string | null>(null)
  const [aprobModalComentario, setAprobModalComentario] = useState("")
  const [rechazarModalOpen, setRechazarModalOpen] = useState(false)
  const [rechazarModalReqId, setRechazarModalReqId] = useState<string | null>(null)
  const [rechazarModalMotivo, setRechazarModalMotivo] = useState("")

  // ─── Ordenes de Compra ─────────────────────────────
  const [ordenes, setOrdenes] = useState<OrdenCompra[]>([])
  const [ocLoading, setOcLoading] = useState(true)
  const [ocSearch, setOcSearch] = useState("")
  const [ocDialogOpen, setOcDialogOpen] = useState(false)
  const [ocForm, setOcForm] = useState({ requisicionId: "", cotizacionId: "", proveedorId: "", condicionesComerciales: "", fechaEntrega: "", sitioEntrega: "", centroCostosId: "", formaPago: "", correoFacturacion: "", observaciones: "", aplicaIVA: true, items: [defaultOCItem()] })
  const [ocSaving, setOcSaving] = useState(false)
  const [ocDetailId, setOcDetailId] = useState<string | null>(null)

  // ─── Recepción ─────────────────────────────────────
  const [recepciones, setRecepciones] = useState<Recepcion[]>([])
  const [recLoading, setRecLoading] = useState(true)
  const [recDialogOpen, setRecDialogOpen] = useState(false)
  const [recForm, setRecForm] = useState({ ordenCompraId: "", remision: "", observaciones: "", items: [defaultRecItem()] })
  const [recSaving, setRecSaving] = useState(false)

  // ─── Proveedores CRUD ──────────────────────────────
  const [provDialogOpen, setProvDialogOpen] = useState(false)
  const [provEditId, setProvEditId] = useState<string | null>(null)
  const [provForm, setProvForm] = useState({ razonSocial: "", nit: "", contacto: "", telefono: "", email: "", direccion: "" })
  const [provSaving, setProvSaving] = useState(false)

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

  const loadAprobaciones = useCallback(async () => {
    setAprobLoading(true)
    try {
      const { getAprobacionesPendientes, getAprobacionConfig } = await import("@/actions/compras")
      const [pendientes, configs] = await Promise.all([getAprobacionesPendientes(), getAprobacionConfig()])
      setAprobPendientes(pendientes as Requisicion[])
      setAprobConfigs(configs as AprobacionConfig[])
    } finally { setAprobLoading(false) }
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
    loadAprobaciones()
    loadOrdenes()
    loadRecepciones()
  }, [loadCentrosCostos, loadProveedores, loadRequisiciones, loadCotizaciones, loadAprobaciones, loadOrdenes, loadRecepciones])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── Helpers ───────────────────────────────────────
  function getRequisicionesAprobadas() {
    return requisiciones.filter(r => r.estado === "APROBADA")
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
    }))
  }

  function getRecItemsForOC(ordenCompraId: string) {
    const oc = ordenes.find(o => o.id === ordenCompraId)
    if (!oc) return [defaultRecItem()]
    return oc.items.map((i, idx) => ({
      item: idx + 1,
      descripcion: i.descripcion,
      cantidadRecibida: 0,
      observaciones: "",
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
      loadAprobaciones()
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
      nuevos.push({ key: crypto.randomUUID(), file })
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
    setCotForm({ requisicionId: "", proveedorId: "", tiempoEntrega: "", formaPago: "", observaciones: "", items: [defaultCotItem()] })
    setCotArchivos([])
    setCotDialogOpen(true)
  }

  async function openCotEdit(id: string) {
    try {
      const { getCotizacion } = await import("@/actions/compras")
      const data = await getCotizacion(id) as any
      setCotEditId(id)
      setCotForm({
        requisicionId: data.requisicionId,
        proveedorId: data.proveedorId,
        tiempoEntrega: data.tiempoEntrega ?? "",
        formaPago: data.formaPago ?? "",
        observaciones: data.observaciones ?? "",
        items: data.items.map((i: any, idx: number) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: Number(i.cantidad),
          valorUnitario: Number(i.valorUnitario),
          valorTotal: Number(i.valorTotal),
        })),
      })
      setCotArchivos((data.archivos || []).map((a: any) => ({ key: crypto.randomUUID(), nombre: a.nombre, url: a.url })))
      setCotDialogOpen(true)
    } catch {
      toast({ title: "Error al cargar cotización", variant: "destructive" })
    }
  }

  function addCotItem() {
    setCotForm(prev => ({ ...prev, items: [...prev.items, defaultCotItem()] }))
  }

  function removeCotItem(idx: number) {
    setCotForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  function updateCotItem(idx: number, field: string, value: any) {
    setCotForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      if (field === "cantidad" || field === "valorUnitario") {
        items[idx].valorTotal = (Number(items[idx].cantidad) || 0) * (Number(items[idx].valorUnitario) || 0)
      }
      return { ...prev, items }
    })
  }

  function handleCotSave(e: React.FormEvent) {
    e.preventDefault()
    setCotConfirmOpen(true)
  }

  async function confirmCotSave() {
    setCotConfirmOpen(false)
    setCotSaving(true)
    try {
      const payload = {
        requisicionId: cotForm.requisicionId,
        proveedorId: cotForm.proveedorId,
        tiempoEntrega: cotForm.tiempoEntrega || null,
        formaPago: cotForm.formaPago || null,
        observaciones: cotForm.observaciones || null,
        items: cotForm.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: i.cantidad,
          valorUnitario: i.valorUnitario,
          valorTotal: i.cantidad * i.valorUnitario,
        })),
        archivos: cotArchivos.map(a => a.base64 ? { nombre: a.nombre, base64: a.base64 } : { nombre: a.nombre, url: a.url }),
      } as any
      const actions = await import("@/actions/compras")
      if (cotEditId) {
        await actions.updateCotizacion(cotEditId, payload)
      } else {
        await actions.createCotizacion(payload)
      }
      setCotDialogOpen(false)
      loadCotizaciones()
      loadRequisiciones()
      toast({ title: cotEditId ? "Cotización actualizada" : "Cotización creada", variant: "success" })
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

  // ─── Cotización Archivos ────────────────────────────
  function addCotArchivos(files: FileList) {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const key = crypto.randomUUID()
      setCotArchivos(prev => [...prev, { key, nombre: file.name }])
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = (e.target?.result as string)?.split(",")[1] ?? ""
        setCotArchivos(prev => prev.map(a => a.key === key ? { ...a, base64 } : a))
      }
      reader.readAsDataURL(file)
    }
  }

  function removeCotArchivo(key: string) {
    setCotArchivos(prev => prev.filter(a => a.key !== key))
  }

  function formatCotSize(name: string) {
    return name
  }

  // ════════════════════════════════════════════════════════
  // APROBACIONES
  // ════════════════════════════════════════════════════════
  function handleAprobarReq(id: string) {
    setAprobModalReqId(id)
    setAprobModalComentario("")
    setAprobModalOpen(true)
  }

  function handleRechazarReq(id: string) {
    setRechazarModalReqId(id)
    setRechazarModalMotivo("")
    setRechazarModalOpen(true)
  }

  async function confirmAprobar() {
    if (!aprobModalReqId) return
    try {
      const { aprobarRequisicion } = await import("@/actions/compras")
      await aprobarRequisicion(aprobModalReqId, aprobModalComentario || undefined)
      setAprobModalOpen(false)
      setAprobModalReqId(null)
      loadAprobaciones()
      loadRequisiciones()
      toast({ title: "Requisición aprobada", variant: "success" })
    } catch (err: any) { toast({ title: "Error al aprobar", description: err?.message, variant: "destructive" }) }
  }

  async function confirmRechazar() {
    if (!rechazarModalReqId || !rechazarModalMotivo.trim()) return
    try {
      const { rechazarRequisicion } = await import("@/actions/compras")
      await rechazarRequisicion(rechazarModalReqId, rechazarModalMotivo)
      setRechazarModalOpen(false)
      setRechazarModalReqId(null)
      loadAprobaciones()
      loadRequisiciones()
      toast({ title: "Requisición rechazada", variant: "success" })
    } catch (err: any) { toast({ title: "Error al rechazar", description: err?.message, variant: "destructive" }) }
  }

  async function handleAprobConfigSave(e: React.FormEvent) {
    e.preventDefault()
    setAprobConfigSaving(true)
    try {
      const { createAprobacionConfig } = await import("@/actions/compras")
      await createAprobacionConfig({
        desde: parseFloat(aprobConfigForm.desde),
        hasta: parseFloat(aprobConfigForm.hasta),
        cargoAprobador: aprobConfigForm.cargoAprobador,
      })
      setAprobConfigDialogOpen(false)
      loadAprobaciones()
      toast({ title: "Regla de aprobación creada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al crear regla", description: err?.message, variant: "destructive" })
    } finally { setAprobConfigSaving(false) }
  }

  async function handleAprobConfigDelete(id: string) {
    if (!confirm("¿Eliminar regla de aprobación?")) return
    try {
      const { deleteAprobacionConfig } = await import("@/actions/compras")
      await deleteAprobacionConfig(id)
      loadAprobaciones()
      toast({ title: "Regla de aprobación eliminada", variant: "success" })
    } catch (err: any) { toast({ title: "Error al eliminar regla", description: err?.message, variant: "destructive" }) }
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
          valorUnitario: Number(i.valorUnitario),
          valorTotal: Number(i.valorTotal),
        })) : req.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: Number(i.cantidadSolicitada),
          valorUnitario: 0,
          valorTotal: 0,
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
        aplicaIVA: ocForm.aplicaIVA,
        items: ocForm.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          unidadMedida: i.unidadMedida,
          cantidad: i.cantidad,
          valorUnitario: i.valorUnitario,
          valorTotal: i.cantidad * i.valorUnitario,
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

  // ════════════════════════════════════════════════════════
  // RECEPCION
  // ════════════════════════════════════════════════════════
  function openRecCreate() {
    setRecForm({ ordenCompraId: "", remision: "", observaciones: "", items: [defaultRecItem()] })
    setRecDialogOpen(true)
  }

  function handleOCSelectForRec(ocId: string) {
    const oc = ordenes.find(o => o.id === ocId)
    if (oc) {
      setRecForm(prev => ({
        ...prev,
        ordenCompraId: ocId,
        items: oc.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          cantidadRecibida: 0,
          observaciones: "",
        })),
      }))
    }
  }

  function updateRecItem(idx: number, field: string, value: any) {
    setRecForm(prev => {
      const items = [...prev.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...prev, items }
    })
  }

  async function handleRecSave(e: React.FormEvent) {
    e.preventDefault()
    setRecSaving(true)
    try {
      const { createRecepcion } = await import("@/actions/compras")
      await createRecepcion({
        ordenCompraId: recForm.ordenCompraId,
        remision: recForm.remision || null,
        observaciones: recForm.observaciones || null,
        items: recForm.items.map((i, idx) => ({
          item: idx + 1,
          descripcion: i.descripcion,
          cantidadRecibida: i.cantidadRecibida,
          observaciones: i.observaciones,
        })),
      } as any)
      setRecDialogOpen(false)
      loadRecepciones()
      loadOrdenes()
      toast({ title: "Recepción registrada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al registrar recepción", description: err?.message, variant: "destructive" })
    } finally { setRecSaving(false) }
  }

  async function handleRecDelete(id: string) {
    if (!confirm("¿Eliminar esta recepción?")) return
    try {
      const { deleteRecepcion } = await import("@/actions/compras")
      await deleteRecepcion(id)
      loadRecepciones()
      toast({ title: "Recepción eliminada", variant: "success" })
    } catch (err: any) { toast({ title: "Error al eliminar recepción", description: err?.message, variant: "destructive" }) }
  }

  // ════════════════════════════════════════════════════════
  // PROVEEDORES CRUD
  // ════════════════════════════════════════════════════════
  function openProvCreate() {
    setProvEditId(null)
    setProvForm({ razonSocial: "", nit: "", contacto: "", telefono: "", email: "", direccion: "" })
    setProvDialogOpen(true)
  }

  function openProvEdit(prov: Proveedor) {
    setProvEditId(prov.id)
    setProvForm({ razonSocial: prov.razonSocial, nit: prov.nit, contacto: prov.contacto ?? "", telefono: prov.telefono ?? "", email: prov.email ?? "", direccion: prov.direccion ?? "" })
    setProvDialogOpen(true)
  }

  async function handleProvSave(e: React.FormEvent) {
    e.preventDefault()
    setProvSaving(true)
    try {
      const { createProveedor, updateProveedor } = await import("@/actions/compras")
      if (provEditId) {
        await updateProveedor(provEditId, provForm as any)
      } else {
        await createProveedor(provForm as any)
      }
      setProvDialogOpen(false)
      loadProveedores()
      toast({ title: provEditId ? "Proveedor actualizado" : "Proveedor creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar proveedor", description: err?.message, variant: "destructive" })
    } finally { setProvSaving(false) }
  }

  async function handleProvDelete(id: string) {
    if (!confirm("¿Desactivar este proveedor?")) return
    try {
      const { deleteProveedor } = await import("@/actions/compras")
      await deleteProveedor(id)
      loadProveedores()
      toast({ title: "Proveedor desactivado", variant: "success" })
    } catch (err: any) { toast({ title: "Error al desactivar proveedor", description: err?.message, variant: "destructive" }) }
  }

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
    { key: "acciones", header: "", render: (r) => (
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
    ), className: "w-40" },
  ]

  const cotColumns: Column<Cotizacion>[] = [
    { key: "numero", header: "No.", render: (c) => <span className="font-mono">{c.numero}</span>, className: "w-16" },
    { key: "fecha", header: "Fecha", render: (c) => formatDate(c.fecha), className: "w-24" },
    { key: "proveedor", header: "Proveedor", render: (c) => c.proveedor?.razonSocial },
    { key: "valorTotal", header: "Valor Total", render: (c) => formatMoney(c.valorTotal), className: "w-28 text-right" },
    { key: "ganadora", header: "Ganadora", render: (c) => c.ganadora ? <Badge variant="success">Sí</Badge> : <Badge variant="secondary">No</Badge>, className: "w-20" },
    { key: "acciones", header: "", render: (c) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCotDetailId(c.id)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
        {!c.ganadora && <Button variant="ghost" size="icon" className="h-7 w-7 text-green-600" onClick={() => handleSeleccionarCot(c.id)} title="Seleccionar"><CheckCircle className="h-4 w-4" /></Button>}
        {!c.ganadora && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCotEdit(c.id)} title="Editar"><Pencil className="h-4 w-4" /></Button>}
        {!c.ganadora && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleCotDelete(c.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>}
      </div>
    ), className: "w-40" },
  ]

  const aprobColumns: Column<Requisicion>[] = [
    { key: "numero", header: "No.", render: (r) => <span className="font-mono">{r.numero}</span>, className: "w-16" },
    { key: "fecha", header: "Fecha", render: (r) => formatDate(r.fecha), className: "w-24" },
    { key: "areaSolicitante", header: "Centro de Costo" },
    { key: "requeridoPor", header: "Solicitante" },
    { key: "prioridad", header: "Prioridad", render: (r) => <Badge variant={PRIORIDAD_STYLES[r.prioridad] ?? "default"}>{PRIORIDAD_LABELS[r.prioridad]}</Badge>, className: "w-24" },
    { key: "items", header: "Items", render: (r) => r.items.length, className: "w-16 text-center" },
    { key: "acciones", header: "", render: (r) => (
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => handleAprobarReq(r.id)}><CheckCircle className="mr-1 h-3.5 w-3.5" />Aprobar</Button>
        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleRechazarReq(r.id)}><XCircle className="mr-1 h-3.5 w-3.5" />Rechazar</Button>
      </div>
    ), className: "w-44" },
  ]

  const ocColumns: Column<OrdenCompra>[] = [
    { key: "numero", header: "OC No.", render: (o) => <span className="font-mono">{o.numero}</span>, className: "w-20" },
    { key: "fecha", header: "Fecha", render: (o) => formatDate(o.fecha), className: "w-24" },
    { key: "proveedor", header: "Proveedor", render: (o) => o.proveedor?.razonSocial },
    { key: "valorTotal", header: "Valor Total", render: (o) => formatMoney(o.valorTotal), className: "w-28 text-right" },
    { key: "estado", header: "Estado", render: (o) => <Badge variant={(ESTADO_OC_STYLES as any)[o.estado] ?? "default"}>{o.estado}</Badge>, className: "w-24" },
    { key: "acciones", header: "", render: (o) => (
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOcDetailId(ocDetailId === o.id ? null : o.id)} title="Ver"><Eye className="h-4 w-4" /></Button>
    ), className: "w-16" },
  ]

  const recColumns: Column<Recepcion>[] = [
    { key: "fecha", header: "Fecha", render: (r) => formatDate(r.fechaRecepcion), className: "w-24" },
    { key: "oc", header: "OC", render: (r) => <span className="font-mono">#{r.ordenCompra?.numero}</span>, className: "w-16" },
    { key: "proveedor", header: "Proveedor", render: (r) => r.ordenCompra?.proveedor?.razonSocial },
    { key: "remision", header: "Remisión", render: (r) => r.remision ?? "—" },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={(ESTADO_RECEPCION_STYLES as any)[r.estado] ?? "default"}>{r.estado}</Badge>, className: "w-24" },
    { key: "acciones", header: "", render: (r) => (
      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRecDelete(r.id)}><Trash2 className="h-4 w-4" /></Button>
    ), className: "w-16" },
  ]

  const provColumns: Column<Proveedor>[] = [
    { key: "razonSocial", header: "Razón Social" },
    { key: "nit", header: "NIT" },
    { key: "contacto", header: "Contacto" },
    { key: "telefono", header: "Teléfono" },
    { key: "email", header: "Email" },
    { key: "acciones", header: "", render: (p) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openProvEdit(p)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleProvDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ), className: "w-20" },
  ]

  const ccColumns: Column<CentroCostos>[] = [
    { key: "codigo", header: "Código", render: (c) => <span className="font-mono">{c.codigo}</span> },
    { key: "nombre", header: "Nombre" },
    { key: "descripcion", header: "Descripción" },
    { key: "acciones", header: "", render: (c) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCCEdit(c)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleCCDelete(c.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    ), className: "w-20" },
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
            { value: "aprobaciones", label: "Aprobaciones", icon: CheckCircle },
            { value: "ordenes", label: "Órdenes de Compra", icon: FileText },
            { value: "recepcion", label: "Recepción", icon: Package },
            { value: "proveedores", label: "Proveedores", icon: Users },
            { value: "centros-costos", label: "Centros Costo", icon: Building2 },
            { value: "config", label: "Config Aprob.", icon: Settings },
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
          <div className="flex items-center justify-between">
            <Input placeholder="Buscar por número, centro de costo o solicitante..." value={reqSearch} onChange={(e) => setReqSearch(e.target.value)} className="max-w-sm" />
            <Button onClick={openReqCreate}><Plus className="mr-2 h-4 w-4" />Nueva Requisición</Button>
          </div>
          <DataTable columns={reqColumns} data={filteredReqs} loading={reqLoading} />

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
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                  reqDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
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
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Select value={cotFilterReq} onValueChange={setCotFilterReq}>
                <SelectTrigger className="w-72"><SelectValue placeholder="Filtrar por requisición..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Todas</SelectItem>
                  {reqsAprobadas.map(r => <SelectItem key={r.id} value={r.id}>Req #{r.numero} - {r.areaSolicitante}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={openCotCreate}><Plus className="mr-2 h-4 w-4" />Nueva Cotización</Button>
          </div>
          <DataTable columns={cotColumns} data={filteredCots} loading={cotLoading} />

          <FormDialog open={cotDialogOpen} onOpenChange={setCotDialogOpen} title={cotEditId ? "Editar Cotización" : "Nueva Cotización"} description="Registra cotización de proveedor" loading={cotSaving} onSubmit={handleCotSave as any} className="sm:max-w-[800px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Requisición</Label>
                  <Select value={cotForm.requisicionId} onValueChange={(v) => {
                    const req = requisiciones.find(r => r.id === v)
                    setCotForm(p => ({
                      ...p,
                      requisicionId: v,
                      items: req ? req.items.map((i, idx) => ({
                        item: idx + 1,
                        descripcion: i.descripcion,
                        unidadMedida: i.unidadMedida,
                        cantidad: Number(i.cantidadSolicitada),
                        valorUnitario: 0,
                        valorTotal: 0,
                      })) : [defaultCotItem()],
                    }))
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {(() => {
                        const allReqs = [...reqsAprobadas]
                        if (cotForm.requisicionId && !allReqs.some(r => r.id === cotForm.requisicionId)) {
                          const req = requisiciones.find(r => r.id === cotForm.requisicionId)
                          if (req) allReqs.unshift(req)
                        }
                        return allReqs.map(r => <SelectItem key={r.id} value={r.id}>Req #{r.numero} - {r.areaSolicitante}</SelectItem>)
                      })()}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Proveedor</Label>
                  <Select value={cotForm.proveedorId} onValueChange={(v) => setCotForm(p => ({ ...p, proveedorId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.razonSocial}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tiempo de Entrega</Label>
                  <Input value={cotForm.tiempoEntrega} onChange={(e) => setCotForm(p => ({ ...p, tiempoEntrega: e.target.value }))} placeholder="Ej: 15 días" />
                </div>
                <div className="space-y-2">
                  <Label>Forma de Pago</Label>
                  <Select value={cotForm.formaPago && !FORMAS_DE_PAGO.includes(cotForm.formaPago) ? "Otra (especificar)" : cotForm.formaPago}
                    onValueChange={(v) => setCotForm(p => ({ ...p, formaPago: v === "Otra (especificar)" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar forma de pago" /></SelectTrigger>
                    <SelectContent>
                      {FORMAS_DE_PAGO.map(fp => <SelectItem key={fp} value={fp}>{fp}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {cotForm.formaPago && !FORMAS_DE_PAGO.includes(cotForm.formaPago) && (
                    <Input value={cotForm.formaPago} onChange={(e) => setCotForm(p => ({ ...p, formaPago: e.target.value }))} placeholder="Especifique la forma de pago" />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Input value={cotForm.observaciones} onChange={(e) => setCotForm(p => ({ ...p, observaciones: e.target.value }))} />
              </div>

              {/* ─── Carga Archivos Cotización ──────────────── */}
              <div
                className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer ${
                  cotDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setCotDragOver(true) }}
                onDragLeave={() => setCotDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setCotDragOver(false); if (e.dataTransfer.files.length > 0) addCotArchivos(e.dataTransfer.files) }}
                onClick={() => cotFileInputRef.current?.click()}
              >
                <p className="text-sm font-medium">Adjuntar archivos</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, imágenes, Excel...</p>
                <input ref={cotFileInputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.doc,.docx" className="hidden"
                  onChange={(e) => { if (e.target.files?.length) addCotArchivos(e.target.files); e.target.value = "" }} />
              </div>

              {cotArchivos.length > 0 && (
                <div className="space-y-1">
                  {cotArchivos.map(a => (
                    <div key={a.key} className="flex items-center justify-between px-3 py-1.5 text-sm border rounded-md">
                      {a.url ? (
                        <a href={a.url} target="_blank" className="truncate underline hover:text-primary">{a.nombre}</a>
                      ) : (
                        <span className="truncate">{a.nombre}</span>
                      )}
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeCotArchivo(a.key)}>✕</Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCotItem}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium">Descripción</th>
                        <th className="text-left px-3 py-2 font-medium w-[90px]">Unidad</th>
                        <th className="text-right px-3 py-2 font-medium w-[90px]">Cantidad</th>
                        <th className="text-right px-3 py-2 font-medium w-[160px]">V. Unitario</th>
                        <th className="text-right px-3 py-2 font-medium w-[160px]">V. Total</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {cotForm.items.map((det, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="px-3 py-1.5">
                            <Input value={det.descripcion} onChange={(e) => updateCotItem(idx, "descripcion", e.target.value)} placeholder="Descripción" required />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input value={det.unidadMedida} onChange={(e) => updateCotItem(idx, "unidadMedida", e.target.value)} placeholder="Und" required />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input type="number" step="0.01" min="0" value={det.cantidad} onChange={(e) => updateCotItem(idx, "cantidad", parseFloat(e.target.value) || 0)} required className="text-right" />
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                              <Input type="text" inputMode="decimal" 
                                value={cotVuFocus === idx ? (cotVuRaw[idx] ?? "") : formatPeso(det.valorUnitario)} 
                                onFocus={() => { setCotVuFocus(idx); setCotVuRaw(p => ({ ...p, [idx]: det.valorUnitario ? formatPeso(det.valorUnitario) : "" })) }}
                                onBlur={() => { setCotVuFocus(null); setCotVuRaw(p => { const r = { ...p }; delete r[idx]; return r }) }}
                                onChange={(e) => { const raw = e.target.value; setCotVuRaw(p => ({ ...p, [idx]: raw })); const num = parsePeso(raw); updateCotItem(idx, "valorUnitario", num) }} 
                                required className="text-right pl-6" placeholder="0,00" />
                            </div>
                          </td>
                          <td className="px-3 py-1.5">
                            <div className="flex h-9 items-center justify-end text-sm font-mono">{formatMoney(det.cantidad * det.valorUnitario)}</div>
                          </td>
                          <td className="px-1 py-1.5">
                            {cotForm.items.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeCotItem(idx)}>✕</Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
                    </div>
                    {c.observaciones && <p className="text-sm"><span className="text-muted-foreground">Observaciones: </span>{c.observaciones}</p>}
                    <Separator />
                    <table className="w-full text-sm">
                      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">#</th><th className="text-left py-2">Descripción</th><th className="text-center py-2">Unidad</th><th className="text-right py-2">Cantidad</th><th className="text-right py-2">V. Unitario</th><th className="text-right py-2">V. Total</th></tr></thead>
                      <tbody>
                        {(c as any).items?.map((i: any) => (
                          <tr key={i.id} className="border-b last:border-0">
                            <td className="py-2">{i.item}</td>
                            <td className="py-2">{i.descripcion}</td>
                            <td className="py-2 text-center">{i.unidadMedida}</td>
                            <td className="py-2 text-right font-mono">{Number(i.cantidad)}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorUnitario))}</td>
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
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          {/* Confirmar guardar cotización */}
          <Dialog open={cotConfirmOpen} onOpenChange={setCotConfirmOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Guardar Cotizaci&oacute;n</DialogTitle>
                <DialogDescription>&iquest;Est&aacute;s seguro de guardar esta cotizaci&oacute;n?</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setCotConfirmOpen(false)}>Cancelar</Button>
                <Button onClick={confirmCotSave}><Save className="mr-2 h-4 w-4" />Guardar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </Tabs.Content>

        {/* ═══ APROBACIONES ═══ */}
        <Tabs.Content value="aprobaciones" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Requisiciones Pendientes de Aprobación</h3>
            <Button variant="outline" onClick={() => { setAprobConfigForm({ desde: "", hasta: "", cargoAprobador: "" }); setAprobConfigDialogOpen(true) }}><Settings className="mr-2 h-4 w-4" />Configurar Reglas</Button>
          </div>
          <DataTable columns={aprobColumns} data={aprobPendientes} loading={aprobLoading} />

          {/* Modal Aprobar */}
          <Dialog open={aprobModalOpen} onOpenChange={(o) => !o && setAprobModalOpen(false)}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Aprobar Requisición</DialogTitle>
                <DialogDescription>
                  {aprobModalReqId && (() => {
                    const r = aprobPendientes.find(x => x.id === aprobModalReqId)
                    return r ? `Req #${r.numero} — ${r.areaSolicitante} — ${r.items.length} ítems` : ""
                  })()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="aprob-comentario">Comentarios <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                  <textarea
                    id="aprob-comentario"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Agrega un comentario si es necesario..."
                    value={aprobModalComentario}
                    onChange={(e) => setAprobModalComentario(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setAprobModalOpen(false)}>Cancelar</Button>
                  <Button onClick={confirmAprobar}>
                    <CheckCircle className="mr-2 h-4 w-4" />Aprobar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Modal Rechazar */}
          <Dialog open={rechazarModalOpen} onOpenChange={(o) => !o && setRechazarModalOpen(false)}>
            <DialogContent className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle>Rechazar Requisición</DialogTitle>
                <DialogDescription>
                  {rechazarModalReqId && (() => {
                    const r = aprobPendientes.find(x => x.id === rechazarModalReqId)
                    return r ? `Req #${r.numero} — ${r.areaSolicitante} — ${r.items.length} ítems` : ""
                  })()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rechazar-motivo">Motivo del rechazo <span className="text-destructive">*</span></Label>
                  <textarea
                    id="rechazar-motivo"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Indica el motivo por el cual se rechaza..."
                    value={rechazarModalMotivo}
                    onChange={(e) => setRechazarModalMotivo(e.target.value)}
                  />
                  {!rechazarModalMotivo.trim() && (
                    <p className="text-xs text-destructive">El motivo es obligatorio</p>
                  )}
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <Button variant="outline" onClick={() => setRechazarModalOpen(false)}>Cancelar</Button>
                  <Button variant="destructive" onClick={confirmRechazar} disabled={!rechazarModalMotivo.trim()}>
                    <XCircle className="mr-2 h-4 w-4" />Rechazar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Separator />
          <h3 className="text-lg font-medium">Reglas de Aprobación</h3>
          {aprobConfigs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay reglas configuradas</p>
          ) : (
            <div className="space-y-2">
              {aprobConfigs.map(ac => (
                <div key={ac.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <span className="font-medium">${formatMoney(ac.desde)}</span> a <span className="font-medium">${formatMoney(ac.hasta)}</span>
                    <span className="text-muted-foreground ml-4">→ Aprobador: {ac.cargoAprobador}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleAprobConfigDelete(ac.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          )}

          <FormDialog open={aprobConfigDialogOpen} onOpenChange={setAprobConfigDialogOpen} title="Nueva Regla de Aprobación" description="Define rangos de valor y aprobadores" loading={aprobConfigSaving} onSubmit={handleAprobConfigSave as any}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Desde ($)</Label>
                  <Input type="number" step="0.01" min="0" value={aprobConfigForm.desde} onChange={(e) => setAprobConfigForm(p => ({ ...p, desde: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Hasta ($)</Label>
                  <Input type="number" step="0.01" min="0" value={aprobConfigForm.hasta} onChange={(e) => setAprobConfigForm(p => ({ ...p, hasta: e.target.value }))} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cargo del Aprobador</Label>
                <Input value={aprobConfigForm.cargoAprobador} onChange={(e) => setAprobConfigForm(p => ({ ...p, cargoAprobador: e.target.value }))} required placeholder="Ej: Gerente de Compras, Presidente" />
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ═══ ORDENES DE COMPRA ═══ */}
        <Tabs.Content value="ordenes" className="space-y-4">
          <div className="flex items-center justify-between">
            <Input placeholder="Buscar por número o proveedor..." value={ocSearch} onChange={(e) => setOcSearch(e.target.value)} className="max-w-sm" />
            <Button onClick={openOCCreate}><Plus className="mr-2 h-4 w-4" />Generar OC</Button>
          </div>
          <DataTable columns={ocColumns} data={filteredOCs} loading={ocLoading} />

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
                      <thead><tr className="border-b text-muted-foreground"><th className="text-left py-2">#</th><th className="text-left py-2">Descripción</th><th className="text-left py-2">Unidad</th><th className="text-right py-2">Cantidad</th><th className="text-right py-2">V. Unitario</th><th className="text-right py-2">V. Total</th></tr></thead>
                      <tbody>
                        {o.items.map((i) => (
                          <tr key={i.id} className="border-b last:border-0">
                            <td className="py-2">{i.item}</td>
                            <td className="py-2">{i.descripcion}</td>
                            <td className="py-2">{i.unidadMedida}</td>
                            <td className="py-2 text-right font-mono">{Number(i.cantidad)}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorUnitario))}</td>
                            <td className="py-2 text-right font-mono">{formatMoney(Number(i.valorTotal))}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t font-medium"><td colSpan={5} className="py-2 text-right">Subtotal:</td><td className="py-2 text-right font-mono">{formatMoney(o.items.reduce((s: number, i: any) => s + Number(i.valorTotal), 0))}</td></tr>
                        <tr className="font-medium"><td colSpan={5} className="py-2 text-right">IVA (16%):</td><td className="py-2 text-right font-mono">{formatMoney(o.items.reduce((s: number, i: any) => s + Number(i.valorTotal), 0) * 0.16)}</td></tr>
                        <tr className="font-medium text-lg"><td colSpan={5} className="py-2 text-right">Total:</td><td className="py-2 text-right font-mono">{formatMoney(o.valorTotal)}</td></tr>
                      </tfoot>
                    </table>
                    <Separator />
                    <HistorialEstados entidadTipo="ORDEN_COMPRA" entidadId={o.id} />
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
                    {requisiciones.filter(r => r.estado === "APROBADA" || r.estado === "EN_COTIZACION").map(r => (
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
                    <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
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
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addOCItem}><Plus className="mr-1 h-3.5 w-3.5" />Agregar</Button>
              </div>
              {ocForm.items.map((det, idx) => (
                <div key={idx} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
                    {ocForm.items.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeOCItem(idx)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input value={det.descripcion} onChange={(e) => updateOCItem(idx, "descripcion", e.target.value)} required />
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div className="space-y-2"><Label>Unidad</Label><Input value={det.unidadMedida} onChange={(e) => updateOCItem(idx, "unidadMedida", e.target.value)} required /></div>
                    <div className="space-y-2"><Label>Cantidad</Label><Input type="number" step="0.01" min="0" value={det.cantidad} onChange={(e) => updateOCItem(idx, "cantidad", parseFloat(e.target.value) || 0)} required /></div>
                    <div className="space-y-2"><Label>V. Unitario</Label><Input type="number" step="0.01" min="0" value={det.valorUnitario} onChange={(e) => updateOCItem(idx, "valorUnitario", parseFloat(e.target.value) || 0)} required /></div>
                    <div className="space-y-2"><Label>V. Total</Label><div className="flex h-9 items-center text-sm font-mono">{formatMoney(det.cantidad * det.valorUnitario)}</div></div>
                  </div>
                </div>
              ))}

              <Separator />
              {/* ─── Totales ──────────────────────────────── */}
              {(() => {
                const sub = ocForm.items.reduce((s, i) => s + (Number(i.cantidad) || 0) * (Number(i.valorUnitario) || 0), 0)
                const iva = ocForm.aplicaIVA ? Math.round(sub * 0.16 * 100) / 100 : 0
                const total = sub + iva
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label>IVA</Label>
                      <input type="checkbox" checked={ocForm.aplicaIVA} onChange={(e) => setOcForm(p => ({ ...p, aplicaIVA: e.target.checked }))} className="h-4 w-4" />
                      <span className="text-sm text-muted-foreground">Aplicar IVA (16%)</span>
                    </div>
                    <div className="rounded-md border p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-mono">{formatMoney(sub)}</span>
                      </div>
                      {ocForm.aplicaIVA && (
                        <div className="flex justify-between">
                          <span>IVA (16%)</span>
                          <span className="font-mono">{formatMoney(iva)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between font-medium">
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

        {/* ═══ RECEPCION ═══ */}
        <Tabs.Content value="recepcion" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openRecCreate}><Plus className="mr-2 h-4 w-4" />Registrar Recepción</Button>
          </div>
          <DataTable columns={recColumns} data={recepciones} loading={recLoading} />

          <FormDialog open={recDialogOpen} onOpenChange={setRecDialogOpen} title="Registrar Recepción" description="Registra la recepción de bienes o servicios" loading={recSaving} onSubmit={handleRecSave as any}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Orden de Compra</Label>
                <Select value={recForm.ordenCompraId} onValueChange={handleOCSelectForRec}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar OC..." /></SelectTrigger>
                  <SelectContent>
                    {ordenes.filter(o => o.estado !== "CERRADA").map(o => (
                      <SelectItem key={o.id} value={o.id}>OC #{o.numero} - {o.proveedor?.razonSocial}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Remisión</Label>
                  <Input value={recForm.remision} onChange={(e) => setRecForm(p => ({ ...p, remision: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Observaciones</Label>
                <Input value={recForm.observaciones} onChange={(e) => setRecForm(p => ({ ...p, observaciones: e.target.value }))} />
              </div>
              <Separator />
              <Label>Items Recibidos</Label>
              {recForm.items.map((det, idx) => (
                <div key={idx} className="space-y-2 rounded-md border p-3">
                  <span className="text-xs text-muted-foreground">{det.descripcion}</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cantidad Recibida</Label>
                      <Input type="number" step="0.01" min="0" value={det.cantidadRecibida} onChange={(e) => updateRecItem(idx, "cantidadRecibida", parseFloat(e.target.value) || 0)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Observaciones</Label>
                      <Input value={det.observaciones} onChange={(e) => updateRecItem(idx, "observaciones", e.target.value)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ═══ PROVEEDORES ═══ */}
        <Tabs.Content value="proveedores" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openProvCreate}><Plus className="mr-2 h-4 w-4" />Nuevo Proveedor</Button>
          </div>
          <DataTable columns={provColumns} data={proveedores} />

          <FormDialog open={provDialogOpen} onOpenChange={setProvDialogOpen} title={provEditId ? "Editar Proveedor" : "Nuevo Proveedor"} loading={provSaving} onSubmit={handleProvSave as any}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Razón Social</Label><Input value={provForm.razonSocial} onChange={(e) => setProvForm(p => ({ ...p, razonSocial: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>NIT</Label><Input value={provForm.nit} onChange={(e) => setProvForm(p => ({ ...p, nit: e.target.value }))} required /></div>
                <div className="space-y-2"><Label>Contacto</Label><Input value={provForm.contacto} onChange={(e) => setProvForm(p => ({ ...p, contacto: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Teléfono</Label><Input value={provForm.telefono} onChange={(e) => setProvForm(p => ({ ...p, telefono: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Email</Label><Input type="email" value={provForm.email} onChange={(e) => setProvForm(p => ({ ...p, email: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Dirección</Label><Input value={provForm.direccion} onChange={(e) => setProvForm(p => ({ ...p, direccion: e.target.value }))} /></div>
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ═══ CENTROS COSTOS ═══ */}
        <Tabs.Content value="centros-costos" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCCCreate}><Plus className="mr-2 h-4 w-4" />Nuevo Centro Costos</Button>
          </div>
          <DataTable columns={ccColumns} data={centrosCostos} />

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

        {/* ═══ CONFIG APROBACION ═══ */}
        <Tabs.Content value="config" className="space-y-4">
          <p className="text-sm text-muted-foreground">Gestiona las reglas de aprobación desde la pestaña de Aprobaciones.</p>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
