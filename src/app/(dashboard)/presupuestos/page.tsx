"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, FileText, ArrowUpCircle, CheckCircle, XCircle, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { formatMoney } from "@/lib/utils"
import {
  getPresupuestos,
  getPresupuesto,
  createPresupuesto,
  updatePresupuesto,
  deletePresupuesto,
  cambiarEstadoPresupuesto,
  getCentrosCostos,
  getCuentasContables,
  type PresupuestoFormData,
} from "@/actions/presupuestos"

type PresupuestoItem = Awaited<ReturnType<typeof getPresupuestos>>[number]
type CentroCostosItem = Awaited<ReturnType<typeof getCentrosCostos>>[number]
type CuentaItem = Awaited<ReturnType<typeof getCuentasContables>>[number]

const ESTADO_STYLES: Record<string, "success" | "secondary" | "warning" | "destructive" | "default"> = {
  BORRADOR: "secondary",
  EN_REVISION: "warning",
  APROBADO: "success",
  CERRADO: "default",
  RECHAZADO: "destructive",
}

const defaultForm: PresupuestoFormData = {
  codigo: "",
  nombre: "",
  descripcion: "",
  tipo: "OPERATIVO",
  año: new Date().getFullYear(),
  mes: null,
  notas: "",
  items: [{ descripcion: "", valorPresupuestado: 0 }],
}

