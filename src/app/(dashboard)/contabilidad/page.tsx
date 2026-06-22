"use client"

import { useState, useEffect, useCallback } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Plus,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  PlusCircle,
} from "lucide-react"
import { formatMoney, formatDate, formatDateTime } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"

import {
  getPlanCuentas,
  createPlanCuenta,
  updatePlanCuenta,
  deletePlanCuenta,
  getPlanCuentasSelect,
  getAsientos,
  getAsiento,
  createAsiento,
  updateAsiento,
  deleteAsiento,
  contabilizarAsiento,
  cancelarAsiento,
  getPlantillasContables,
  createPlantillaContable,
  updatePlantillaContable,
  deletePlantillaContable,
  togglePlantillaContable,
  getBalanceGeneral,
  getEstadoResultados,
  getLibroMayor,
  getAuxiliarProveedores,
  getAuxiliarCentroCostos,
  type PlanCuentaFormData,
  type AsientoFormData,
  type PlantillaFormData,
} from "@/actions/contabilidad"
import { getCentrosCostos } from "@/actions/configuracion"

type PlanCuentaItem = {
  id: string
  empresaId: string
  codigo: string
  nombre: string
  tipo: string
  nivel: number
  padreId: string | null
  activo: boolean
  createdAt: Date
  totalHijos: number
  totalDetalles: number
}

type PlanCuentaSelectItem = {
  id: string
  codigo: string
  nombre: string
  nivel: number
  label: string
}

type AsientoDetalleItem = {
  id: string
  asientoId: string
  planCuentaId: string
  debe: number
  haber: number
  descripcion: string | null
  planCuenta: { id: string; codigo: string; nombre: string }
}

type AsientoItem = {
  id: string
  empresaId: string
  numero: number
  fecha: string
  concepto: string
  tipo: string
  estado: string
  createdAt: string
  updatedAt: string
  detalles: AsientoDetalleItem[]
}

const TIPO_STYLES: Record<string, "success" | "destructive" | "info" | "warning" | "secondary" | "default"> = {
  INGRESO: "success",
  GASTO: "destructive",
  TRASPASO: "info",
  AJUSTE: "warning",
  APERTURA: "secondary",
  CIERRE: "default",
}

const ESTADO_STYLES: Record<string, "success" | "destructive" | "secondary"> = {
  BORRADOR: "secondary",
  CONTABILIZADO: "success",
  CANCELADO: "destructive",
}

interface PlanCuentaNode extends PlanCuentaItem {
  children: PlanCuentaNode[]
}

