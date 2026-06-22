"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useToast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Pencil, Trash2, Power, PowerOff } from "lucide-react"
import { formatDate, formatMoney } from "@/lib/utils"
import {
  getCategorias,
  createCategoria,
  updateCategoria,
  toggleCategoria,
  deleteCategoria,
  getActivos,
  createActivo,
  updateActivo,
  deleteActivo,
  getMovimientos,
  createMovimiento,
} from "@/actions/inventario"

type CategoriaRow = {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  _count: { activos: number }
}

type ActivoRow = {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  marca: string | null
  modelo: string | null
  numeroSerie: string | null
  fechaAdquisicion: Date | null
  valorAdquisicion: number | null
  valorActual: number | null
  ubicacion: string | null
  estado: string
  categoria: { id: string; nombre: string } | null
  createdAt: Date
}

type MovimientoRow = {
  id: string
  activoId: string
  tipo: string
  fecha: Date
  observaciones: string | null
  responsable: { nombre: string; apellido: string | null } | null
  activo: { codigo: string; nombre: string }
  createdAt: Date
}

type Tab = "activos" | "categorias" | "movimientos"

const estadoBadge: Record<string, "success" | "warning" | "info" | "destructive"> = {
  DISPONIBLE: "success",
  ASIGNADO: "warning",
  EN_REPARACION: "info",
  DADO_BAJA: "destructive",
}

const estadoLabel: Record<string, string> = {
  DISPONIBLE: "Disponible",
  ASIGNADO: "Asignado",
  EN_REPARACION: "En reparación",
  DADO_BAJA: "Dado de baja",
}

const tipoBadge: Record<string, "warning" | "info" | "secondary" | "destructive" | "default"> = {
  ASIGNACION: "warning",
  DEVOLUCION: "info",
  MANTENIMIENTO: "secondary",
  BAJA: "destructive",
  TRASPASO: "default",
}

const tipoLabel: Record<string, string> = {
  ASIGNACION: "Asignación",
  DEVOLUCION: "Devolución",
  MANTENIMIENTO: "Mantenimiento",
  BAJA: "Baja",
  TRASPASO: "Traspaso",
}

const estados = Object.entries(estadoLabel)

function DialogFooter({
  loading,
  onCancel,
  submitLabel = "Guardar",
}: {
  loading: boolean
  onCancel: () => void
  submitLabel?: string
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {submitLabel}
      </Button>
    </div>
  )
}