export default function PresupuestosPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("lista")
  const [items, setItems] = useState<PresupuestoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<PresupuestoFormData>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [centrosCostos, setCentrosCostos] = useState<CentroCostosItem[]>([])
  const [cuentas, setCuentas] = useState<CuentaItem[]>([])
  const [detail, setDetail] = useState<any>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const [presupuestos, cc, ct] = await Promise.all([
        getPresupuestos(),
        getCentrosCostos(),
        getCuentasContables(),
      ])
      setItems(presupuestos)
      setCentrosCostos(cc)
      setCuentas(ct)
    } catch (err: any) {
      toast({ title: "Error al cargar", description: err.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadItems() }, [loadItems])

  const filtered = search
    ? items.filter(
        (i) =>
          i.codigo.toLowerCase().includes(search.toLowerCase()) ||
          i.nombre.toLowerCase().includes(search.toLowerCase())
      )
    : items

  async function openDetail(item: PresupuestoItem) {
    try {
      const d = await getPresupuesto(item.id)
      setDetail(d)
      setDetailOpen(true)
    } catch (e: any) {
      toast({ title: "Error al cargar detalle", description: e.message, variant: "destructive" })
    }
  }

  function openCreate() {
    const year = new Date().getFullYear()
    const prefix = `P-${year}-`
    const next = items.filter((i) => i.codigo.startsWith(prefix)).length + 1
    setEditId(null)
    setForm({ ...defaultForm, codigo: `${prefix}${String(next).padStart(3, "0")}`, año: year })
    setDialogOpen(true)
  }

  async function openEdit(item: PresupuestoItem) {
    try {
      const d = await getPresupuesto(item.id)
      setEditId(item.id)
      setForm({
        codigo: d.codigo,
        nombre: d.nombre,
        descripcion: d.descripcion ?? "",
        tipo: d.tipo,
        año: d.año,
        mes: d.mes,
        notas: d.notas ?? "",
        items: d.items.map((i: any) => ({
          id: i.id,
          centroCostosId: i.centroCostosId,
          cuentaContableId: i.cuentaContableId,
          descripcion: i.descripcion,
          valorPresupuestado: Number(i.valorPresupuestado),
          notas: i.notas,
        })),
      })
      setDialogOpen(true)
    } catch (e: any) {
      toast({ title: "Error al cargar", description: e.message, variant: "destructive" })
    }
  }

  function handleFormChange(updates: Partial<PresupuestoFormData>) {
    setForm((prev) => ({ ...prev, ...updates }))
  }

  function handleItemChange(index: number, updates: any) {
    setForm((prev) => {
      const items = [...prev.items]
      items[index] = { ...items[index], ...updates }
      return { ...prev, items }
    })
  }

  function addItem() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { descripcion: "", valorPresupuestado: 0 }],
    }))
  }

  function removeItem(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) {
        await updatePresupuesto(editId, form)
        toast({ title: "Presupuesto actualizado", variant: "success" })
      } else {
        await createPresupuesto(form)
        toast({ title: "Presupuesto creado", variant: "success" })
      }
      setDialogOpen(false)
      await loadItems()
    } catch (err: any) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este presupuesto?")) return
    try {
      await deletePresupuesto(id)
      toast({ title: "Presupuesto eliminado", variant: "success" })
      await loadItems()
    } catch (err: any) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" })
    }
  }

  async function handleCambiarEstado(id: string, estado: string) {
    try {
      await cambiarEstadoPresupuesto(id, estado)
      toast({ title: `Estado cambiado a ${estado}`, variant: "success" })
      await loadItems()
      if (detail && detail.id === id) {
        const updated = await getPresupuesto(id)
        setDetail(updated)
      }
    } catch (err: any) {
      toast({ title: "Error al cambiar estado", description: err.message, variant: "destructive" })
    }
  }

  const totalGeneral = filtered.reduce((s, i) => s + Number(i.totalPresupuestado), 0)

  const columns: Column<PresupuestoItem>[] = [
    {
      key: "codigo",
      header: "Código",
      render: (item) => (
        <button onClick={() => openDetail(item)} className="font-medium text-primary hover:underline">
          {item.codigo}
        </button>
      ),
    },
    { key: "nombre", header: "Nombre" },
    {
      key: "tipo",
      header: "Tipo",
      render: (item) => (
        <Badge variant="secondary" className="text-xs">
          {item.tipo}
        </Badge>
      ),
    },
    { key: "año", header: "Año" },
    {
      key: "totalPresupuestado",
      header: "Valor",
      render: (item) => formatMoney(Number(item.totalPresupuestado)),
    },
    {
      key: "itemCount",
      header: "Partidas",
      render: (item) => (
        <span className="text-muted-foreground text-sm">{item.itemCount} items</span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (item) => (
        <Badge variant={ESTADO_STYLES[item.estado] ?? "secondary"}>
          {item.estado === "EN_REVISION" ? "En Revisión" : item.estado}
        </Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      render: (item) => (
        <div className="flex gap-1">
          {item.estado === "BORRADOR" && (
            <>
              <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleCambiarEstado(item.id, "EN_REVISION")}>
                <ArrowUpCircle className="h-4 w-4 text-blue-500" />
              </Button>
            </>
          )}
          {item.estado === "EN_REVISION" && (
            <>
              <Button variant="ghost" size="icon" onClick={() => handleCambiarEstado(item.id, "APROBADO")}>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => handleCambiarEstado(item.id, "RECHAZADO")}>
                <XCircle className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
          {item.estado === "BORRADOR" && (
            <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Presupuestos" description="Gestión de presupuestos por periodo y centro de costos" />

      <div className="flex items-center justify-between">
        <Input
          placeholder="Buscar..."
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo Presupuesto
        </Button>
      </div>

      {!loading && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {filtered.length} presupuestos
            </span>
            <span className="font-medium">
              Total: {formatMoney(totalGeneral)}
            </span>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={filtered} loading={loading} />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editId ? "Editar Presupuesto" : "Nuevo Presupuesto"}
        loading={saving}
        onSubmit={handleSave}
      >
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código</Label>
              <Input id="codigo" value={form.codigo} onChange={(e) => handleFormChange({ codigo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo</Label>
              <Select value={form.tipo} onValueChange={(v: any) => handleFormChange({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPERATIVO">Operativo</SelectItem>
                  <SelectItem value="CAPEX">CAPEX</SelectItem>
                  <SelectItem value="PROYECTO">Proyecto</SelectItem>
                  <SelectItem value="GENERAL">General</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input id="nombre" value={form.nombre} onChange={(e) => handleFormChange({ nombre: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea id="descripcion" value={form.descripcion ?? ""} onChange={(e) => handleFormChange({ descripcion: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="año">Año</Label>
              <Input id="año" type="number" value={form.año} onChange={(e) => handleFormChange({ año: Number(e.target.value) })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mes">Mes (opcional)</Label>
              <Select value={form.mes?.toString() ?? ""} onValueChange={(v) => handleFormChange({ mes: v ? Number(v) : null })}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Todos</SelectItem>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(0, i).toLocaleString("es", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Partidas</Label>
            {form.items.map((item, idx) => (
              <div key={idx} className="rounded-md border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Partida #{idx + 1}</span>
                  {form.items.length > 1 && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}>
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    placeholder="Descripción"
                    value={item.descripcion}
                    onChange={(e) => handleItemChange(idx, { descripcion: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Centro Costos</Label>
                    <Select
                      value={item.centroCostosId ?? ""}
                      onValueChange={(v) => handleItemChange(idx, { centroCostosId: v || null })}
                    >
                      <SelectTrigger><SelectValue placeholder="Ninguno" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Ninguno</SelectItem>
                        {centrosCostos.map((cc) => (
                          <SelectItem key={cc.id} value={cc.id}>{cc.codigo} - {cc.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cuenta Contable</Label>
                    <Select
                      value={item.cuentaContableId ?? ""}
                      onValueChange={(v) => handleItemChange(idx, { cuentaContableId: v || null })}
                    >
                      <SelectTrigger><SelectValue placeholder="Ninguna" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Ninguna</SelectItem>
                        {cuentas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.codigo} - {c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor Presupuestado</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={item.valorPresupuestado}
                    onChange={(e) => handleItemChange(idx, { valorPresupuestado: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={addItem}>
              <Plus className="mr-2 h-3 w-3" /> Agregar Partida
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea id="notas" value={form.notas ?? ""} onChange={(e) => handleFormChange({ notas: e.target.value })} />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={detail ? `Presupuesto: ${detail.codigo}` : ""}
        onSubmit={() => setDetailOpen(false)}
        submitLabel="Cerrar"
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{detail.nombre}</p>
                <p className="text-sm text-muted-foreground">{detail.descripcion}</p>
              </div>
              <Badge variant={ESTADO_STYLES[detail.estado] ?? "secondary"}>
                {detail.estado === "EN_REVISION" ? "En Revisión" : detail.estado}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Año:</span> {detail.año}
                {detail.mes && <span> / {new Date(0, detail.mes - 1).toLocaleString("es", { month: "long" })}</span>}
              </div>
              <div>
                <span className="text-muted-foreground">Tipo:</span> {detail.tipo}
              </div>
              <div>
                <span className="text-muted-foreground">Creado por:</span>{" "}
                {detail.creadoPor?.nombre} {detail.creadoPor?.apellido}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Partidas</Label>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left">Descripción</th>
                      <th className="px-3 py-2 text-left">Centro Costos</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.items.map((item: any) => (
                      <tr key={item.id} className="border-b last:border-0">
                        <td className="px-3 py-2">{item.descripcion}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {item.centroCostos ? `${item.centroCostos.codigo} - ${item.centroCostos.nombre}` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatMoney(Number(item.valorPresupuestado))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="px-3 py-2" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(detail.items.reduce((s: number, i: any) => s + Number(i.valorPresupuestado), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {detail.estado === "EN_REVISION" && (
              <div className="flex gap-2">
                <Button className="flex-1" onClick={() => handleCambiarEstado(detail.id, "APROBADO")}>
                  <CheckCircle className="mr-2 h-4 w-4" /> Aprobar
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => handleCambiarEstado(detail.id, "RECHAZADO")}>
                  <XCircle className="mr-2 h-4 w-4" /> Rechazar
                </Button>
              </div>
            )}
          </div>
        )}
      </FormDialog>
    </div>
  )
}
