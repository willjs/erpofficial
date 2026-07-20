"use client"

import { useState, useRef, useEffect } from "react"
import { useActionState } from "react"
import { crearRequisicionPublica } from "@/actions/public-compras"
import { getCentrosCostosPublicos } from "@/actions/public-centro-costos"
import type { PublicRequisicionState } from "@/actions/public-compras"
import { uuid } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import * as XLSX from "xlsx"

interface ItemRow {
  key: string
  descripcion: string
  unidadMedida: string
  cantidadSolicitada: string
}

interface ArchivoAdjunto {
  key: string
  file: File
}

function emptyItem(): ItemRow {
  return {
    key: uuid(),
    descripcion: "",
    unidadMedida: "",
    cantidadSolicitada: "",
  }
}

interface CentroCostoOption {
  id: string
  codigo: string
  nombre: string
}

function CentroCostosSelect({ centrosCostos }: { centrosCostos: CentroCostoOption[] }) {
  const [value, setValue] = useState("__none__")
  return (
    <>
      <input type="hidden" name="centroCostosId" value={value === "__none__" ? "" : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger>
          <SelectValue placeholder="Seleccionar centro de costo" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Sin centro de costo</SelectItem>
          {centrosCostos.map((cc) => (
            <SelectItem key={cc.id} value={cc.id}>
              {cc.codigo} — {cc.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )
}

export default function SolicitarRequisicionPage() {
  const { toast } = useToast()
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [archivos, setArchivos] = useState<ArchivoAdjunto[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [centrosCostos, setCentrosCostos] = useState<CentroCostoOption[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    getCentrosCostosPublicos().then(setCentrosCostos)
  }, [])

  const [state, action, pending] = useActionState(
    async (_prev: PublicRequisicionState, form: FormData) => {
      items.forEach((item, idx) => {
        form.set(`items.${idx}.descripcion`, item.descripcion)
        form.set(`items.${idx}.unidadMedida`, item.unidadMedida)
        form.set(`items.${idx}.cantidadSolicitada`, item.cantidadSolicitada)
      })
      archivos.forEach((a, idx) => {
        form.set(`archivo.${idx}`, a.file)
      })
      return crearRequisicionPublica(_prev, form)
    },
    undefined
  )

  function updateItem(key: string, field: keyof Omit<ItemRow, "key">, value: string) {
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [field]: value } : it))
    )
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(key: string) {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  // ─── Excel ────────────────────────────────────────────────
  function handleExcel(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]

        // Read as array of arrays to find header row and extract form fields
        const rowsArr: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })
        let headerRow: string[] | null = null
        let dataStartIdx = -1

        for (let i = 0; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const joined = row.map(String).join(" ").toLowerCase()

          if (
            joined.includes("descripción") ||
            joined.includes("descripcion") ||
            joined.includes("concepto") ||
            (joined.includes("cantidad") && joined.includes("und"))
          ) {
            headerRow = row.map(String)
            dataStartIdx = i + 1
            break
          }
        }

        if (!headerRow) {
          // fallback: treat first non-empty row as header
          for (let i = 0; i < rowsArr.length; i++) {
            if (rowsArr[i] && rowsArr[i].length >= 2) {
              headerRow = rowsArr[i].map(String)
              dataStartIdx = i + 1
              break
            }
          }
        }

        if (!headerRow) return

        // Find column indices by header name
        const descIdx = headerRow.findIndex((h) =>
          /descripci[oó]n|concepto|art[ií]culo|producto|item/i.test(h)
        )
        const undIdx = headerRow.findIndex((h) => {
          const v = (h ?? "").trim()
          return (
            /^und$/i.test(v) ||
            /^und$/i.test(v.replace(/\s+/g, "")) ||
            /unidad/i.test(v) ||
            /medida/i.test(v) ||
            /umedida/i.test(v)
          )
        })
        const cantIdx = headerRow.findIndex((h) =>
          /cantidad/i.test(h)
        )

        const parsed: ItemRow[] = []
        for (let i = dataStartIdx; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const desc = descIdx >= 0 ? String(row[descIdx] ?? "").trim() : ""
          const und = undIdx >= 0 ? String(row[undIdx] ?? "").trim() : ""
          const cant = cantIdx >= 0 ? String(row[cantIdx] ?? "").trim() : ""
          if (!desc && !cant) continue
          parsed.push({
            key: uuid(),
            descripcion: desc,
            unidadMedida: und,
            cantidadSolicitada: cant,
          })
        }

        if (parsed.length > 0) {
          setItems(parsed)
        }
      } catch (err) {
        toast({ title: "Error al leer Excel", description: err instanceof Error ? err.message : "Formato no válido", variant: "destructive" })
      }
    }
    reader.readAsArrayBuffer(file)
  }

  // ─── Archivos adjuntos ────────────────────────────────────
  function addArchivos(files: FileList) {
    const nuevos: ArchivoAdjunto[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (file.name.match(/\.xlsx?$/i)) {
        handleExcel(file)
      }
      nuevos.push({ key: uuid(), file })
    }
    setArchivos((prev) => [...prev, ...nuevos])
  }

  function removeArchivo(key: string) {
    setArchivos((prev) => prev.filter((a) => a.key !== key))
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ─── Drag & drop ──────────────────────────────────────────
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      addArchivos(e.dataTransfer.files)
    }
  }

  // ─── Render ───────────────────────────────────────────────
  if (state?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Solicitud Enviada</CardTitle>
            <CardDescription>
              Su solicitud de requisición ha sido recibida y está pendiente
              de aprobación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archivos.length > 0 && (
              <p className="text-sm text-muted-foreground mb-2">
                {archivos.length} archivo(s) adjunto(s) recibido(s)
                correctamente.
              </p>
            )}
            <p className="text-sm text-muted-foreground mb-4">
              Recibirá una respuesta a la brevedad posible.
            </p>
            <Button onClick={() => window.location.reload()}>
              Nueva Solicitud
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/50 p-4 pt-12">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">
            Solicitud de Requisición
          </CardTitle>
          <CardDescription>
            Complete el formulario o suba un archivo Excel para solicitar
            bienes o servicios. Su solicitud será revisada por el
            departamento correspondiente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-6">
            {/* ─── Solicitante ─────────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="solicitante">
                Nombre del Solicitante
              </Label>
              <Input
                id="solicitante"
                name="solicitante"
                placeholder="Nombre completo"
                required
              />
            </div>

            {/* ─── Prioridad ────────────────────────────────── */}
            <div className="space-y-2">
              <Label>Prioridad</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="prioridad" value="normal" defaultChecked className="h-4 w-4 text-primary" />
                  <span>Normal</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="prioridad" value="urgente" className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-600">Urgente</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" name="prioridad" value="emergencia" className="h-4 w-4 text-destructive" />
                  <span className="text-destructive">Emergencia</span>
                </label>
              </div>
            </div>

            {/* ─── Centro de Costo ──────────────────────────── */}
            <div className="space-y-2">
              <Label>Centro de Costo</Label>
              <CentroCostosSelect centrosCostos={centrosCostos} />
            </div>



            {/* ─── Carga Excel ─────────────────────────────── */}
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm font-medium">
                Arrastre archivos aquí o haga clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Soporta Excel (.xlsx, .xls), PDF, imágenes y otros
                formatos
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.pdf,.jpg,.jpeg,.png,.doc,.docx,.txt"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) {
                    addArchivos(e.target.files)
                  }
                  e.target.value = ""
                }}
              />
            </div>

            {/* ─── Archivos adjuntos ───────────────────────── */}
            {archivos.length > 0 && (
              <div className="space-y-2">
                <Label>Archivos adjuntos</Label>
                <div className="divide-y rounded-md border">
                  {archivos.map((a) => (
                    <div
                      key={a.key}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {a.file.name.match(/\.xlsx?$/i) && (
                          <span className="text-green-600 font-medium shrink-0">
                            XLSX
                          </span>
                        )}
                        <span className="truncate">{a.file.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          ({formatSize(a.file.size)})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 shrink-0"
                        onClick={() => removeArchivo(a.key)}
                      >
                        ✕
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Artículos ───────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Artículos / Servicios</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  + Agregar Ítem
                </Button>
              </div>

              {/* Tabla de items */}
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-3 py-2 font-medium w-1/2">
                        Descripción
                      </th>
                      <th className="text-left px-3 py-2 font-medium w-[100px]">
                        Unidad
                      </th>
                      <th className="text-left px-3 py-2 font-medium w-[100px]">
                        Cantidad
                      </th>
                      <th className="w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.key} className="border-b last:border-0">
                        <td className="px-3 py-1.5">
                          <Input
                            placeholder="Descripción del ítem"
                            value={item.descripcion}
                            onChange={(e) =>
                              updateItem(item.key, "descripcion", e.target.value)
                            }
                            required
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            placeholder="Unidad"
                            value={item.unidadMedida}
                            onChange={(e) =>
                              updateItem(item.key, "unidadMedida", e.target.value)
                            }
                            required
                          />
                        </td>
                        <td className="px-3 py-1.5">
                          <Input
                            type="number"
                            placeholder="Cant."
                            min="0.01"
                            step="0.01"
                            value={item.cantidadSolicitada}
                            onChange={(e) =>
                              updateItem(
                                item.key,
                                "cantidadSolicitada",
                                e.target.value
                              )
                            }
                            required
                          />
                        </td>
                        <td className="px-1 py-1.5">
                          {items.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeItem(item.key)}
                            >
                              ✕
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observaciones">
                Observaciones (opcional)
              </Label>
              <Textarea
                id="observaciones"
                name="observaciones"
                placeholder="Información adicional..."
                rows={3}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Enviando..." : "Enviar Solicitud"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
