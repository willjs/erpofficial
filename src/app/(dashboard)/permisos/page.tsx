"use client"

import { useState, useEffect, useCallback } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import { Plus, Pencil, Trash2, Check, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { cn, formatDate, formatDateTime } from "@/lib/utils"
import {
  getTiposPermiso,
  createTipoPermiso,
  updateTipoPermiso,
  toggleTipoPermisoActivo,
  toggleTipoPermisoRemunerado,
  deleteTipoPermiso,
  getSolicitudesPermiso,
  getSolicitudPermiso,
  createSolicitudPermiso,
  updateSolicitudPermiso,
  deleteSolicitudPermiso,
  aprobarSolicitud,
  rechazarSolicitud,
  cancelarSolicitud,
  getEmpleados,
} from "@/actions/permisos"

// ─── Tabs wrappers ──────────────────────────────────────

function TabsList({ className, ...props }: React.ComponentPropsWithoutRef<typeof Tabs.List>) {
  return (
    <Tabs.List
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentPropsWithoutRef<typeof Tabs.Trigger>) {
  return (
    <Tabs.Trigger
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentPropsWithoutRef<typeof Tabs.Content>) {
  return (
    <Tabs.Content
      className={cn(
        "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
}

// ─── Estado badge helper ───────────────────────────────

const estadoVariants: Record<string, "warning" | "success" | "destructive" | "secondary"> = {
  PENDIENTE: "warning",
  APROBADO: "success",
  RECHAZADO: "destructive",
  CANCELADO: "secondary",
}

const estadoLabels: Record<string, string> = {
  PENDIENTE: "Pendiente",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  CANCELADO: "Cancelado",
}

function EstadoBadge({ estado }: { estado: string }) {
  return <Badge variant={estadoVariants[estado] ?? "secondary"}>{estadoLabels[estado] ?? estado}</Badge>
}

// ─── Boolean badge helper ──────────────────────────────

function BoolBadge({ value, trueLabel = "Sí", falseLabel = "No" }: { value: boolean; trueLabel?: string; falseLabel?: string }) {
  return (
    <Badge variant={value ? "success" : "secondary"}>
      {value ? trueLabel : falseLabel}
    </Badge>
  )
}

// ─── Helper to format date for input ───────────────────

function toDateInputValue(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date
  return d.toISOString().slice(0, 10)
}

// ─── Main Page ─────────────────────────────────────────

export default function PermisosPage() {
  const [activeTab, setActiveTab] = useState("solicitudes")

  // Data
  const [solicitudes, setSolicitudes] = useState<any[]>([])
  const [tipos, setTipos] = useState<any[]>([])
  const [empleados, setEmpleados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Search
  const [searchSolicitudes, setSearchSolicitudes] = useState("")
  const [searchTipos, setSearchTipos] = useState("")

  // Solicitud dialog
  const [solicitudDialogOpen, setSolicitudDialogOpen] = useState(false)
  const [solicitudEdit, setSolicitudEdit] = useState<any>(null)
  const [solicitudForm, setSolicitudForm] = useState({
    empleadoId: "",
    tipoPermisoId: "",
    fechaInicio: "",
    fechaFin: "",
    motivo: "",
  })
  const [savingSolicitud, setSavingSolicitud] = useState(false)
  const [solicitudError, setSolicitudError] = useState("")

  // Tipo dialog
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false)
  const [tipoEdit, setTipoEdit] = useState<any>(null)
  const [tipoForm, setTipoForm] = useState({
    nombre: "",
    descripcion: "",
    diasMaximos: "",
    remunerado: true,
  })
  const [savingTipo, setSavingTipo] = useState(false)
  const [tipoError, setTipoError] = useState("")

  // ─── Load data ─────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [sols, tips, emps] = await Promise.all([
        getSolicitudesPermiso(),
        getTiposPermiso(),
        getEmpleados(),
      ])
      setSolicitudes(sols)
      setTipos(tips)
      setEmpleados(emps)
    } catch {
      toast({ title: "Error al cargar datos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Solicitud helpers ─────────────────────────────

  function openCreateSolicitud() {
    setSolicitudEdit(null)
    setSolicitudForm({ empleadoId: "", tipoPermisoId: "", fechaInicio: "", fechaFin: "", motivo: "" })
    setSolicitudError("")
    setSolicitudDialogOpen(true)
  }

  async function openEditSolicitud(id: string) {
    try {
      const sol = await getSolicitudPermiso(id)
      setSolicitudEdit(sol)
      setSolicitudForm({
        empleadoId: sol.empleadoId,
        tipoPermisoId: sol.tipoPermisoId,
        fechaInicio: toDateInputValue(sol.fechaInicio),
        fechaFin: toDateInputValue(sol.fechaFin),
        motivo: sol.motivo ?? "",
      })
      setSolicitudError("")
      setSolicitudDialogOpen(true)
    } catch {
      setSolicitudError("Error al cargar la solicitud")
      toast({ title: "Error al cargar la solicitud", variant: "destructive" })
    }
  }

  async function handleSolicitudSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSavingSolicitud(true)
    setSolicitudError("")
    try {
      if (solicitudEdit) {
        await updateSolicitudPermiso(solicitudEdit.id, solicitudForm)
        toast({ title: "Solicitud actualizada", variant: "success" })
      } else {
        await createSolicitudPermiso(solicitudForm)
        toast({ title: "Solicitud creada", variant: "success" })
      }
      setSolicitudDialogOpen(false)
      await loadData()
    } catch (err: any) {
      const msg = err.message ?? "Error al guardar la solicitud"
      setSolicitudError(msg)
      toast({ title: "Error al guardar", description: msg, variant: "destructive" })
    } finally {
      setSavingSolicitud(false)
    }
  }

  async function handleDeleteSolicitud(id: string) {
    if (!confirm("¿Estás seguro de eliminar esta solicitud?")) return
    try {
      await deleteSolicitudPermiso(id)
      toast({ title: "Solicitud eliminada", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message ?? "", variant: "destructive" })
    }
  }

  async function handleAprobar(id: string) {
    try {
      await aprobarSolicitud(id)
      toast({ title: "Solicitud aprobada", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al aprobar", description: err.message ?? "", variant: "destructive" })
    }
  }

  async function handleRechazar(id: string) {
    try {
      await rechazarSolicitud(id)
      toast({ title: "Solicitud rechazada", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al rechazar", description: err.message ?? "", variant: "destructive" })
    }
  }

  async function handleCancelar(id: string) {
    if (!confirm("¿Cancelar esta solicitud?")) return
    try {
      await cancelarSolicitud(id)
      toast({ title: "Solicitud cancelada", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al cancelar", description: err.message ?? "", variant: "destructive" })
    }
  }

  // ─── Tipo helpers ─────────────────────────────────

  function openCreateTipo() {
    setTipoEdit(null)
    setTipoForm({ nombre: "", descripcion: "", diasMaximos: "", remunerado: true })
    setTipoError("")
    setTipoDialogOpen(true)
  }

  function openEditTipo(tipo: any) {
    setTipoEdit(tipo)
    setTipoForm({
      nombre: tipo.nombre,
      descripcion: tipo.descripcion ?? "",
      diasMaximos: tipo.diasMaximos?.toString() ?? "",
      remunerado: tipo.remunerado,
    })
    setTipoError("")
    setTipoDialogOpen(true)
  }

  async function handleTipoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSavingTipo(true)
    setTipoError("")
    try {
      const data = {
        ...tipoForm,
        diasMaximos: tipoForm.diasMaximos === "" ? null : Number(tipoForm.diasMaximos),
      }
      if (tipoEdit) {
        await updateTipoPermiso(tipoEdit.id, data)
        toast({ title: "Tipo de permiso actualizado", variant: "success" })
      } else {
        await createTipoPermiso(data)
        toast({ title: "Tipo de permiso creado", variant: "success" })
      }
      setTipoDialogOpen(false)
      await loadData()
    } catch (err: any) {
      const msg = err.message ?? "Error al guardar el tipo de permiso"
      setTipoError(msg)
      toast({ title: "Error al guardar", description: msg, variant: "destructive" })
    } finally {
      setSavingTipo(false)
    }
  }

  async function handleToggleActivo(id: string) {
    try {
      await toggleTipoPermisoActivo(id)
      toast({ title: "Estado actualizado", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al cambiar estado", description: err.message ?? "", variant: "destructive" })
    }
  }

  async function handleToggleRemunerado(id: string) {
    try {
      await toggleTipoPermisoRemunerado(id)
      toast({ title: "Tipo de permiso actualizado", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al cambiar remunerado", description: err.message ?? "", variant: "destructive" })
    }
  }

  async function handleDeleteTipo(id: string) {
    if (!confirm("¿Estás seguro de eliminar este tipo de permiso?")) return
    try {
      await deleteTipoPermiso(id)
      toast({ title: "Tipo de permiso eliminado", variant: "success" })
      await loadData()
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message ?? "", variant: "destructive" })
    }
  }

  // ─── Columns ───────────────────────────────────────

  const solicitudColumns: Column<any>[] = [
    { key: "empleado", header: "Empleado", render: (s) => `${s.empleado.nombre} ${s.empleado.apellido}` },
    { key: "tipoPermiso", header: "Tipo", render: (s) => s.tipoPermiso.nombre },
    {
      key: "fechaInicio",
      header: "Inicio",
      render: (s) => formatDate(s.fechaInicio),
    },
    {
      key: "fechaFin",
      header: "Fin",
      render: (s) => formatDate(s.fechaFin),
    },
    {
      key: "motivo",
      header: "Motivo",
      render: (s) => s.motivo ?? "—",
    },
    {
      key: "estado",
      header: "Estado",
      render: (s) => <EstadoBadge estado={s.estado} />,
    },
    {
      key: "solicitante",
      header: "Solicitó",
      render: (s) =>
        s.solicitante ? `${s.solicitante.nombre} ${s.solicitante.apellido}` : "—",
    },
    {
      key: "acciones",
      header: "Acciones",
      className: "text-right",
      render: (s) => (
        <div className="flex justify-end gap-1">
          {s.estado === "PENDIENTE" && (
            <>
              <Button size="sm" variant="outline" className="text-green-600" title="Aprobar" onClick={() => handleAprobar(s.id)}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="outline" className="text-red-600" title="Rechazar" onClick={() => handleRechazar(s.id)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
          {s.estado === "PENDIENTE" && (
            <Button size="sm" variant="outline" onClick={() => openEditSolicitud(s.id)}>
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {s.estado !== "APROBADO" && (
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteSolicitud(s.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  const tipoColumns: Column<any>[] = [
    { key: "nombre", header: "Nombre" },
    { key: "descripcion", header: "Descripción", render: (t) => t.descripcion ?? "—" },
    { key: "diasMaximos", header: "Días Máx.", render: (t) => t.diasMaximos ?? "—" },
    {
      key: "remunerado",
      header: "Remunerado",
      render: (t) => (
        <Button size="sm" variant="ghost" onClick={() => handleToggleRemunerado(t.id)}>
          <BoolBadge value={t.remunerado} />
        </Button>
      ),
    },
    {
      key: "activo",
      header: "Activo",
      render: (t) => (
        <Button size="sm" variant="ghost" onClick={() => handleToggleActivo(t.id)}>
          <BoolBadge value={t.activo} />
        </Button>
      ),
    },
    {
      key: "acciones",
      header: "Acciones",
      className: "text-right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="outline" onClick={() => openEditTipo(t)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDeleteTipo(t.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  // ─── Render ────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Permisos y Ausencias"
        description="Solicitud y aprobación de permisos"
        actions={
          activeTab === "solicitudes" ? (
            <Button onClick={openCreateSolicitud}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Solicitud
            </Button>
          ) : (
            <Button onClick={openCreateTipo}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Tipo
            </Button>
          )
        }
      />

      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="solicitudes">Solicitudes</TabsTrigger>
          <TabsTrigger value="tipos">Tipos de Permiso</TabsTrigger>
        </TabsList>

        <TabsContent value="solicitudes">
          <DataTable
            columns={solicitudColumns}
            data={solicitudes}
            loading={loading}
            searchable
            searchPlaceholder="Buscar solicitudes..."
            searchTerm={searchSolicitudes}
            onSearch={setSearchSolicitudes}
          />
        </TabsContent>

        <TabsContent value="tipos">
          <DataTable
            columns={tipoColumns}
            data={tipos}
            loading={loading}
            searchable
            searchPlaceholder="Buscar tipos..."
            searchTerm={searchTipos}
            onSearch={setSearchTipos}
          />
        </TabsContent>
      </Tabs.Root>

      {/* ─── Solicitud Dialog ─────────────────────────── */}
      <FormDialog
        open={solicitudDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSolicitudEdit(null)
            setSolicitudError("")
          }
          setSolicitudDialogOpen(open)
        }}
        title={solicitudEdit ? "Editar Solicitud" : "Nueva Solicitud"}
        description="Registra una solicitud de permiso o ausencia"
        onSubmit={handleSolicitudSubmit}
        submitLabel={solicitudEdit ? "Actualizar" : "Crear"}
        loading={savingSolicitud}
      >
        {solicitudError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{solicitudError}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="empleadoId">Empleado</Label>
          <Select
            value={solicitudForm.empleadoId}
            onValueChange={(v) => setSolicitudForm((f) => ({ ...f, empleadoId: v }))}
          >
            <SelectTrigger id="empleadoId">
              <SelectValue placeholder="Seleccionar empleado" />
            </SelectTrigger>
            <SelectContent>
              {empleados.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.nombre} {emp.apellido} ({emp.codigo})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipoPermisoId">Tipo de Permiso</Label>
          <Select
            value={solicitudForm.tipoPermisoId}
            onValueChange={(v) => setSolicitudForm((f) => ({ ...f, tipoPermisoId: v }))}
          >
            <SelectTrigger id="tipoPermisoId">
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {tipos
                .filter((t) => t.activo)
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nombre}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fechaInicio">Fecha Inicio</Label>
            <Input
              id="fechaInicio"
              type="date"
              value={solicitudForm.fechaInicio}
              onChange={(e) => setSolicitudForm((f) => ({ ...f, fechaInicio: e.target.value }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaFin">Fecha Fin</Label>
            <Input
              id="fechaFin"
              type="date"
              value={solicitudForm.fechaFin}
              onChange={(e) => setSolicitudForm((f) => ({ ...f, fechaFin: e.target.value }))}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo</Label>
          <textarea
            id="motivo"
            className="flex h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Motivo del permiso (opcional)"
            value={solicitudForm.motivo}
            onChange={(e) => setSolicitudForm((f) => ({ ...f, motivo: e.target.value }))}
          />
        </div>
      </FormDialog>

      {/* ─── Tipo Dialog ──────────────────────────────── */}
      <FormDialog
        open={tipoDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setTipoEdit(null)
            setTipoError("")
          }
          setTipoDialogOpen(open)
        }}
        title={tipoEdit ? "Editar Tipo de Permiso" : "Nuevo Tipo de Permiso"}
        description="Define los tipos de permiso disponibles"
        onSubmit={handleTipoSubmit}
        submitLabel={tipoEdit ? "Actualizar" : "Crear"}
        loading={savingTipo}
      >
        {tipoError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{tipoError}</div>
        )}

        <div className="space-y-2">
          <Label htmlFor="tipoNombre">Nombre</Label>
          <Input
            id="tipoNombre"
            value={tipoForm.nombre}
            onChange={(e) => setTipoForm((f) => ({ ...f, nombre: e.target.value }))}
            placeholder="Ej. Vacaciones, Permiso Médico"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="tipoDescripcion">Descripción</Label>
          <textarea
            id="tipoDescripcion"
            className="flex h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Descripción opcional"
            value={tipoForm.descripcion}
            onChange={(e) => setTipoForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="diasMaximos">Días Máximos</Label>
          <Input
            id="diasMaximos"
            type="number"
            min="1"
            value={tipoForm.diasMaximos}
            onChange={(e) => setTipoForm((f) => ({ ...f, diasMaximos: e.target.value }))}
            placeholder="Sin límite"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="remunerado">Remunerado</Label>
          <Button
            id="remunerado"
            type="button"
            size="sm"
            variant={tipoForm.remunerado ? "default" : "secondary"}
            onClick={() => setTipoForm((f) => ({ ...f, remunerado: !f.remunerado }))}
          >
            {tipoForm.remunerado ? "Sí" : "No"}
          </Button>
        </div>
      </FormDialog>
    </div>
  )
}
