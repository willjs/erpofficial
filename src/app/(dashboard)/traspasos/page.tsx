"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus, Pencil, Trash2, Eye, CheckCircle,
} from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  getTraspasos, getTraspaso, createTraspaso, updateTraspaso,
  cambiarEstadoTraspaso, completarTraspaso, deleteTraspaso,
  type TraspasoFormData,
} from "@/actions/traspasos"
import { getAlmacenes } from "@/actions/inventarios"

interface TraspasoRow {
  id: string
  numero: number
  fecha: string
  estado: string
  almacenOrigen: { id: string; nombre: string }
  almacenDestino: { id: string; nombre: string }
  _count: { items: number }
}

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  BORRADOR: "secondary",
  EN_TRANSITO: "warning",
  COMPLETADO: "success",
  CANCELADO: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  EN_TRANSITO: "En Tránsito",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
}

export default function TraspasosPage() {
  const { toast } = useToast()

  const [traspasos, setTraspasos] = useState<TraspasoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [almacenes, setAlmacenes] = useState<{ id: string; nombre: string }[]>([])
  const [formItems, setFormItems] = useState<any[]>([{ descripcion: "", unidadMedida: "UNIDAD", cantidad: 1 }])

  const loadTraspasos = useCallback(async () => {
    try {
      const data = await getTraspasos()
      setTraspasos(data as unknown as TraspasoRow[])
    } catch {
      toast({ title: "Error al cargar traspasos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadReferencias = useCallback(async () => {
    try {
      const data = await getAlmacenes()
      setAlmacenes(data.map((a: any) => ({ id: a.id, nombre: a.nombre })))
    } catch {
      toast({ title: "Error al cargar almacenes", variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    setLoading(true)
    loadTraspasos()
    loadReferencias()
  }, [loadTraspasos, loadReferencias])

  const filtered = useMemo(() => {
    if (!search) return traspasos
    const q = search.toLowerCase()
    return traspasos.filter(
      (t) =>
        `TRA-${t.numero}`.includes(q) ||
        t.almacenOrigen.nombre.toLowerCase().includes(q) ||
        t.almacenDestino.nombre.toLowerCase().includes(q) ||
        ESTADO_LABELS[t.estado]?.toLowerCase().includes(q)
    )
  }, [traspasos, search])

  const handleItemChange = (i: number, field: string, value: any) => {
    const newItems = [...formItems]
    newItems[i] = { ...newItems[i], [field]: value }
    setFormItems(newItems)
  }

  const addItem = () => {
    setFormItems([...formItems, { descripcion: "", unidadMedida: "UNIDAD", cantidad: 1 }])
  }

  const openCreate = () => {
    setEditingId(null)
    setFormItems([{ descripcion: "", unidadMedida: "UNIDAD", cantidad: 1 }])
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    setEditingId(id)
    try {
      const data = await getTraspaso(id)
      if (data) {
        setFormItems(data.items.map((item: any) => ({
          descripcion: item.descripcion,
          unidadMedida: item.unidadMedida,
          cantidad: Number(item.cantidad),
        })))
        setDialogOpen(true)
      }
    } catch {
      toast({ title: "Error al cargar traspaso", variant: "destructive" })
    }
  }

  const openDetail = async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      const data = await getTraspaso(id)
      setDetail(data)
    } catch {
      toast({ title: "Error al cargar traspaso", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData(e.currentTarget)
      const data: TraspasoFormData = {
        almacenOrigenId: fd.get("almacenOrigenId") as string,
        almacenDestinoId: fd.get("almacenDestinoId") as string,
        fecha: fd.get("fecha") as string,
        notas: fd.get("notas") as string,
        items: formItems,
      }
      if (editingId) {
        await updateTraspaso(editingId, data)
        toast({ title: "Traspaso actualizado", variant: "success" })
      } else {
        await createTraspaso(data)
        toast({ title: "Traspaso creado", variant: "success" })
      }
      setDialogOpen(false)
      setEditingId(null)
      await loadTraspasos()
    } catch (err: any) {
      toast({ title: err?.message || "Error al guardar traspaso", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleCompletar = async (id: string) => {
    try {
      await completarTraspaso(id)
      toast({ title: "Traspaso completado. Inventario actualizado.", variant: "success" })
      await loadTraspasos()
    } catch {
      toast({ title: "Error al completar traspaso", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteTraspaso(deleteTarget)
      toast({ title: "Traspaso eliminado", variant: "success" })
      setDeleteTarget(null)
      await loadTraspasos()
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: Column<TraspasoRow>[] = [
    { key: "numero", header: "N°", render: (t) => `TRA-${t.numero}` },
    { key: "fecha", header: "Fecha", render: (t) => formatDate(t.fecha) },
    {
      key: "origen", header: "Origen", render: (t) => t.almacenOrigen.nombre,
    },
    {
      key: "destino", header: "Destino", render: (t) => t.almacenDestino.nombre,
    },
    {
      key: "estado", header: "Estado", render: (t) => (
        <Badge variant={ESTADO_STYLES[t.estado] || "secondary"}>
          {ESTADO_LABELS[t.estado] || t.estado}
        </Badge>
      ),
    },
    {
      key: "acciones", header: "", className: "w-[180px]",
      render: (t) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => openDetail(t.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          {(t.estado === "BORRADOR" || t.estado === "EN_TRANSITO") && (
            <Button variant="ghost" size="icon" title="Completar (actualiza inventario)" onClick={() => handleCompletar(t.id)}>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {t.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(t.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleteTarget(t.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Traspasos"
        description="Transferencia de inventario entre almacenes"
      />

      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Traspaso
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar por número, almacén o estado..."
        searchTerm={search}
        onSearch={setSearch}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditingId(null) }}
        title={editingId ? "Editar Traspaso" : "Nuevo Traspaso"}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editingId ? "Actualizar" : "Crear"}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="almacenOrigenId">Almacén Origen *</Label>
            <Select name="almacenOrigenId" required defaultValue="">
              <SelectTrigger><SelectValue placeholder="Selecciona origen..." /></SelectTrigger>
              <SelectContent>
                {almacenes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="almacenDestinoId">Almacén Destino *</Label>
            <Select name="almacenDestinoId" required defaultValue="">
              <SelectTrigger><SelectValue placeholder="Selecciona destino..." /></SelectTrigger>
              <SelectContent>
                {almacenes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Input id="notas" name="notas" />
          </div>

          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> Agregar Item
              </Button>
            </div>
            {formItems.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md">
                <div className="col-span-5 space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input value={item.descripcion} onChange={(e) => handleItemChange(i, "descripcion", e.target.value)} placeholder="Descripción" required />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">UM</Label>
                  <Input value={item.unidadMedida} onChange={(e) => handleItemChange(i, "unidadMedida", e.target.value)} />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" value={item.cantidad} onChange={(e) => handleItemChange(i, "cantidad", Number(e.target.value))} min={0.01} step={0.01} required />
                </div>
              </div>
            ))}
          </div>
        </div>
      </FormDialog>

      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Detalle del Traspaso</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>N°:</strong> TRA-{detail.numero}</div>
                <div><strong>Fecha:</strong> {formatDate(detail.fecha)}</div>
                <div><strong>Origen:</strong> {detail.almacenOrigen?.nombre}</div>
                <div><strong>Destino:</strong> {detail.almacenDestino?.nombre}</div>
                <div><strong>Estado:</strong> <Badge variant={ESTADO_STYLES[detail.estado]}>{ESTADO_LABELS[detail.estado]}</Badge></div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">#</th>
                    <th className="text-left py-1">Descripción</th>
                    <th className="text-left py-1">UM</th>
                    <th className="text-right py-1">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-1">{item.item}</td>
                      <td className="py-1">{item.descripcion}</td>
                      <td className="py-1">{item.unidadMedida}</td>
                      <td className="text-right py-1">{Number(item.cantidad)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detail.notas && <p className="text-sm text-muted-foreground"><strong>Notas:</strong> {detail.notas}</p>}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de eliminar este traspaso? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteLoading} onClick={handleDelete}>
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
