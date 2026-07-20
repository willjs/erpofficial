"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import * as Tabs from "@radix-ui/react-tabs"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  Plus, Pencil, Trash2, CheckCircle2, Banknote, Eye, DollarSign, FileText,
  CheckCircle, XCircle, ArrowRight, Download, PlusCircle, History, AlertTriangle,
} from "lucide-react"
import { formatMoney, formatDate } from "@/lib/utils"
import {
  getCuentas, createCuenta, updateCuenta, deleteCuenta,
  getMovimientos, createMovimiento, updateMovimiento, deleteMovimiento, conciliarMovimiento,
  getPagosByCuentaId, ajustarSaldoCuenta,
} from "@/actions/tesoreria"
import {
  getCuentasPagar, crearCuentaPagar, getEgresos, enviarATesoreria, pagarCuenta, deleteCuentaPagar,
  getOrdenesCompra,
} from "@/actions/compras"
import { limpiarDatosComprasTesoreria } from "@/actions/cleanup"

type Cuenta = { id: string; banco: string; numeroCuenta: string; tipo: "CORRIENTE" | "AHORROS" | "EFECTIVO" | "INVERSION"; saldoInicial: number; saldoActual: number; moneda: string }
type Movimiento = { id: string; cuentaId: string; tipo: string; fecha: string; monto: number; descripcion: string | null; referencia: string | null; estado: string; fechaConciliacion: string | null; cuenta: { banco: string; numeroCuenta: string } }

type CuentaPagar = {
  id: string; ordenCompraId: string; tipo: string; numeroFactura: string | null;
  fechaFactura: string | null; fechaVencimiento: string | null;
  valor: number; saldoPendiente: number; estado: string;
  ordenCompra: {
    id: string; numero: number; proveedor: { razonSocial: string; nit: string };
    items: { item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number }[];
    cotizacion?: {
      proveedor: { razonSocial: string };
      items: { item: number; descripcion: string; unidadMedida: string; cantidad: number; valorUnitario: number; valorTotal: number }[];
    } | null;
  };
  _count: { pagos: number }
}

type Egreso = {
  id: string; numero: number; fecha: string; beneficiario: string;
  cuentaBancaria: string | null; valor: number; observaciones: string | null;
  pago: { proveedor: { razonSocial: string }; cuentaPagar: { numeroFactura: string | null }; comprobante: string | null }
}

type PagoHistorico = {
  id: string; valor: number; fechaPago: string | null; estado: string;
  proveedor: { razonSocial: string; nit: string } | null;
  cuentaPagar: { numeroFactura: string | null; valor: number } | null;
  createdAt: string;
}

const tipoCuentaVariant: Record<string, string> = { CORRIENTE: "info", AHORROS: "success", EFECTIVO: "warning", INVERSION: "default" }
const tipoCuentaLabel: Record<string, string> = { CORRIENTE: "Corriente", AHORROS: "Ahorros", EFECTIVO: "Efectivo", INVERSION: "Inversión" }
const estadoMovVariant: Record<string, string> = { PENDIENTE: "warning", CONCILIADO: "success", CANCELADO: "destructive" }
const estadoCPVariant: Record<string, string> = { PENDIENTE: "warning", CONTABILIZADA: "info", ENVIADA_TESORERIA: "default", PAGADA: "success" }
const tipoMovLabel: Record<string, string> = { INGRESO: "Ingreso", EGASTO: "Egreso" }

