"use client"

import { useCallback, useEffect, useState } from "react"
import { Plus, Pencil, Trash2, Calculator, CheckCircle, DollarSign, ChevronDown, ChevronRight, CalendarDays, Users, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DataTable, type Column } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { FormDialog } from "@/components/shared/form-dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatMoney, formatDate } from "@/lib/utils"
import type {
  getNominas,
  getNomina,
  getEmpleados,
  getNominaDetalles,
} from "@/actions/nomina"

type NominaItem = Awaited<ReturnType<typeof getNominas>>[number]
type NominaFull = Awaited<ReturnType<typeof getNomina>> & { detalles: NominaDetalleItem[] }
type NominaDetalleItem = Awaited<ReturnType<typeof getNominaDetalles>>[number]
type EmpleadoItem = Awaited<ReturnType<typeof getEmpleados>>[number]

type EstadoNomina = "BORRADOR" | "CALCULADA" | "APROBADA" | "PAGADA" | "CANCELADA"

const estadoBadge: Record<EstadoNomina, { label: string; variant: "secondary" | "warning" | "info" | "success" | "destructive" }> = {
  BORRADOR: { label: "Borrador", variant: "secondary" },
  CALCULADA: { label: "Calculada", variant: "warning" },
  APROBADA: { label: "Aprobada", variant: "info" },
  PAGADA: { label: "Pagada", variant: "success" },
  CANCELADA: { label: "Cancelada", variant: "destructive" },
}

function estadosSiguientes(estado: EstadoNomina) {
  switch (estado) {
    case "BORRADOR": return { calcular: true, aprobar: false, pagar: false }
    case "CALCULADA": return { calcular: false, aprobar: true, pagar: false }
    case "APROBADA": return { calcular: false, aprobar: false, pagar: true }
    default: return { calcular: false, aprobar: false, pagar: false }
  }
}

