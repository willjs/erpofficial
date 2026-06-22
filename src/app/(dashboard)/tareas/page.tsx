"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/components/ui/use-toast"
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
  MessageSquare,
  Eye,
  Loader2,
  Send,
} from "lucide-react"
import { formatDate, formatDateTime } from "@/lib/utils"
import * as actions from "@/actions/tareas"
import type { ProyectoFormData, TareaFormData } from "@/actions/tareas"

type ProyectoItem = Awaited<ReturnType<typeof actions.getProyectos>>[number]
type TareaItem = Awaited<ReturnType<typeof actions.getTareas>>[number]
type UsuarioItem = Awaited<ReturnType<typeof actions.getUsuarios>>[number]
type DeptoItem = Awaited<ReturnType<typeof actions.getDepartamentos>>[number]
type ComentarioItem = Awaited<ReturnType<typeof actions.getComentarios>>[number]

const estadoProyectoBadge: Record<string, "info" | "warning" | "success" | "destructive"> = {
  PLANIFICADO: "info",
  EN_CURSO: "warning",
  COMPLETADO: "success",
  CANCELADO: "destructive",
}

const estadoTareaBadge: Record<string, "secondary" | "warning" | "success" | "destructive"> = {
  PENDIENTE: "secondary",
  EN_PROGRESO: "warning",
  COMPLETADA: "success",
  CANCELADA: "destructive",
}

const prioridadBadge: Record<string, "secondary" | "info" | "warning" | "destructive"> = {
  BAJA: "secondary",
  MEDIA: "info",
  ALTA: "warning",
  CRITICA: "destructive",
}

