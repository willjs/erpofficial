"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  getServicios, createServicio, updateServicio, deleteServicio,
  importServiciosExcel, type ServicioFormData, type ServicioImportRow,
} from "@/actions/servicios"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plus, Pencil, Trash2, Upload } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import * as XLSX from "xlsx"

type ServicioItem = Awaited<ReturnType<typeof getServicios>>[number]

const defaultServicio: ServicioFormData = {
  codigo: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  unidadMedida: "UNIDAD",
  precioUnitario: null,
}

export default function ServiciosPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<ServicioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ServicioFormData>(defaultServicio)
  const [saving, setSaving] = useState(false)

  const [importDialog, setImportDialog] = useState(false)
  const [importRows, setImportRows] = useState<ServicioImportRow[]>([])
  const [importResult, setImportResult] = useState<Awaited<ReturnType<typeof importServiciosExcel>> | null>(null)
  const [importModo, setImportModo] = useState<"crear" | "actualizar">("actualizar")
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await getServicios()
      setItems(data)
    } catch {
      toast({ title: "Error al cargar servicios", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtrados = items.filter((s) => {
    const q = search.toLowerCase()
    return (
      s.codigo.toLowerCase().includes(q) ||
      s.nombre.toLowerCase().includes(q) ||
      (s.categoria && s.categoria.toLowerCase().includes(q))
    )
  })

  function openCreate() {
    setEditId(null)
    setForm(defaultServicio)
    setDialogOpen(true)
  }

  function openEdit(item: ServicioItem) {
    setEditId(item.id)
    setForm({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      categoria: item.categoria ?? "",
      unidadMedida: item.unidadMedida,
      precioUnitario: item.precioUnitario ? Number(item.precioUnitario) : null,
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editId) {
        await updateServicio(editId, form)
      } else {
        await createServicio(form)
      }
      setDialogOpen(false)
      await load()
      toast({ title: editId ? "Servicio actualizado" : "Servicio creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar servicio", description: err?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteServicio(id)
      await load()
      toast({ title: "Servicio eliminado", variant: "success" })
    } catch {
      toast({ title: "Error al eliminar servicio", variant: "destructive" })
    }
  }

  function handleExcelFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rowsArr: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        let headerRow: string[] | null = null
        let dataStartIdx = -1

        for (let i = 0; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const joined = row.map(String).join(" ").toLowerCase()
          if (
            joined.includes("código") || joined.includes("codigo") ||
            (joined.includes("nombre") && joined.includes("precio"))
          ) {
            headerRow = row.map(String)
            dataStartIdx = i + 1
            break
          }
        }

        if (!headerRow) {
          for (let i = 0; i < rowsArr.length; i++) {
            if (rowsArr[i] && rowsArr[i].length >= 2) {
              headerRow = rowsArr[i].map(String)
              dataStartIdx = i + 1
              break
            }
          }
        }

        if (!headerRow) {
          toast({ title: "Error", description: "No se encontraron encabezados en el archivo", variant: "destructive" })
          return
        }

        function findColIndex(names: string[]): number {
          return headerRow!.findIndex((h) => names.some((n) => h.toLowerCase().includes(n)))
        }

        const codigoIdx = findColIndex(["código", "codigo", "code"])
        const nombreIdx = findColIndex(["nombre", "name", "descripción", "descripcion"])
        const categoriaIdx = findColIndex(["categoría", "categoria", "category", "cat"])
        const unidadIdx = findColIndex(["unidad", "umedida", "medida", "unit"])
        const precioIdx = findColIndex(["precio", "price", "precio unitario", "p. unit", "p unit"])
        const descIdx = findColIndex(["descripción", "descripcion", "description", "observación", "observacion"])

        const parsed: ServicioImportRow[] = []

        for (let i = dataStartIdx; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const codigo = codigoIdx >= 0 ? String(row[codigoIdx] ?? "").trim() : ""
          const nombre = nombreIdx >= 0 ? String(row[nombreIdx] ?? "").trim() : (codigoIdx >= 0 ? "" : String(row[0] ?? "").trim())
          if (!codigo && !nombre) continue
          parsed.push({
            codigo,
            nombre,
            categoria: categoriaIdx >= 0 ? String(row[categoriaIdx] ?? "").trim() || undefined : undefined,
            unidadMedida: unidadIdx >= 0 ? String(row[unidadIdx] ?? "").trim() || "UNIDAD" : "UNIDAD",
            precioUnitario: precioIdx >= 0 ? (Number(row[precioIdx]) || null) : null,
            descripcion: descIdx >= 0 ? String(row[descIdx] ?? "").trim() || undefined : undefined,
          })
        }

        setImportRows(parsed)
        setImportResult(null)
      } catch {
        toast({ title: "Error al leer archivo", description: "Verifica que sea un archivo Excel válido", variant: "destructive" })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleImportSubmit() {
    setImportLoading(true)
    try {
      const result = await importServiciosExcel(importRows, importModo)
      setImportResult(result)
      if (result.creados > 0 || result.actualizados > 0) {
        await load()
      }
      toast({
        title: "Importación completada",
        description: `${result.creados} creados, ${result.actualizados} actualizados, ${result.errores} errores`,
        variant: result.errores > 0 ? "default" : "success",
      })
    } catch (err: any) {
      toast({ title: "Error al importar", description: err?.message, variant: "destructive" })
    } finally {
      setImportLoading(false)
    }
  }

  function openImportDialog() {
    setImportRows([])
    setImportResult(null)
    setImportDialog(true)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const columns: Column<ServicioItem>[] = [
    { key: "codigo", header: "Código" },
    { key: "nombre", header: "Nombre" },
    {
      key: "categoria",
      header: "Categoría",
      render: (item) => item.categoria ? <Badge variant="secondary">{item.categoria}</Badge> : "-",
    },
    { key: "unidadMedida", header: "U. Medida" },
    {
      key: "precioUnitario",
      header: "Precio",
      render: (item) => (item.precioUnitario ? formatMoney(Number(item.precioUnitario)) : "-"),
    },
    {
      key: "acciones",
      header: "",
      render: (item) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Servicios"
        description="Gestión de servicios registrados en el catálogo"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={openImportDialog}>
              <Upload className="mr-2 h-4 w-4" /> Importar Excel
            </Button>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> Nuevo Servicio
            </Button>
          </div>
        }
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="Buscar servicio..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground">{filtrados.length} servicios</span>
      </div>

      <DataTable columns={columns} data={filtrados} loading={loading} />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editId ? "Editar Servicio" : "Nuevo Servicio"}
        loading={saving}
        onSubmit={handleSave}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Unidad de Medida</Label>
              <Select value={form.unidadMedida} onValueChange={(v) => setForm((f) => ({ ...f, unidadMedida: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIDAD">Unidad</SelectItem>
                  <SelectItem value="HORA">Hora</SelectItem>
                  <SelectItem value="DIA">Día</SelectItem>
                  <SelectItem value="MES">Mes</SelectItem>
                  <SelectItem value="SERVICIO">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input value={form.categoria ?? ""} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Precio Unitario</Label>
              <Input type="number" step="0.01" value={form.precioUnitario ?? ""} onChange={(e) => setForm((f) => ({ ...f, precioUnitario: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={form.descripcion ?? ""} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={importDialog}
        onOpenChange={(o) => { setImportDialog(o); if (!o) { setImportRows([]); setImportResult(null) } }}
        title="Importar Servicios desde Excel"
        loading={importLoading}
        onSubmit={handleImportSubmit}
        submitLabel={importResult ? "Cerrar" : "Importar"}
      >
        <div className="space-y-4">
          {!importResult && importRows.length === 0 && (
            <div className="space-y-2">
              <Label>Modo de importación</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={importModo === "actualizar" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setImportModo("actualizar")}
                  className="flex-1"
                >
                  Actualizar existentes
                </Button>
                <Button
                  type="button"
                  variant={importModo === "crear" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setImportModo("crear")}
                  className="flex-1"
                >
                  Solo crear nuevos
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {importModo === "actualizar"
                  ? "Si el código ya existe, se actualizarán nombre, precio, categoría y descripción."
                  : "Si el código ya existe, se omitirá (no se modificará)."}
              </p>
              <Label>Archivo Excel</Label>
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleExcelFile(file)
                }}
              />
              <details className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
                <summary className="cursor-pointer font-medium">Ver formato esperado</summary>
                <div className="mt-1 space-y-1">
                  <p>Columnas: Código, Nombre, Categoría, Unidad, Precio, Descripción</p>
                  <pre className="bg-muted p-1 rounded text-[10px] overflow-x-auto">
{`Código    | Nombre         | Categoría   | Unidad | Precio
SVC-001   | Limpieza       | Servicios   | UNIDAD | 50000
SVC-002   | Soporte Técnico | Tecnología  | HORA   | 25000`}
                  </pre>
                </div>
              </details>
            </div>
          )}

          {!importResult && importRows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{importRows.length} servicio(s) detectado(s)</p>
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-2 py-1">Código</th>
                      <th className="text-left px-2 py-1">Nombre</th>
                      <th className="text-left px-2 py-1">U. Medida</th>
                      <th className="text-right px-2 py-1">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="px-2 py-1">{r.codigo}</td>
                        <td className="px-2 py-1">{r.nombre}</td>
                        <td className="px-2 py-1">{r.unidadMedida}</td>
                        <td className="px-2 py-1 text-right">{r.precioUnitario ? formatMoney(r.precioUnitario) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-2 text-sm">
              <p><strong>Resultado:</strong></p>
              <ul className="space-y-1">
                <li>Creados: <strong>{importResult.creados}</strong></li>
                <li>Actualizados: <strong>{importResult.actualizados}</strong></li>
                <li>Errores: <strong>{importResult.errores}</strong></li>
              </ul>
              {importResult.detalles.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-xs text-muted-foreground">Ver detalles</summary>
                  <ul className="mt-1 max-h-32 overflow-y-auto space-y-0.5">
                    {importResult.detalles.map((d, i) => (
                      <li key={i} className="text-xs text-muted-foreground">{d}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      </FormDialog>
    </div>
  )
}