export default function TesoreriaPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("cuentas")

  // ─── Cuentas ────────────────────────────────────────
  const [cuentas, setCuentas] = useState<Cuenta[]>([])
  const [cuentasLoading, setCuentasLoading] = useState(true)
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false)
  const [cuentaEditing, setCuentaEditing] = useState<Cuenta | null>(null)
  const [cuentaForm, setCuentaForm] = useState<{ banco: string; numeroCuenta: string; tipo: "CORRIENTE" | "AHORROS" | "EFECTIVO" | "INVERSION"; saldoInicial: number; moneda: string }>({ banco: "", numeroCuenta: "", tipo: "CORRIENTE", saldoInicial: 0, moneda: "COP" })

  // ─── Detalle Cuenta (pagos + ajuste) ───────────────
  const [detalleCuentaId, setDetalleCuentaId] = useState<string | null>(null)
  const [pagosHistoricos, setPagosHistoricos] = useState<PagoHistorico[]>([])
  const [pagosLoading, setPagosLoading] = useState(false)
  const [ajusteDialogOpen, setAjusteDialogOpen] = useState(false)
  const [ajusteMonto, setAjusteMonto] = useState(0)
  const [ajusteDesc, setAjusteDesc] = useState("")

  // ─── Movimientos ────────────────────────────────────
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [selectedCuentaId, setSelectedCuentaId] = useState("")
  const [movLoading, setMovLoading] = useState(false)
  const [movDialogOpen, setMovDialogOpen] = useState(false)
  const [movEditing, setMovEditing] = useState<Movimiento | null>(null)
  const [movForm, setMovForm] = useState({ tipo: "INGRESO", fecha: "", monto: 0, descripcion: "", referencia: "" })
  const [submitting, setSubmitting] = useState(false)

  // ─── Cuentas por Pagar ──────────────────────────────
  const [cuentasPagar, setCuentasPagar] = useState<CuentaPagar[]>([])
  const [cpLoading, setCpLoading] = useState(true)
  const [cpFacturaDialogOpen, setCpFacturaDialogOpen] = useState(false)
  const [cpFacturaForm, setCpFacturaForm] = useState({ ordenCompraId: "", numeroFactura: "", fechaFactura: "", fechaVencimiento: "" })
  const [selectedOC, setSelectedOC] = useState<any>(null)

  // ─── Limpiar datos ────────────────────────────
  const [cleanupOpen, setCleanupOpen] = useState(false)
  const [cleanupLoading, setCleanupLoading] = useState(false)

  // ─── Editar Factura ─────────────────────────────
  const [editFacturaOpen, setEditFacturaOpen] = useState(false)
  const [editFacturaCPId, setEditFacturaCPId] = useState("")
  const [editFacturaValor, setEditFacturaValor] = useState("")

  // ─── Comprobante Preview ──────────────────────────
  const [comprobanteUrl, setComprobanteUrl] = useState<string | null>(null)

  // ─── Pago Dialog ──────────────────────────────────
  const [pagoDialogOpen, setPagoDialogOpen] = useState(false)
  const [pagoCP, setPagoCP] = useState<CuentaPagar | null>(null)
  const [pagoCuentaId, setPagoCuentaId] = useState("")
  const [pagoComprobante, setPagoComprobante] = useState<File | null>(null)
  const [pagoNumeroFactura, setPagoNumeroFactura] = useState("")

  // ─── Ordenes de Compra ─────────────────────────────
  const [ordenesCompra, setOrdenesCompra] = useState<any[]>([])
  const [ocLoading, setOcLoading] = useState(false)

  // ─── Egresos ────────────────────────────────────────
  const [egresos, setEgresos] = useState<Egreso[]>([])
  const [egresoLoading, setEgresoLoading] = useState(true)

  // ─── Loaders ────────────────────────────────────────
  const loadCuentas = useCallback(async () => {
    setCuentasLoading(true)
    try {
      const data = await getCuentas()
      setCuentas(data as Cuenta[])
      if (data.length > 0 && !selectedCuentaId) setSelectedCuentaId(data[0].id)
    } catch (err: any) {
      toast({ title: "Error al cargar cuentas", description: err.message, variant: "destructive" })
    } finally { setCuentasLoading(false) }
  }, [selectedCuentaId])

  const loadPagos = useCallback(async (cuentaId: string) => {
    if (!cuentaId) return
    setPagosLoading(true)
    try {
      const data = await getPagosByCuentaId(cuentaId)
      setPagosHistoricos(data as PagoHistorico[])
    } catch (err: any) {
      toast({ title: "Error al cargar pagos", description: err.message, variant: "destructive" })
    } finally { setPagosLoading(false) }
  }, [])

  const loadMovimientos = useCallback(async (cuentaId: string) => {
    if (!cuentaId) return
    setMovLoading(true)
    try {
      const data = await getMovimientos(cuentaId)
      setMovimientos(data as Movimiento[])
    } catch (err: any) {
      toast({ title: "Error al cargar movimientos", description: err.message, variant: "destructive" })
    } finally { setMovLoading(false) }
  }, [])

  const loadCuentasPagar = useCallback(async () => {
    setCpLoading(true)
    try {
      const data = await getCuentasPagar()
      setCuentasPagar(data as CuentaPagar[])
    } catch (err: any) {
      toast({ title: "Error al cargar cuentas por pagar", description: err.message, variant: "destructive" })
    } finally { setCpLoading(false) }
  }, [])

  const loadEgresos = useCallback(async () => {
    setEgresoLoading(true)
    try {
      const data = await getEgresos()
      setEgresos(data as Egreso[])
    } catch (err: any) {
      toast({ title: "Error al cargar egresos", description: err.message, variant: "destructive" })
    } finally { setEgresoLoading(false) }
  }, [])

  const loadOrdenesCompra = useCallback(async () => {
    setOcLoading(true)
    try {
      const data = await getOrdenesCompra()
      setOrdenesCompra(data)
    } catch (err: any) {
      toast({ title: "Error al cargar órdenes de compra", description: err.message, variant: "destructive" })
    } finally { setOcLoading(false) }
  }, [])

  useEffect(() => { loadCuentas() }, [loadCuentas])
  useEffect(() => { if (detalleCuentaId) { loadPagos(detalleCuentaId) } else { setPagosHistoricos([]) } }, [detalleCuentaId, loadPagos])
  useEffect(() => { if (selectedCuentaId) loadMovimientos(selectedCuentaId); else setMovimientos([]) }, [selectedCuentaId, loadMovimientos])
  useEffect(() => { loadCuentasPagar(); loadEgresos(); loadOrdenesCompra() }, [loadCuentasPagar, loadEgresos, loadOrdenesCompra])

  const totalSaldo = cuentas.reduce((sum, c) => sum + c.saldoActual, 0)

  // ─── Cuenta handlers ────────────────────────────────
  function openCreateCuenta() { setCuentaEditing(null); setCuentaForm({ banco: "", numeroCuenta: "", tipo: "CORRIENTE", saldoInicial: 0, moneda: "COP" }); setCuentaDialogOpen(true) }
  function openEditCuenta(c: Cuenta) { setCuentaEditing(c); setCuentaForm({ banco: c.banco, numeroCuenta: c.numeroCuenta, tipo: c.tipo, saldoInicial: c.saldoInicial, moneda: c.moneda }); setCuentaDialogOpen(true) }
  async function handleSubmitCuenta(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    try {
      const isEdit = cuentas.some(c => c.id === cuentaEditing?.id)
      const result = isEdit
        ? await updateCuenta(cuentaEditing!.id, cuentaForm)
        : await createCuenta(cuentaForm)
      if (result.success) {
        toast({ title: isEdit ? "Cuenta actualizada" : "Cuenta creada", variant: "success" })
        setCuentaDialogOpen(false); await loadCuentas()
      }
    } catch (err: any) {
      toast({ title: "Error al guardar cuenta", description: err.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }
  async function handleDeleteCuenta(id: string) {
    if (!confirm("¿Eliminar cuenta?")) return
    try {
      await deleteCuenta(id)
      toast({ title: "Cuenta eliminada", variant: "success" })
      await loadCuentas()
      if (detalleCuentaId === id) setDetalleCuentaId(null)
    } catch (err: any) {
      toast({ title: "Error al eliminar cuenta", description: err.message, variant: "destructive" })
    }
  }

  async function handleAjustarSaldo(e: React.FormEvent) {
    e.preventDefault()
    if (!detalleCuentaId || ajusteMonto <= 0) return
    setSubmitting(true)
    try {
      await ajustarSaldoCuenta(detalleCuentaId, ajusteMonto, ajusteDesc || undefined)
      toast({ title: "Saldo ajustado", description: `Se agregaron ${formatMoney(ajusteMonto)} al saldo de la cuenta`, variant: "success" })
      setAjusteDialogOpen(false)
      setAjusteMonto(0)
      setAjusteDesc("")
      await loadCuentas()
    } catch (err: any) {
      toast({ title: "Error al ajustar saldo", description: err.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  // ─── Movimiento handlers ────────────────────────────
  function openCreateMov() { setMovEditing(null); setMovForm({ tipo: "INGRESO", fecha: new Date().toISOString().split("T")[0], monto: 0, descripcion: "", referencia: "" }); setMovDialogOpen(true) }
  function openEditMov(m: Movimiento) { setMovEditing(m); setMovForm({ tipo: m.tipo as any, fecha: m.fecha.split("T")[0], monto: m.monto, descripcion: m.descripcion || "", referencia: m.referencia || "" }); setMovDialogOpen(true) }
  async function handleSubmitMov(e: React.FormEvent) {
    e.preventDefault(); if (!selectedCuentaId) return; setSubmitting(true)
    try {
      const payload = { ...movForm, cuentaId: selectedCuentaId }
      const isEdit = !!movEditing
      const result = isEdit ? await updateMovimiento(movEditing.id, payload as any) : await createMovimiento(payload as any)
      if (result.success) {
        toast({ title: isEdit ? "Movimiento actualizado" : "Movimiento creado", variant: "success" })
        setMovDialogOpen(false); await loadMovimientos(selectedCuentaId); await loadCuentas()
      }
    } catch (err: any) {
      toast({ title: "Error al guardar movimiento", description: err.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }
  async function handleDeleteMov(id: string) {
    if (!confirm("¿Eliminar movimiento?")) return
    try {
      await deleteMovimiento(id)
      toast({ title: "Movimiento eliminado", variant: "success" })
      await loadMovimientos(selectedCuentaId); await loadCuentas()
    } catch (err: any) {
      toast({ title: "Error al eliminar movimiento", description: err.message, variant: "destructive" })
    }
  }
  async function handleCleanup() {
    setCleanupLoading(true)
    try {
      const result = await limpiarDatosComprasTesoreria()
      toast({ title: result.message, variant: "success" })
      setCleanupOpen(false)
      await loadCuentas()
      await loadCuentasPagar()
      await loadEgresos()
      if (selectedCuentaId) await loadMovimientos(selectedCuentaId)
      if (detalleCuentaId) await loadPagos(detalleCuentaId)
    } catch (err: any) {
      toast({ title: "Error al limpiar datos", description: err.message, variant: "destructive" })
    } finally { setCleanupLoading(false) }
  }

  async function handleConciliar(id: string) {
    if (!confirm("¿Conciliar?")) return
    try {
      await conciliarMovimiento(id)
      toast({ title: "Movimiento conciliado", variant: "success" })
      await loadMovimientos(selectedCuentaId); await loadCuentas()
    } catch (err: any) {
      toast({ title: "Error al conciliar movimiento", description: err.message, variant: "destructive" })
    }
  }

  // ─── Cuenta Pagar handlers ──────────────────────────
  async function handleCrearCP(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true)
    try {
      await crearCuentaPagar(cpFacturaForm.ordenCompraId, cpFacturaForm.numeroFactura || undefined, cpFacturaForm.fechaFactura || undefined, cpFacturaForm.fechaVencimiento || undefined)
      toast({ title: "Cuenta por pagar registrada", variant: "success" })
      setCpFacturaDialogOpen(false)
      await loadCuentasPagar()
    } catch (err: any) {
      toast({ title: "Error al registrar cuenta por pagar", description: err.message, variant: "destructive" })
    } finally { setSubmitting(false) }
  }

  function openCrearCP() {
    setCpFacturaForm({ ordenCompraId: "", numeroFactura: "", fechaFactura: "", fechaVencimiento: "" })
    setSelectedOC(null)
    loadOrdenesCompra()
    setCpFacturaDialogOpen(true)
  }

  useEffect(() => {
    if (!cpFacturaForm.ordenCompraId) { setSelectedOC(null); return }
    const oc = ordenesCompra.find((o: any) => o.id === cpFacturaForm.ordenCompraId)
    setSelectedOC(oc ?? null)
  }, [cpFacturaForm.ordenCompraId, ordenesCompra])

  function openEditFactura(c: CuentaPagar) {
    setEditFacturaCPId(c.id)
    setEditFacturaValor("")
    setEditFacturaOpen(true)
  }

  async function handleEditFactura() {
    if (!editFacturaCPId || !editFacturaValor.trim()) return
    try {
      const { actualizarFacturaCuentaPagar } = await import("@/actions/compras")
      await actualizarFacturaCuentaPagar(editFacturaCPId, editFacturaValor.trim())
      toast({ title: "Factura actualizada", variant: "success" })
      setEditFacturaOpen(false)
      await loadCuentasPagar()
    } catch (err: any) { toast({ title: "Error", description: err.message, variant: "destructive" }) }
  }

  async function handleDeleteCP(id: string) {
    if (!confirm("¿Eliminar esta cuenta por pagar?")) return
    try {
      await deleteCuentaPagar(id)
      toast({ title: "Cuenta por pagar eliminada", variant: "success" })
      await loadCuentasPagar()
      await loadEgresos()
    } catch (err: any) { toast({ title: "Error al eliminar", description: err.message, variant: "destructive" }) }
  }

  async function handleEnviarTesoreria(id: string) {
    if (!confirm("¿Enviar a tesorería para pago?")) return
    try {
      await enviarATesoreria(id)
      toast({ title: "Enviada a tesorería", variant: "success" })
      await loadCuentasPagar()
    } catch (err: any) { toast({ title: "Error al enviar a tesorería", description: err.message, variant: "destructive" }) }
  }

  function openPagoDialog(cp: CuentaPagar) {
    setPagoCP(cp)
    setPagoCuentaId(cuentas.length > 0 ? cuentas[0].id : "")
    setPagoComprobante(null)
    setPagoNumeroFactura(cp.numeroFactura ?? "")
    setPagoDialogOpen(true)
  }

  async function handlePagarCP(e: React.FormEvent) {
    e.preventDefault()
    if (!pagoCP || !pagoCuentaId) return
    setSubmitting(true)
    try {
      let comprobante = undefined as any
      if (pagoComprobante) {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve((reader.result as string).split(",")[1])
          reader.readAsDataURL(pagoComprobante!)
        })
        comprobante = { nombre: pagoComprobante.name, base64 }
      }
      await pagarCuenta(pagoCP.id, pagoCuentaId, pagoNumeroFactura || undefined, comprobante)
      toast({ title: "Pago registrado exitosamente", variant: "success" })
      setPagoDialogOpen(false)
      await loadCuentasPagar()
      await loadEgresos()
      await loadCuentas()
      if (selectedCuentaId) await loadMovimientos(selectedCuentaId)
      if (detalleCuentaId) await loadPagos(detalleCuentaId)
    } catch (err: any) { toast({ title: "Error al registrar pago", description: err.message, variant: "destructive" }) } finally { setSubmitting(false) }
  }

  // ─── Columns ─────────────────────────────────────────
  const cuentaColumns: Column<Cuenta>[] = [
    { key: "banco", header: "Banco", render: (c) => <button type="button" className="text-primary hover:underline text-left" onClick={() => setDetalleCuentaId(detalleCuentaId === c.id ? null : c.id)}>{c.banco}</button> },
    { key: "numeroCuenta", header: "Número" },
    { key: "tipo", header: "Tipo", render: (c) => <Badge variant={(tipoCuentaVariant as any)[c.tipo] || "default"}>{tipoCuentaLabel[c.tipo] || c.tipo}</Badge> },
    { key: "saldoInicial", header: "Saldo Inicial", render: (c) => formatMoney(c.saldoInicial, c.moneda), className: "text-right" },
    { key: "saldoActual", header: "Saldo Actual", render: (c) => formatMoney(c.saldoActual, c.moneda), className: "text-right" },
    { key: "acciones", header: "", render: (c) => (
      <div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => openEditCuenta(c)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => handleDeleteCuenta(c.id)}><Trash2 className="h-4 w-4" /></Button></div>
    )},
  ]

  const movColumns: Column<Movimiento>[] = [
    { key: "fecha", header: "Fecha", render: (m) => formatDate(m.fecha) },
    { key: "tipo", header: "Tipo", render: (m) => <span className={m.tipo === "INGRESO" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{tipoMovLabel[m.tipo] || m.tipo}</span> },
    { key: "monto", header: "Monto", render: (m) => formatMoney(m.monto) },
    { key: "descripcion", header: "Descripción", render: (m) => m.descripcion || "—" },
    { key: "referencia", header: "Ref.", render: (m) => m.referencia || "—" },
    { key: "estado", header: "Estado", render: (m) => <Badge variant={(estadoMovVariant as any)[m.estado] || "default"}>{m.estado}</Badge> },
    { key: "cuenta", header: "Cuenta", render: (m) => <span className="text-xs">{m.cuenta.banco} — {m.cuenta.numeroCuenta}</span> },
    { key: "acciones", header: "", render: (m) => (
      <div className="flex gap-1">
        {m.estado === "PENDIENTE" && <Button variant="ghost" size="sm" onClick={() => handleConciliar(m.id)}><CheckCircle2 className="h-4 w-4 text-green-600" /></Button>}
        <Button variant="ghost" size="sm" onClick={() => openEditMov(m)}><Pencil className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => handleDeleteMov(m.id)}><Trash2 className="h-4 w-4" /></Button>
      </div>
    )},
  ]

  const cpColumns: Column<CuentaPagar>[] = [
    { key: "factura", header: "Factura", render: (c) => c.numeroFactura ?? "—", className: "w-28" },
    { key: "proveedor", header: "Proveedor", render: (c) => c.ordenCompra?.proveedor?.razonSocial },
    { key: "oc", header: "OC", render: (c) => <span className="font-mono">#{c.ordenCompra?.numero}</span>, className: "w-16" },
    { key: "valor", header: "Valor", render: (c) => formatMoney(c.valor), className: "w-28 text-right" },
    { key: "saldo", header: "Saldo Pend.", render: (c) => formatMoney(c.saldoPendiente), className: "w-28 text-right" },
    { key: "estado", header: "Estado", render: (c) => <Badge variant={(estadoCPVariant as any)[c.estado] || "default"}>{c.estado}</Badge>, className: "w-28" },
    { key: "acciones", header: "", render: (c) => (
      <div className="flex gap-1">
        {c.estado !== "PAGADA" ? (
          <Button variant="ghost" size="sm" className="text-green-600" onClick={() => openPagoDialog(c)} title="Pagar">
            <DollarSign className="h-4 w-4" />
          </Button>
        ) : !c.numeroFactura ? (
          <Button variant="ghost" size="sm" onClick={() => openEditFactura(c)} title="Agregar factura">
            <FileText className="h-4 w-4" />
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteCP(c.id)} title="Eliminar">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    ), className: "w-20" },
  ]

  const egresoColumns: Column<Egreso>[] = [
    { key: "numero", header: "No.", render: (e) => <span className="font-mono">#{e.numero}</span>, className: "w-16" },
    { key: "fecha", header: "Fecha", render: (e) => formatDate(e.fecha), className: "w-24" },
    { key: "beneficiario", header: "Beneficiario" },
    { key: "valor", header: "Valor", render: (e) => formatMoney(e.valor), className: "w-28 text-right" },
    { key: "cuenta", header: "Cuenta Bancaria", render: (e) => e.cuentaBancaria ?? "—" },
    { key: "factura", header: "Factura", render: (e) => e.pago?.cuentaPagar?.numeroFactura ?? "—" },
    { key: "comprobante", header: "Comprobante", render: (e) => e.pago?.comprobante ? (
      <div className="flex gap-1">
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setComprobanteUrl(e.pago!.comprobante)} title="Ver comprobante"><Eye className="h-4 w-4" /></Button>
        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => window.open(e.pago!.comprobante!, "_blank")} title="Descargar"><Download className="h-4 w-4" /></Button>
      </div>
    ) : "—", className: "w-20" },
  ]

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader title="Tesorería" description="Cuentas bancarias, cuentas por pagar, pagos y egresos" actions={
        <Button variant="outline" size="sm" className="text-destructive border-destructive" onClick={() => setCleanupOpen(true)}>
          <AlertTriangle className="h-4 w-4 mr-1" />Limpiar datos
        </Button>
      } />

      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <Banknote className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Saldo Total Consolidado</p>
            <p className="text-2xl font-bold">{formatMoney(totalSaldo)}</p>
          </div>
        </CardContent>
      </Card>

      <Tabs.Root value={tab} onValueChange={setTab} className="space-y-4">
        <Tabs.List className="flex gap-1 border-b flex-wrap">
          {[
            { value: "cuentas", label: "Cuentas", icon: Banknote },
            { value: "movimientos", label: "Movimientos", icon: ArrowRight },
            { value: "cuentas-pagar", label: "Cuentas por Pagar", icon: FileText },
            { value: "egresos", label: "Egresos", icon: DollarSign },
          ].map(t => (
            <Tabs.Trigger key={t.value} value={t.value}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              <t.icon className="h-4 w-4" />{t.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="cuentas" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateCuenta}><Plus className="mr-2 h-4 w-4" />Nueva Cuenta</Button>
          </div>
          <DataTable columns={cuentaColumns} data={cuentas} loading={cuentasLoading} />

          {detalleCuentaId && (() => {
            const c = cuentas.find(x => x.id === detalleCuentaId)
            if (!c) return null
            return (
              <Card>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{c.banco} — {c.numeroCuenta}</h3>
                      <div className="text-sm text-muted-foreground">
                        <Badge variant={(tipoCuentaVariant as any)[c.tipo] || "default"} className="mr-2">{tipoCuentaLabel[c.tipo] || c.tipo}</Badge>
                        {c.moneda}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setAjusteMonto(0); setAjusteDesc(""); setAjusteDialogOpen(true) }}>
                      <PlusCircle className="h-4 w-4 mr-1" />Ajustar Saldo
                    </Button>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Saldo Inicial</p>
                      <p className="text-lg font-mono font-semibold">{formatMoney(c.saldoInicial, c.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Saldo Actual</p>
                      <p className="text-lg font-mono font-semibold">{formatMoney(c.saldoActual, c.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total Pagado</p>
                      <p className="text-lg font-mono font-semibold">{formatMoney(pagosHistoricos.reduce((s, p) => s + p.valor, 0), c.moneda)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">No. Pagos</p>
                      <p className="text-lg font-mono font-semibold">{pagosHistoricos.length}</p>
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h4 className="text-sm font-medium flex items-center gap-2 mb-2"><History className="h-4 w-4" />Historial de Pagos</h4>
                    {pagosLoading ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">Cargando pagos...</p>
                    ) : pagosHistoricos.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No hay pagos registrados en esta cuenta</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-3 py-2 font-medium">Fecha</th>
                              <th className="text-left px-3 py-2 font-medium">Proveedor</th>
                              <th className="text-left px-3 py-2 font-medium">Factura</th>
                              <th className="text-right px-3 py-2 font-medium">Valor Pagado</th>
                              <th className="text-center px-3 py-2 font-medium">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagosHistoricos.map((p) => (
                              <tr key={p.id} className="border-b last:border-0">
                                <td className="px-3 py-2">{p.fechaPago ? formatDate(p.fechaPago) : formatDate(p.createdAt)}</td>
                                <td className="px-3 py-2">{p.proveedor?.razonSocial ?? "—"}</td>
                                <td className="px-3 py-2">{p.cuentaPagar?.numeroFactura ?? "—"}</td>
                                <td className="px-3 py-2 text-right font-mono">{formatMoney(p.valor, c.moneda)}</td>
                                <td className="px-3 py-2 text-center"><Badge variant={p.estado === "PAGADO" ? "success" : "default"}>{p.estado}</Badge></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })()}
        </Tabs.Content>

        <Tabs.Content value="movimientos" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-72">
              <Select value={selectedCuentaId} onValueChange={setSelectedCuentaId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                <SelectContent>
                  {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numeroCuenta}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedCuentaId && <Button onClick={openCreateMov}><Plus className="mr-2 h-4 w-4" />Nuevo Movimiento</Button>}
          </div>
          {!selectedCuentaId ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Selecciona una cuenta</p>
          ) : <DataTable columns={movColumns} data={movimientos} loading={movLoading} />}
        </Tabs.Content>

        <Tabs.Content value="cuentas-pagar" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Obligaciones financieras registradas</p>
            <Button onClick={openCrearCP}><Plus className="mr-2 h-4 w-4" />Registrar Factura</Button>
          </div>
          <DataTable columns={cpColumns} data={cuentasPagar} loading={cpLoading} />

          <Dialog open={cpFacturaDialogOpen} onOpenChange={setCpFacturaDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Registrar Cuenta por Pagar</DialogTitle>
                <DialogDescription>Asocia una factura a una orden de compra</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCrearCP as any}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Orden de Compra</Label>
                    <Select value={cpFacturaForm.ordenCompraId} onValueChange={(v) => setCpFacturaForm(p => ({ ...p, ordenCompraId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar OC..." /></SelectTrigger>
                      <SelectContent>
                        {ocLoading ? (
                          <SelectItem value=" ">Cargando...</SelectItem>
                        ) : ordenesCompra.length === 0 ? (
                          <SelectItem value=" ">Sin OC disponibles</SelectItem>
                        ) : ordenesCompra.filter((oc: any) => oc.estado !== "CERRADA").map((oc: any) => (
                          <SelectItem key={oc.id} value={oc.id}>
                            #{oc.numero} - {oc.proveedor?.razonSocial} ({oc.estado})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedOC && (
                    <Card>
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-lg">OC #{selectedOC.numero}</p>
                            <p className="text-sm text-muted-foreground">{selectedOC.proveedor?.razonSocial} - NIT {selectedOC.proveedor?.nit}</p>
                          </div>
                          <Badge>{(selectedOC as any).estado}</Badge>
                        </div>
                        <Separator />
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div><span className="text-muted-foreground">Fecha:</span> {formatDate(selectedOC.fecha)}</div>
                          <div><span className="text-muted-foreground">Subtotal:</span> {formatMoney(selectedOC.subtotal)}</div>
                          <div><span className="text-muted-foreground">IVA:</span> {formatMoney(selectedOC.iva)}</div>
                          <div><span className="text-muted-foreground">Descuento:</span> {formatMoney(selectedOC.descuento)}</div>
                          <div><span className="text-muted-foreground font-semibold">Total:</span> <span className="font-semibold">{formatMoney(selectedOC.valorTotal)}</span></div>
                          <div><span className="text-muted-foreground">Forma de Pago:</span> {selectedOC.formaPago || "—"}</div>
                        </div>
                        {selectedOC.items?.length > 0 && (
                          <>
                            <Separator />
                            <p className="text-sm font-medium">Ítems</p>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-muted-foreground border-b">
                                  <th className="text-left py-1 pr-2">#</th>
                                  <th className="text-left py-1 pr-2">Descripción</th>
                                  <th className="text-right py-1 pr-2">Cant.</th>
                                  <th className="text-right py-1 pr-2">V/Unitario</th>
                                  <th className="text-right py-1">V/Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedOC.items.map((i: any) => (
                                  <tr key={i.item} className="border-b last:border-0">
                                    <td className="py-1 pr-2 align-top">{i.item}</td>
                                    <td className="py-1 pr-2 align-top">{i.descripcion}</td>
                                    <td className="py-1 pr-2 text-right align-top">{i.cantidad}</td>
                                    <td className="py-1 pr-2 text-right align-top">{formatMoney(i.valorUnitario)}</td>
                                    <td className="py-1 text-right align-top">{formatMoney(i.valorTotal)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </>
                        )}
                        {selectedOC.observaciones && (
                          <p className="text-sm text-muted-foreground"><span className="font-medium">Obs:</span> {selectedOC.observaciones}</p>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  <Separator />
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2"><Label>No. Factura</Label><Input value={cpFacturaForm.numeroFactura} onChange={(e) => setCpFacturaForm(p => ({ ...p, numeroFactura: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Fecha Factura</Label><Input type="date" value={cpFacturaForm.fechaFactura} onChange={(e) => setCpFacturaForm(p => ({ ...p, fechaFactura: e.target.value }))} /></div>
                    <div className="space-y-2"><Label>Vencimiento</Label><Input type="date" value={cpFacturaForm.fechaVencimiento} onChange={(e) => setCpFacturaForm(p => ({ ...p, fechaVencimiento: e.target.value }))} /></div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setCpFacturaDialogOpen(false)}>Cancelar</Button>
                    <Button type="submit" disabled={!cpFacturaForm.ordenCompraId || submitting}>
                      {submitting ? "Guardando..." : "Guardar"}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </Tabs.Content>

        <Tabs.Content value="egresos" className="space-y-4">
          <DataTable columns={egresoColumns} data={egresos} loading={egresoLoading} />
        </Tabs.Content>
      </Tabs.Root>

      {/* Cuenta Form Dialog */}
      <FormDialog open={cuentaDialogOpen} onOpenChange={setCuentaDialogOpen} title={cuentaEditing ? "Editar Cuenta" : "Nueva Cuenta"} onSubmit={handleSubmitCuenta as any} loading={submitting}>
        <div className="space-y-4">
          <div><Label>Banco</Label><Input value={cuentaForm.banco} onChange={(e) => setCuentaForm(p => ({ ...p, banco: e.target.value }))} required /></div>
          <div><Label>Número de Cuenta</Label><Input value={cuentaForm.numeroCuenta} onChange={(e) => setCuentaForm(p => ({ ...p, numeroCuenta: e.target.value }))} required /></div>
          <div><Label>Tipo</Label><Select value={cuentaForm.tipo} onValueChange={(v: string) => setCuentaForm(p => ({ ...p, tipo: v as "CORRIENTE" | "AHORROS" | "EFECTIVO" | "INVERSION" }))}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="CORRIENTE">Corriente</SelectItem><SelectItem value="AHORROS">Ahorros</SelectItem>
              <SelectItem value="EFECTIVO">Efectivo</SelectItem><SelectItem value="INVERSION">Inversión</SelectItem>
            </SelectContent></Select></div>
          {!cuentaEditing && <div><Label>Saldo Inicial</Label><Input type="number" step="any" value={cuentaForm.saldoInicial} onChange={(e) => setCuentaForm(p => ({ ...p, saldoInicial: parseFloat(e.target.value) || 0 }))} /><p className="text-xs text-muted-foreground mt-1">{formatMoney(cuentaForm.saldoInicial, cuentaForm.moneda)}</p></div>}
          <div><Label>Moneda</Label><Select value={cuentaForm.moneda} onValueChange={(v) => setCuentaForm(p => ({ ...p, moneda: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="COP">COP</SelectItem><SelectItem value="MXN">MXN</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem>
            </SelectContent></Select></div>
        </div>
      </FormDialog>

      {/* Pago Dialog */}
      <Dialog open={pagoDialogOpen} onOpenChange={setPagoDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
            <DialogDescription>Confirma el pago de la obligación seleccionada</DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePagarCP}>
            <div className="space-y-4">
              {pagoCP && (
                <>
                  <Card>
                    <CardContent className="pt-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium">{pagoCP.ordenCompra?.proveedor?.razonSocial}</span>
                        <Badge variant="outline">OC #{pagoCP.ordenCompra?.numero}</Badge>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-muted-foreground">No. Factura:</span>
                          <Input value={pagoNumeroFactura} onChange={(e) => setPagoNumeroFactura(e.target.value)} placeholder="Ingrese número de factura" className="mt-1 h-8 text-sm" />
                        </div>
                        <div><span className="text-muted-foreground">Valor:</span> <p className="font-mono font-semibold">{formatMoney(pagoCP.valor)}</p></div>
                        <div><span className="text-muted-foreground">Saldo Pend.:</span> <p className="font-mono font-semibold">{formatMoney(pagoCP.saldoPendiente)}</p></div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Detalle de la OC */}
                  {pagoCP.ordenCompra?.items?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Detalle de la Orden de Compra</h4>
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="text-left px-2 py-1.5 font-medium text-xs">Descripción</th>
                              <th className="text-left px-2 py-1.5 font-medium w-[60px] text-xs">Und</th>
                              <th className="text-right px-2 py-1.5 font-medium w-[60px] text-xs">Cant</th>
                              <th className="text-right px-2 py-1.5 font-medium w-[100px] text-xs">V. Unidad</th>
                              <th className="text-right px-2 py-1.5 font-medium w-[100px] text-xs">V. Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pagoCP.ordenCompra.items.map((det, idx) => (
                              <tr key={idx} className="border-b last:border-0">
                                <td className="px-2 py-1 text-xs">{det.descripcion}</td>
                                <td className="px-2 py-1 text-xs">{det.unidadMedida}</td>
                                <td className="px-2 py-1 text-right font-mono text-xs">{Number(det.cantidad)}</td>
                                <td className="px-2 py-1 text-right font-mono text-xs">{formatMoney(det.valorUnitario)}</td>
                                <td className="px-2 py-1 text-right font-mono text-xs">{formatMoney(det.valorTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}


                </>
              )}

              <div className="space-y-2">
                <Label>Cuenta Bancaria</Label>
                <Select value={pagoCuentaId} onValueChange={setPagoCuentaId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                  <SelectContent>
                    {cuentas.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numeroCuenta} ({formatMoney(c.saldoActual, c.moneda)})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Comprobante de Pago (opcional)</Label>
                <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setPagoComprobante(e.target.files?.[0] ?? null)} />
                {pagoComprobante && <p className="text-xs text-muted-foreground">{pagoComprobante.name} ({(pagoComprobante.size / 1024).toFixed(1)} KB)</p>}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setPagoDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={!pagoCuentaId || submitting}>
                  {submitting ? "Procesando..." : <><DollarSign className="mr-2 h-4 w-4" />Confirmar Pago</>}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Editar Factura Dialog */}
      <Dialog open={editFacturaOpen} onOpenChange={setEditFacturaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Agregar número de factura</DialogTitle>
            <DialogDescription>La factura solo se puede asignar si no tenía una previamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>No. Factura</Label>
              <Input value={editFacturaValor} onChange={(e) => setEditFacturaValor(e.target.value)} placeholder="Ingrese número de factura" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditFacturaOpen(false)}>Cancelar</Button>
              <Button onClick={handleEditFactura} disabled={!editFacturaValor.trim()}>Guardar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movimiento Form Dialog */}
      <FormDialog open={movDialogOpen} onOpenChange={setMovDialogOpen} title={movEditing ? "Editar Movimiento" : "Nuevo Movimiento"} onSubmit={handleSubmitMov as any} loading={submitting}>
        <div className="space-y-4">
          <div><Label>Tipo</Label><Select value={movForm.tipo} onValueChange={(v) => setMovForm(p => ({ ...p, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
              <SelectItem value="INGRESO">Ingreso</SelectItem><SelectItem value="EGASTO">Egreso</SelectItem>
            </SelectContent></Select></div>
          <div><Label>Fecha</Label><Input type="date" value={movForm.fecha} onChange={(e) => setMovForm(p => ({ ...p, fecha: e.target.value }))} required /></div>
          <div><Label>Monto</Label><Input type="number" step="0.01" value={movForm.monto} onChange={(e) => setMovForm(p => ({ ...p, monto: parseFloat(e.target.value) || 0 }))} required /></div>
          <div><Label>Descripción</Label><Input value={movForm.descripcion} onChange={(e) => setMovForm(p => ({ ...p, descripcion: e.target.value }))} /></div>
          <div><Label>Referencia</Label><Input value={movForm.referencia} onChange={(e) => setMovForm(p => ({ ...p, referencia: e.target.value }))} /></div>
        </div>
      </FormDialog>

      {/* Ajustar Saldo Dialog */}
      <Dialog open={ajusteDialogOpen} onOpenChange={setAjusteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar Saldo</DialogTitle>
            <DialogDescription>Agrega un ingreso adicional al saldo actual de la cuenta</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAjustarSaldo}>
            <div className="space-y-4">
              <div>
                <Label>Monto a agregar *</Label>
                <Input type="number" step="0.01" min="0.01" value={ajusteMonto || ""} onChange={(e) => setAjusteMonto(parseFloat(e.target.value) || 0)} required />
              </div>
              <div>
                <Label>Descripción (opcional)</Label>
                <Input value={ajusteDesc} onChange={(e) => setAjusteDesc(e.target.value)} placeholder="Ej: Ajuste manual, abono, etc." />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setAjusteDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={ajusteMonto <= 0 || submitting}>
                  {submitting ? "Ajustando..." : "Ajustar Saldo"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación Limpiar Datos */}
      <Dialog open={cleanupOpen} onOpenChange={setCleanupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2"><AlertTriangle className="h-5 w-5" />Limpiar datos</DialogTitle>
            <DialogDescription>
              Esta acción eliminará <strong>todos</strong> los datos de <strong>Compras</strong> y <strong>Tesorería</strong>:
              requisiciones, cotizaciones, órdenes de compra, recepciones, cuentas por pagar, pagos, egresos y movimientos bancarios.
              <br /><br />
              Se conservarán: cuentas bancarias, proveedores, centros de costo y demás configuración.
              <br /><br />
              <span className="text-destructive font-semibold">Esta operación no se puede deshacer.</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setCleanupOpen(false)} disabled={cleanupLoading}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={handleCleanup} disabled={cleanupLoading}>
              {cleanupLoading ? "Eliminando..." : "Sí, eliminar todo"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Comprobante Preview Dialog */}
      <Dialog open={!!comprobanteUrl} onOpenChange={(o) => !o && setComprobanteUrl(null)}>
        {comprobanteUrl && (
          <DialogContent className="max-w-3xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Comprobante de Pago</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
              {comprobanteUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={comprobanteUrl} alt="Comprobante" className="max-h-[70vh] w-auto rounded-lg object-contain" />
              ) : (
                <iframe src={comprobanteUrl} className="w-full h-[70vh] rounded-lg border" />
              )}
              <a href={comprobanteUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">Abrir en nueva pestaña</a>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
