"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  Plus, Pencil, Trash2, CheckCircle, XCircle, Eye,
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
  getVentas, getVenta, createVenta, updateVenta,
  cambiarEstadoVenta, deleteVenta,
  type VentaFormData,
} from "@/actions/ventas"
import { getClientes } from "@/actions/clientes"

interface VentaRow {
  id: string
  numero: number
  fecha: string
  cliente: { id: string; nombre: string }
  estado: string
  tipoFactura: string
  total: number
  _count: { items: number; pagos: number }
}

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  BORRADOR: "secondary",
  CONFIRMADA: "success",
  CANCELADA: "destructive",
  ANULADA: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  CONFIRMADA: "Confirmada",
  CANCELADA: "Cancelada",
  ANULADA: "Anulada",
}

export default function VentasPage() {
  const { toast } = useToast()
  const searchParams = useSearchParams()

  const [ventas, setVentas] = useState<VentaRow[]>([])
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
  const [formItems, setFormItems] = useState<any[]>([{ descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, precioUnitario: 0, descuento: 0, subtotal: 0, impuesto: 0, total: 0 }])
  const [formPagos, setFormPagos] = useState<any[]>([])
  const [facturaTipo, setFacturaTipo] = useState("CONTADO")
  const [pedidoIdFromUrl, setPedidoIdFromUrl] = useState("")

  const loadVentas = useCallback(async () => {
    try {
      const data = await getVentas()
      setVentas(data as unknown as VentaRow[])
    } catch {
      toast({ title: "Error al cargar ventas", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadReferencias = useCallback(async () => {
    try {
      const data = await getClientes()
      setClientes(data.map((c: any) => ({ id: c.id, nombre: c.nombre })))
    } catch {
      toast({ title: "Error al cargar referencias", variant: "destructive" })
    }
  }, [toast])

  useEffect(() => {
    setLoading(true)
    loadVentas()
    loadReferencias()
    const pid = searchParams.get("pedidoId")
    if (pid) {
      setPedidoIdFromUrl(pid)
      setDialogOpen(true)
    }
  }, [loadVentas, loadReferencias, searchParams])

  const filtered = useMemo(() => {
    if (!search) return ventas
    const q = search.toLowerCase()
    return ventas.filter(
      (v) =>
        `VEN-${v.numero}`.includes(q) ||
        v.cliente.nombre.toLowerCase().includes(q) ||
        ESTADO_LABELS[v.estado]?.toLowerCase().includes(q)
    )
  }, [ventas, search])

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
    setFormItems([...formItems, { descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, precioUnitario: 0, descuento: 0, subtotal: 0, impuesto: 0, total: 0 }])
  }

  const addPago = () => {
    setFormPagos([...formPagos, { metodo: "EFECTIVO", monto: 0, referencia: "" }])
  }

  const handlePagoChange = (i: number, field: string, value: any) => {
    const newPagos = [...formPagos]
    newPagos[i] = { ...newPagos[i], [field]: value }
    setFormPagos(newPagos)
  }

  const removePago = (i: number) => {
    setFormPagos(formPagos.filter((_, idx) => idx !== i))
  }

  const openCreate = () => {
    setEditingId(null)
    setFormItems([{ descripcion: "", unidadMedida: "UNIDAD", cantidad: 1, precioUnitario: 0, descuento: 0, subtotal: 0, impuesto: 0, total: 0 }])
    setFormPagos([])
    setFacturaTipo("CONTADO")
    setDialogOpen(true)
  }

  const openEdit = async (id: string) => {
    setEditingId(id)
    try {
      const data = await getVenta(id)
      if (data) {
        setFormItems(data.items.map((item: any) => ({
          descripcion: item.descripcion, unidadMedida: item.unidadMedida,
          cantidad: Number(item.cantidad), precioUnitario: Number(item.precioUnitario),
          descuento: Number(item.descuento), subtotal: Number(item.subtotal),
          impuesto: Number(item.impuesto), total: Number(item.total),
        })))
        setFormPagos(data.pagos?.map((p: any) => ({
          metodo: p.metodo, monto: Number(p.monto), referencia: p.referencia || "",
        })) || [])
        setFacturaTipo(data.tipoFactura)
        setDialogOpen(true)
      }
    } catch {
      toast({ title: "Error al cargar venta", variant: "destructive" })
    }
  }

  const openDetail = async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      const data = await getVenta(id)
      setDetail(data)
    } catch {
      toast({ title: "Error al cargar venta", variant: "destructive" })
    } finally {
      setDetailLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const fd = new FormData(e.currentTarget)
      const data: VentaFormData = {
        clienteId: fd.get("clienteId") as string,
        pedidoId: fd.get("pedidoId") as string || "",
        fecha: fd.get("fecha") as string,
        tipoFactura: facturaTipo,
        fechaVencimiento: fd.get("fechaVencimiento") as string || "",
        notas: fd.get("notas") as string,
        items: formItems,
        pagos: formPagos.length > 0 ? formPagos : undefined,
      }
      if (editingId) {
        await updateVenta(editingId, data)
        toast({ title: "Venta actualizada", variant: "success" })
      } else {
        await createVenta(data)
        toast({ title: "Venta creada", variant: "success" })
      }
      setDialogOpen(false)
      setEditingId(null)
      await loadVentas()
    } catch {
      toast({ title: "Error al guardar venta", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleEstadoChange = async (id: string, estado: string) => {
    try {
      await cambiarEstadoVenta(id, estado)
      toast({ title: `Venta ${ESTADO_LABELS[estado]?.toLowerCase()}`, variant: "success" })
      await loadVentas()
    } catch {
      toast({ title: "Error al cambiar estado", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      await deleteVenta(deleteTarget)
      toast({ title: "Venta eliminada", variant: "success" })
      setDeleteTarget(null)
      await loadVentas()
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

  const columns: Column<VentaRow>[] = [
    { key: "numero", header: "N°", render: (v) => `VEN-${v.numero}` },
    { key: "fecha", header: "Fecha", render: (v) => formatDate(v.fecha) },
    { key: "cliente", header: "Cliente", render: (v) => v.cliente.nombre },
    { key: "total", header: "Total", render: (v) => formatMoney(v.total) },
    {
      key: "tipoFactura", header: "Tipo", render: (v) => (
        <Badge variant={v.tipoFactura === "CREDITO" ? "warning" : "default"}>{v.tipoFactura}</Badge>
      ),
    },
    {
      key: "estado", header: "Estado", render: (v) => (
        <Badge variant={ESTADO_STYLES[v.estado] || "secondary"}>{ESTADO_LABELS[v.estado] || v.estado}</Badge>
      ),
    },
    {
      key: "acciones", header: "", className: "w-[140px]",
      render: (v) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" title="Ver detalle" onClick={() => openDetail(v.id)}>
            <Eye className="h-4 w-4" />
          </Button>
          {v.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" title="Confirmar" onClick={() => handleEstadoChange(v.id, "CONFIRMADA")}>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </Button>
              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(v.id)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleteTarget(v.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {(v.estado === "CONFIRMADA") && (
            <Button variant="ghost" size="icon" title="Anular" onClick={() => handleEstadoChange(v.id, "ANULADA")}>
              <XCircle className="h-4 w-4 text-red-600" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Ventas" description="Facturación de ventas" />

      <div className="flex items-center justify-between">
        <div />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Venta
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
        onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditingId(null); setPedidoIdFromUrl("") } }}
        title={editingId ? "Editar Venta" : "Nueva Venta"}
        onSubmit={handleSubmit}
        loading={saving}
        submitLabel={editingId ? "Actualizar" : "Crear"}
        className="max-w-4xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="clienteId">Cliente *</Label>
            <Select name="clienteId" required defaultValue="">
              <SelectTrigger><SelectValue placeholder="Selecciona un cliente..." /></SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="tipoFactura">Tipo Factura</Label>
            <select
              id="tipoFactura"
              value={facturaTipo}
              onChange={(e) => setFacturaTipo(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </select>
          </div>
          {facturaTipo === "CREDITO" && (
            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento">Vencimiento</Label>
              <Input id="fechaVencimiento" name="fechaVencimiento" type="date" />
            </div>
          )}
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
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {formItems.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-md">
                  <div className="col-span-3 space-y-1">
                    <Label className="text-xs">Descripción</Label>
                    <Input value={item.descripcion} onChange={(e) => handleItemChange(i, "descripcion", e.target.value)} placeholder="Descripción" required />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">UM</Label>
                    <Input value={item.unidadMedida} onChange={(e) => handleItemChange(i, "unidadMedida", e.target.value)} />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Cant</Label>
                    <Input type="number" value={item.cantidad} onChange={(e) => handleItemChange(i, "cantidad", Number(e.target.value))} min={0.01} step={0.01} required />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">P. Unitario</Label>
                    <Input type="number" value={item.precioUnitario} onChange={(e) => handleItemChange(i, "precioUnitario", Number(e.target.value))} min={0} step={0.01} required />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <Label className="text-xs">Dto</Label>
                    <Input type="number" value={item.descuento} onChange={(e) => handleItemChange(i, "descuento", Number(e.target.value))} min={0} step={0.01} />
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

          <div className="col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Pagos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addPago}>
                <Plus className="mr-1 h-3 w-3" /> Agregar Pago
              </Button>
            </div>
            {formPagos.map((pago, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-end p-2 border rounded-md">
                <div className="space-y-1">
                  <Label className="text-xs">Método</Label>
                  <select
                    value={pago.metodo}
                    onChange={(e) => handlePagoChange(i, "metodo", e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="TARJETA">Tarjeta</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Monto</Label>
                  <Input type="number" value={pago.monto} onChange={(e) => handlePagoChange(i, "monto", Number(e.target.value))} min={0} step={0.01} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Referencia</Label>
                  <Input value={pago.referencia} onChange={(e) => handlePagoChange(i, "referencia", e.target.value)} />
                </div>
                <div className="flex items-end pb-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => removePago(i)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </FormDialog>

      <Dialog open={!!detailId} onOpenChange={(o) => { if (!o) setDetailId(null) }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader><DialogTitle>Detalle de Venta</DialogTitle></DialogHeader>
          {detailLoading ? (
            <div className="text-center py-8 text-muted-foreground">Cargando...</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>N°:</strong> VEN-{detail.numero}</div>
                <div><strong>Fecha:</strong> {formatDate(detail.fecha)}</div>
                <div><strong>Cliente:</strong> {detail.cliente?.nombre}</div>
                <div><strong>Estado:</strong> <Badge variant={ESTADO_STYLES[detail.estado]}>{ESTADO_LABELS[detail.estado]}</Badge></div>
                <div><strong>Tipo:</strong> {detail.tipoFactura}</div>
                {detail.fechaVencimiento && <div><strong>Vencimiento:</strong> {formatDate(detail.fechaVencimiento)}</div>}
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-1">#</th>
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
              {detail.pagos?.length > 0 && (
                <div>
                  <strong className="text-sm">Pagos:</strong>
                  {detail.pagos.map((p: any) => (
                    <div key={p.id} className="text-sm flex gap-4">
                      <span>{p.metodo}</span>
                      <span>{formatMoney(Number(p.monto))}</span>
                      {p.referencia && <span className="text-muted-foreground">Ref: {p.referencia}</span>}
                    </div>
                  ))}
                </div>
              )}
              {detail.notas && <p className="text-sm text-muted-foreground"><strong>Notas:</strong> {detail.notas}</p>}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro de eliminar esta venta? Esta acción no se puede deshacer.</DialogDescription>
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
