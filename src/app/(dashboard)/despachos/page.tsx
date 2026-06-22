"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  Plus, Pencil, Trash2, Eye, Truck, Package, CheckCircle,
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
  getDespachos, getDespacho, createDespacho, updateDespacho,
  cambiarEstadoDespacho, deleteDespacho,
  type DespachoFormData,
} from "@/actions/despachos"
import { getAlmacenes } from "@/actions/inventarios"

interface DespachoRow {
  id: string
  numero: number
  fecha: string
  estado: string
  pedido: { id: string; numero: number } | null
  almacen: { id: string; nombre: string }
  _count: { items: number }
}

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "default" | "destructive"> = {
  BORRADOR: "secondary",
  PREPARADO: "info",
  ENVIADO: "warning",
  ENTREGADO: "success",
  CANCELADO: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  PREPARADO: "Preparado",
  ENVIADO: "Enviado",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
}

export default function DespachosPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [despachos, setDespachos] = useState<DespachoRow[]>([])
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
  const [pedidoIdFromUrl, setPedidoIdFromUrl] = useState("")

  const [almacenes, setAlmacenes] = useState<{ id: string; nombre: string }[]>([])
  const [formItems, setFormItems] = useState<any[]>([{ descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, lote: "" }])

  const loadDespachos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDespachos()
      setDespachos(data as unknown as DespachoRow[])
    } catch {
      toast({ title: "Error al cargar despachos", variant: "destructive" })
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
    loadDespachos()
    loadReferencias()
    const pid = searchParams.get("pedidoId")
    if (pid) {
      setPedidoIdFromUrl(pid)
      setDialogOpen(true)
    }
  }, [loadDespachos, loadReferencias, searchParams])

  const filtered = useMemo(() => {
    if (!search) return despachos
    const q = search.toLowerCase()
    return despachos.filter(
      (d) =>
        `DES-${d.numero}`.includes(q) ||
        d.almacen.nombre.toLowerCase().includes(q) ||
        ESTADO_LABELS[d.estado]?.toLowerCase().includes(q)
    )
  }, [despachos, search])

  const handleItemChange = (i: number, field: string, value: any) => {
    const newItems = [...formItems]
    newItems[i] = { ...newItems[i], [field]: value }
    setFormItems(newItems)
  }

  const addItem = () => {
    setFormItems([...formItems, { descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, lote: "" }])
  }

  const removeItem = (i: number) => {
    if (formItems.length <= 1) return
    setFormItems(formItems.filter((_, idx) => idx !== i))
  }

  const openCreate = () => {
    setEditingId(null)
    setFormItems([{ descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, lote: "" }])
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    setEditingId(id)
    try {
      const data = await getDespacho(id)
      if (data) {
        setFormItems(data.items.map((item: any) => ({
          descripcion: item.descripcion,
          unidadMedida: item.unidadMedida,
          cantidad: Number(item.cantidad),
          lote: item.lote || "",
        })))
        setDialogOpen(true)
      }
    } catch {
      toast({ title: "Error al cargar despacho", variant: "destructive" })
    }
  }

  const openDetail = async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      const data = await getDespacho(id)
      setDetail(data)
    } catch {
      toast({ title: "Error al cargar despacho", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData(e.currentTarget)
      const data: DespachoFormData = {
        pedidoId: fd.get("pedidoId") as string || "",
        almacenId: fd.get("almacenId") as string,
        fecha: fd.get("fecha") as string,
        destino: fd.get("destino") as string,
        notas: fd.get("notas") as string,
        items: formItems,
      }
      if (editingId) {
        await updateDespacho(editingId, data)
        toast({ title: "Despacho actualizado", variant: "success" })
      } else {
        await createDespacho(data)
        toast({ title: "Despacho creado", variant: "success" })
      }
      setDialogOpen(false)
      setEditingId(null)
      await loadDespachos()
    } catch {
      toast({ title: "Error al guardar despacho", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEstadoChange = async (id: string, estado: string) => {
    try {
      await cambiarEstadoDespacho(id, estado)
      toast({ title: `Despacho ${ESTADO_LABELS[estado]?.toLowerCase()}`, variant: "success" })
      await loadDespachos()
    } catch {
      toast({ title: "Error al cambiar estado", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteDespacho(deleteTarget)
      toast({ title: "Despacho eliminado", variant: "success" })
      setDeleteTarget(null)
      await loadDespachos()
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  const columns: Column<DespachoRow>[] = [
    { key: "numero", header: "N°", render: (d) => `DES-${d.numero}` },
    { key: "fecha", header: "Fecha", render: (d) => formatDate(d.fecha) },
    { key: "almacen", header: "Almacén", render: (d) => d.almacen.nombre },
    {
      key: "pedido", header: "Pedido", render: (d) =>
        d.pedido ? `PED-${d.pedido.numero}` : "—",
    },
    {
      key: "estado", header: "Estado", render: (d) => (
        <Badge variant={ESTADO_STYLES[d.estado] || "secondary"}>
          {ESTADO_LABELS[d.estado] || d.estado}
        </Badge>
      ),
    },
    {
      key: "acciones", header: "", className: "w-[180px]",
      render: (d) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => openDetail(d.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          {d.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" title="Preparar" onClick={() => handleEstadoChange(d.id, "PREPARADO")}>
                <Package className="h-4 w-4 text-blue-600" />
              </Button>
            </>
          )}
          {d.estado === "PREPARADO" && (
            <Button variant="ghost" size="icon" title="Enviar" onClick={() => handleEstadoChange(d.id, "ENVIADO")}>
              <Truck className="h-4 w-4 text-amber-600" />
            </Button>
          )}
          {d.estado === "ENVIADO" && (
            <Button variant="ghost" size="icon" title="Entregar" onClick={() => handleEstadoChange(d.id, "ENTREGADO")}>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </Button>
          )}
          {d.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(d.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleteTarget(d.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {(d.estado === "PREPARADO" || d.estado === "ENVIADO") && (
            <Button variant="ghost" size="icon" title="Cancelar" onClick={() => handleEstadoChange(d.id, "CANCELADO")}>
              <Trash2 className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Despachos" description="Gestión de envíos y despachos a clientes" />

      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Despacho
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
        onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setPedidoIdFromUrl("") } }}
        title={editingId ? "Editar Despacho" : "Nuevo Despacho"}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editingId ? "Actualizar" : "Crear"}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="almacenId">Almacén *</Label>
            <Select name="almacenId" required defaultValue="">
              <SelectTrigger><SelectValue placeholder="Selecciona un almacén..." /></SelectTrigger>
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
            <Label htmlFor="destino">Destino</Label>
            <Input id="destino" name="destino" placeholder="Dirección de entrega" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pedidoId">Pedido relacionado</Label>
            <Input id="pedidoId" name="pedidoId" placeholder="ID del pedido (opcional)" defaultValue={pedidoIdFromUrl} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label htmlFor="notas">Notas</Label>
            <textarea id="notas" name="notas" rows={2} className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm" />
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
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Descripción</Label>
                  <Input value={item.descripcion} onChange={(e) => handleItemChange(i, "descripcion", e.target.value)} placeholder="Descripción" required />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">UM</Label>
                  <Input value={item.unidadMedida} onChange={(e) => handleItemChange(i, "unidadMedida", e.target.value)} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" value={item.cantidad} onChange={(e) => handleItemChange(i, "cantidad", Number(e.target.value))} min={0.01} step={0.01} required />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Lote</Label>
                  <Input value={item.lote} onChange={(e) => handleItemChange(i, "lote", e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </FormDialog>

      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Detalle del Despacho</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>N°:</strong> DES-{detail.numero}</div>
                <div><strong>Fecha:</strong> {formatDate(detail.fecha)}</div>
                <div><strong>Almacén:</strong> {detail.almacen?.nombre}</div>
                <div><strong>Estado:</strong> <Badge variant={ESTADO_STYLES[detail.estado]}>{ESTADO_LABELS[detail.estado]}</Badge></div>
                {detail.destino && <div className="col-span-2"><strong>Destino:</strong> {detail.destino}</div>}
                {detail.pedido && <div><strong>Pedido:</strong> PED-{detail.pedido.numero}</div>}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">#</th>
                    <th className="text-left py-1">Descripción</th>
                    <th className="text-right py-1">Cant</th>
                    <th className="text-left py-1">Lote</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-1">{item.item}</td>
                      <td className="py-1">{item.descripcion}</td>
                      <td className="text-right py-1">{Number(item.cantidad)}</td>
                      <td className="py-1">{item.lote || "—"}</td>
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
            <DialogDescription>¿Estás seguro de eliminar este despacho? Esta acción no se puede deshacer.</DialogDescription>
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
