"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, Play, CheckCircle2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import {
  getOrdenes, createOrden, updateOrden, cambiarEstadoOrden, deleteOrden, asignarRecursos,
  type OrdenFormData, getProgramacionesActivas, getRecursosDisponibles,
} from "@/actions/operaciones-ordenes"
import { getClientesOperaciones, getProductosOperaciones } from "@/actions/operaciones-programacion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PUERTOS } from "@/lib/constantes"

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  PENDIENTE: "secondary",
  ASIGNADA: "info",
  EN_PROCESO: "warning",
  FINALIZADA: "success",
  CERRADA: "secondary",
}

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ASIGNADA: "Asignada",
  EN_PROCESO: "En Proceso",
  FINALIZADA: "Finalizada",
  CERRADA: "Cerrada",
}

export default function OrdenesPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [programaciones, setProgramaciones] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [recursos, setRecursos] = useState<any>({ barcazas: [], remolcadores: [], vehiculos: [], conductores: [], capitanes: [] })
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [recursoDialogOpen, setRecursoDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [progId, setProgId] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [selectedOrden, setSelectedOrden] = useState<any>(null)

  const selectedProg = programaciones.find(p => p.id === progId) ?? null

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [ords, progs, clis, prods, rec] = await Promise.all([
        getOrdenes(), getProgramacionesActivas(), getClientesOperaciones(),
        getProductosOperaciones(), getRecursosDisponibles(),
      ])
      setItems(ords)
      setProgramaciones(progs)
      setClientes(clis)
      setProductos(prods)
      setRecursos(rec)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const columns: Column<any>[] = [
    { key: "numero", header: "#" },
    { key: "programacion", header: "Prog.", render: (r) => `#${r.programacion?.numero}` },
    { key: "cliente", header: "Cliente", render: (r) => r.cliente?.nombre },
    { key: "motonave", header: "Motonave" },
    { key: "puerto", header: "Puerto" },
    { key: "producto", header: "Producto", render: (r) => r.producto?.nombre },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={ESTADO_STYLES[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge> },
    { key: "acciones", header: "", render: (row) => (
      <div className="flex gap-1">
        {row.estado === "PENDIENTE" && (
          <Button variant="ghost" size="icon" onClick={() => openRecursos(row)} title="Asignar recursos"><Play className="h-4 w-4" /></Button>
        )}
        {["PENDIENTE", "ASIGNADA"].includes(row.estado) && (
          <>
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Editar"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
        {row.estado === "ASIGNADA" && (
          <Button variant="ghost" size="icon" onClick={() => handleCambiarEstado(row.id, "EN_PROCESO")} title="Iniciar"><Play className="h-4 w-4" /></Button>
        )}
        {row.estado === "EN_PROCESO" && (
          <Button variant="ghost" size="icon" onClick={() => handleCambiarEstado(row.id, "FINALIZADA")} title="Finalizar"><CheckCircle2 className="h-4 w-4" /></Button>
        )}
        {row.estado === "FINALIZADA" && (
          <Button variant="ghost" size="icon" onClick={() => handleCambiarEstado(row.id, "CERRADA")} title="Cerrar"><CheckCircle2 className="h-4 w-4 text-green-600" /></Button>
        )}
      </div>
    )},
  ]

  function resetForm() {
    setEditId(null)
    setEditItem(null)
    setProgId("")
  }

  function openNew() {
    resetForm()
    setDialogOpen(true)
  }

  function openEdit(row: any) {
    setEditId(row.id)
    setEditItem(row)
    setProgId(row.programacionId ?? "")
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      const data: OrdenFormData = {
        programacionId: form.get("programacionId") as string || progId,
        clienteId: form.get("clienteId") as string || selectedProg?.clienteId || editItem?.clienteId || "",
        motonave: form.get("motonave") as string || selectedProg?.motonave || editItem?.motonave || "",
        puerto: form.get("puerto") as string || selectedProg?.puerto || editItem?.puerto || "",
        productoId: form.get("productoId") as string || selectedProg?.productoId || editItem?.productoId || "",
        api: form.get("api") ? Number(form.get("api")) : undefined,
        gravedadEspecifica: form.get("gravedadEspecifica") ? Number(form.get("gravedadEspecifica")) : undefined,
        densidad: form.get("densidad") ? Number(form.get("densidad")) : undefined,
        viscosidad: form.get("viscosidad") ? Number(form.get("viscosidad")) : undefined,
        azufre: form.get("azufre") ? Number(form.get("azufre")) : undefined,
        agua: form.get("agua") ? Number(form.get("agua")) : undefined,
        puntoChispa: form.get("puntoChispa") ? Number(form.get("puntoChispa")) : undefined,
        temperatura: form.get("temperatura") ? Number(form.get("temperatura")) : undefined,
        otrasPropiedades: form.get("otrasPropiedades") as string,
        muestraRetenida: form.get("muestraRetenida") === "on",
        muestraProveedor: form.get("muestraProveedor") as string,
        muestraMotonave: form.get("muestraMotonave") as string,
        muestraMarpol: form.get("muestraMarpol") === "on",
        muestraMarpolInfo: form.get("muestraMarpolInfo") as string,
        muestraOtra: form.get("muestraOtra") as string,
        muestraClienteEstado: form.get("muestraClienteEstado") as string,
      }
      if (editId) {
        await updateOrden(editId, data)
        toast({ title: "Actualizada", description: "Orden actualizada", variant: "success" })
      } else {
        await createOrden(data)
        toast({ title: "Creada", description: "Orden creada", variant: "success" })
      }
      setDialogOpen(false)
      resetForm()
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCambiarEstado(id: string, estado: string) {
    try {
      await cambiarEstadoOrden(id, estado)
      toast({ title: "Estado actualizado", variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteOrden(id)
      toast({ title: "Eliminada", variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  async function handleAsignarRecursos(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!selectedOrden) return
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      await asignarRecursos(selectedOrden.id, {
        barcazaId: form.get("barcazaId") as string,
        remolcadorId: form.get("remolcadorId") as string,
        vehiculoId: form.get("vehiculoId") as string,
        conductorId: form.get("conductorId") as string,
        capitanId: form.get("capitanId") as string,
      })
      toast({ title: "Recursos asignados", variant: "success" })
      setRecursoDialogOpen(false)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  function openRecursos(orden: any) {
    setSelectedOrden(orden)
    setRecursoDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Órdenes Operativas"
        description="Ejecución de operaciones de suministro"
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nueva Orden</Button>}
      />

      <DataTable columns={columns} data={items} loading={loading} searchable />

      <FormDialog open={dialogOpen} onOpenChange={(v) => { if (!v) resetForm(); setDialogOpen(v) }} title={editId ? "Editar Orden" : "Nueva Orden Operativa"} onSubmit={handleSubmit} loading={submitting}>
        <div className="grid gap-4" key={editId ?? "new"}>
          <div className="space-y-2">
            <Label htmlFor="programacionId">Programación origen</Label>
            <Select value={progId} onValueChange={setProgId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar programación" /></SelectTrigger>
              <SelectContent>
                {programaciones.map((p) => (
                  <SelectItem key={p.id} value={p.id}>#{p.numero} - {p.motonave} - {p.cliente?.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(selectedProg ?? editItem) ? (
            <>
              <input type="hidden" name="programacionId" value={selectedProg?.id ?? editItem?.programacionId ?? ""} />
              <input type="hidden" name="clienteId" value={selectedProg?.clienteId ?? editItem?.clienteId ?? ""} />
              <input type="hidden" name="puerto" value={selectedProg?.puerto ?? editItem?.puerto ?? ""} />
              <input type="hidden" name="motonave" value={selectedProg?.motonave ?? editItem?.motonave ?? ""} />
              <input type="hidden" name="productoId" value={selectedProg?.productoId ?? editItem?.productoId ?? ""} />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Cliente:</strong> {selectedProg ? (clientes.find(c => c.id === selectedProg.clienteId)?.nombre ?? selectedProg.cliente?.nombre) : (clientes.find(c => c.id === editItem?.clienteId)?.nombre ?? editItem?.clienteId)}</div>
                <div><strong>Puerto:</strong> {selectedProg?.puerto ?? editItem?.puerto}</div>
                <div><strong>Motonave:</strong> {selectedProg?.motonave ?? editItem?.motonave}</div>
                <div><strong>Producto:</strong> {selectedProg ? (productos.find(p => p.id === selectedProg.productoId)?.nombre ?? selectedProg.productoId) : (productos.find(p => p.id === editItem?.productoId)?.nombre ?? editItem?.productoId)}</div>
              </div>
            </>
          ) : null}

          <fieldset className="border rounded p-3 space-y-3">
            <legend className="text-sm font-semibold px-2">Calidad del Producto / Product Quality</legend>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">API</Label><Input name="api" type="number" step="0.01" defaultValue={editItem?.api ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Gravedad Específica / Specific Gravity</Label><Input name="gravedadEspecifica" type="number" step="0.0001" defaultValue={editItem?.gravedadEspecifica ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Densidad a 60°F / Density at 60°F</Label><Input name="densidad" type="number" step="0.0001" defaultValue={editItem?.densidad ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Viscosidad / Viscosity</Label><Input name="viscosidad" type="number" step="0.01" defaultValue={editItem?.viscosidad ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Azufre / Sulphur</Label><Input name="azufre" type="number" step="0.01" defaultValue={editItem?.azufre ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Agua / Water</Label><Input name="agua" type="number" step="0.01" defaultValue={editItem?.agua ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Punto de Chispa / Flash Point</Label><Input name="puntoChispa" type="number" step="0.01" defaultValue={editItem?.puntoChispa ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Temperatura / Temperature</Label><Input name="temperatura" type="number" step="0.01" defaultValue={editItem?.temperatura ?? ""} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Otras Propiedades / Other Specs</Label><Input name="otrasPropiedades" defaultValue={editItem?.otrasPropiedades ?? ""} /></div>
          </fieldset>
          <fieldset className="border rounded p-3 space-y-3">
            <legend className="text-sm font-semibold px-2">Muestras / Samples</legend>
            <div className="flex items-center gap-2">
              <input name="muestraRetenida" type="checkbox" className="w-4 h-4" id="muestraRetenida" defaultChecked={editItem?.muestraRetenida ?? false} />
              <Label htmlFor="muestraRetenida" className="text-xs cursor-pointer">Muestra retenida</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs">Proveedor / Supplier</Label><Input name="muestraProveedor" defaultValue={editItem?.muestraProveedor ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Motonave / Vessel</Label><Input name="muestraMotonave" defaultValue={editItem?.muestraMotonave ?? ""} /></div>
              <div className="space-y-1">
                <Label className="text-xs">MARPOL Annex VI</Label>
                <div className="flex items-center gap-2">
                  <input name="muestraMarpol" type="checkbox" className="w-4 h-4" id="muestraMarpol" defaultChecked={editItem?.muestraMarpol ?? false} />
                  <Label htmlFor="muestraMarpol" className="text-xs cursor-pointer">Sí</Label>
                </div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Info MARPOL / MARPOL Info</Label><Input name="muestraMarpolInfo" defaultValue={editItem?.muestraMarpolInfo ?? ""} /></div>
              <div className="space-y-1"><Label className="text-xs">Otra Muestra / Other Sample</Label><Input name="muestraOtra" defaultValue={editItem?.muestraOtra ?? ""} /></div>
              <div className="space-y-1">
                <Label className="text-xs">Entregada al Cliente</Label>
                <div className="flex gap-3">
                  <label className="flex items-center gap-1 text-xs"><input name="muestraClienteEstado" type="radio" value="SI" defaultChecked={editItem?.muestraClienteEstado === "SI"} /> Sí</label>
                  <label className="flex items-center gap-1 text-xs"><input name="muestraClienteEstado" type="radio" value="RECHAZADA" defaultChecked={editItem?.muestraClienteEstado === "RECHAZADA"} /> Rechazada</label>
                  <label className="flex items-center gap-1 text-xs"><input name="muestraClienteEstado" type="radio" value="NO" defaultChecked={editItem?.muestraClienteEstado === "NO" || !editItem} /> No</label>
                </div>
              </div>
            </div>
          </fieldset>
        </div>
      </FormDialog>

      <Dialog open={recursoDialogOpen} onOpenChange={setRecursoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Asignar Recursos - Orden #{selectedOrden?.numero}</DialogTitle></DialogHeader>
          <form onSubmit={handleAsignarRecursos} className="space-y-4">
            <div className="space-y-2">
              <Label>Barcaza</Label>
              <Select name="barcazaId">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {recursos.barcazas.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.nombre} ({b.capacidad}T)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Remolcador</Label>
              <Select name="remolcadorId">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {recursos.remolcadores.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Vehículo</Label>
              <Select name="vehiculoId">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {recursos.vehiculos.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.placa} - {v.tipo}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conductor</Label>
              <Select name="conductorId">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {recursos.conductores.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capitán</Label>
              <Select name="capitanId">
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {recursos.capitanes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? "Asignando..." : "Asignar Recursos"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
