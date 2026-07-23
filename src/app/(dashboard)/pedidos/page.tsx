"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Pencil, Trash2, CheckCircle, XCircle, Eye, Send, FileText,
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
import { formatMoney, formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  getPedidos, getPedido, createPedido, updatePedido,
  cambiarEstadoPedido, deletePedido,
  type PedidoFormData, getProductosCatalogo,
} from "@/actions/pedidos"
import { getClientes } from "@/actions/clientes"

interface PedidoRow {
  id: string
  numero: number
  fecha: string
  cliente: { id: string; nombre: string }
  estado: string
  total: number
  _count: { items: number; ventas: number; despachos: number }
}

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  BORRADOR: "secondary",
  CONFIRMADO: "info",
  EN_DESPACHO: "warning",
  COMPLETADO: "success",
  CANCELADO: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  CONFIRMADO: "Confirmado",
  EN_DESPACHO: "En Despacho",
  COMPLETADO: "Completado",
  CANCELADO: "Cancelado",
}

const SIGUIENTE_ESTADO: Record<string, string[]> = {
  BORRADOR: ["CONFIRMADO"],
  CONFIRMADO: ["EN_DESPACHO", "CANCELADO"],
  EN_DESPACHO: ["COMPLETADO", "CANCELADO"],
  COMPLETADO: [],
  CANCELADO: [],
}

