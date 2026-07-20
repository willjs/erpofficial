"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2, XCircle, Send, Eye } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { PUERTOS, BANDERAS, getFlagEmoji } from "@/lib/constantes"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { useToast } from "@/components/ui/use-toast"
import {
  getProgramaciones, createProgramacion, updateProgramacion,
  cambiarEstadoProgramacion, deleteProgramacion,
  type ProgramacionFormData, getProductosOperaciones, getClientesOperaciones,
} from "@/actions/operaciones-programacion"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

const ESTADO_STYLES: Record<string, "secondary" | "success" | "warning" | "info" | "destructive"> = {
  BORRADOR: "secondary",
  PROGRAMADA: "info",
  APROBADA: "success",
  CANCELADA: "destructive",
}

const ESTADO_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  PROGRAMADA: "Programada",
  APROBADA: "Aprobada",
  CANCELADA: "Cancelada",
}

const SIGUIENTE_ESTADO: Record<string, string[]> = {
  BORRADOR: ["PROGRAMADA"],
  PROGRAMADA: ["APROBADA", "CANCELADA"],
  APROBADA: [],
  CANCELADA: [],
}

export default function ProgramacionPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [productos, setProductos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selected, setSelected] = useState<any>(null)
  const [bandera, setBandera] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [progs, prods, clis] = await Promise.all([getProgramaciones(), getProductosOperaciones(), getClientesOperaciones()])
      setItems(progs)
      setProductos(prods)
      setClientes(clis)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const columns: Column<any>[] = [
    { key: "numero", header: "#" },
    { key: "fecha", header: "Fecha", render: (r) => formatDate(r.fecha) },
    { key: "cliente", header: "Cliente", render: (r) => r.cliente?.nombre },
    { key: "motonave", header: "Motonave" },
    { key: "puerto", header: "Puerto" },
    { key: "producto", header: "Producto", render: (r) => r.producto?.nombre },
    { key: "ordenes", header: "Ord.", render: (r) => r._count?.ordenes ?? 0 },
    { key: "estado", header: "Estado", render: (r) => <Badge variant={ESTADO_STYLES[r.estado]}>{ESTADO_LABELS[r.estado]}</Badge> },
    { key: "acciones", header: "", render: (row) => (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openDetail(row)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
        {row.estado === "BORRADOR" && (
          <>
            <Button variant="ghost" size="icon" onClick={() => openEdit(row)} title="Editar"><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
          </>
        )}
        {SIGUIENTE_ESTADO[row.estado]?.map((estado) => (
          <Button key={estado} variant="ghost" size="icon" onClick={() => handleCambiarEstado(row.id, estado)} title={ESTADO_LABELS[estado]}>
            {estado === "CANCELADA" ? <XCircle className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </Button>
        ))}
      </div>
    )},
  ]

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      const data: ProgramacionFormData = {
        fecha: form.get("fecha") as string,
        clienteId: form.get("clienteId") as string,
        agente: form.get("agente") as string,
        puerto: form.get("puerto") as string,
        lugarSuministro: form.get("lugarSuministro") as string,
        motonave: form.get("motonave") as string,
        imo: form.get("imo") as string,
        bandera: form.get("bandera") as string,
        productoId: form.get("productoId") as string,
        observaciones: form.get("observaciones") as string,
      }
      if (editId) {
        await updateProgramacion(editId, data)
        toast({ title: "Actualizada", description: "Programación actualizada", variant: "success" })
      } else {
        await createProgramacion(data)
        toast({ title: "Creada", description: "Programación creada", variant: "success" })
      }
      setDialogOpen(false)
      setEditId(null)
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCambiarEstado(id: string, estado: string) {
    try {
      await cambiarEstadoProgramacion(id, estado)
      toast({ title: "Estado actualizado", description: `Cambió a ${ESTADO_LABELS[estado]}`, variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProgramacion(id)
      toast({ title: "Eliminada", description: "Programación eliminada", variant: "success" })
      load()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  function openEdit(item: any) {
    setEditId(item.id)
    setEditItem(item)
    setBandera(item.bandera ?? "")
    setDialogOpen(true)
  }

  function openDetail(item: any) {
    setSelected(item)
    setDetailOpen(true)
  }

  const dialogTitle = editId ? "Editar Programación" : "Nueva Programación"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Programación Operativa"
        description="Planificación de operaciones de suministro"
        actions={<Button onClick={() => { setEditId(null); setDialogOpen(true) }}><Plus className="h-4 w-4 mr-2" /> Nueva Programación</Button>}
      />

      <DataTable columns={columns} data={items} loading={loading} searchable />

      <FormDialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditId(null); setEditItem(null); setBandera("") } }} title={dialogTitle} onSubmit={handleSubmit} loading={submitting}>
        <div className="grid gap-4" key={editId ?? "new"}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input id="fecha" name="fecha" type="date" required defaultValue={editItem ? (typeof editItem.fecha === "string" ? editItem.fecha.slice(0, 10) : new Date().toISOString().slice(0, 10)) : new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clienteId">Cliente</Label>
              <Select name="clienteId" required defaultValue={editItem?.clienteId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="agente">Agente</Label><Input id="agente" name="agente" defaultValue={editItem?.agente ?? ""} /></div>
            <div className="space-y-2">
              <Label htmlFor="puerto">Puerto</Label>
              <Select name="puerto" required defaultValue={editItem?.puerto}>
                <SelectTrigger><SelectValue placeholder="Seleccionar puerto" /></SelectTrigger>
                <SelectContent>
                  {PUERTOS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label htmlFor="lugarSuministro">Lugar de suministro</Label><Input id="lugarSuministro" name="lugarSuministro" defaultValue={editItem?.lugarSuministro ?? ""} /></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label htmlFor="motonave">Motonave</Label><Input id="motonave" name="motonave" required defaultValue={editItem?.motonave ?? ""} /></div>
            <div className="space-y-2"><Label htmlFor="imo">IMO</Label><Input id="imo" name="imo" defaultValue={editItem?.imo ?? ""} /></div>
            <div className="space-y-2">
              <Label>Bandera / Flag</Label>
              <SearchableSelect name="bandera" options={BANDERAS} value={bandera} onValueChange={setBandera} placeholder="Seleccionar bandera" renderOption={(o) => <><span className="mr-1.5">{getFlagEmoji(o)}</span>{o}</>} renderValue={(v) => <><span className="mr-1.5">{getFlagEmoji(v)}</span>{v}</>} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="productoId">Producto</Label>
            <Select name="productoId" required defaultValue={editItem?.productoId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
              <SelectContent>
                {productos.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label htmlFor="observaciones">Observaciones</Label><Input id="observaciones" name="observaciones" defaultValue={editItem?.observaciones ?? ""} /></div>
        </div>
      </FormDialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Programación #{selected?.numero}</DialogTitle>
            <div><Badge variant={ESTADO_STYLES[selected?.estado]}>{ESTADO_LABELS[selected?.estado]}</Badge></div>
          </DialogHeader>
          {selected && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Fecha:</strong> {formatDate(selected.fecha)}</div>
              <div><strong>Cliente:</strong> {selected.cliente?.nombre}</div>
              <div><strong>Agente:</strong> {selected.agente || "-"}</div>
              <div><strong>Puerto:</strong> {selected.puerto}</div>
              <div><strong>Lugar:</strong> {selected.lugarSuministro || "-"}</div>
              <div><strong>Motonave:</strong> {selected.motonave}</div>
              <div><strong>IMO:</strong> {selected.imo || "-"}</div>
              <div><strong>Bandera:</strong> {selected.bandera || "-"}</div>
              <div><strong>Producto:</strong> {selected.producto?.nombre}</div>
              <div className="col-span-2"><strong>Observaciones:</strong> {selected.observaciones || "-"}</div>
              <div className="col-span-2"><strong>Órdenes generadas:</strong> {selected._count?.ordenes ?? 0}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