export default function InventarioPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>("activos")

  // Activos
  const [activos, setActivos] = useState<ActivoRow[]>([])
  const [activosLoading, setActivosLoading] = useState(true)
  const [activoSearch, setActivoSearch] = useState("")
  const [activoDialog, setActivoDialog] = useState(false)
  const [editingActivo, setEditingActivo] = useState<ActivoRow | null>(null)
  const [activoSubmitting, setActivoSubmitting] = useState(false)

  // Categorías
  const [categorias, setCategorias] = useState<CategoriaRow[]>([])
  const [categoriasLoading, setCategoriasLoading] = useState(true)
  const [catDialog, setCatDialog] = useState(false)
  const [editingCat, setEditingCat] = useState<CategoriaRow | null>(null)
  const [catSubmitting, setCatSubmitting] = useState(false)

  // Movimientos
  const [movimientos, setMovimientos] = useState<MovimientoRow[]>([])
  const [movimientosLoading, setMovimientosLoading] = useState(true)
  const [movFilterActivoId, setMovFilterActivoId] = useState("")
  const [movDialog, setMovDialog] = useState(false)
  const [movSubmitting, setMovSubmitting] = useState(false)

  // Refs for dialog forms
  const catFormRef = useRef<HTMLFormElement>(null)
  const activoFormRef = useRef<HTMLFormElement>(null)
  const movFormRef = useRef<HTMLFormElement>(null)

  // ----- Fetch helpers -----
  const fetchActivos = useCallback(async () => {
    setActivosLoading(true)
    try {
      setActivos((await getActivos()) as unknown as ActivoRow[])
    } catch (err: any) {
      toast({ title: "Error al cargar activos", description: err?.message, variant: "destructive" })
    } finally {
      setActivosLoading(false)
    }
  }, [toast])

  const fetchCategorias = useCallback(async () => {
    setCategoriasLoading(true)
    try {
      setCategorias((await getCategorias()) as unknown as CategoriaRow[])
    } catch (err: any) {
      toast({ title: "Error al cargar categorías", description: err?.message, variant: "destructive" })
    } finally {
      setCategoriasLoading(false)
    }
  }, [toast])

  const fetchMovimientos = useCallback(async () => {
    setMovimientosLoading(true)
    try {
      setMovimientos((await getMovimientos(movFilterActivoId || undefined)) as unknown as MovimientoRow[])
    } catch (err: any) {
      toast({ title: "Error al cargar movimientos", description: err?.message, variant: "destructive" })
    } finally {
      setMovimientosLoading(false)
    }
  }, [movFilterActivoId, toast])

  useEffect(() => {
    fetchActivos()
    fetchCategorias()
    fetchMovimientos()
  }, [fetchActivos, fetchCategorias, fetchMovimientos])

  // ----- Filtered data -----
  const filteredActivos = activos.filter((a) => {
    if (!activoSearch) return true
    const q = activoSearch.toLowerCase()
    return (
      a.codigo.toLowerCase().includes(q) ||
      a.nombre.toLowerCase().includes(q) ||
      (a.marca ?? "").toLowerCase().includes(q)
    )
  })

  // ============================================================
  // COLUMNAS
  // ============================================================

  const activoColumns: Column<ActivoRow>[] = [
    { key: "codigo", header: "Código" },
    { key: "nombre", header: "Nombre" },
    {
      key: "categoria",
      header: "Categoría",
      render: (item) => item.categoria?.nombre ?? "—",
    },
    { key: "marca", header: "Marca", render: (item) => item.marca ?? "—" },
    {
      key: "valorActual",
      header: "Valor actual",
      render: (item) =>
        item.valorActual != null ? formatMoney(Number(item.valorActual)) : "—",
    },
    {
      key: "estado",
      header: "Estado",
      render: (item) => (
        <Badge variant={estadoBadge[item.estado] ?? "outline"}>
          {estadoLabel[item.estado] ?? item.estado}
        </Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[100px] text-right",
      render: (item) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openActivoDialog(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (confirm("¿Eliminar este activo?")) {
                try {
                  await deleteActivo(item.id)
                  fetchActivos()
                  toast({ title: "Activo eliminado", variant: "success" })
                } catch (err: any) {
                  toast({ title: "Error al eliminar activo", description: err?.message, variant: "destructive" })
                }
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  const catColumns: Column<CategoriaRow>[] = [
    { key: "nombre", header: "Nombre" },
    {
      key: "descripcion",
      header: "Descripción",
      render: (item) => item.descripcion ?? "—",
    },
    {
      key: "activos",
      header: "Activos",
      render: (item) => item._count.activos,
    },
    {
      key: "activo",
      header: "Estado",
      render: (item) => (
        <Badge variant={item.activo ? "success" : "destructive"}>
          {item.activo ? "Activa" : "Inactiva"}
        </Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[140px] text-right",
      render: (item) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => openCatDialog(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              try {
                await toggleCategoria(item.id)
                fetchCategorias()
                toast({ title: "Estado de categoría actualizado", variant: "success" })
              } catch (err: any) {
                toast({ title: "Error al cambiar estado", description: err?.message, variant: "destructive" })
              }
            }}
          >
            {item.activo ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4 text-green-500" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (confirm("¿Eliminar esta categoría?")) {
                try {
                  await deleteCategoria(item.id)
                  fetchCategorias()
                  toast({ title: "Categoría eliminada", variant: "success" })
                } catch (err: any) {
                  toast({ title: "Error al eliminar categoría", description: err?.message, variant: "destructive" })
                }
              }
            }}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  const movColumns: Column<MovimientoRow>[] = [
    {
      key: "activo",
      header: "Activo",
      render: (item) => `${item.activo.codigo} - ${item.activo.nombre}`,
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (item) => (
        <Badge variant={tipoBadge[item.tipo] ?? "outline"}>
          {tipoLabel[item.tipo] ?? item.tipo}
        </Badge>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      render: (item) => formatDate(item.fecha),
    },
    {
      key: "responsable",
      header: "Responsable",
      render: (item) => {
        if (!item.responsable) return "—"
        return `${item.responsable.nombre} ${item.responsable.apellido ?? ""}`.trim()
      },
    },
    {
      key: "observaciones",
      header: "Observaciones",
      render: (item) => item.observaciones ?? "—",
    },
  ]

  // ============================================================
  // DIALOG HANDLERS
  // ============================================================

  // --- Categoría ---
  function openCatDialog(cat: CategoriaRow | null = null) {
    setEditingCat(cat)
    setCatDialog(true)
  }

  async function handleCatSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setCatSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (editingCat) {
        await updateCategoria(editingCat.id, fd)
      } else {
        await createCategoria(fd)
      }
      closeCatDialog()
      fetchCategorias()
      toast({ title: editingCat ? "Categoría actualizada" : "Categoría creada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar categoría", description: err?.message, variant: "destructive" })
    } finally {
      setCatSubmitting(false)
    }
  }

  function closeCatDialog() {
    setCatDialog(false)
    setEditingCat(null)
  }

  // --- Activo ---
  function openActivoDialog(activo: ActivoRow | null = null) {
    setEditingActivo(activo)
    setActivoDialog(true)
  }

  async function handleActivoSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setActivoSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (editingActivo) {
        await updateActivo(editingActivo.id, fd)
      } else {
        await createActivo(fd)
      }
      closeActivoDialog()
      fetchActivos()
      toast({ title: editingActivo ? "Activo actualizado" : "Activo creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar activo", description: err?.message, variant: "destructive" })
    } finally {
      setActivoSubmitting(false)
    }
  }

  function closeActivoDialog() {
    setActivoDialog(false)
    setEditingActivo(null)
  }

  // --- Movimiento ---
  async function handleMovSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setMovSubmitting(true)
    try {
      const fd = new FormData(e.currentTarget)
      await createMovimiento(fd)
      setMovDialog(false)
      fetchActivos()
      fetchMovimientos()
      toast({ title: "Movimiento creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al crear movimiento", description: err?.message, variant: "destructive" })
    } finally {
      setMovSubmitting(false)
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario"
        description="Control de activos y suministros"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {[
          { id: "activos" as Tab, label: "Activos" },
          { id: "categorias" as Tab, label: "Categorías" },
          { id: "movimientos" as Tab, label: "Movimientos" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px cursor-pointer ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===== TAB: ACTIVOS ===== */}
      {tab === "activos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Input
              placeholder="Buscar por código, nombre o marca..."
              value={activoSearch}
              onChange={(e) => setActivoSearch(e.target.value)}
              className="max-w-sm"
            />
            <Button onClick={() => openActivoDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo activo
            </Button>
          </div>
          <DataTable
            columns={activoColumns}
            data={filteredActivos}
            loading={activosLoading}
          />
        </div>
      )}

      {/* ===== TAB: CATEGORÍAS ===== */}
      {tab === "categorias" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => openCatDialog()}>
              <Plus className="mr-2 h-4 w-4" /> Nueva categoría
            </Button>
          </div>
          <DataTable
            columns={catColumns}
            data={categorias}
            loading={categoriasLoading}
          />
        </div>
      )}

      {/* ===== TAB: MOVIMIENTOS ===== */}
      {tab === "movimientos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="mov-filter" className="text-sm whitespace-nowrap">
                Filtrar por activo:
              </Label>
              <select
                id="mov-filter"
                value={movFilterActivoId}
                onChange={(e) => setMovFilterActivoId(e.target.value)}
                className="flex h-9 w-[280px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">Todos los activos</option>
                {activos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.codigo} - {a.nombre}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={() => setMovDialog(true)}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
            </Button>
          </div>
          <DataTable
            columns={movColumns}
            data={movimientos}
            loading={movimientosLoading}
          />
        </div>
      )}

      {/* ================================================================ */}
      {/* DIALOG: CATEGORÍA */}
      {/* ================================================================ */}
      <Dialog open={catDialog} onOpenChange={(v) => { if (!v) closeCatDialog() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          <form ref={catFormRef} onSubmit={handleCatSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cat-nombre">Nombre</Label>
                <Input
                  id="cat-nombre"
                  name="nombre"
                  defaultValue={editingCat?.nombre ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cat-desc">Descripción</Label>
                <Input
                  id="cat-desc"
                  name="descripcion"
                  defaultValue={editingCat?.descripcion ?? ""}
                />
              </div>
            </div>
            <DialogFooter
              loading={catSubmitting}
              onCancel={closeCatDialog}
              submitLabel={editingCat ? "Actualizar" : "Crear"}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DIALOG: ACTIVO */}
      {/* ================================================================ */}
      <Dialog open={activoDialog} onOpenChange={(v) => { if (!v) closeActivoDialog() }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingActivo ? "Editar activo" : "Nuevo activo"}</DialogTitle>
          </DialogHeader>
          <form ref={activoFormRef} onSubmit={handleActivoSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="act-nombre">Nombre *</Label>
                <Input
                  id="act-nombre"
                  name="nombre"
                  defaultValue={editingActivo?.nombre ?? ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-categoria">Categoría</Label>
                <select
                  id="act-categoria"
                  name="categoriaId"
                  defaultValue={editingActivo?.categoria?.id ?? ""}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Sin categoría</option>
                  {categorias
                    .filter((c) => c.activo)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-marca">Marca</Label>
                <Input
                  id="act-marca"
                  name="marca"
                  defaultValue={editingActivo?.marca ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-modelo">Modelo</Label>
                <Input
                  id="act-modelo"
                  name="modelo"
                  defaultValue={editingActivo?.modelo ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-serie">N° Serie</Label>
                <Input
                  id="act-serie"
                  name="numeroSerie"
                  defaultValue={editingActivo?.numeroSerie ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-ubicacion">Ubicación</Label>
                <Input
                  id="act-ubicacion"
                  name="ubicacion"
                  defaultValue={editingActivo?.ubicacion ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-fecha">Fecha adquisición</Label>
                <Input
                  id="act-fecha"
                  name="fechaAdquisicion"
                  type="date"
                  defaultValue={
                    editingActivo?.fechaAdquisicion
                      ? new Date(editingActivo.fechaAdquisicion).toISOString().split("T")[0]
                      : ""
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-valor-adq">Valor adquisición</Label>
                <Input
                  id="act-valor-adq"
                  name="valorAdquisicion"
                  type="number"
                  step="0.01"
                  defaultValue={editingActivo?.valorAdquisicion?.toString() ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-valor-act">Valor actual</Label>
                <Input
                  id="act-valor-act"
                  name="valorActual"
                  type="number"
                  step="0.01"
                  defaultValue={editingActivo?.valorActual?.toString() ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-desc">Descripción</Label>
                <Input
                  id="act-desc"
                  name="descripcion"
                  defaultValue={editingActivo?.descripcion ?? ""}
                />
              </div>
              {editingActivo && (
                <div className="space-y-2">
                  <Label htmlFor="act-estado">Estado</Label>
                  <select
                    id="act-estado"
                    name="estado"
                    defaultValue={editingActivo.estado}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    {estados.map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter
              loading={activoSubmitting}
              onCancel={closeActivoDialog}
              submitLabel={editingActivo ? "Actualizar" : "Crear"}
            />
          </form>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* DIALOG: MOVIMIENTO */}
      {/* ================================================================ */}
      <Dialog open={movDialog} onOpenChange={setMovDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo movimiento</DialogTitle>
          </DialogHeader>
          <form ref={movFormRef} onSubmit={handleMovSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mov-activo">Activo *</Label>
                <select
                  id="mov-activo"
                  name="activoId"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Seleccionar activo...</option>
                  {activos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.codigo} - {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-tipo">Tipo *</Label>
                <select
                  id="mov-tipo"
                  name="tipo"
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="">Seleccionar tipo...</option>
                  {Object.entries(tipoLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-fecha">Fecha</Label>
                <Input
                  id="mov-fecha"
                  name="fecha"
                  type="date"
                  defaultValue={new Date().toISOString().split("T")[0]}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mov-obs">Observaciones</Label>
                <Input id="mov-obs" name="observaciones" />
              </div>
            </div>
            <DialogFooter
              loading={movSubmitting}
              onCancel={() => setMovDialog(false)}
              submitLabel="Crear"
            />
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