function buildTree(items: PlanCuentaItem[]): PlanCuentaNode[] {
  const map = new Map<string, PlanCuentaNode>()
  const roots: PlanCuentaNode[] = []

  for (const item of items) {
    map.set(item.id, { ...item, children: [] } as PlanCuentaNode)
  }

  for (const item of items) {
    const node = map.get(item.id)!
    if (item.padreId && map.has(item.padreId)) {
      map.get(item.padreId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

function getCuentaBalance(detalles: AsientoDetalleItem[]) {
  const debe = detalles.reduce((s, d) => s + d.debe, 0)
  const haber = detalles.reduce((s, d) => s + d.haber, 0)
  return { debe, haber, balance: debe === haber }
}

function defaultDetalle() {
  return { planCuentaId: "", debe: "", haber: "", descripcion: "" }
}

export default function ContabilidadPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("plan-cuentas")

  // ─── PlanCuenta state ─────────────────────────────────
  const [cuentas, setCuentas] = useState<PlanCuentaItem[]>([])
  const [cuentasLoading, setCuentasLoading] = useState(true)
  const [cuentaSearch, setCuentaSearch] = useState("")
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [cuentaDialogOpen, setCuentaDialogOpen] = useState(false)
  const [cuentaEditId, setCuentaEditId] = useState<string | null>(null)
  const [cuentaForm, setCuentaForm] = useState<PlanCuentaFormData>({
    codigo: "",
    nombre: "",
    tipo: "ACTIVO",
    padreId: null,
    activo: true,
  })
  const [cuentaSaving, setCuentaSaving] = useState(false)
  const [planCuentasSelect, setPlanCuentasSelect] = useState<PlanCuentaSelectItem[]>([])

  // ─── Asiento state ────────────────────────────────────
  const [asientos, setAsientos] = useState<AsientoItem[]>([])
  const [asientosLoading, setAsientosLoading] = useState(true)
  const [asientoSearch, setAsientoSearch] = useState("")
  const [asientoDialogOpen, setAsientoDialogOpen] = useState(false)
  const [asientoEditId, setAsientoEditId] = useState<string | null>(null)
  const [asientoForm, setAsientoForm] = useState({
    fecha: new Date().toISOString().split("T")[0],
    concepto: "",
    tipo: "INGRESO",
    detalles: [defaultDetalle()],
  })
  const [asientoSaving, setAsientoSaving] = useState(false)
  const [detalleAsientoId, setDetalleAsientoId] = useState<string | null>(null)

  // ─── Centros de Costos state ─────────────────────────
  const [centrosCostos, setCentrosCostos] = useState<any[]>([])

  // ─── Load data ────────────────────────────────────────
  const loadCuentas = useCallback(async () => {
    setCuentasLoading(true)
    try {
      const data = await getPlanCuentas()
      setCuentas(data)
    } catch (err: any) {
      toast({ title: "Error al cargar cuentas", description: err.message, variant: "destructive" })
    } finally {
      setCuentasLoading(false)
    }
  }, [toast])

  const loadPlanCuentasSelect = useCallback(async () => {
    try {
      const data = await getPlanCuentasSelect()
      setPlanCuentasSelect(data)
    } catch (err: any) {
      toast({ title: "Error al cargar plan de cuentas", description: err.message, variant: "destructive" })
    }
  }, [])

  const loadAsientos = useCallback(async () => {
    setAsientosLoading(true)
    try {
      const data = await getAsientos()
      setAsientos(data)
    } finally {
      setAsientosLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCuentas()
    loadPlanCuentasSelect()
    loadAsientos()
    getCentrosCostos().then(setCentrosCostos).catch(() => {})
  }, [loadCuentas, loadPlanCuentasSelect, loadAsientos])

  // ─── Cuenta helpers ───────────────────────────────────
  const filteredCuentas = cuentaSearch
    ? cuentas.filter(
        (c) =>
          c.codigo.toLowerCase().includes(cuentaSearch.toLowerCase()) ||
          c.nombre.toLowerCase().includes(cuentaSearch.toLowerCase())
      )
    : cuentas

  const cuentaTree = buildTree(filteredCuentas)

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function openCuentaCreate() {
    setCuentaEditId(null)
    setCuentaForm({ codigo: "", nombre: "", tipo: "ACTIVO", padreId: null, activo: true })
    setCuentaDialogOpen(true)
  }

  function openCuentaEdit(item: PlanCuentaItem) {
    setCuentaEditId(item.id)
    setCuentaForm({
      codigo: item.codigo,
      nombre: item.nombre,
      tipo: item.tipo,
      padreId: item.padreId,
      activo: item.activo,
    })
    setCuentaDialogOpen(true)
  }

  async function handleCuentaSave(e: React.FormEvent) {
    e.preventDefault()
    setCuentaSaving(true)
    try {
      if (cuentaEditId) {
        await updatePlanCuenta(cuentaEditId, cuentaForm)
      } else {
        await createPlanCuenta(cuentaForm)
      }
      setCuentaDialogOpen(false)
      toast({ title: cuentaEditId ? "Cuenta actualizada" : "Cuenta creada", variant: "success" })
      loadCuentas()
      loadPlanCuentasSelect()
    } catch (err: any) {
      toast({ title: "Error al guardar cuenta", description: err.message, variant: "destructive" })
    } finally {
      setCuentaSaving(false)
    }
  }

  async function handleCuentaDelete(id: string) {
    if (!confirm("¿Eliminar esta cuenta?")) return
    try {
      await deletePlanCuenta(id)
      toast({ title: "Cuenta eliminada", variant: "success" })
      loadCuentas()
      loadPlanCuentasSelect()
    } catch (err: any) {
      toast({ title: "Error al eliminar cuenta", description: err.message, variant: "destructive" })
    }
  }

  // ─── Asiento helpers ──────────────────────────────────
  const filteredAsientos = asientoSearch
    ? asientos.filter(
        (a) =>
          a.concepto.toLowerCase().includes(asientoSearch.toLowerCase()) ||
          a.numero.toString().includes(asientoSearch)
      )
    : asientos

  function openAsientoCreate() {
    setAsientoEditId(null)
    setAsientoForm({
      fecha: new Date().toISOString().split("T")[0],
      concepto: "",
      tipo: "INGRESO",
      detalles: [defaultDetalle()],
    })
    setAsientoDialogOpen(true)
  }

  async function openAsientoEdit(id: string) {
    try {
      const data = await getAsiento(id)
      setAsientoEditId(id)
      setAsientoForm({
        fecha: data.fecha.split("T")[0],
        concepto: data.concepto,
        tipo: data.tipo,
        detalles: data.detalles.map((d) => ({
          planCuentaId: d.planCuentaId,
          debe: d.debe.toString(),
          haber: d.haber.toString(),
          descripcion: d.descripcion ?? "",
        })),
      })
      setAsientoDialogOpen(true)
    } catch (err: any) {
      toast({ title: "Error al cargar asiento", description: err.message, variant: "destructive" })
    }
  }

  function addDetalle() {
    setAsientoForm((prev) => ({
      ...prev,
      detalles: [...prev.detalles, defaultDetalle()],
    }))
  }

  function removeDetalle(idx: number) {
    setAsientoForm((prev) => ({
      ...prev,
      detalles: prev.detalles.filter((_, i) => i !== idx),
    }))
  }

  function updateDetalle(idx: number, field: string, value: string) {
    setAsientoForm((prev) => {
      const detalles = [...prev.detalles]
      detalles[idx] = { ...detalles[idx], [field]: value }
      return { ...prev, detalles }
    })
  }

  async function handleAsientoSave(e: React.FormEvent) {
    e.preventDefault()
    setAsientoSaving(true)
    try {
      const payload: AsientoFormData = {
        fecha: asientoForm.fecha,
        concepto: asientoForm.concepto,
        tipo: asientoForm.tipo,
        detalles: asientoForm.detalles.map((d) => ({
          planCuentaId: d.planCuentaId,
          debe: parseFloat(d.debe) || 0,
          haber: parseFloat(d.haber) || 0,
          descripcion: d.descripcion || null,
        })),
      }

      if (asientoEditId) {
        await updateAsiento(asientoEditId, payload)
      } else {
        await createAsiento(payload)
      }
      setAsientoDialogOpen(false)
      toast({ title: asientoEditId ? "Asiento actualizado" : "Asiento creado", variant: "success" })
      loadAsientos()
    } catch (err: any) {
      toast({ title: "Error al guardar asiento", description: err.message, variant: "destructive" })
    } finally {
      setAsientoSaving(false)
    }
  }

  async function handleAsientoDelete(id: string) {
    if (!confirm("¿Eliminar este asiento?")) return
    try {
      await deleteAsiento(id)
      toast({ title: "Asiento eliminado", variant: "success" })
      loadAsientos()
    } catch (err: any) {
      toast({ title: "Error al eliminar asiento", description: err.message, variant: "destructive" })
    }
  }

  async function handleContabilizar(id: string) {
    if (!confirm("¿Contabilizar este asiento?")) return
    try {
      await contabilizarAsiento(id)
      toast({ title: "Asiento contabilizado", variant: "success" })
      loadAsientos()
    } catch (err: any) {
      toast({ title: "Error al contabilizar", description: err.message, variant: "destructive" })
    }
  }

  async function handleCancelar(id: string) {
    if (!confirm("¿Cancelar este asiento?")) return
    try {
      await cancelarAsiento(id)
      toast({ title: "Asiento cancelado", variant: "success" })
      loadAsientos()
    } catch (err: any) {
      toast({ title: "Error al cancelar", description: err.message, variant: "destructive" })
    }
  }

  // ─── Render helpers ───────────────────────────────────
  function renderTipoBadge(tipo: string) {
    return <Badge variant={TIPO_STYLES[tipo] ?? "default"}>{tipo}</Badge>
  }

  function renderEstadoBadge(estado: string) {
    return <Badge variant={ESTADO_STYLES[estado] ?? "secondary"}>{estado}</Badge>
  }

  function renderCuentaNode(
    node: PlanCuentaNode,
    depth: number
  ) {
    const hasChildren = node.children.length > 0
    const isExpanded = expandedIds.has(node.id)
    const padLeft = depth * 24

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
          style={{ marginLeft: padLeft }}
        >
          <button
            onClick={() => hasChildren && toggleExpand(node.id)}
            className={`p-0.5 ${hasChildren ? "cursor-pointer opacity-100" : "opacity-0"}`}
            disabled={!hasChildren}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm text-muted-foreground shrink-0">
              {node.codigo}
            </span>
            <span className="text-sm truncate">{node.nombre}</span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {node.tipo}
            </Badge>
            {!node.activo && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                Inactiva
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setCuentaForm({
                  codigo: "",
                  nombre: "",
                  tipo: node.tipo,
                  padreId: node.id,
                  activo: true,
                })
                setCuentaEditId(null)
                setCuentaDialogOpen(true)
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => openCuentaEdit(node)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => handleCuentaDelete(node.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => renderCuentaNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const asientoColumns: Column<AsientoItem>[] = [
    {
      key: "numero",
      header: "No.",
      render: (a) => <span className="font-mono">{a.numero}</span>,
      className: "w-16",
    },
    {
      key: "fecha",
      header: "Fecha",
      render: (a) => formatDate(a.fecha),
      className: "w-28",
    },
    {
      key: "concepto",
      header: "Concepto",
      render: (a) => (
        <div className="flex items-center gap-2">
          <span className="truncate max-w-[300px]">{a.concepto}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0"
            onClick={() => setDetalleAsientoId(detalleAsientoId === a.id ? null : a.id)}
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (a) => renderTipoBadge(a.tipo),
      className: "w-24",
    },
    {
      key: "estado",
      header: "Estado",
      render: (a) => renderEstadoBadge(a.estado),
      className: "w-28",
    },
    {
      key: "total",
      header: "Total",
      render: (a) => {
        const total = a.detalles.reduce((s, d) => s + d.debe, 0)
        return <span className="font-mono text-sm">{formatMoney(total)}</span>
      },
      className: "w-28 text-right",
    },
    {
      key: "acciones",
      header: "",
      render: (a) => (
        <div className="flex items-center gap-1">
          {a.estado === "BORRADOR" && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600"
                onClick={() => handleContabilizar(a.id)}
                title="Contabilizar"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => openAsientoEdit(a.id)}
                title="Editar"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => handleAsientoDelete(a.id)}
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleCancelar(a.id)}
                title="Cancelar"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
      className: "w-44",
    },
  ]

  // ─── Template ─────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title="Contabilidad"
        description="Plan de cuentas, asientos y balance"
      />

      <Tabs.Root value={tab} onValueChange={setTab} className="space-y-4">
        <Tabs.List className="flex gap-1 border-b">
          <Tabs.Trigger
            value="plan-cuentas"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Plan de Cuentas
          </Tabs.Trigger>
          <Tabs.Trigger
            value="asientos"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Asientos
          </Tabs.Trigger>
          <Tabs.Trigger
            value="plantillas"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Plantillas Contables
          </Tabs.Trigger>
          <Tabs.Trigger
            value="balance"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Balance General
          </Tabs.Trigger>
          <Tabs.Trigger
            value="resultados"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Estado Resultados
          </Tabs.Trigger>
          <Tabs.Trigger
            value="mayor"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Libro Mayor
          </Tabs.Trigger>
          <Tabs.Trigger
            value="auxiliares"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            Auxiliares
          </Tabs.Trigger>
        </Tabs.List>

        {/* ══════════════════════════════════════════════════
            TAB: PLAN DE CUENTAS
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="plan-cuentas" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Input
                placeholder="Buscar por código o nombre..."
                value={cuentaSearch}
                onChange={(e) => setCuentaSearch(e.target.value)}
              />
            </div>
            <Button onClick={openCuentaCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Cuenta
            </Button>
          </div>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {filteredCuentas.length} cuenta(s)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {cuentasLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : cuentaTree.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No se encontraron cuentas
                </div>
              ) : (
                <div className="py-2">
                  {cuentaTree.map((node) => renderCuentaNode(node, 0))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cuenta Form Dialog */}
          <FormDialog
            open={cuentaDialogOpen}
            onOpenChange={setCuentaDialogOpen}
            title={cuentaEditId ? "Editar Cuenta" : "Nueva Cuenta"}
            description="Registra una cuenta contable en el plan de cuentas"
            loading={cuentaSaving}
            onSubmit={handleCuentaSave as any}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={cuentaForm.codigo}
                    onChange={(e) =>
                      setCuentaForm((prev) => ({ ...prev, codigo: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <Select
                    value={cuentaForm.tipo}
                    onValueChange={(v) =>
                      setCuentaForm((prev) => ({ ...prev, tipo: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVO">ACTIVO</SelectItem>
                      <SelectItem value="PASIVO">PASIVO</SelectItem>
                      <SelectItem value="PATRIMONIO">PATRIMONIO</SelectItem>
                      <SelectItem value="INGRESO">INGRESO</SelectItem>
                      <SelectItem value="GASTO">GASTO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input
                  id="nombre"
                  value={cuentaForm.nombre}
                  onChange={(e) =>
                    setCuentaForm((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="padreId">Cuenta Padre</Label>
                <Select
                  value={cuentaForm.padreId ?? ""}
                  onValueChange={(v) =>
                    setCuentaForm((prev) => ({
                      ...prev,
                      padreId: v || null,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Ninguna (raíz)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Ninguna (raíz)</SelectItem>
                    {planCuentasSelect.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {"·".repeat(c.nivel)} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ══════════════════════════════════════════════════
            TAB: ASIENTOS
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="asientos" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Input
                placeholder="Buscar por concepto o número..."
                value={asientoSearch}
                onChange={(e) => setAsientoSearch(e.target.value)}
              />
            </div>
            <Button onClick={openAsientoCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Asiento
            </Button>
          </div>

          <DataTable
            columns={asientoColumns}
            data={filteredAsientos}
            loading={asientosLoading}
          />

          {/* Detalles Dialog */}
          <Dialog
            open={detalleAsientoId !== null}
            onOpenChange={(open) => !open && setDetalleAsientoId(null)}
          >
            <DialogContent className="sm:max-w-[700px]">
              <DialogHeader>
                <DialogTitle>Detalles del Asiento</DialogTitle>
                <DialogDescription>
                  {detalleAsientoId &&
                    (() => {
                      const a = asientos.find((x) => x.id === detalleAsientoId)
                      return a
                        ? `No. ${a.numero} - ${a.concepto}`
                        : ""
                    })()}
                </DialogDescription>
              </DialogHeader>
              {detalleAsientoId && (
                <div className="space-y-4">
                  {(() => {
                    const a = asientos.find((x) => x.id === detalleAsientoId)
                    if (!a) return null
                    const { debe, haber, balance } = getCuentaBalance(a.detalles)
                    return (
                      <>
                        <div className="flex items-center gap-4 text-sm">
                          <span>
                            <span className="text-muted-foreground">Tipo: </span>
                            {renderTipoBadge(a.tipo)}
                          </span>
                          <span>
                            <span className="text-muted-foreground">Estado: </span>
                            {renderEstadoBadge(a.estado)}
                          </span>
                          <span>
                            <span className="text-muted-foreground">Fecha: </span>
                            {formatDate(a.fecha)}
                          </span>
                        </div>
                        <Separator />
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-muted-foreground">
                                <th className="text-left py-2 pr-4">Cuenta</th>
                                <th className="text-right py-2 px-4">Debe</th>
                                <th className="text-right py-2 px-4">Haber</th>
                                <th className="text-left py-2 pl-4">Descripción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {a.detalles.map((d) => (
                                <tr key={d.id} className="border-b last:border-0">
                                  <td className="py-2 pr-4">
                                    <span className="font-mono text-muted-foreground">
                                      {d.planCuenta.codigo}
                                    </span>{" "}
                                    {d.planCuenta.nombre}
                                  </td>
                                  <td className="text-right py-2 px-4 font-mono">
                                    {d.debe > 0 ? formatMoney(d.debe) : "—"}
                                  </td>
                                  <td className="text-right py-2 px-4 font-mono">
                                    {d.haber > 0 ? formatMoney(d.haber) : "—"}
                                  </td>
                                  <td className="py-2 pl-4 text-muted-foreground">
                                    {d.descripcion ?? "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t font-medium">
                                <td className="py-2 pr-4">Totales</td>
                                <td className="text-right py-2 px-4 font-mono">
                                  {formatMoney(debe)}
                                </td>
                                <td className="text-right py-2 px-4 font-mono">
                                  {formatMoney(haber)}
                                </td>
                                <td className="py-2 pl-4">
                                  {balance ? (
                                    <Badge
                                      variant="success"
                                      className="text-[10px]"
                                    >
                                      Balanceado
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px]"
                                    >
                                      No balanceado
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    )
                  })()}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Asiento Form Dialog */}
          <FormDialog
            open={asientoDialogOpen}
            onOpenChange={setAsientoDialogOpen}
            title={asientoEditId ? "Editar Asiento" : "Nuevo Asiento"}
            description="Registra un asiento contable con sus líneas de detalle"
            loading={asientoSaving}
            onSubmit={handleAsientoSave as any}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fecha">Fecha</Label>
                  <Input
                    id="fecha"
                    type="date"
                    value={asientoForm.fecha}
                    onChange={(e) =>
                      setAsientoForm((prev) => ({
                        ...prev,
                        fecha: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asiento-tipo">Tipo</Label>
                  <Select
                    value={asientoForm.tipo}
                    onValueChange={(v) =>
                      setAsientoForm((prev) => ({ ...prev, tipo: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INGRESO">INGRESO</SelectItem>
                      <SelectItem value="GASTO">GASTO</SelectItem>
                      <SelectItem value="TRASPASO">TRASPASO</SelectItem>
                      <SelectItem value="AJUSTE">AJUSTE</SelectItem>
                      <SelectItem value="APERTURA">APERTURA</SelectItem>
                      <SelectItem value="CIERRE">CIERRE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Total Est.</Label>
                  <div className="flex h-9 items-center text-sm font-mono text-muted-foreground">
                    {formatMoney(
                      asientoForm.detalles.reduce(
                        (s, d) => s + (parseFloat(d.debe) || 0),
                        0
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="concepto">Concepto</Label>
                <Input
                  id="concepto"
                  value={asientoForm.concepto}
                  onChange={(e) =>
                    setAsientoForm((prev) => ({
                      ...prev,
                      concepto: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <Separator />
              <div className="flex items-center justify-between">
                <Label>Líneas del Asiento</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addDetalle}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Agregar línea
                </Button>
              </div>

              {asientoForm.detalles.map((det, idx) => (
                <div key={idx} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Línea {idx + 1}
                    </span>
                    {asientoForm.detalles.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive"
                        onClick={() => removeDetalle(idx)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Cuenta Contable</Label>
                    <Select
                      value={det.planCuentaId}
                      onValueChange={(v) => updateDetalle(idx, "planCuentaId", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cuenta..." />
                      </SelectTrigger>
                      <SelectContent>
                        {planCuentasSelect.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {"·".repeat(c.nivel)} {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Debe</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={det.debe}
                        onChange={(e) =>
                          updateDetalle(idx, "debe", e.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Haber</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={det.haber}
                        onChange={(e) =>
                          updateDetalle(idx, "haber", e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input
                      placeholder="Descripción opcional"
                      value={det.descripcion}
                      onChange={(e) =>
                        updateDetalle(idx, "descripcion", e.target.value)
                      }
                    />
                  </div>
                </div>
              ))}

              {asientoForm.detalles.length > 0 && (
                <div className="flex justify-end text-sm font-medium">
                  <span className="text-muted-foreground mr-4">Debe:</span>
                  <span className="font-mono mr-6">
                    {formatMoney(
                      asientoForm.detalles.reduce(
                        (s, d) => s + (parseFloat(d.debe) || 0),
                        0
                      )
                    )}
                  </span>
                  <span className="text-muted-foreground mr-4">Haber:</span>
                  <span className="font-mono">
                    {formatMoney(
                      asientoForm.detalles.reduce(
                        (s, d) => s + (parseFloat(d.haber) || 0),
                        0
                      )
                    )}
                  </span>
                </div>
              )}
            </div>
          </FormDialog>
        </Tabs.Content>

        {/* ══════════════════════════════════════════════════
            TAB: BALANCE GENERAL
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="balance" className="space-y-4">
          <BalanceTab planCuentasSelect={planCuentasSelect} toast={toast} />
        </Tabs.Content>

        {/* ══════════════════════════════════════════════════
            TAB: ESTADO DE RESULTADOS
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="resultados" className="space-y-4">
          <ResultadosTab planCuentasSelect={planCuentasSelect} toast={toast} />
        </Tabs.Content>

        {/* ══════════════════════════════════════════════════
            TAB: LIBRO MAYOR
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="mayor" className="space-y-4">
          <MayorTab planCuentasSelect={planCuentasSelect} toast={toast} />
        </Tabs.Content>

        {/* ══════════════════════════════════════════════════
            TAB: AUXILIARES
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="auxiliares" className="space-y-4">
          <AuxiliaresTab planCuentasSelect={planCuentasSelect} centrosCostos={centrosCostos} toast={toast} />
        </Tabs.Content>

        {/* ══════════════════════════════════════════════════
            TAB: PLANTILLAS CONTABLES
           ══════════════════════════════════════════════════ */}
        <Tabs.Content value="plantillas" className="space-y-4">
          <PlantillasTabContent
            planCuentasSelect={planCuentasSelect}
            toast={toast}
            onDataChange={() => {
              loadCuentas()
              loadPlanCuentasSelect()
            }}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
// ─── Balance General ──────────────────────────────────
function BalanceTab({ planCuentasSelect, toast }: { planCuentasSelect: PlanCuentaSelectItem[]; toast: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0])

  async function load() {
    setLoading(true)
    try {
      const result = await getBalanceGeneral(fecha)
      setData(result)
    } catch (err: any) { toast({ title: "Error al generar balance", description: err.message, variant: "destructive" }) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label>Fecha de Corte</Label>
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </div>
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generar Balance
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { title: "Activo", items: data.activo.cuentas, total: data.activo.total, color: "text-blue-600" },
            { title: "Pasivo", items: data.pasivo.cuentas, total: data.pasivo.total, color: "text-red-600" },
            { title: "Patrimonio", items: data.patrimonio.cuentas, total: data.patrimonio.total, color: "text-green-600" },
          ].map((section) => (
            <Card key={section.title}>
              <CardHeader className="py-3">
                <CardTitle className={`text-lg font-bold ${section.color}`}>{section.title}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {section.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4">Sin cuentas</p>
                ) : (
                  <div className="divide-y">
                    {section.items.map((c: any) => (
                      <div key={c.cuentaId} className="flex justify-between px-4 py-2 text-sm">
                        <span><span className="font-mono text-muted-foreground">{c.codigo}</span> {c.nombre}</span>
                        <span className="font-mono font-medium">{formatMoney(Math.abs(c.saldo))}</span>
                      </div>
                    ))}
                    <div className="flex justify-between px-4 py-2 text-sm font-bold border-t-2">
                      <span>Total {section.title}</span>
                      <span className="font-mono">{formatMoney(section.total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Estado de Resultados ────────────────────────────
function ResultadosTab({ planCuentasSelect, toast }: { planCuentasSelect: PlanCuentaSelectItem[]; toast: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [hasta, setHasta] = useState(new Date().toISOString().split("T")[0])

  async function load() {
    setLoading(true)
    try {
      const result = await getEstadoResultados(desde, hasta)
      setData(result)
    } catch (err: any) { toast({ title: "Error al generar resultados", description: err.message, variant: "destructive" }) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4">
            <div className="space-y-2"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="space-y-2"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
            <Button onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Generar Resultados
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-lg font-bold text-green-600">Ingresos</CardTitle></CardHeader>
            <CardContent className="p-0">
              {data.ingresos.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Sin ingresos</p>
              ) : (
                <div className="divide-y">
                  {data.ingresos.map((i: any) => (
                    <div key={i.codigo} className="flex justify-between px-4 py-2 text-sm">
                      <span><span className="font-mono text-muted-foreground">{i.codigo}</span> {i.nombre}</span>
                      <span className="font-mono font-medium">{formatMoney(i.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2 text-sm font-bold border-t-2">
                    <span>Total Ingresos</span>
                    <span className="font-mono">{formatMoney(data.totalIngresos)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-lg font-bold text-red-600">Egresos</CardTitle></CardHeader>
            <CardContent className="p-0">
              {data.gastos.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">Sin egresos</p>
              ) : (
                <div className="divide-y">
                  {data.gastos.map((e: any) => (
                    <div key={e.codigo} className="flex justify-between px-4 py-2 text-sm">
                      <span><span className="font-mono text-muted-foreground">{e.codigo}</span> {e.nombre}</span>
                      <span className="font-mono font-medium">{formatMoney(e.saldo)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2 text-sm font-bold border-t-2">
                    <span>Total Egresos</span>
                    <span className="font-mono">{formatMoney(data.totalGastos)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {data && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Utilidad del Período</p>
              <p className={`text-3xl font-bold ${data.utilidad >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatMoney(data.utilidad)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Libro Mayor ─────────────────────────────────────
function MayorTab({ planCuentasSelect, toast }: { planCuentasSelect: PlanCuentaSelectItem[]; toast: any }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [cuentaId, setCuentaId] = useState("")
  const [desde, setDesde] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [hasta, setHasta] = useState(new Date().toISOString().split("T")[0])

  async function load() {
    if (!cuentaId) return
    setLoading(true)
    try {
      const result = await getLibroMayor(cuentaId, desde, hasta)
      setData(result)
    } catch (err: any) { toast({ title: "Error al consultar mayor", description: err.message, variant: "destructive" }) } finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2 min-w-[250px]">
              <Label>Cuenta Contable</Label>
              <Select value={cuentaId} onValueChange={setCuentaId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta..." /></SelectTrigger>
                <SelectContent>
                  {planCuentasSelect.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{"·".repeat(c.nivel)} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="space-y-2"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
            <Button onClick={load} disabled={loading || !cuentaId}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Consultar
            </Button>
          </div>
        </CardContent>
      </Card>

      {data && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">
              {data.cuenta.codigo} - {data.cuenta.nombre}
              <span className="text-muted-foreground ml-2">({data.cuenta.tipo})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.movimientos.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">Sin movimientos en el período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="text-left py-2 px-4">Fecha</th>
                      <th className="text-left py-2 px-4">No.</th>
                      <th className="text-left py-2 px-4">Concepto</th>
                      <th className="text-right py-2 px-4">Debe</th>
                      <th className="text-right py-2 px-4">Haber</th>
                      <th className="text-right py-2 px-4">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movimientos.map((m: any, i: number) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-4">{formatDate(m.fecha)}</td>
                        <td className="py-2 px-4 font-mono">{m.asientoNumero}</td>
                        <td className="py-2 px-4">{m.concepto}</td>
                        <td className="text-right py-2 px-4 font-mono">{m.debe > 0 ? formatMoney(m.debe) : "—"}</td>
                        <td className="text-right py-2 px-4 font-mono">{m.haber > 0 ? formatMoney(m.haber) : "—"}</td>
                        <td className="text-right py-2 px-4 font-mono font-medium">{formatMoney(m.saldoAcumulado)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-bold">
                      <td colSpan={5} className="py-2 px-4 text-right">Saldo Final</td>
                      <td className="text-right py-2 px-4 font-mono">{formatMoney(data.saldoFinal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Auxiliares ──────────────────────────────────────
function AuxiliaresTab({ planCuentasSelect, centrosCostos, toast }: { planCuentasSelect: PlanCuentaSelectItem[]; centrosCostos: any[]; toast: any }) {
  const [tab, setTab] = useState("proveedores")
  const [dataProv, setDataProv] = useState<any[]>([])
  const [dataCC, setDataCC] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [desde, setDesde] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0])
  const [hasta, setHasta] = useState(new Date().toISOString().split("T")[0])
  const [centroCostosId, setCentroCostosId] = useState("")

  async function loadProveedores() {
    setLoading(true)
    try {
      const result = await getAuxiliarProveedores(desde, hasta)
      setDataProv(result)
    } catch (err: any) { toast({ title: "Error al cargar auxiliar proveedores", description: err.message, variant: "destructive" }) } finally { setLoading(false) }
  }

  async function loadCentroCostos() {
    if (!centroCostosId) return
    setLoading(true)
    try {
      const result = await getAuxiliarCentroCostos(centroCostosId, desde, hasta)
      setDataCC(result)
    } catch (err: any) { toast({ title: "Error al cargar centro costos", description: err.message, variant: "destructive" }) } finally { setLoading(false) }
  }

  const provColumns: Column<any>[] = [
    { key: "proveedor", header: "Proveedor", render: (r: any) => r.proveedor?.razonSocial ?? "—" },
    { key: "factura", header: "Factura", render: (r: any) => r.numeroFactura ?? "—" },
    { key: "fecha", header: "Fecha", render: (r: any) => formatDate(r.fecha) },
    { key: "valor", header: "Valor", render: (r: any) => formatMoney(r.valor), className: "text-right" },
    { key: "saldo", header: "Saldo", render: (r: any) => formatMoney(r.saldoPendiente), className: "text-right" },
    { key: "estado", header: "Estado", render: (r: any) => <Badge variant={r.estado === "PAGADA" ? "success" : "warning"}>{r.estado}</Badge> },
  ]

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2"><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div className="space-y-2"><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
            <div className="flex gap-2">
              <Button onClick={loadProveedores} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Por Proveedor
              </Button>
              <Button onClick={loadCentroCostos} disabled={loading || !centroCostosId} variant="outline">
                Por Centro Costo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex gap-1 border-b">
          <Tabs.Trigger value="proveedores" className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary">Proveedores</Tabs.Trigger>
          <Tabs.Trigger value="centro-costos" className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary">Centros de Costo</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="proveedores" className="space-y-4 pt-4">
          {dataProv.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Presiona &quot;Por Proveedor&quot; para consultar</p>
          ) : (
            <DataTable columns={provColumns} data={dataProv} />
          )}
        </Tabs.Content>

        <Tabs.Content value="centro-costos" className="space-y-4 pt-4">
          <div className="space-y-2 max-w-xs">
            <Label>Centro de Costo</Label>
            <Select value={centroCostosId} onValueChange={setCentroCostosId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {centrosCostos.map((cc: any) => (
                  <SelectItem key={cc.id} value={cc.id}>{cc.codigo} - {cc.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {dataCC ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">
                    {dataCC.centro?.codigo} - {dataCC.centro?.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {dataCC.movimientos.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-4">Sin movimientos</p>
                  ) : (
                    <div className="divide-y">
                      {dataCC.movimientos.map((m: any) => (
                        <div key={m.id} className="flex justify-between px-4 py-2 text-sm">
                          <span>
                            <span className="font-mono text-muted-foreground">#{m.numero}</span>{" "}
                            {m.proveedor} <span className="text-muted-foreground">{formatDate(m.fecha)}</span>
                          </span>
                          <span className="font-mono">{formatMoney(m.valorTotal)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between px-4 py-2 text-sm font-bold border-t-2">
                        <span>Total</span>
                        <span className="font-mono">{formatMoney(dataCC.total)}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Selecciona un centro de costo y presiona &quot;Por Centro Costo&quot;</p>
          )}
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}

function PlantillasTabContent({
  planCuentasSelect,
  onDataChange,
  toast,
}: {
  planCuentasSelect: PlanCuentaSelectItem[]
  onDataChange: () => void
  toast: any
}) {
  const [plantillas, setPlantillas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    evento: string; concepto: string;
    lineas: { tipo: string; cuentaCodigo: string; centroCostosId: string; formula: string; porcentaje: string }[]
  }>({ evento: "FACTURA_PROVEEDOR", concepto: "", lineas: [] })
  const [centrosCostos, setCentrosCostos] = useState<{ id: string; nombre: string; codigo: string }[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [data, cc] = await Promise.all([
        getPlantillasContables(),
        getCentrosCostos(),
      ])
      setPlantillas(data)
      setCentrosCostos(cc.map((c: any) => ({ id: c.id, nombre: c.nombre, codigo: c.codigo })))
    } catch (err: any) {
      toast({ title: "Error al cargar plantillas", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditingId(null)
    setForm({ evento: "FACTURA_PROVEEDOR", concepto: "", lineas: [{ tipo: "DEBE", cuentaCodigo: "", centroCostosId: "", formula: "VALOR_FACTURA", porcentaje: "" }] })
    setDialogOpen(true)
  }

  function openEdit(item: any) {
    setEditingId(item.id)
    setForm({
      evento: item.evento,
      concepto: item.concepto,
      lineas: item.lineas.map((l: any) => ({
        tipo: l.tipo,
        cuentaCodigo: l.cuentaCodigo,
        centroCostosId: l.centroCostosId ?? "",
        formula: l.formula,
        porcentaje: l.porcentaje?.toString() ?? "",
      })),
    })
    setDialogOpen(true)
  }

  function addLinea() {
    setForm((prev) => ({
      ...prev,
      lineas: [...prev.lineas, { tipo: "DEBE", cuentaCodigo: "", centroCostosId: "", formula: "VALOR_FACTURA", porcentaje: "" }],
    }))
  }

  function removeLinea(idx: number) {
    setForm((prev) => ({
      ...prev,
      lineas: prev.lineas.filter((_, i) => i !== idx),
    }))
  }

  function updateLinea(idx: number, field: string, value: string) {
    setForm((prev) => {
      const lineas = [...prev.lineas]
      lineas[idx] = { ...lineas[idx], [field]: value }
      return { ...prev, lineas }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: PlantillaFormData = {
        evento: form.evento as any,
        concepto: form.concepto,
        lineas: form.lineas.map((l) => ({
          tipo: l.tipo as "DEBE" | "HABER",
          cuentaCodigo: l.cuentaCodigo,
          centroCostosId: l.centroCostosId || null,
          formula: l.formula as any,
          porcentaje: l.porcentaje ? parseFloat(l.porcentaje) : null,
        })),
      }
      if (editingId) {
        await updatePlantillaContable(editingId, payload)
      } else {
        await createPlantillaContable(payload)
      }
      setDialogOpen(false)
      toast({ title: editingId ? "Plantilla actualizada" : "Plantilla creada", variant: "success" })
      load()
      onDataChange()
    } catch (err: any) {
      toast({ title: "Error al guardar plantilla", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta plantilla?")) return
    try {
      await deletePlantillaContable(id)
      toast({ title: "Plantilla eliminada", variant: "success" })
      load()
    } catch (err: any) {
      toast({ title: "Error al eliminar plantilla", description: err.message, variant: "destructive" })
    }
  }

  async function handleToggle(id: string) {
    try {
      const updated = await togglePlantillaContable(id)
      toast({ title: updated.activo ? "Plantilla activada" : "Plantilla desactivada", variant: "success" })
      load()
    } catch (err: any) {
      toast({ title: "Error al cambiar estado", description: err.message, variant: "destructive" })
    }
  }

  const eventoLabel: Record<string, string> = {
    FACTURA_PROVEEDOR: "Factura Proveedor",
    PAGO_PROVEEDOR: "Pago Proveedor",
    RECEPCION_OC: "Recepción OC",
    EGRESO: "Egreso",
    NOTA_DEBITO: "Nota Débito",
    NOTA_CREDITO: "Nota Crédito",
  }

  const columns: Column<any>[] = [
    { key: "evento", header: "Evento", render: (p) => <Badge variant="info">{eventoLabel[p.evento] ?? p.evento}</Badge> },
    { key: "concepto", header: "Concepto" },
    {
      key: "lineas", header: "Líneas",
      render: (p) => <span className="font-mono text-sm">{p.lineas.length} línea(s)</span>,
    },
    {
      key: "activo", header: "Estado",
      render: (p) => p.activo ? <Badge variant="success">Activa</Badge> : <Badge variant="secondary">Inactiva</Badge>,
    },
    {
      key: "acciones", header: "",
      render: (p) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleToggle(p.id)}>
            {p.activo ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle className="h-4 w-4 text-success" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
      className: "w-32",
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Define cómo se generan los asientos contables automáticos</p>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Nueva Plantilla</Button>
      </div>

      <DataTable columns={columns} data={plantillas} loading={loading} />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? "Editar Plantilla" : "Nueva Plantilla Contable"}
        description="Configura las líneas de debe y haber para la generación automática de asientos"
        loading={saving}
        onSubmit={handleSubmit as any}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Evento</Label>
              <Select value={form.evento} onValueChange={(v) => setForm((p) => ({ ...p, evento: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(eventoLabel).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Concepto</Label>
              <Input value={form.concepto} onChange={(e) => setForm((p) => ({ ...p, concepto: e.target.value }))} required />
            </div>
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <Label>Líneas</Label>
            <Button type="button" variant="outline" size="sm" onClick={addLinea}>
              <Plus className="mr-1 h-3.5 w-3.5" />Agregar línea
            </Button>
          </div>

          {form.lineas.map((linea, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Línea {idx + 1}</span>
                {form.lineas.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeLinea(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={linea.tipo} onValueChange={(v) => updateLinea(idx, "tipo", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DEBE">Debe</SelectItem>
                      <SelectItem value="HABER">Haber</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fórmula</Label>
                  <Select value={linea.formula} onValueChange={(v) => updateLinea(idx, "formula", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VALOR_FACTURA">Valor Factura</SelectItem>
                      <SelectItem value="IVA">IVA</SelectItem>
                      <SelectItem value="VALOR_TOTAL">Valor Total</SelectItem>
                      <SelectItem value="SALDO">Saldo</SelectItem>
                      <SelectItem value="PORCENTAJE">Porcentaje</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Cuenta Contable (código)</Label>
                <Select value={linea.cuentaCodigo} onValueChange={(v) => updateLinea(idx, "cuentaCodigo", v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar código de cuenta..." /></SelectTrigger>
                  <SelectContent>
                    {planCuentasSelect.map((c) => (
                      <SelectItem key={c.id} value={c.codigo}>
                        {"·".repeat(c.nivel)} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {linea.formula === "PORCENTAJE" && (
                <div className="space-y-2">
                  <Label>Porcentaje (%)</Label>
                  <Input type="number" step="0.01" value={linea.porcentaje} onChange={(e) => updateLinea(idx, "porcentaje", e.target.value)} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Centro de Costos (opcional)</Label>
                <Select value={linea.centroCostosId} onValueChange={(v) => updateLinea(idx, "centroCostosId", v)}>
                  <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Ninguno</SelectItem>
                    {centrosCostos.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>{cc.codigo} - {cc.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      </FormDialog>
    </div>
  )
}