export default function NominaPage() {
  const [nominas, setNominas] = useState<NominaItem[]>([])
  const [empleados, setEmpleados] = useState<EmpleadoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [selectedNomina, setSelectedNomina] = useState<NominaFull | null>(null)
  const [detalles, setDetalles] = useState<NominaDetalleItem[]>([])
  const [detallesLoading, setDetallesLoading] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingNomina, setEditingNomina] = useState<NominaItem | null>(null)
  const [formData, setFormData] = useState({
    empleadoId: "",
    periodo: "",
    fechaInicio: "",
    fechaFin: "",
    fechaPago: "",
    salarioBase: "",
  })
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [detalleDialogOpen, setDetalleDialogOpen] = useState(false)
  const [editingDetalle, setEditingDetalle] = useState<NominaDetalleItem | null>(null)
  const [detalleForm, setDetalleForm] = useState({ concepto: "", tipo: "DEVENGADO" as "DEVENGADO" | "DEDUCCION", monto: "", formula: "" })

  const [masivoDialogOpen, setMasivoDialogOpen] = useState(false)
  const [masivoForm, setMasivoForm] = useState({ periodo: "", fechaInicio: "", fechaFin: "", fechaPago: "" })
  const [masivoLoading, setMasivoLoading] = useState(false)

  const [resumen, setResumen] = useState<{ periodo: string; totalDevengado: number; totalDeducciones: number; totalPagar: number; count: number; pagadas: number }[]>([])
  const { toast } = useToast()

  const loadNominas = useCallback(async () => {
    const { getNominas: fn } = await import("@/actions/nomina")
    const data = await fn()
    setNominas(data)
  }, [])

  useEffect(() => {
    loadNominas()
      .catch(() => toast({ title: "Error al cargar nóminas", variant: "destructive" }))
      .finally(() => setLoading(false))
  }, [loadNominas])

  const loadResumen = useCallback(async () => {
    try {
      const { getResumenNominas } = await import("@/actions/nomina")
      const data = await getResumenNominas()
      setResumen(data)
    } catch {
      toast({ title: "Error al cargar resumen", variant: "destructive" })
    }
  }, [])

  useEffect(() => { loadResumen() }, [loadResumen])

  const loadEmpleados = useCallback(async () => {
    const { getEmpleados: fn } = await import("@/actions/nomina")
    const data = await fn()
    setEmpleados(data)
  }, [])

  const openCreateDialog = async () => {
    await loadEmpleados()
    setEditingNomina(null)
    setFormData({ empleadoId: "", periodo: "", fechaInicio: "", fechaFin: "", fechaPago: "", salarioBase: "" })
    setDialogOpen(true)
  }

  const openEditDialog = async (nomina: NominaItem) => {
    await loadEmpleados()
    setEditingNomina(nomina)
    setFormData({
      empleadoId: nomina.empleadoId,
      periodo: nomina.periodo,
      fechaInicio: nomina.fechaInicio ? nomina.fechaInicio.toString().slice(0, 10) : "",
      fechaFin: nomina.fechaFin ? nomina.fechaFin.toString().slice(0, 10) : "",
      fechaPago: nomina.fechaPago ? nomina.fechaPago.toString().slice(0, 10) : "",
      salarioBase: nomina.salarioBase.toString(),
    })
    setDialogOpen(true)
  }

  const handleSaveNomina = async () => {
    setSaving(true)
    try {
      const { createNomina, updateNomina } = await import("@/actions/nomina")
      if (editingNomina) {
        await updateNomina(editingNomina.id, formData)
      } else {
        await createNomina(formData)
      }
      setDialogOpen(false)
      await loadNominas()
      toast({ title: editingNomina ? "Nómina actualizada" : "Nómina creada", variant: "success" })
    } catch (err) {
      toast({ title: "Error al guardar", description: err instanceof Error ? err.message : "Error al guardar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNomina = async (id: string) => {
    if (!confirm("¿Eliminar esta nómina?")) return
    setActionLoading(id)
    try {
      const { deleteNomina } = await import("@/actions/nomina")
      await deleteNomina(id)
      if (selectedNomina?.id === id) {
        setSelectedNomina(null)
        setDetalles([])
      }
      await loadNominas()
      toast({ title: "Nómina eliminada", variant: "success" })
    } catch (err) {
      toast({ title: "Error al eliminar", description: err instanceof Error ? err.message : "Error al eliminar", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleAction = async (id: string, action: "calcular" | "aprobar" | "pagar") => {
    setActionLoading(`${action}-${id}`)
    try {
      const actions = await import("@/actions/nomina")
      if (action === "calcular") await actions.calcularNomina(id)
      else if (action === "aprobar") await actions.aprobarNomina(id)
      else await actions.pagarNomina(id)
      await loadNominas()
      if (selectedNomina?.id === id) {
        loadDetalles(id)
      }
      const actionLabels: Record<string, string> = { calcular: "calculada", aprobar: "aprobada", pagar: "pagada" }
      toast({ title: `Nómina ${actionLabels[action]}`, variant: "success" })
    } catch (err) {
      toast({ title: "Error al procesar", description: err instanceof Error ? err.message : "Error al procesar", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const loadDetalles = async (nominaId: string) => {
    setDetallesLoading(true)
    try {
      const { getNomina } = await import("@/actions/nomina")
      const data = await getNomina(nominaId)
      setSelectedNomina(data)
      setDetalles(data.detalles)
    } catch {
      toast({ title: "Error al cargar detalles", variant: "destructive" })
    } finally {
      setDetallesLoading(false)
    }
  }

  const selectNomina = async (nomina: NominaItem) => {
    if (selectedNomina?.id === nomina.id) {
      setSelectedNomina(null)
      setDetalles([])
    } else {
      await loadDetalles(nomina.id)
    }
  }

  const openCreateDetalle = () => {
    setEditingDetalle(null)
    setDetalleForm({ concepto: "", tipo: "DEVENGADO", monto: "", formula: "" })
    setDetalleDialogOpen(true)
  }

  const openEditDetalle = (detalle: NominaDetalleItem) => {
    setEditingDetalle(detalle)
    setDetalleForm({
      concepto: detalle.concepto,
      tipo: detalle.tipo as "DEVENGADO" | "DEDUCCION",
      monto: detalle.monto.toString(),
      formula: detalle.formula || "",
    })
    setDetalleDialogOpen(true)
  }

  const handleSaveDetalle = async () => {
    if (!selectedNomina) return
    setSaving(true)
    try {
      const { createNominaDetalle, updateNominaDetalle } = await import("@/actions/nomina")
      if (editingDetalle) {
        await updateNominaDetalle(editingDetalle.id, {
          nominaId: selectedNomina.id,
          ...detalleForm,
        })
      } else {
        await createNominaDetalle({
          nominaId: selectedNomina.id,
          ...detalleForm,
        })
      }
      setDetalleDialogOpen(false)
      await loadDetalles(selectedNomina.id)
      toast({ title: editingDetalle ? "Concepto actualizado" : "Concepto agregado", variant: "success" })
    } catch (err) {
      toast({ title: "Error al guardar detalle", description: err instanceof Error ? err.message : "Error al guardar detalle", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleGenerarMasivo = async () => {
    setMasivoLoading(true)
    try {
      const { generarNominasMasivo } = await import("@/actions/nomina")
      const result = await generarNominasMasivo(masivoForm)
      setMasivoDialogOpen(false)
      await loadNominas()
      await loadResumen()
      toast({ title: `Nóminas generadas: ${result.total} de ${result.empleados} empleados`, variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al generar nóminas", description: err.message, variant: "destructive" })
    } finally {
      setMasivoLoading(false)
    }
  }

  const handleDeleteDetalle = async (id: string) => {
    if (!confirm("¿Eliminar este detalle?")) return
    if (!selectedNomina) return
    setActionLoading(`det-${id}`)
    try {
      const { deleteNominaDetalle } = await import("@/actions/nomina")
      await deleteNominaDetalle(id)
      await loadDetalles(selectedNomina.id)
      toast({ title: "Detalle eliminado", variant: "success" })
    } catch (err) {
      toast({ title: "Error al eliminar detalle", description: err instanceof Error ? err.message : "Error al eliminar detalle", variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const filteredNominas = nominas.filter((n) => {
    if (!search) return true
    const q = search.toLowerCase()
    const emp = `${n.empleado.nombre} ${n.empleado.apellido}`.toLowerCase()
    return emp.includes(q) || n.periodo.toLowerCase().includes(q) || n.estado.toLowerCase().includes(q)
  })

  const columns: Column<NominaItem>[] = [
    {
      key: "periodo",
      header: "Período",
      render: (n) => (
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{n.periodo}</span>
        </div>
      ),
    },
    {
      key: "empleado",
      header: "Empleado",
      render: (n) => (
        <div>
          <div className="font-medium">{n.empleado.nombre} {n.empleado.apellido}</div>
          <div className="text-xs text-muted-foreground">{n.empleado.codigo}</div>
        </div>
      ),
    },
    {
      key: "fechas",
      header: "Fechas",
      render: (n) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(n.fechaInicio)} — {formatDate(n.fechaFin)}
        </div>
      ),
    },
    {
      key: "totalPagar",
      header: "Total a Pagar",
      className: "text-right",
      render: (n) => <span className="font-semibold">{formatMoney(n.totalPagar)}</span>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (n) => {
        const config = estadoBadge[n.estado as EstadoNomina]
        return <Badge variant={config.variant}>{config.label}</Badge>
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-[180px]",
      render: (n) => {
        const est = n.estado as EstadoNomina
        const actions = estadosSiguientes(est)
        return (
          <div className="flex items-center gap-1">
            {actions.calcular && (
              <Button variant="ghost" size="sm" title="Calcular" disabled={actionLoading === `calcular-${n.id}`} onClick={(e) => { e.stopPropagation(); handleAction(n.id, "calcular") }}>
                <Calculator className={`h-4 w-4 ${actionLoading === `calcular-${n.id}` ? "animate-spin" : ""}`} />
              </Button>
            )}
            {actions.aprobar && (
              <Button variant="ghost" size="sm" title="Aprobar" disabled={actionLoading === `aprobar-${n.id}`} onClick={(e) => { e.stopPropagation(); handleAction(n.id, "aprobar") }}>
                <CheckCircle className={`h-4 w-4 text-blue-500 ${actionLoading === `aprobar-${n.id}` ? "animate-spin" : ""}`} />
              </Button>
            )}
            {actions.pagar && (
              <Button variant="ghost" size="sm" title="Pagar" disabled={actionLoading === `pagar-${n.id}`} onClick={(e) => { e.stopPropagation(); handleAction(n.id, "pagar") }}>
                <DollarSign className={`h-4 w-4 text-green-500 ${actionLoading === `pagar-${n.id}` ? "animate-spin" : ""}`} />
              </Button>
            )}
            {est === "BORRADOR" && (
              <>
                <Button variant="ghost" size="sm" title="Editar" onClick={(e) => { e.stopPropagation(); openEditDialog(n) }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" title="Eliminar" disabled={actionLoading === n.id} onClick={(e) => { e.stopPropagation(); handleDeleteNomina(n.id) }}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" title="Ver detalles" onClick={(e) => { e.stopPropagation(); selectNomina(n) }}>
              {selectedNomina?.id === n.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nómina"
        description="Gestión de nóminas y pagos"
        actions={
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setMasivoDialogOpen(true)} className="w-full sm:w-auto">
              <Users className="mr-2 h-4 w-4" />
              Generar Masivo
            </Button>
            <Button onClick={openCreateDialog} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nueva Nómina
            </Button>
          </div>
        }
      />

      {resumen.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {resumen.slice(0, 3).map((r) => (
            <Card key={r.periodo}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  {r.periodo}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatMoney(r.totalPagar)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {r.count} nóminas · {r.pagadas} pagadas · {formatMoney(r.totalDevengado)} devengado · {formatMoney(r.totalDeducciones)} deducido
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={filteredNominas}
            loading={loading}
            searchable
            searchPlaceholder="Buscar por empleado, período o estado..."
            searchTerm={search}
            onSearch={setSearch}
          />
        </CardContent>
      </Card>

      {selectedNomina && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-base sm:text-lg">
                Detalles — {selectedNomina.empleado.nombre} {selectedNomina.empleado.apellido}
                {" — "}{selectedNomina.periodo}
              </span>
              {(selectedNomina.estado as EstadoNomina) === "BORRADOR" && (
                <Button size="sm" onClick={openCreateDetalle} className="w-full sm:w-auto">
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar Concepto
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {detallesLoading ? (
              <div className="text-center text-muted-foreground py-4">Cargando detalles...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Concepto</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead className="hidden sm:table-cell">Fórmula</TableHead>
                      {(selectedNomina.estado as EstadoNomina) === "BORRADOR" && <TableHead className="w-[80px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detalles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={(selectedNomina.estado as EstadoNomina) === "BORRADOR" ? 5 : 4} className="h-24 text-center text-muted-foreground">
                          Sin conceptos registrados
                        </TableCell>
                      </TableRow>
                    ) : (
                      detalles.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.concepto}</TableCell>
                          <TableCell>
                            <Badge variant={d.tipo === "DEVENGADO" ? "success" : "destructive"}>
                              {d.tipo === "DEVENGADO" ? "Devengado" : "Deducción"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatMoney(d.monto)}</TableCell>
                          <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{d.formula || "—"}</TableCell>
                          {(selectedNomina.estado as EstadoNomina) === "BORRADOR" && (
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" title="Editar" onClick={() => openEditDetalle(d)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" title="Eliminar" disabled={actionLoading === `det-${d.id}`} onClick={() => handleDeleteDetalle(d.id)}>
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                </div>

                <Separator />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Total Devengado</span>
                    <p className="text-lg font-semibold text-green-600">{formatMoney(selectedNomina.totalDevengado)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Total Deducciones</span>
                    <p className="text-lg font-semibold text-red-600">{formatMoney(selectedNomina.totalDeducciones)}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Total a Pagar</span>
                    <p className="text-lg font-semibold">{formatMoney(selectedNomina.totalPagar)}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingNomina ? "Editar Nómina" : "Nueva Nómina"}
        onSubmit={handleSaveNomina}
        loading={saving}
        submitLabel={editingNomina ? "Actualizar" : "Crear"}
      >
        <div className="space-y-2">
          <Label htmlFor="empleadoId">Empleado</Label>
          <Select value={formData.empleadoId} onValueChange={(v) => setFormData((f) => ({ ...f, empleadoId: v }))}>
            <SelectTrigger id="empleadoId" className="w-full">
              <SelectValue placeholder="Seleccionar empleado" />
            </SelectTrigger>
            <SelectContent>
              {empleados.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nombre} {e.apellido} ({e.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="periodo">Período</Label>
          <Input id="periodo" placeholder="Ej: Enero 2026" value={formData.periodo} onChange={(e) => setFormData((f) => ({ ...f, periodo: e.target.value }))} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fechaInicio">Fecha Inicio</Label>
            <Input id="fechaInicio" type="date" value={formData.fechaInicio} onChange={(e) => setFormData((f) => ({ ...f, fechaInicio: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaFin">Fecha Fin</Label>
            <Input id="fechaFin" type="date" value={formData.fechaFin} onChange={(e) => setFormData((f) => ({ ...f, fechaFin: e.target.value }))} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="salarioBase">Salario Base</Label>
          <Input id="salarioBase" type="number" step="0.01" min="0" placeholder="0.00" value={formData.salarioBase} onChange={(e) => setFormData((f) => ({ ...f, salarioBase: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fechaPago">Fecha de Pago (opcional)</Label>
          <Input id="fechaPago" type="date" value={formData.fechaPago} onChange={(e) => setFormData((f) => ({ ...f, fechaPago: e.target.value }))} />
        </div>
      </FormDialog>

      <FormDialog
        open={detalleDialogOpen}
        onOpenChange={setDetalleDialogOpen}
        title={editingDetalle ? "Editar Concepto" : "Agregar Concepto"}
        onSubmit={handleSaveDetalle}
        loading={saving}
        submitLabel={editingDetalle ? "Actualizar" : "Agregar"}
      >
        <div className="space-y-2">
          <Label htmlFor="concepto">Concepto</Label>
          <Input id="concepto" placeholder="Ej: Sueldo base, ISR, etc." value={detalleForm.concepto} onChange={(e) => setDetalleForm((f) => ({ ...f, concepto: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo</Label>
          <Select value={detalleForm.tipo} onValueChange={(v: "DEVENGADO" | "DEDUCCION") => setDetalleForm((f) => ({ ...f, tipo: v }))}>
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="DEVENGADO">Devengado</SelectItem>
              <SelectItem value="DEDUCCION">Deducción</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="monto">Monto</Label>
          <Input id="monto" type="number" step="0.01" min="0" placeholder="0.00" value={detalleForm.monto} onChange={(e) => setDetalleForm((f) => ({ ...f, monto: e.target.value }))} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="formula">Fórmula (opcional)</Label>
          <Input id="formula" placeholder="Ej: salarioBase * 0.5" value={detalleForm.formula} onChange={(e) => setDetalleForm((f) => ({ ...f, formula: e.target.value }))} />
        </div>
      </FormDialog>

      <FormDialog
        open={masivoDialogOpen}
        onOpenChange={setMasivoDialogOpen}
        title="Generar Nóminas Masivas"
        onSubmit={handleGenerarMasivo}
        loading={masivoLoading}
        submitLabel="Generar"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Se creará una nómina en borrador para cada empleado activo con el período indicado.
          </p>
          <div className="space-y-2">
            <Label>Período</Label>
            <Input placeholder="Ej: Enero 2026" value={masivoForm.periodo} onChange={(e) => setMasivoForm((f) => ({ ...f, periodo: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha Inicio</Label>
              <Input type="date" value={masivoForm.fechaInicio} onChange={(e) => setMasivoForm((f) => ({ ...f, fechaInicio: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>Fecha Fin</Label>
              <Input type="date" value={masivoForm.fechaFin} onChange={(e) => setMasivoForm((f) => ({ ...f, fechaFin: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fecha de Pago (opcional)</Label>
            <Input type="date" value={masivoForm.fechaPago} onChange={(e) => setMasivoForm((f) => ({ ...f, fechaPago: e.target.value }))} />
          </div>
        </div>
      </FormDialog>
    </div>
  )
}
