"use client"

import { useState, useEffect } from "react"
import { Plus, Trash2, Power, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/shared/page-header"
import { FormDialog } from "@/components/shared/form-dialog"
import { useToast } from "@/components/ui/use-toast"
import { formatDate } from "@/lib/utils"
import {
  getCodigosAprobacion,
  crearCodigoAprobacion,
  eliminarCodigoAprobacion,
  desactivarCodigoAprobacion,
} from "@/actions/codigos-aprobacion"

type Codigo = {
  id: string
  codigo: string
  descripcion: string | null
  activo: boolean
  usado: boolean
  usadoEn: string | null
  usadoFecha: string | null
  createdAt: string
}

export function CodigosAprobacionPage() {
  const { toast } = useToast()
  const [codigos, setCodigos] = useState<Codigo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ codigo: "", descripcion: "" })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await getCodigosAprobacion()
      setCodigos(data as Codigo[])
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleCrear() {
    if (!form.codigo.trim()) { toast({ title: "Error", description: "El código es requerido", variant: "destructive" }); return }
    setSaving(true)
    try {
      await crearCodigoAprobacion({ codigo: form.codigo, descripcion: form.descripcion || null })
      toast({ title: "Código creado", variant: "success" })
      setDialogOpen(false)
      setForm({ codigo: "", descripcion: "" })
      load()
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleEliminar(id: string) {
    if (!confirm("¿Eliminar este código?")) return
    try {
      await eliminarCodigoAprobacion(id)
      toast({ title: "Código eliminado", variant: "success" })
      load()
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  async function handleToggle(id: string) {
    try {
      await desactivarCodigoAprobacion(id)
      load()
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Códigos de Aprobación"
        description="Administre los códigos que usa presidencia para aprobar cotizaciones"
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />Nuevo código
          </Button>
        }
      />

      <Card>
        <CardHeader><CardTitle className="text-lg">Códigos registrados</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : codigos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay códigos de aprobación registrados.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">Código</th>
                    <th className="text-left py-2 pr-4">Descripción</th>
                    <th className="text-center py-2 pr-4">Estado</th>
                    <th className="text-center py-2 pr-4">Usado</th>
                    <th className="text-left py-2 pr-4">Usado en</th>
                    <th className="text-left py-2 pr-4">Creado</th>
                    <th className="text-right py-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {codigos.map((c) => (
                    <tr key={c.id} className="border-b">
                      <td className="py-2 pr-4 font-mono font-bold tracking-wider">{c.codigo}</td>
                      <td className="py-2 pr-4">{c.descripcion || "—"}</td>
                      <td className="py-2 pr-4 text-center">
                        <Badge variant={c.activo ? "success" : "secondary"}>{c.activo ? "Activo" : "Inactivo"}</Badge>
                      </td>
                      <td className="py-2 pr-4 text-center">
                        {c.usado ? <Badge variant="warning">Usado</Badge> : <Badge variant="outline">Disponible</Badge>}
                      </td>
                      <td className="py-2 pr-4 text-xs">{c.usadoEn ? c.usadoEn.slice(0, 12) : "—"}</td>
                      <td className="py-2 pr-4 text-xs">{formatDate(c.createdAt)}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleToggle(c.id)} disabled={c.usado} title={c.activo ? "Desactivar" : "Activar"}>
                            {c.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEliminar(c.id)} disabled={c.usado} title="Eliminar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Nuevo código de aprobación"
        onSubmit={(e) => { e.preventDefault(); handleCrear() }}
        loading={saving}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="codigo">Código *</Label>
            <Input
              id="codigo"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
              placeholder="Ej: PRES2024"
              className="uppercase"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <Input
              id="descripcion"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej: Código de presidencia primer semestre"
            />
          </div>
        </div>
      </FormDialog>
    </div>
  )
}
