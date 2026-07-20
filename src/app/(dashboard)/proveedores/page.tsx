"use client"

import { useState, useEffect, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, Paperclip, X, FileText, Eye, Download } from "lucide-react"

interface ArchivoUI {
  id: string
  nombre: string
  url?: string
  tamaño?: number
  base64?: string
  pending?: boolean
}

type Proveedor = { id: string; razonSocial: string; nit: string; contacto: string | null; telefono: string | null; email: string | null; emailFactura: string | null; direccion: string | null; archivos?: unknown }

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function ProveedoresPage() {
  const { toast } = useToast()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ razonSocial: "", nit: "", contacto: "", telefono: "", email: "", emailFactura: "", direccion: "" })
  const [archivos, setArchivos] = useState<ArchivoUI[]>([])
  const [saving, setSaving] = useState(false)
  const [viewFiles, setViewFiles] = useState<{ proveedor: string; files: { nombre: string; url: string; tamaño: number }[] } | null>(null)

  const load = useCallback(async () => {
    const { getProveedores } = await import("@/actions/compras")
    const data = await getProveedores()
    setProveedores(data as any)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = proveedores.filter((p) => {
    const q = search.toLowerCase()
    return p.razonSocial.toLowerCase().includes(q) || p.nit.toLowerCase().includes(q) || (p.contacto && p.contacto.toLowerCase().includes(q))
  })

  function openCreate() {
    setEditId(null)
    setForm({ razonSocial: "", nit: "", contacto: "", telefono: "", email: "", emailFactura: "", direccion: "" })
    setArchivos([])
    setDialogOpen(true)
  }

  function openEdit(prov: Proveedor) {
    setEditId(prov.id)
    setForm({ razonSocial: prov.razonSocial, nit: prov.nit, contacto: prov.contacto ?? "", telefono: prov.telefono ?? "", email: prov.email ?? "", emailFactura: prov.emailFactura ?? "", direccion: prov.direccion ?? "" })
    const archs: { nombre: string; url: string; tamaño: number }[] = Array.isArray(prov.archivos) ? (prov.archivos as any) : []
    setArchivos(archs.map((a) => ({ id: a.url, nombre: a.nombre, url: a.url, tamaño: a.tamaño })))
    setDialogOpen(true)
  }

  function handleAddFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const readers = files.map((file) => new Promise<ArchivoUI>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve({ id: `pending_${Date.now()}_${Math.random()}`, nombre: file.name, tamaño: file.size, base64: (reader.result as string).split(",")[1], pending: true })
      reader.readAsDataURL(file)
    }))
    Promise.all(readers).then((items) => setArchivos((prev) => [...prev, ...items]))
    e.target.value = ""
  }

  function removeArchivo(id: string) {
    setArchivos((prev) => prev.filter((a) => a.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { createProveedor, updateProveedor } = await import("@/actions/compras")
      const pendingFiles = archivos.filter((a) => a.pending && a.base64).map((a) => ({ nombre: a.nombre, base64: a.base64! }))
      if (editId) {
        await updateProveedor(editId, { ...form, archivos: pendingFiles } as any)
      } else {
        await createProveedor({ ...form, archivos: pendingFiles } as any)
      }
      setDialogOpen(false)
      load()
      toast({ title: editId ? "Proveedor actualizado" : "Proveedor creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar proveedor", description: err?.message, variant: "destructive" })
    } finally { setSaving(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Desactivar este proveedor?")) return
    try {
      const { deleteProveedor } = await import("@/actions/compras")
      await deleteProveedor(id)
      load()
      toast({ title: "Proveedor desactivado", variant: "success" })
    } catch (err: any) { toast({ title: "Error al desactivar proveedor", description: err?.message, variant: "destructive" }) }
  }

  async function handleDeleteArchivo(url: string) {
    if (!editId) return removeArchivo(url)
    try {
      const { deleteProveedorArchivo } = await import("@/actions/compras")
      await deleteProveedorArchivo(editId, url)
      removeArchivo(url)
      toast({ title: "Archivo eliminado", variant: "success" })
    } catch (err: any) { toast({ title: "Error al eliminar archivo", description: err?.message, variant: "destructive" }) }
  }

  const columns: Column<Proveedor>[] = [
    { key: "razonSocial", header: "Razón Social" },
    { key: "nit", header: "NIT" },
    { key: "contacto", header: "Contacto" },
    { key: "telefono", header: "Teléfono" },
    { key: "email", header: "Email" },
    {
      key: "archivos", header: "Docs", render: (p) => {
        const files: { nombre: string; url: string; tamaño: number }[] = Array.isArray(p.archivos) ? (p.archivos as any) : []
        return files.length > 0
          ? <button type="button" className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer" onClick={() => setViewFiles({ proveedor: p.razonSocial, files })}><Paperclip className="h-3.5 w-3.5" />{files.length}</button>
          : <span className="text-xs text-muted-foreground">—</span>
      }, className: "w-16 text-center"
    },
    {
      key: "acciones", header: "", render: (p) => {
        const files: { nombre: string; url: string; tamaño: number }[] = Array.isArray(p.archivos) ? (p.archivos as any) : []
        return (
          <div className="flex gap-1">
            {files.length > 0 && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewFiles({ proveedor: p.razonSocial, files })}><Eye className="h-4 w-4" /></Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        )
      }, className: "w-28"
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader title="Proveedores" description="Gestión de proveedores" />

      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <Input placeholder="Buscar..." className="w-full sm:w-64" value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button onClick={openCreate} className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" />Nuevo Proveedor</Button>
      </div>

      <DataTable columns={columns} data={filtered} loading={loading} mobileCardTitle={(p) => <>{p.razonSocial}</>} />

      <FormDialog open={dialogOpen} onOpenChange={setDialogOpen} title={editId ? "Editar Proveedor" : "Nuevo Proveedor"} loading={saving} onSubmit={handleSave as any}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Razón Social</Label><Input value={form.razonSocial} onChange={(e) => setForm(p => ({ ...p, razonSocial: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>NIT</Label><Input value={form.nit} onChange={(e) => setForm(p => ({ ...p, nit: e.target.value }))} required /></div>
            <div className="space-y-2"><Label>Contacto</Label><Input value={form.contacto} onChange={(e) => setForm(p => ({ ...p, contacto: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Teléfono</Label><Input value={form.telefono} onChange={(e) => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Email Factura Electrónica</Label><Input type="email" value={form.emailFactura} onChange={(e) => setForm(p => ({ ...p, emailFactura: e.target.value }))} /></div>
            <div className="space-y-2 col-span-2"><Label>Dirección</Label><Input value={form.direccion} onChange={(e) => setForm(p => ({ ...p, direccion: e.target.value }))} /></div>
          </div>

          <div className="space-y-2">
            <Label>Anexos</Label>
            <div className="flex flex-wrap gap-2">
              {archivos.map((a) => (
                <div key={a.id} className="flex items-center gap-2 bg-muted rounded px-3 py-1.5 text-sm max-w-[300px]">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  {a.url ? (
                    <a href={a.url} target="_blank" className="truncate hover:underline">{a.nombre}</a>
                  ) : (
                    <span className="truncate">{a.nombre}</span>
                  )}
                  {a.tamaño != null && <span className="text-xs text-muted-foreground shrink-0">({formatSize(a.tamaño)})</span>}
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => handleDeleteArchivo(a.id)}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => document.getElementById("file-input-proveedor")?.click()}>
                <Plus className="h-4 w-4 mr-1" />Agregar archivo
              </Button>
              <Input id="file-input-proveedor" type="file" multiple className="hidden" onChange={handleAddFiles} />
            </div>
          </div>
        </div>
      </FormDialog>

      <Dialog open={!!viewFiles} onOpenChange={(o) => { if (!o) setViewFiles(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anexos de {viewFiles?.proveedor ?? "..."}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {viewFiles?.files.length === 0 && <p className="text-sm text-muted-foreground">Sin archivos adjuntos</p>}
            {viewFiles?.files.map((f, i) => (
              <div key={i} className="flex items-center gap-3 bg-muted rounded px-3 py-2">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.nombre}</p>
                  <p className="text-xs text-muted-foreground">{formatSize(f.tamaño)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <a href={f.url} target="_blank">
                    <Button type="button" variant="outline" size="sm"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                  </a>
                  <a href={f.url} download>
                    <Button type="button" variant="outline" size="sm"><Download className="h-4 w-4 mr-1" />Descargar</Button>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