export default function PedidosPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [pedidos, setPedidos] = useState<PedidoRow[]>([])
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

  const [clientes, setClientes] = useState<{ id: string; nombre: string }[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [formItems, setFormItems] = useState<any[]>([{ productoId: "none", tipoItem: "PRODUCTO", descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, precioUnitario: 0, descuento: 0, subtotal: 0, impuesto: 0, total: 0 }])

  // ─── Product picker popup ──────────────────────────
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState("")
  const [pickerTipo, setPickerTipo] = useState<"PRODUCTO" | "SERVICIO">("PRODUCTO")
  const [pickerCantidad, setPickerCantidad] = useState(1)
  const [pickerDescuento, setPickerDescuento] = useState(0)
  const [pickerSelected, setPickerSelected] = useState<any>(null)

  const loadPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPedidos()
      setPedidos(data as unknown as PedidoRow[])
    } catch {
      toast({ title: "Error al cargar pedidos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadReferencias = useCallback(async () => {
    try {
      const [clientsData, prodsData] = await Promise.all([
        getClientes(),
        getProductosCatalogo(),
      ])
      setClientes(clientsData.map((c: any) => ({ id: c.id, nombre: c.nombre })))
      setProductos(prodsData)
    } catch {
      toast({ title: "Error al cargar referencias", variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    loadPedidos()
    loadReferencias()
  }, [loadPedidos, loadReferencias])

  const filtered = useMemo(() => {
    if (!search) return pedidos
    const q = search.toLowerCase()
    return pedidos.filter(
      (p) =>
        `PED-${p.numero}`.includes(q) ||
        p.cliente.nombre.toLowerCase().includes(q) ||
        ESTADO_LABELS[p.estado]?.toLowerCase().includes(q)
    )
  }, [pedidos, search])

  const recalcItem = (items: any[]) =>
    items.map((item) => {
      const subtotal = item.cantidad * item.precioUnitario
      const descuento = item.descuento || 0
      const base = subtotal - descuento
      const impuesto = base * 0.19
      const total = base + impuesto
      return { ...item, subtotal, impuesto, total }
    })

  const handleItemChange = (i: number, field: string, value: any) => {
    const newItems = [...formItems]
    newItems[i] = { ...newItems[i], [field]: value }
    setFormItems(recalcItem(newItems))
  }

  const addItem = () => {
    setPickerSearch("")
    setPickerTipo("PRODUCTO")
    setPickerCantidad(1)
    setPickerDescuento(0)
    setPickerSelected(null)
    setPickerOpen(true)
  }

  const confirmPickerItem = () => {
    if (pickerTipo === "SERVICIO") {
      const newItem = {
        productoId: "none",
        tipoItem: "SERVICIO",
        descripcion: "",
        unidadMedida: "UNIDAD",
        cantidad: pickerCantidad,
        precioUnitario: 0,
        descuento: pickerDescuento,
        subtotal: 0,
        impuesto: 0,
        total: 0,
      }
      setFormItems(recalcItem([...formItems, newItem]))
    } else if (pickerSelected) {
      const newItem = {
        productoId: pickerSelected.id,
        tipoItem: "PRODUCTO",
        descripcion: pickerSelected.nombre,
        unidadMedida: pickerSelected.unidadMedida || "UNIDAD",
        cantidad: pickerCantidad,
        precioUnitario: pickerSelected.precioUnitario || 0,
        descuento: pickerDescuento,
        subtotal: 0,
        impuesto: 0,
        total: 0,
      }
      setFormItems(recalcItem([...formItems, newItem]))
    }
    setPickerOpen(false)
  }

  const filteredProductos = useMemo(() => {
    if (!pickerSearch) return productos
    const q = pickerSearch.toLowerCase()
    return productos.filter(
      (p) => p.codigo?.toLowerCase().includes(q) || p.nombre?.toLowerCase().includes(q)
    )
  }, [productos, pickerSearch])

  const removeItem = (i: number) => {
    if (formItems.length <= 1) return
    setFormItems(formItems.filter((_, idx) => idx !== i))
  }

  const openCreate = () => {
    setEditingId(null)
    setFormItems([{ productoId: "none", tipoItem: "PRODUCTO", descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, precioUnitario: 0, descuento: 0, subtotal: 0, impuesto: 0, total: 0 }])
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    setEditingId(id)
    try {
      const data = await getPedido(id)
      if (data) {
        setFormItems(
          data.items.map((item: any) => {
            const prod = productos.find((p) => p.nombre === item.descripcion)
            return {
              productoId: prod?.id ?? "none",
              tipoItem: item.tipoItem ?? "PRODUCTO",
              descripcion: item.descripcion,
              unidadMedida: item.unidadMedida,
              cantidad: Number(item.cantidad),
              precioUnitario: Number(item.precioUnitario),
              descuento: Number(item.descuento),
              subtotal: Number(item.subtotal),
              impuesto: Number(item.impuesto),
              total: Number(item.total),
            }
          })
        )
        setDialogOpen(true)
      }
    } catch {
      toast({ title: "Error al cargar pedido", variant: "destructive" })
    }
  }

  const openDetail = async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      const data = await getPedido(id)
      setDetail(data)
    } catch {
      toast({ title: "Error al cargar pedido", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData(e.currentTarget)
      const data: PedidoFormData = {
        clienteId: fd.get("clienteId") as string,
        fecha: fd.get("fecha") as string,
        notas: fd.get("notas") as string,
        items: formItems,
      }
      if (editingId) {
        await updatePedido(editingId, data)
        toast({ title: "Pedido actualizado", variant: "success" })
      } else {
        await createPedido(data)
        toast({ title: "Pedido creado", variant: "success" })
      }
      setDialogOpen(false)
      setEditingId(null)
      await loadPedidos()
    } catch {
      toast({ title: "Error al guardar pedido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEstadoChange = async (id: string, estado: string) => {
    try {
      await cambiarEstadoPedido(id, estado)
      toast({ title: `Pedido ${ESTADO_LABELS[estado]?.toLowerCase()}`, variant: "success" })
      await loadPedidos()
    } catch {
      toast({ title: "Error al cambiar estado", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deletePedido(deleteTarget)
      toast({ title: "Pedido eliminado", variant: "success" })
      setDeleteTarget(null)
      await loadPedidos()
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  const totals = useMemo(() => {
    return formItems.reduce(
      (acc, item) => ({
        subtotal: acc.subtotal + (item.subtotal || 0),
        descuento: acc.descuento + (item.descuento || 0),
        impuesto: acc.impuesto + (item.impuesto || 0),
        total: acc.total + (item.total || 0),
      }),
      { subtotal: 0, descuento: 0, impuesto: 0, total: 0 }
    )
  }, [formItems])

  const columns: Column<PedidoRow>[] = [
    { key: "numero", header: "N°", render: (p) => `PED-${p.numero}` },
    {
      key: "fecha", header: "Fecha", render: (p) => formatDate(p.fecha),
    },
    { key: "cliente", header: "Cliente", render: (p) => p.cliente.nombre },
    {
      key: "total", header: "Total", render: (p) => formatMoney(p.total),
    },
    {
      key: "estado", header: "Estado",
      render: (p) => (
        <Badge variant={ESTADO_STYLES[p.estado] || "secondary"}>
          {ESTADO_LABELS[p.estado] || p.estado}
        </Badge>
      ),
    },
    {
      key: "items", header: "Items", render: (p) => p._count.items,
    },
    {
      key: "acciones", header: "", className: "w-[180px]",
      render: (p) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => openDetail(p.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          {SIGUIENTE_ESTADO[p.estado]?.length > 0 && SIGUIENTE_ESTADO[p.estado].map((s) => (
            <Button
              key={s}
              variant="ghost" size="icon"
              title={ESTADO_LABELS[s] || s}
              onClick={() => handleEstadoChange(p.id, s)}
            >
              {s === "CONFIRMADO" && <CheckCircle className="h-4 w-4 text-green-600" />}
              {s === "CANCELADO" && <XCircle className="h-4 w-4 text-red-600" />}
              {s === "EN_DESPACHO" && <span className="text-xs font-bold text-amber-600">D</span>}
              {s === "COMPLETADO" && <CheckCircle className="h-4 w-4 text-blue-600" />}
            </Button>
          ))}
          {p.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(p.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleteTarget(p.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {(p.estado === "CONFIRMADO" || p.estado === "EN_DESPACHO") && (
            <>
              <Button variant="ghost" size="icon" title="Crear Despacho" onClick={() => router.push(`/despachos?pedidoId=${p.id}`)}>
                <Send className="h-4 w-4 text-blue-600" />
              </Button>
              <Button variant="ghost" size="icon" title="Crear Venta" onClick={() => router.push(`/ventas?pedidoId=${p.id}`)}>
                <FileText className="h-4 w-4 text-green-600" />
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
        title="Pedidos"
        description="Gestión de pedidos de clientes"
      />

      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Pedido
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar por número, cliente o estado..."
        searchTerm={search}
        onSearch={setSearch}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingId(null)
        }}
        title={editingId ? "Editar Pedido" : "Nuevo Pedido"}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editingId ? "Actualizar" : "Crear"}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clienteId">Cliente *</Label>
            <Select name="clienteId" required defaultValue="">
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un cliente..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fecha">Fecha *</Label>
            <Input id="fecha" name="fecha" type="date" defaultValue={new Date().toISOString().split("T")[0]} required />
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
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md">
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      value={item.tipoItem}
                      onChange={(e) => handleItemChange(i, "tipoItem", e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm"
                    >
                      <option value="PRODUCTO">Prod</option>
                      <option value="SERVICIO">Serv</option>
                    </select>
                  </div>
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input
                      value={item.descripcion}
                      onChange={(e) => handleItemChange(i, "descripcion", e.target.value)}
                      placeholder="Descripción"
                      required
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">UM</Label>
                    <Input
                      value={item.unidadMedida}
                      onChange={(e) => handleItemChange(i, "unidadMedida", e.target.value)}
                      placeholder="UNIDAD"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">P. Unit</Label>
                    <Input
                      type="number"
                      value={item.precioUnitario}
                      onChange={(e) => handleItemChange(i, "precioUnitario", Number(e.target.value))}
                      min={0}
                      step={0.01}
                      required
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Cant</Label>
                    <Input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => handleItemChange(i, "cantidad", Number(e.target.value))}
                      min={0.01}
                      step={0.01}
                      required
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Dto %</Label>
                    <Input
                      type="number"
                      value={item.descuento}
                      onChange={(e) => handleItemChange(i, "descuento", Number(e.target.value))}
                      min={0}
                      step={0.01}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Subtotal</Label>
                    <Input type="number" value={item.subtotal.toFixed(2)} readOnly className="bg-muted" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Imp</Label>
                    <Input type="number" value={item.impuesto.toFixed(2)} readOnly className="bg-muted" />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Total</Label>
                    <Input type="number" value={item.total.toFixed(2)} readOnly className="bg-muted" />
                  </div>
                  <div className="col-span-1 flex items-end pb-1">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeItem(i)} disabled={formItems.length === 1}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-4 text-sm font-medium pt-2 border-t">
              <span>Subtotal: {formatMoney(totals.subtotal)}</span>
              <span>Dto: {formatMoney(totals.descuento)}</span>
              <span>IVA: {formatMoney(totals.impuesto)}</span>
              <span className="text-lg">Total: {formatMoney(totals.total)}</span>
            </div>
          </div>
        </div>
      </FormDialog>

      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Detalle del Pedido</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>N°:</strong> PED-{detail.numero}</div>
                <div><strong>Fecha:</strong> {formatDate(detail.fecha)}</div>
                <div><strong>Cliente:</strong> {detail.cliente?.nombre}</div>
                <div><strong>Estado:</strong> <Badge variant={ESTADO_STYLES[detail.estado]}>{ESTADO_LABELS[detail.estado]}</Badge></div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">Item</th>
                    <th className="text-left py-1">Tipo</th>
                    <th className="text-left py-1">Descripción</th>
                    <th className="text-right py-1">Cant</th>
                    <th className="text-right py-1">P. Unit</th>
                    <th className="text-right py-1">Dto</th>
                    <th className="text-right py-1">Subtotal</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items?.map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="py-1">{item.item}</td>
                      <td className="py-1"><Badge variant={item.tipoItem === "SERVICIO" ? "secondary" : "default"}>{item.tipoItem ?? "PRODUCTO"}</Badge></td>
                      <td className="py-1">{item.descripcion}</td>
                      <td className="text-right py-1">{Number(item.cantidad)}</td>
                      <td className="text-right py-1">{formatMoney(Number(item.precioUnitario))}</td>
                      <td className="text-right py-1">{formatMoney(Number(item.descuento))}</td>
                      <td className="text-right py-1">{formatMoney(Number(item.subtotal))}</td>
                      <td className="text-right py-1">{formatMoney(Number(item.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end gap-4 text-sm font-medium">
                <span>Subtotal: {formatMoney(Number(detail.subtotal))}</span>
                <span>IVA: {formatMoney(Number(detail.impuesto))}</span>
                <span className="text-base">Total: {formatMoney(Number(detail.total))}</span>
              </div>
              {detail.notas && <p className="text-sm text-muted-foreground"><strong>Notas:</strong> {detail.notas}</p>}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de eliminar este pedido? Esta acción no se puede deshacer.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={deleteLoading} onClick={handleDelete}>
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ PRODUCT PICKER POPUP ═══ */}
      <Dialog open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (!o) setPickerSelected(null) }}>
        <DialogContent className="sm:max-w-[550px] max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Agregar Item al Pedido</DialogTitle>
            <DialogDescription>Selecciona un producto del catálogo o agrega un servicio manualmente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Tipo de item */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={pickerTipo === "PRODUCTO" ? "default" : "outline"}
                size="sm"
                onClick={() => { setPickerTipo("PRODUCTO"); setPickerSelected(null); setPickerSearch("") }}
                className="flex-1"
              >
                Producto del catálogo
              </Button>
              <Button
                type="button"
                variant={pickerTipo === "SERVICIO" ? "default" : "outline"}
                size="sm"
                onClick={() => { setPickerTipo("SERVICIO"); setPickerSelected(null) }}
                className="flex-1"
              >
                Servicio
              </Button>
            </div>

            {/* Buscador de productos */}
            {pickerTipo === "PRODUCTO" && (
              <>
                <Input
                  placeholder="Buscar por código o nombre..."
                  value={pickerSearch}
                  onChange={(e) => { setPickerSearch(e.target.value); setPickerSelected(null) }}
                  autoFocus
                />
                <div className="border rounded-md overflow-y-auto max-h-[300px] flex-1">
                  {filteredProductos.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No se encontraron productos
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-background">
                        <tr className="border-b text-muted-foreground">
                          <th className="text-left py-2 px-3">Código</th>
                          <th className="text-left py-2 px-3">Nombre</th>
                          <th className="text-left py-2 px-3">UM</th>
                          <th className="text-right py-2 px-3">Precio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProductos.map((p) => (
                          <tr
                            key={p.id}
                            className={`border-b cursor-pointer transition-colors ${
                              pickerSelected?.id === p.id
                                ? "bg-primary/10 border-primary"
                                : "hover:bg-muted/50"
                            }`}
                            onClick={() => setPickerSelected(p)}
                          >
                            <td className="py-2 px-3 font-mono text-xs">{p.codigo}</td>
                            <td className="py-2 px-3">{p.nombre}</td>
                            <td className="py-2 px-3 text-muted-foreground">{p.unidadMedida}</td>
                            <td className="py-2 px-3 text-right font-mono">{formatMoney(p.precioUnitario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {/* Info del servicio */}
            {pickerTipo === "SERVICIO" && (
              <div className="bg-muted/50 rounded-md p-4 text-sm text-muted-foreground">
                Se agregará un item tipo servicio. Podrás editar la descripción y el precio directamente en el pedido.
              </div>
            )}

            {/* Cantidad y descuento */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div className="space-y-1">
                <Label className="text-xs">Cantidad</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={pickerCantidad}
                  onChange={(e) => setPickerCantidad(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descuento ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pickerDescuento}
                  onChange={(e) => setPickerDescuento(Number(e.target.value))}
                />
              </div>
            </div>

            {/* Preview del item seleccionado */}
            {pickerSelected && (
              <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                <div className="font-medium">{pickerSelected.nombre}</div>
                <div className="text-muted-foreground">
                  Código: <span className="font-mono">{pickerSelected.codigo}</span> | UM: {pickerSelected.unidadMedida} | Precio: {formatMoney(pickerSelected.precioUnitario)}
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPickerOpen(false)}>Cancelar</Button>
              <Button
                type="button"
                onClick={confirmPickerItem}
                disabled={pickerTipo === "PRODUCTO" && !pickerSelected}
              >
                <Plus className="mr-1 h-4 w-4" />
                Agregar al pedido
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
