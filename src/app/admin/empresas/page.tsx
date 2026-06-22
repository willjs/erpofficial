"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import {
  getEmpresas, createEmpresa, updateEmpresa, deleteEmpresa,
} from "@/actions/admin"
import { MODULOS_DISPONIBLES } from "@/lib/modulos"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { PlusCircle, Pencil, Trash2 } from "lucide-react"

const BASIC_MODULES = ["CORE", "CONTABILIDAD", "CLIENTES", "PEDIDOS", "VENTAS", "DESPACHOS", "TRASPASOS", "RRHH", "NOMINA", "REPORTES", "PERMISOS", "TESORERIA", "PRESUPUESTOS", "DOCUMENTOS", "TAREAS"]
const ALL_MODULES = MODULOS_DISPONIBLES.map(m => m.clave)

interface EmpresaData {
  id: string
  nombre: string
  rfc: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  activo: boolean
  tipo: string
  modulosActivos: string | null
  tipoContabilidad: string | null
  _count: { usuarios: number }
}

export default function AdminEmpresasPage() {
  const { update: updateSession } = useSession()
  const [data, setData] = useState<EmpresaData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<EmpresaData | null>(null)
  const [form, setForm] = useState({
    nombre: "", rfc: "", direccion: "", telefono: "", email: "",
    tipoContabilidad: "INTERNA",
    tipo: "COMPLETA",
    modulos: [...ALL_MODULES],
  })

  const load = useCallback(async () => {
    try {
      const empresas = await getEmpresas()
      setData(empresas as EmpresaData[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function parseModulos(modulosActivos: string | null): string[] {
    if (!modulosActivos) return []
    return modulosActivos.replace(/[\[\]"]/g, "").split(",").filter(Boolean).map(s => s.trim())
  }

  function openCreate() {
    setEditing(null)
    setForm({ nombre: "", rfc: "", direccion: "", telefono: "", email: "", tipoContabilidad: "INTERNA", tipo: "COMPLETA", modulos: [...ALL_MODULES] })
    setDialogOpen(true)
  }

  function openEdit(item: EmpresaData) {
    setEditing(item)
    setForm({
      nombre: item.nombre,
      rfc: item.rfc ?? "",
      direccion: item.direccion ?? "",
      telefono: item.telefono ?? "",
      email: item.email ?? "",
      tipoContabilidad: item.tipoContabilidad ?? "INTERNA",
      tipo: item.tipo || "COMPLETA",
      modulos: parseModulos(item.modulosActivos),
    })
    setDialogOpen(true)
  }

  function handleTipoChange(tipo: string) {
    const nuevosModulos = tipo === "BASICA" ? [...BASIC_MODULES] : tipo === "COMPLETA" ? [...ALL_MODULES] : form.modulos
    setForm({ ...form, tipo, modulos: nuevosModulos })
  }

  function toggleModulo(clave: string) {
    const nuevos = form.modulos.includes(clave)
      ? form.modulos.filter(m => m !== clave)
      : [...form.modulos, clave]
    setForm({ ...form, modulos: nuevos })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre,
        rfc: form.rfc || undefined,
        direccion: form.direccion || undefined,
        telefono: form.telefono || undefined,
        email: form.email || undefined,
        tipoContabilidad: form.tipoContabilidad || null,
        tipo: form.tipo as "BASICA" | "COMPLETA" | "PERSONALIZADA",
        modulos: form.tipo === "PERSONALIZADA" ? form.modulos : undefined,
      }
      if (editing) {
        await updateEmpresa(editing.id, payload)
      } else {
        await createEmpresa(payload)
      }
      setDialogOpen(false)
      await load()
      // Refrescar sesión para actualizar modulosActivos en el JWT
      await updateSession()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta empresa? Se eliminarán todos sus datos.")) return
    await deleteEmpresa(id)
    await load()
  }

  const filtered = data.filter((e) =>
    `${e.nombre} ${e.rfc ?? ""} ${e.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<EmpresaData>[] = [
    { key: "nombre", header: "Nombre" },
    { key: "rfc", header: "RFC", render: (e) => e.rfc ?? "—" },
    { key: "email", header: "Email", render: (e) => e.email ?? "—" },
    {
      key: "tipo", header: "Tipo",
      render: (e) => {
        const colors: Record<string, string> = { BASICA: "bg-blue-100 text-blue-800", COMPLETA: "bg-green-100 text-green-800", PERSONALIZADA: "bg-purple-100 text-purple-800" }
        return <Badge className={colors[e.tipo] || ""}>{e.tipo || "COMPLETA"}</Badge>
      },
    },
    {
      key: "usuarios", header: "Usuarios",
      render: (e) => <Badge variant="secondary">{e._count.usuarios}</Badge>,
    },
    {
      key: "activo", header: "Estado",
      render: (e) => e.activo ? <Badge variant="success">Activa</Badge> : <Badge variant="destructive">Inactiva</Badge>,
    },
    {
      key: "acciones", header: "Acciones", className: "text-right",
      render: (e) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empresas"
        description="Gestiona todas las empresas registradas en el sistema"
      />

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />Nueva Empresa
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar empresa..."
        searchTerm={search}
        onSearch={setSearch}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Empresa" : "Nueva Empresa"}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="emp-nombre">Nombre</Label>
            <Input id="emp-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="emp-rfc">RFC</Label>
            <Input id="emp-rfc" value={form.rfc} onChange={(e) => setForm({ ...form, rfc: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="emp-direccion">Dirección</Label>
            <Input id="emp-direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="emp-telefono">Teléfono</Label>
            <Input id="emp-telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="emp-email">Email</Label>
            <Input id="emp-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          {/* Tipo de empresa */}
          <div>
            <Label htmlFor="emp-tipo">Tipo de empresa</Label>
            <Select value={form.tipo} onValueChange={handleTipoChange}>
              <SelectTrigger id="emp-tipo"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BASICA">Básica (oficina)</SelectItem>
                <SelectItem value="COMPLETA">Completa (todos los módulos)</SelectItem>
                <SelectItem value="PERSONALIZADA">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Selector de módulos (solo PERSONALIZADA) */}
          {form.tipo === "PERSONALIZADA" && (
            <div>
              <Label>Módulos activos</Label>
              <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border p-3">
                {MODULOS_DISPONIBLES.map((mod) => (
                  <label key={mod.clave} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.modulos.includes(mod.clave)}
                      onCheckedChange={() => toggleModulo(mod.clave)}
                    />
                    {mod.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="emp-tipo-cont">Tipo Contabilidad</Label>
            <Select value={form.tipoContabilidad} onValueChange={(v) => setForm({ ...form, tipoContabilidad: v })}>
              <SelectTrigger id="emp-tipo-cont"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INTERNA">Interna (en el sistema)</SelectItem>
                <SelectItem value="WORD_OFFICE">Word Office</SelectItem>
                <SelectItem value="SYSCAR">Syscar</SelectItem>
                <SelectItem value="ZEUS">Zeus</SelectItem>
                <SelectItem value="OTRO">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
    </div>
  )
}
