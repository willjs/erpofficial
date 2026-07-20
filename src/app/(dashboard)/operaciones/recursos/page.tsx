"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import {
  getBarcazas, createBarcaza, updateBarcaza, deleteBarcaza,
  getRemolcadores, createRemolcador, updateRemolcador, deleteRemolcador,
  getVehiculos, createVehiculo, updateVehiculo, deleteVehiculo,
  getConductores, createConductor, updateConductor, deleteConductor,
  getCapitanes, createCapitan, updateCapitan, deleteCapitan,
} from "@/actions/operaciones-recursos"

type TabType = "barcazas" | "remolcadores" | "vehiculos" | "conductores" | "capitanes"

export default function RecursosPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState<TabType>("barcazas")
  const [barcazas, setBarcazas] = useState<any[]>([])
  const [remolcadores, setRemolcadores] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [conductores, setConductores] = useState<any[]>([])
  const [capitanes, setCapitanes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [b, r, v, c, cap] = await Promise.all([
        getBarcazas(), getRemolcadores(), getVehiculos(), getConductores(), getCapitanes(),
      ])
      setBarcazas(b)
      setRemolcadores(r)
      setVehiculos(v)
      setConductores(c)
      setCapitanes(cap)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const form = new FormData(e.currentTarget)
      if (tab === "barcazas") {
        if (editId) await updateBarcaza(editId, { nombre: form.get("nombre") as string, capacidad: Number(form.get("capacidad")), estado: (form.get("estado") as string) || "DISPONIBLE" })
        else await createBarcaza({ nombre: form.get("nombre") as string, capacidad: Number(form.get("capacidad")), estado: (form.get("estado") as string) || "DISPONIBLE" })
      } else if (tab === "remolcadores") {
        if (editId) await updateRemolcador(editId, { nombre: form.get("nombre") as string, matricula: form.get("matricula") as string })
        else await createRemolcador({ nombre: form.get("nombre") as string, matricula: form.get("matricula") as string })
      } else if (tab === "vehiculos") {
        if (editId) await updateVehiculo(editId, { placa: form.get("placa") as string, tipo: (form.get("tipo") as string) || "CISTERNA" })
        else await createVehiculo({ placa: form.get("placa") as string, tipo: (form.get("tipo") as string) || "CISTERNA" })
      } else if (tab === "conductores") {
        if (editId) await updateConductor(editId, { nombre: form.get("nombre") as string, documento: form.get("documento") as string, licencia: form.get("licencia") as string })
        else await createConductor({ nombre: form.get("nombre") as string, documento: form.get("documento") as string, licencia: form.get("licencia") as string })
      } else if (tab === "capitanes") {
        if (editId) await updateCapitan(editId, { nombre: form.get("nombre") as string, licencia: form.get("licencia") as string })
        else await createCapitan({ nombre: form.get("nombre") as string, licencia: form.get("licencia") as string })
      }
      toast({ title: "Guardado", variant: "success" })
      setDialogOpen(false)
      setEditId(null)
      loadAll()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      if (tab === "barcazas") await deleteBarcaza(id)
      else if (tab === "remolcadores") await deleteRemolcador(id)
      else if (tab === "vehiculos") await deleteVehiculo(id)
      else if (tab === "conductores") await deleteConductor(id)
      else if (tab === "capitanes") await deleteCapitan(id)
      toast({ title: "Eliminado", variant: "success" })
      loadAll()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  function getColumns(): Column<any>[] {
    if (tab === "barcazas") return [
      { key: "nombre", header: "Nombre" },
      { key: "capacidad", header: "Capacidad", render: (r) => `${Number(r.capacidad)} T` },
      { key: "estado", header: "Estado", render: (r) => <Badge>{r.estado}</Badge> },
      { key: "activo", header: "Activo", render: (r) => r.activo ? "Sí" : "No" },
      { key: "acciones", header: "", render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditId(row.id); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )},
    ]
    if (tab === "remolcadores") return [
      { key: "nombre", header: "Nombre" },
      { key: "matricula", header: "Matrícula", render: (r) => r.matricula || "-" },
      { key: "activo", header: "Activo", render: (r) => r.activo ? "Sí" : "No" },
      { key: "acciones", header: "", render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditId(row.id); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )},
    ]
    if (tab === "vehiculos") return [
      { key: "placa", header: "Placa" },
      { key: "tipo", header: "Tipo" },
      { key: "activo", header: "Activo", render: (r) => r.activo ? "Sí" : "No" },
      { key: "acciones", header: "", render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditId(row.id); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )},
    ]
    if (tab === "conductores") return [
      { key: "nombre", header: "Nombre" },
      { key: "documento", header: "Documento", render: (r) => r.documento || "-" },
      { key: "licencia", header: "Licencia", render: (r) => r.licencia || "-" },
      { key: "acciones", header: "", render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditId(row.id); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )},
    ]
    return [
      { key: "nombre", header: "Nombre" },
      { key: "licencia", header: "Licencia", render: (r) => r.licencia || "-" },
      { key: "acciones", header: "", render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setEditId(row.id); setDialogOpen(true) }}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )},
    ]
  }

  function getData() {
    if (tab === "barcazas") return barcazas
    if (tab === "remolcadores") return remolcadores
    if (tab === "vehiculos") return vehiculos
    if (tab === "conductores") return conductores
    return capitanes
  }

  const labels: Record<TabType, string> = { barcazas: "Barcaza", remolcadores: "Remolcador", vehiculos: "Vehículo", conductores: "Conductor", capitanes: "Capitán" }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recursos Operativos"
        description="Barcazas, remolcadores, vehículos, conductores y capitanes"
        actions={<Button onClick={() => { setEditId(null); setDialogOpen(true) }}><Plus className="h-4 w-4 mr-2" /> Nuevo</Button>}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="barcazas">Barcazas</TabsTrigger>
          <TabsTrigger value="remolcadores">Remolcadores</TabsTrigger>
          <TabsTrigger value="vehiculos">Vehículos</TabsTrigger>
          <TabsTrigger value="conductores">Conductores</TabsTrigger>
          <TabsTrigger value="capitanes">Capitanes</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          <DataTable columns={getColumns()} data={getData()} loading={loading} />
        </TabsContent>
      </Tabs>

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editId ? "Editar" : `Nuevo ${labels[tab]}`} onSubmit={handleSubmit} loading={submitting}>
        <div className="grid gap-4">
          {tab === "barcazas" && (
            <>
              <div className="space-y-2"><Label>Nombre</Label><Input name="nombre" required /></div>
              <div className="space-y-2"><Label>Capacidad (TON)</Label><Input name="capacidad" type="number" step="0.1" required /></div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select name="estado" defaultValue="DISPONIBLE">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DISPONIBLE">Disponible</SelectItem>
                    <SelectItem value="EN_USO">En uso</SelectItem>
                    <SelectItem value="MANTENIMIENTO">Mantenimiento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {tab === "remolcadores" && (
            <>
              <div className="space-y-2"><Label>Nombre</Label><Input name="nombre" required /></div>
              <div className="space-y-2"><Label>Matrícula</Label><Input name="matricula" /></div>
            </>
          )}
          {tab === "vehiculos" && (
            <>
              <div className="space-y-2"><Label>Placa</Label><Input name="placa" required /></div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select name="tipo" defaultValue="CISTERNA">
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CISTERNA">Cisterna</SelectItem>
                    <SelectItem value="CAMION">Camión</SelectItem>
                    <SelectItem value="PICKUP">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {tab === "conductores" && (
            <>
              <div className="space-y-2"><Label>Nombre</Label><Input name="nombre" required /></div>
              <div className="space-y-2"><Label>Documento</Label><Input name="documento" /></div>
              <div className="space-y-2"><Label>Licencia</Label><Input name="licencia" /></div>
            </>
          )}
          {tab === "capitanes" && (
            <>
              <div className="space-y-2"><Label>Nombre</Label><Input name="nombre" required /></div>
              <div className="space-y-2"><Label>Licencia</Label><Input name="licencia" /></div>
            </>
          )}
        </div>
      </FormDialog>
    </div>
  )
}
