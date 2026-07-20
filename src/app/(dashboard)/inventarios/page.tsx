"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as XLSX from "xlsx"
import { useToast } from "@/components/ui/use-toast"
import { Plus, Pencil, Trash2, Package, Warehouse, ArrowRightLeft, Settings, Power, PowerOff, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import * as Tabs from "@radix-ui/react-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { formatMoney, formatDateTime } from "@/lib/utils"
import {
  getAlmacenes,
  createAlmacen,
  updateAlmacen,
  toggleAlmacen,
  getProductos,
  createProducto,
  updateProducto,
  deleteProducto,
  getStock,
  getMovimientosInventario,
  ingresarStock,
  retirarStock,
  type AlmacenFormData,
  type ProductoFormData,
  importProductosExcel,
  type ProductoImportRow,
} from "@/actions/inventarios"

type AlmacenItem = Awaited<ReturnType<typeof getAlmacenes>>[number]
type ProductoItem = Awaited<ReturnType<typeof getProductos>>[number]
type StockItem = Awaited<ReturnType<typeof getStock>>[number]
type MovimientoItem = Awaited<ReturnType<typeof getMovimientosInventario>>[number]

const defaultProducto: ProductoFormData = {
  codigo: "",
  nombre: "",
  descripcion: "",
  categoria: "",
  unidadMedida: "UNIDAD",
  precioUnitario: null,
}

const defaultAlmacen: AlmacenFormData = {
  codigo: "",
  nombre: "",
  direccion: "",
}

export default function InventariosPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("productos")

  const [productos, setProductos] = useState<ProductoItem[]>([])
  const [almacenes, setAlmacenes] = useState<AlmacenItem[]>([])
  const [stock, setStock] = useState<StockItem[]>([])
  const [movimientos, setMovimientos] = useState<MovimientoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const [prodDialog, setProdDialog] = useState(false)
  const [prodEditId, setProdEditId] = useState<string | null>(null)
  const [prodForm, setProdForm] = useState<ProductoFormData>(defaultProducto)
  const [saving, setSaving] = useState(false)

  const [almDialog, setAlmDialog] = useState(false)
  const [almEditId, setAlmEditId] = useState<string | null>(null)
  const [almForm, setAlmForm] = useState<AlmacenFormData>(defaultAlmacen)
  const [almSaving, setAlmSaving] = useState(false)

  const [movDialog, setMovDialog] = useState(false)
  const [movTipo, setMovTipo] = useState<"ENTRADA" | "SALIDA">("ENTRADA")
  const [movForm, setMovForm] = useState({
    productoId: "",
    almacenId: "",
    cantidad: 0,
    valorUnitario: 0,
    referencia: "",
    observaciones: "",
  })
  const [movSaving, setMovSaving] = useState(false)

  const [importDialog, setImportDialog] = useState(false)
  const [importRows, setImportRows] = useState<ProductoImportRow[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importModo, setImportModo] = useState<"actualizar" | "crear">("actualizar")
  const [importResult, setImportResult] = useState<{
    creados: number; actualizados: number; errores: number; total: number; detalles: string[]
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [p, a, s, m] = await Promise.all([
        getProductos(),
        getAlmacenes(),
        getStock(),
        getMovimientosInventario(100),
      ])
      setProductos(p)
      setAlmacenes(a)
      setStock(s)
      setMovimientos(m)
    } catch (err: any) {
      toast({ title: "Error al cargar datos", description: err?.message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadAll() }, [loadAll])

  // ─── Importar Excel ─────────────────────────────

  function normalizeKey(s: string) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
  }

  function parseNumberCell(val: unknown): number | null {
    if (val == null || val === "") return null
    if (typeof val === "number") return val
    let str = String(val).trim()
    // Detect locale format: if last comma or dot is a decimal separator
    const lastDot = str.lastIndexOf(".")
    const lastComma = str.lastIndexOf(",")
    if (lastComma > lastDot) {
      // European format: 1.234,56 → remove dots, replace comma with dot
      str = str.replace(/\./g, "").replace(",", ".")
    } else if (lastDot > lastComma) {
      // US format: 1,234.56 → remove commas
      str = str.replace(/,/g, "")
    }
    const num = Number(str)
    return isNaN(num) ? null : num
  }

  function handleExcelFile(file: File) {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: "array" })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rowsArr: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 })

        // Detect headers (accent-insensitive)
        const headerRow = rowsArr[0] ?? []
        const colMap: Record<string, number> = {}
        headerRow.forEach((h: string, i: number) => {
          const key = normalizeKey(String(h ?? ""))
          if (key.includes("codigo") || key === "cod") colMap.codigo = i
          if (key.includes("nombre") || key === "nom") colMap.nombre = i
          if (key.includes("categoria") || key.includes("categ") || key === "cat") colMap.categoria = i
          if (key.includes("unidad") || key.includes("medida") || key === "um") colMap.unidadMedida = i
          if (key.includes("precio") || key.includes("prec") || key.includes("valor")) colMap.precioUnitario = i
          if (key.includes("descripcion") || key.includes("desc")) colMap.descripcion = i
          if (key === "stock" || key.includes("stock inicial") || key.includes("stockini")) colMap.stockInicial = i
          if (key.includes("stock minimo") || key.includes("minimo") || key.includes("stock min") || key === "stock minimo") colMap.stockMinimo = i
          if (key.includes("almacen") || key.includes("bodega") || key === "alm") colMap.almacenCodigo = i
        })

        const parsed: ProductoImportRow[] = []

        for (let i = 1; i < rowsArr.length; i++) {
          const row = rowsArr[i]
          if (!row || row.length === 0) continue
          const codigo = colMap.codigo !== undefined ? String(row[colMap.codigo] ?? "").trim() : ""
          const nombre = colMap.nombre !== undefined ? String(row[colMap.nombre] ?? "").trim() : ""
          if (!codigo && !nombre) continue
          const precioRaw = colMap.precioUnitario !== undefined ? row[colMap.precioUnitario] : null
          parsed.push({
            codigo,
            nombre,
            categoria: colMap.categoria !== undefined ? String(row[colMap.categoria] ?? "").trim() || undefined : undefined,
            unidadMedida: colMap.unidadMedida !== undefined ? String(row[colMap.unidadMedida] ?? "").trim() || "UNIDAD" : "UNIDAD",
            precioUnitario: parseNumberCell(precioRaw),
            descripcion: colMap.descripcion !== undefined ? String(row[colMap.descripcion] ?? "").trim() || undefined : undefined,
            stockInicial: parseNumberCell(colMap.stockInicial !== undefined ? row[colMap.stockInicial] : null) ?? 0,
            stockMinimo: parseNumberCell(colMap.stockMinimo !== undefined ? row[colMap.stockMinimo] : null) ?? 0,
            almacenCodigo: colMap.almacenCodigo !== undefined ? String(row[colMap.almacenCodigo] ?? "").trim() || undefined : undefined,
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
      const result = await importProductosExcel(importRows, importModo)
      setImportResult(result)
      if (result.creados > 0 || result.actualizados > 0) {
        await loadAll()
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
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ─── Productos ──────────────────────────────────

  const productosFiltrados = search
    ? productos.filter(
        (p) =>
          p.codigo.toLowerCase().includes(search.toLowerCase()) ||
          p.nombre.toLowerCase().includes(search.toLowerCase()) ||
          (p.categoria ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : productos

  function openCreateProducto() {
    const prefix = "P-"
    const next = productos.filter((p) => p.codigo.startsWith(prefix)).length + 1
    setProdEditId(null)
    setProdForm({ ...defaultProducto, codigo: `${prefix}${String(next).padStart(3, "0")}` })
    setProdDialog(true)
  }

  function openEditProducto(item: ProductoItem) {
    setProdEditId(item.id)
    setProdForm({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      categoria: item.categoria ?? "",
      unidadMedida: item.unidadMedida,
      precioUnitario: item.precioUnitario ? Number(item.precioUnitario) : null,
    })
    setProdDialog(true)
  }

  async function handleSaveProducto(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (prodEditId) {
        await updateProducto(prodEditId, prodForm)
      } else {
        await createProducto(prodForm)
      }
      setProdDialog(false)
      await loadAll()
      toast({ title: prodEditId ? "Producto actualizado" : "Producto creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar producto", description: err?.message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProducto(id: string) {
    if (!confirm("¿Eliminar este producto?")) return
    try {
      await deleteProducto(id)
      await loadAll()
      toast({ title: "Producto eliminado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al eliminar producto", description: err?.message, variant: "destructive" })
    }
  }

  const prodColumns: Column<ProductoItem>[] = [
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
      key: "stock",
      header: "Stock Total",
      render: (item) => {
        const total = item.stocks.reduce((s, st) => s + Number(st.cantidad), 0)
        return <span className="font-medium">{total}</span>
      },
    },
    {
      key: "acciones",
      header: "",
      render: (item) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditProducto(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDeleteProducto(item.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  // ─── Almacenes ──────────────────────────────────

  function openCreateAlmacen() {
    setAlmEditId(null)
    setAlmForm(defaultAlmacen)
    setAlmDialog(true)
  }

  function openEditAlmacen(item: AlmacenItem) {
    setAlmEditId(item.id)
    setAlmForm({
      codigo: item.codigo,
      nombre: item.nombre,
      direccion: item.direccion ?? "",
    })
    setAlmDialog(true)
  }

  async function handleSaveAlmacen(e: React.FormEvent) {
    e.preventDefault()
    setAlmSaving(true)
    try {
      if (almEditId) {
        await updateAlmacen(almEditId, almForm)
      } else {
        await createAlmacen(almForm)
      }
      setAlmDialog(false)
      await loadAll()
      toast({ title: almEditId ? "Almacén actualizado" : "Almacén creado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al guardar almacén", description: err?.message, variant: "destructive" })
    } finally {
      setAlmSaving(false)
    }
  }

  async function handleToggleAlmacen(id: string) {
    try {
      await toggleAlmacen(id)
      await loadAll()
      toast({ title: "Estado de almacén actualizado", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al cambiar estado", description: err?.message, variant: "destructive" })
    }
  }

  const almColumns: Column<AlmacenItem>[] = [
    { key: "codigo", header: "Código" },
    { key: "nombre", header: "Nombre" },
    { key: "direccion", header: "Dirección", render: (a) => a.direccion ?? "-" },
    {
      key: "productos",
      header: "Productos",
      render: (a) => <span className="text-muted-foreground">{a._count.stocks} items</span>,
    },
    {
      key: "activo",
      header: "Estado",
      render: (a) => (
        <Badge variant={a.activo ? "success" : "secondary"}>{a.activo ? "Activo" : "Inactivo"}</Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      render: (a) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditAlmacen(a)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleToggleAlmacen(a.id)}>
            {a.activo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4 text-green-500" />}
          </Button>
        </div>
      ),
    },
  ]

  // ─── Movimientos ────────────────────────────────

  function openMovDialog(tipo: "ENTRADA" | "SALIDA") {
    setMovTipo(tipo)
    setMovForm({ productoId: "", almacenId: "", cantidad: 0, valorUnitario: 0, referencia: "", observaciones: "" })
    setMovDialog(true)
  }

  async function handleSaveMov(e: React.FormEvent) {
    e.preventDefault()
    setMovSaving(true)
    try {
      if (movTipo === "ENTRADA") {
        await ingresarStock({
          productoId: movForm.productoId,
          almacenId: movForm.almacenId,
          cantidad: movForm.cantidad,
          valorUnitario: movForm.valorUnitario > 0 ? movForm.valorUnitario : undefined,
          referencia: movForm.referencia || undefined,
          observaciones: movForm.observaciones || undefined,
        })
      } else {
        await retirarStock({
          productoId: movForm.productoId,
          almacenId: movForm.almacenId,
          cantidad: movForm.cantidad,
          referencia: movForm.referencia || undefined,
          observaciones: movForm.observaciones || undefined,
        })
      }
      setMovDialog(false)
      await loadAll()
      toast({ title: movTipo === "ENTRADA" ? "Ingreso registrado" : "Salida registrada", variant: "success" })
    } catch (err: any) {
      toast({ title: "Error al registrar movimiento", description: err?.message, variant: "destructive" })
    } finally {
      setMovSaving(false)
    }
  }

  const movColumns: Column<MovimientoItem>[] = [
    {
      key: "tipo",
      header: "Tipo",
      render: (m) => (
        <Badge variant={m.tipo === "ENTRADA" ? "success" : m.tipo === "SALIDA" ? "destructive" : "secondary"}>
          {m.tipo}
        </Badge>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (m) => `${m.producto.codigo} - ${m.producto.nombre}`,
    },
    {
      key: "almacen",
      header: "Almacén",
      render: (m) => m.almacenDestino?.nombre ?? m.almacenOrigen?.nombre ?? "-",
    },
    {
      key: "cantidad",
      header: "Cantidad",
      render: (m) => <span className="font-medium">{Number(m.cantidad)}</span>,
    },
    {
      key: "valorUnitario",
      header: "Valor Unit.",
      render: (m) => (m.valorUnitario ? formatMoney(Number(m.valorUnitario)) : "-"),
    },
    {
      key: "referencia",
      header: "Referencia",
      render: (m) => m.referencia ?? "-",
    },
    {
      key: "createdAt",
      header: "Fecha",
      render: (m) => formatDateTime(m.createdAt),
    },
  ]

  // ─── Stock view ─────────────────────────────────

  const stockColumns: Column<StockItem>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (s) => `${s.producto.codigo} - ${s.producto.nombre}`,
    },
    { key: "unidad", header: "U/M", render: (s) => s.producto.unidadMedida },
    {
      key: "almacen",
      header: "Almacén",
      render: (s) => s.almacen.nombre,
    },
    {
      key: "cantidad",
      header: "Stock Actual",
      render: (s) => {
        const c = Number(s.cantidad)
        const min = Number(s.cantidadMinima)
        return (
          <span className={`font-medium ${min > 0 && c <= min ? "text-destructive" : ""}`}>
            {c}
          </span>
        )
      },
    },
    { key: "min", header: "Stock Mínimo", render: (s) => Number(s.cantidadMinima) },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Inventarios" description="Gestión de productos, stock y movimientos de inventario" />

      <Tabs.Root value={tab} onValueChange={setTab} className="space-y-4">
        <Tabs.List className="flex gap-1 border-b overflow-x-auto">
          <Tabs.Trigger value="productos" className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <Package className="h-4 w-4" /> Productos
          </Tabs.Trigger>
          <Tabs.Trigger value="almacenes" className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <Warehouse className="h-4 w-4" /> Almacenes
          </Tabs.Trigger>
          <Tabs.Trigger value="stock" className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <Settings className="h-4 w-4" /> Stock
          </Tabs.Trigger>
          <Tabs.Trigger value="movimientos" className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-primary">
            <ArrowRightLeft className="h-4 w-4" /> Movimientos
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="productos" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Input
              placeholder="Buscar producto..."
              className="w-full sm:max-w-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setTab("movimientos")} className="w-full sm:w-auto">
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Registrar Movimiento
              </Button>
              <Button variant="outline" onClick={openImportDialog} className="w-full sm:w-auto">
                <Upload className="mr-2 h-4 w-4" /> Importar Excel
              </Button>
              <Button onClick={openCreateProducto} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Nuevo Producto
              </Button>
            </div>
          </div>
          <DataTable columns={prodColumns} data={productosFiltrados} loading={loading} mobileCardTitle={(p) => <><span className="font-mono">{p.codigo}</span> — {p.nombre}</>} />
        </Tabs.Content>

        <Tabs.Content value="almacenes" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{almacenes.length} almacenes</span>
            <Button onClick={openCreateAlmacen} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" /> Nuevo Almacén
            </Button>
          </div>
          <DataTable columns={almColumns} data={almacenes} loading={loading} mobileCardTitle={(a) => <><span className="font-mono">{a.codigo}</span> — {a.nombre}</>} />
        </Tabs.Content>

        <Tabs.Content value="stock" className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{stock.length} registros</span>
          </div>
          <DataTable columns={stockColumns} data={stock} loading={loading} mobileCardTitle={(s) => <>{s.producto.codigo} — {s.producto.nombre} <span className="text-muted-foreground">({s.almacen.nombre})</span></>} />
        </Tabs.Content>

        <Tabs.Content value="movimientos" className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{movimientos.length} movimientos</span>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Button onClick={() => openMovDialog("ENTRADA")} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Ingreso
              </Button>
              <Button variant="destructive" onClick={() => openMovDialog("SALIDA")} className="w-full sm:w-auto">
                <ArrowRightLeft className="mr-2 h-4 w-4" /> Salida
              </Button>
            </div>
          </div>
          <DataTable columns={movColumns} data={movimientos} loading={loading} mobileCardTitle={(m) => <>{m.tipo === "ENTRADA" ? "⬆ Ingreso" : "⬇ Salida"} — {m.producto.codigo} {m.producto.nombre}</>} />
        </Tabs.Content>
      </Tabs.Root>

      <FormDialog
        open={prodDialog}
        onOpenChange={setProdDialog}
        title={prodEditId ? "Editar Producto" : "Nuevo Producto"}
        loading={saving}
        onSubmit={handleSaveProducto}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={prodForm.codigo} onChange={(e) => setProdForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Unidad de Medida</Label>
              <Select value={prodForm.unidadMedida} onValueChange={(v) => setProdForm((f) => ({ ...f, unidadMedida: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNIDAD">Unidad</SelectItem>
                  <SelectItem value="CAJA">Caja</SelectItem>
                  <SelectItem value="PAQUETE">Paquete</SelectItem>
                  <SelectItem value="KILO">Kilogramo</SelectItem>
                  <SelectItem value="LITRO">Litro</SelectItem>
                  <SelectItem value="METRO">Metro</SelectItem>
                  <SelectItem value="HORA">Hora</SelectItem>
                  <SelectItem value="SERVICIO">Servicio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={prodForm.nombre} onChange={(e) => setProdForm((f) => ({ ...f, nombre: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Input value={prodForm.categoria ?? ""} onChange={(e) => setProdForm((f) => ({ ...f, categoria: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Precio Unitario</Label>
              <Input type="number" step="0.01" value={prodForm.precioUnitario ?? ""} onChange={(e) => setProdForm((f) => ({ ...f, precioUnitario: e.target.value ? Number(e.target.value) : null }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea value={prodForm.descripcion ?? ""} onChange={(e) => setProdForm((f) => ({ ...f, descripcion: e.target.value }))} />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={almDialog}
        onOpenChange={setAlmDialog}
        title={almEditId ? "Editar Almacén" : "Nuevo Almacén"}
        loading={almSaving}
        onSubmit={handleSaveAlmacen}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código</Label>
              <Input value={almForm.codigo} onChange={(e) => setAlmForm((f) => ({ ...f, codigo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={almForm.nombre} onChange={(e) => setAlmForm((f) => ({ ...f, nombre: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Dirección</Label>
            <Textarea value={almForm.direccion ?? ""} onChange={(e) => setAlmForm((f) => ({ ...f, direccion: e.target.value }))} />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={movDialog}
        onOpenChange={setMovDialog}
        title={movTipo === "ENTRADA" ? "Registrar Ingreso" : "Registrar Salida"}
        loading={movSaving}
        onSubmit={handleSaveMov}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Producto</Label>
            <Select value={movForm.productoId} onValueChange={(v) => setMovForm((f) => ({ ...f, productoId: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
              <SelectContent>
                {productos.filter((p) => p.activo).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo} - {p.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Almacén</Label>
            <Select value={movForm.almacenId} onValueChange={(v) => setMovForm((f) => ({ ...f, almacenId: v }))}>
              <SelectTrigger><SelectValue placeholder="Seleccionar almacén" /></SelectTrigger>
              <SelectContent>
                {almacenes.filter((a) => a.activo).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.codigo} - {a.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input type="number" step="0.01" min="0.01" value={movForm.cantidad || ""} onChange={(e) => setMovForm((f) => ({ ...f, cantidad: Number(e.target.value) }))} />
          </div>
          {movTipo === "ENTRADA" && (
            <div className="space-y-2">
              <Label>Valor Unitario</Label>
              <Input type="number" step="0.01" value={movForm.valorUnitario || ""} onChange={(e) => setMovForm((f) => ({ ...f, valorUnitario: Number(e.target.value) }))} />
            </div>
          )}
          <div className="space-y-2">
            <Label>Referencia</Label>
            <Input value={movForm.referencia} onChange={(e) => setMovForm((f) => ({ ...f, referencia: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Observaciones</Label>
            <Textarea value={movForm.observaciones} onChange={(e) => setMovForm((f) => ({ ...f, observaciones: e.target.value }))} />
          </div>
        </div>
      </FormDialog>

      <FormDialog
        open={importDialog}
        onOpenChange={(o) => { setImportDialog(o); if (!o) { setImportRows([]); setImportResult(null) } }}
        title="Importar Productos desde Excel"
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
                  ? "Si el código ya existe, se actualizarán nombre, precio, categoría y stock."
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
              <p className="text-xs text-muted-foreground">
                Columnas esperadas: Código, Nombre, Categoría, Unidad de Medida, Precio Unitario,
                Descripción, Stock Inicial, Stock Mínimo, Almacén
              </p>
            </div>
          )}

          {importRows.length > 0 && !importResult && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{importRows.length} filas detectadas</p>
              <div className="max-h-48 overflow-y-auto border rounded-md text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-1">Código</th>
                      <th className="text-left p-1">Nombre</th>
                      <th className="text-left p-1">Categoría</th>
                      <th className="text-left p-1">UM</th>
                      <th className="text-right p-1">Precio</th>
                      <th className="text-right p-1">Stock Inicial</th>
                      <th className="text-right p-1">Stock Mínimo</th>
                      <th className="text-left p-1">Almacén</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1">{r.codigo}</td>
                        <td className="p-1">{r.nombre}</td>
                        <td className="p-1">{r.categoria ?? "-"}</td>
                        <td className="p-1">{r.unidadMedida}</td>
                        <td className="text-right p-1">{r.precioUnitario ?? "-"}</td>
                        <td className="text-right p-1">{r.stockInicial ?? 0}</td>
                        <td className="text-right p-1">{r.stockMinimo ?? 0}</td>
                        <td className="p-1">{r.almacenCodigo ?? "(primero disponible)"}</td>
                      </tr>
                    ))}
                    {importRows.length > 50 && (
                      <tr className="border-t text-muted-foreground">
                        <td colSpan={8} className="text-center p-1">... y {importRows.length - 50} más</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-primary/10 rounded-md p-2">
                  <div className="text-2xl font-bold text-primary">{importResult.creados}</div>
                  <div className="text-xs text-muted-foreground">Creados</div>
                </div>
                <div className="bg-blue-50 rounded-md p-2">
                  <div className="text-2xl font-bold text-blue-600">{importResult.actualizados}</div>
                  <div className="text-xs text-muted-foreground">Actualizados</div>
                </div>
                <div className="bg-red-50 rounded-md p-2">
                  <div className="text-2xl font-bold text-destructive">{importResult.errores}</div>
                  <div className="text-xs text-muted-foreground">Errores</div>
                </div>
              </div>
              {importResult.detalles.length > 0 && (
                <div className="max-h-32 overflow-y-auto border rounded-md text-xs p-2 text-muted-foreground">
                  {importResult.detalles.map((d, i) => (
                    <p key={i}>{d}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </FormDialog>
    </div>
  )
}