export default function TareasPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<"proyectos" | "tareas">("proyectos")

  const [proyectos, setProyectos] = useState<ProyectoItem[]>([])
  const [tareas, setTareas] = useState<TareaItem[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioItem[]>([])
  const [departamentos, setDeptos] = useState<DeptoItem[]>([])
  const [loading, setLoading] = useState(true)

  const [proyFilterDepto, setProyFilterDepto] = useState("")
  const [proyFilterEstado, setProyFilterEstado] = useState("")
  const [proySearch, setProySearch] = useState("")

  const [tareaFilterProyecto, setTareaFilterProyecto] = useState("")
  const [tareaFilterEstado, setTareaFilterEstado] = useState("")
  const [tareaFilterPrioridad, setTareaFilterPrioridad] = useState("")
  const [tareaSearch, setTareaSearch] = useState("")

  const [proyDialogOpen, setProyDialogOpen] = useState(false)
  const [proyEditando, setProyEditando] = useState<ProyectoItem | null>(null)
  const [proyForm, setProyForm] = useState<ProyectoFormData>({
    nombre: "",
    descripcion: "",
    departamentoId: "",
    fechaInicio: "",
    fechaFin: "",
    presupuesto: null,
    estado: "PLANIFICADO",
  })
  const [proySaving, setProySaving] = useState(false)

  const [tareaDialogOpen, setTareaDialogOpen] = useState(false)
  const [tareaEditando, setTareaEditando] = useState<TareaItem | null>(null)
  const [tareaForm, setTareaForm] = useState<TareaFormData>({
    titulo: "",
    descripcion: "",
    proyectoId: "",
    asignadoAId: "",
    prioridad: "MEDIA",
    estado: "PENDIENTE",
    fechaVencimiento: "",
  })
  const [tareaSaving, setTareaSaving] = useState(false)

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "proyecto" | "tarea"
    id: string
    nombre: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [comentariosDialogOpen, setComentariosDialogOpen] = useState(false)
  const [comentariosTarea, setComentariosTarea] = useState<{
    id: string
    titulo: string
  } | null>(null)
  const [comentarios, setComentarios] = useState<ComentarioItem[]>([])
  const [comentariosLoading, setComentariosLoading] = useState(false)
  const [nuevoComentario, setNuevoComentario] = useState("")
  const [comentarioSaving, setComentarioSaving] = useState(false)

  async function loadInitialData() {
    setLoading(true)
    try {
      const [proyectosData, tareasData, usuariosData, deptosData] = await Promise.all([
        actions.getProyectos(),
        actions.getTareas(),
        actions.getUsuarios(),
        actions.getDepartamentos(),
      ])
      setProyectos(proyectosData)
      setTareas(tareasData)
      setUsuarios(usuariosData)
      setDeptos(deptosData)
    } catch {
      toast({ title: "Error al cargar datos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  const filteredProyectos = proyectos.filter((p) => {
    if (proyFilterDepto && proyFilterDepto !== "__all" && p.departamentoId !== proyFilterDepto) return false
    if (proyFilterEstado && proyFilterEstado !== "__all" && p.estado !== proyFilterEstado) return false
    if (proySearch) {
      const t = proySearch.toLowerCase()
      if (!p.nombre.toLowerCase().includes(t)) return false
    }
    return true
  })

  const filteredTareas = tareas.filter((t) => {
    if (tareaFilterProyecto && tareaFilterProyecto !== "__all" && t.proyectoId !== tareaFilterProyecto) return false
    if (tareaFilterEstado && tareaFilterEstado !== "__all" && t.estado !== tareaFilterEstado) return false
    if (tareaFilterPrioridad && tareaFilterPrioridad !== "__all" && t.prioridad !== tareaFilterPrioridad) return false
    if (tareaSearch) {
      const term = tareaSearch.toLowerCase()
      if (!t.titulo.toLowerCase().includes(term)) return false
    }
    return true
  })

  async function openCreateProyecto() {
    setProyEditando(null)
    setProyForm({ nombre: "", descripcion: "", departamentoId: "", fechaInicio: "", fechaFin: "", presupuesto: null, estado: "PLANIFICADO" })
    setProyDialogOpen(true)
  }

  async function openEditProyecto(p: ProyectoItem) {
    setProyEditando(p)
    setProyForm({
      nombre: p.nombre,
      descripcion: p.descripcion ?? "",
      departamentoId: p.departamentoId ?? "",
      fechaInicio: p.fechaInicio ? p.fechaInicio.toISOString().split("T")[0] : "",
      fechaFin: p.fechaFin ? p.fechaFin.toISOString().split("T")[0] : "",
      presupuesto: p.presupuesto ? Number(p.presupuesto) : null,
      estado: p.estado,
    })
    setProyDialogOpen(true)
  }

  async function handleProyectoSubmit(e: React.FormEvent) {
    e.preventDefault()
    setProySaving(true)
    try {
      if (proyEditando) {
        const res = await actions.updateProyecto(proyEditando.id, proyForm)
        if (!res.success) {
          toast({ title: "Error al actualizar", description: typeof res.error === "string" ? res.error : "Error desconocido", variant: "destructive" })
          return
        }
        setProyectos((prev) => prev.map((p) => (p.id === proyEditando.id ? res.data : p)))
        toast({ title: "Proyecto actualizado", variant: "success" })
      } else {
        const res = await actions.createProyecto(proyForm)
        if (!res.success) {
          toast({ title: "Error al crear", description: typeof res.error === "string" ? res.error : "Error desconocido", variant: "destructive" })
          return
        }
        setProyectos((prev) => [res.data, ...prev])
        toast({ title: "Proyecto creado", variant: "success" })
      }
      setProyDialogOpen(false)
    } catch {
      toast({ title: "Error inesperado", variant: "destructive" })
    } finally {
      setProySaving(false)
    }
  }

  function confirmDeleteProyecto(p: ProyectoItem) {
    setDeleteTarget({ type: "proyecto", id: p.id, nombre: p.nombre })
    setDeleteDialogOpen(true)
  }

  function confirmDeleteTarea(t: TareaItem) {
    setDeleteTarget({ type: "tarea", id: t.id, nombre: t.titulo })
    setDeleteDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      if (deleteTarget.type === "proyecto") {
        const res = await actions.deleteProyecto(deleteTarget.id)
        if (!res.success) {
          toast({ title: "Error al eliminar", description: res.error ?? "Error desconocido", variant: "destructive" })
          return
        }
        setProyectos((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      } else {
        const res = await actions.deleteTarea(deleteTarget.id)
        if (!res.success) {
          toast({ title: "Error al eliminar", description: res.error ?? "Error desconocido", variant: "destructive" })
          return
        }
        setTareas((prev) => prev.filter((t) => t.id !== deleteTarget.id))
      }
      toast({ title: `${deleteTarget.type === "proyecto" ? "Proyecto" : "Tarea"} eliminado`, variant: "success" })
      setDeleteDialogOpen(false)
    } catch {
      toast({ title: "Error inesperado", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  async function openCreateTarea() {
    setTareaEditando(null)
    setTareaForm({ titulo: "", descripcion: "", proyectoId: "", asignadoAId: "", prioridad: "MEDIA", estado: "PENDIENTE", fechaVencimiento: "" })
    setTareaDialogOpen(true)
  }

  async function openEditTarea(t: TareaItem) {
    setTareaEditando(t)
    setTareaForm({
      titulo: t.titulo,
      descripcion: t.descripcion ?? "",
      proyectoId: t.proyectoId ?? "",
      asignadoAId: t.asignadoAId ?? "",
      prioridad: t.prioridad,
      estado: t.estado,
      fechaVencimiento: t.fechaVencimiento ? t.fechaVencimiento.toISOString().split("T")[0] : "",
    })
    setTareaDialogOpen(true)
  }

  async function handleTareaSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTareaSaving(true)
    try {
      if (tareaEditando) {
        const res = await actions.updateTarea(tareaEditando.id, tareaForm)
        if (!res.success) {
          toast({ title: "Error al actualizar", description: typeof res.error === "string" ? res.error : "Error desconocido", variant: "destructive" })
          return
        }
        setTareas((prev) => prev.map((t) => (t.id === tareaEditando.id ? res.data : t)))
        toast({ title: "Tarea actualizada", variant: "success" })
      } else {
        const res = await actions.createTarea(tareaForm)
        if (!res.success) {
          toast({ title: "Error al crear", description: typeof res.error === "string" ? res.error : "Error desconocido", variant: "destructive" })
          return
        }
        setTareas((prev) => [res.data, ...prev])
        toast({ title: "Tarea creada", variant: "success" })
      }
      setTareaDialogOpen(false)
    } catch {
      toast({ title: "Error inesperado", variant: "destructive" })
    } finally {
      setTareaSaving(false)
    }
  }

  async function openComentarios(t: TareaItem) {
    setComentariosTarea({ id: t.id, titulo: t.titulo })
    setComentariosLoading(true)
    setComentariosDialogOpen(true)
    try {
      const data = await actions.getComentarios(t.id)
      setComentarios(data)
    } catch {
      toast({ title: "Error al cargar comentarios", variant: "destructive" })
    } finally {
      setComentariosLoading(false)
    }
  }

  async function handleAddComentario() {
    if (!nuevoComentario.trim() || !comentariosTarea) return
    setComentarioSaving(true)
    try {
      const res = await actions.createComentario(comentariosTarea.id, nuevoComentario.trim())
      if (res.success) {
        setComentarios((prev) => [res.data, ...prev])
        setNuevoComentario("")
        toast({ title: "Comentario agregado", variant: "success" })
      } else {
        toast({ title: "Error al agregar comentario", variant: "destructive" })
      }
    } catch {
      toast({ title: "Error inesperado", variant: "destructive" })
    } finally {
      setComentarioSaving(false)
    }
  }

  const proyectoColumns: Column<ProyectoItem>[] = [
    { key: "nombre", header: "Nombre" },
    {
      key: "departamento",
      header: "Departamento",
      render: (p) => p.departamento?.nombre ?? "—",
    },
    {
      key: "estado",
      header: "Estado",
      render: (p) => (
        <Badge variant={estadoProyectoBadge[p.estado]}>{p.estado.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "tareas",
      header: "Tareas",
      render: (p) => p._count.tareas,
      className: "text-center",
    },
    {
      key: "fechaInicio",
      header: "Inicio",
      render: (p) => (p.fechaInicio ? formatDate(p.fechaInicio) : "—"),
    },
    {
      key: "fechaFin",
      header: "Fin",
      render: (p) => (p.fechaFin ? formatDate(p.fechaFin) : "—"),
    },
    {
      key: "acciones",
      header: "",
      render: (p) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => openEditProyecto(p)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => confirmDeleteProyecto(p)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setTareaFilterProyecto(p.id)
              setTab("tareas")
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: "w-[100px]",
    },
  ]

  const tareaColumns: Column<TareaItem>[] = [
    { key: "titulo", header: "Título" },
    {
      key: "proyecto",
      header: "Proyecto",
      render: (t) => t.proyecto?.nombre ?? "—",
    },
    {
      key: "asignadoA",
      header: "Asignado",
      render: (t) =>
        t.asignadoA ? `${t.asignadoA.nombre} ${t.asignadoA.apellido ?? ""}` : "—",
    },
    {
      key: "prioridad",
      header: "Prioridad",
      render: (t) => <Badge variant={prioridadBadge[t.prioridad]}>{t.prioridad}</Badge>,
    },
    {
      key: "estado",
      header: "Estado",
      render: (t) => (
        <Badge variant={estadoTareaBadge[t.estado]}>{t.estado.replace("_", " ")}</Badge>
      ),
    },
    {
      key: "fechaVencimiento",
      header: "Vence",
      render: (t) => (t.fechaVencimiento ? formatDate(t.fechaVencimiento) : "—"),
    },
    {
      key: "comentarios",
      header: "Coment.",
      render: (t) => (
        <Button variant="ghost" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); openComentarios(t) }}>
          <MessageSquare className="h-3.5 w-3.5" />
          {t._count.comentarios}
        </Button>
      ),
      className: "text-center",
    },
    {
      key: "acciones",
      header: "",
      render: (t) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" onClick={() => openEditTarea(t)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => confirmDeleteTarea(t)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      className: "w-[80px]",
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tareas y Proyectos"
        description="Gestión de tareas, proyectos y seguimiento"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={openCreateProyecto}>
              <Plus className="mr-1 h-4 w-4" />
              Nuevo Proyecto
            </Button>
            <Button onClick={openCreateTarea}>
              <Plus className="mr-1 h-4 w-4" />
              Nueva Tarea
            </Button>
          </div>
        }
      />

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab("proyectos")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
            tab === "proyectos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Proyectos
        </button>
        <button
          onClick={() => setTab("tareas")}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
            tab === "tareas"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Tareas
        </button>
      </div>

      {tab === "proyectos" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={proyFilterDepto} onValueChange={setProyFilterDepto}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={proyFilterEstado} onValueChange={setProyFilterEstado}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                <SelectItem value="PLANIFICADO">Planificado</SelectItem>
                <SelectItem value="EN_CURSO">En Curso</SelectItem>
                <SelectItem value="COMPLETADO">Completado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={proyectoColumns}
            data={filteredProyectos}
            loading={loading}
            searchable
            searchTerm={proySearch}
            onSearch={setProySearch}
            searchPlaceholder="Buscar proyecto..."
          />
        </div>
      )}

      {tab === "tareas" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={tareaFilterProyecto} onValueChange={setTareaFilterProyecto}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Proyecto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tareaFilterEstado} onValueChange={setTareaFilterEstado}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="EN_PROGRESO">En Progreso</SelectItem>
                <SelectItem value="COMPLETADA">Completada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tareaFilterPrioridad} onValueChange={setTareaFilterPrioridad}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Prioridad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todas</SelectItem>
                <SelectItem value="BAJA">Baja</SelectItem>
                <SelectItem value="MEDIA">Media</SelectItem>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="CRITICA">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DataTable
            columns={tareaColumns}
            data={filteredTareas}
            loading={loading}
            searchable
            searchTerm={tareaSearch}
            onSearch={setTareaSearch}
            searchPlaceholder="Buscar tarea..."
          />
        </div>
      )}

      <FormDialog
        open={proyDialogOpen}
        onOpenChange={setProyDialogOpen}
        title={proyEditando ? "Editar Proyecto" : "Nuevo Proyecto"}
        description={proyEditando ? "Actualiza los datos del proyecto" : "Ingresa los datos del nuevo proyecto"}
        onSubmit={handleProyectoSubmit}
        submitLabel={proyEditando ? "Actualizar" : "Crear"}
        loading={proySaving}
      >
        <div className="space-y-2">
          <Label htmlFor="proy-nombre">Nombre</Label>
          <Input
            id="proy-nombre"
            value={proyForm.nombre}
            onChange={(e) => setProyForm((f) => ({ ...f, nombre: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proy-desc">Descripción</Label>
          <Input
            id="proy-desc"
            value={proyForm.descripcion ?? ""}
            onChange={(e) => setProyForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="proy-depto">Departamento</Label>
          <Select
            value={proyForm.departamentoId ?? ""}
            onValueChange={(v) => setProyForm((f) => ({ ...f, departamentoId: v === "__none" ? "" : v }))}
            >
              <SelectTrigger id="proy-depto">
                <SelectValue placeholder="Sin departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Sin departamento</SelectItem>
              {departamentos.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="proy-fechaInicio">Fecha Inicio</Label>
            <Input
              id="proy-fechaInicio"
              type="date"
              value={proyForm.fechaInicio ?? ""}
              onChange={(e) => setProyForm((f) => ({ ...f, fechaInicio: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proy-fechaFin">Fecha Fin</Label>
            <Input
              id="proy-fechaFin"
              type="date"
              value={proyForm.fechaFin ?? ""}
              onChange={(e) => setProyForm((f) => ({ ...f, fechaFin: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="proy-presupuesto">Presupuesto</Label>
          <Input
            id="proy-presupuesto"
            type="number"
            step="0.01"
            value={proyForm.presupuesto ?? ""}
            onChange={(e) =>
              setProyForm((f) => ({
                ...f,
                presupuesto: e.target.value ? Number(e.target.value) : null,
              }))
            }
          />
        </div>
        {proyEditando && (
          <div className="space-y-2">
            <Label htmlFor="proy-estado">Estado</Label>
            <Select
              value={proyForm.estado ?? "PLANIFICADO"}
              onValueChange={(v: any) => setProyForm((f) => ({ ...f, estado: v }))}
            >
              <SelectTrigger id="proy-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PLANIFICADO">Planificado</SelectItem>
                <SelectItem value="EN_CURSO">En Curso</SelectItem>
                <SelectItem value="COMPLETADO">Completado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </FormDialog>

      <FormDialog
        open={tareaDialogOpen}
        onOpenChange={setTareaDialogOpen}
        title={tareaEditando ? "Editar Tarea" : "Nueva Tarea"}
        description={tareaEditando ? "Actualiza los datos de la tarea" : "Ingresa los datos de la nueva tarea"}
        onSubmit={handleTareaSubmit}
        submitLabel={tareaEditando ? "Actualizar" : "Crear"}
        loading={tareaSaving}
      >
        <div className="space-y-2">
          <Label htmlFor="tarea-titulo">Título</Label>
          <Input
            id="tarea-titulo"
            value={tareaForm.titulo}
            onChange={(e) => setTareaForm((f) => ({ ...f, titulo: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tarea-desc">Descripción</Label>
          <Input
            id="tarea-desc"
            value={tareaForm.descripcion ?? ""}
            onChange={(e) => setTareaForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tarea-proyecto">Proyecto</Label>
            <Select
              value={tareaForm.proyectoId ?? ""}
              onValueChange={(v) => setTareaForm((f) => ({ ...f, proyectoId: v === "__none" ? "" : v }))}
              >
                <SelectTrigger id="tarea-proyecto">
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin proyecto</SelectItem>
                {proyectos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tarea-asignado">Asignado a</Label>
            <Select
              value={tareaForm.asignadoAId ?? ""}
              onValueChange={(v) => setTareaForm((f) => ({ ...f, asignadoAId: v === "__none" ? "" : v }))}
              >
                <SelectTrigger id="tarea-asignado">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Sin asignar</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre} {u.apellido ?? ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tarea-prioridad">Prioridad</Label>
            <Select
              value={tareaForm.prioridad ?? "MEDIA"}
              onValueChange={(v: any) => setTareaForm((f) => ({ ...f, prioridad: v }))}
            >
              <SelectTrigger id="tarea-prioridad">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BAJA">Baja</SelectItem>
                <SelectItem value="MEDIA">Media</SelectItem>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="CRITICA">Crítica</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tarea-fechaVto">Fecha Vencimiento</Label>
            <Input
              id="tarea-fechaVto"
              type="date"
              value={tareaForm.fechaVencimiento ?? ""}
              onChange={(e) => setTareaForm((f) => ({ ...f, fechaVencimiento: e.target.value }))}
            />
          </div>
        </div>
        {tareaEditando && (
          <div className="space-y-2">
            <Label htmlFor="tarea-estado">Estado</Label>
            <Select
              value={tareaForm.estado ?? "PENDIENTE"}
              onValueChange={(v: any) => setTareaForm((f) => ({ ...f, estado: v }))}
            >
              <SelectTrigger id="tarea-estado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="EN_PROGRESO">En Progreso</SelectItem>
                <SelectItem value="COMPLETADA">Completada</SelectItem>
                <SelectItem value="CANCELADA">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </FormDialog>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar {deleteTarget?.type === "proyecto" ? "el proyecto" : "la tarea"}{" "}
              <strong>{deleteTarget?.nombre}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={comentariosDialogOpen} onOpenChange={setComentariosDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comentarios</DialogTitle>
            <DialogDescription>{comentariosTarea?.titulo}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {comentariosLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : comentarios.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Sin comentarios aún
              </p>
            ) : (
              comentarios.map((c) => {
                const autor = usuarios.find((u) => u.id === c.usuarioId)
                return (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {autor ? `${autor.nombre} ${autor.apellido ?? ""}` : "Usuario"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm">{c.contenido}</p>
                  </div>
                )
              })
            )}
            <Separator />
            <div className="flex gap-2">
              <Input
                placeholder="Escribe un comentario..."
                value={nuevoComentario}
                onChange={(e) => setNuevoComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComentario()
                  }
                }}
              />
              <Button
                size="icon"
                onClick={handleAddComentario}
                disabled={!nuevoComentario.trim() || comentarioSaving}
              >
                {comentarioSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
