"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getUsuariosAdmin, toggleSuperAdmin, toggleUsuarioActivoAdmin, createUsuarioAdmin, updateUsuarioAdmin,
} from "@/actions/admin"
import { getEmpresas } from "@/actions/admin"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  PlusCircle, Shield, ShieldOff, ToggleLeft, ToggleRight, Pencil,
} from "lucide-react"

interface UsuarioAdminData {
  id: string
  nombre: string
  apellido: string | null
  email: string
  activo: boolean
  superAdmin: boolean
  empresa: { id: string; nombre: string } | null
  roles: { rol: { id: string; nombre: string } }[]
}

interface EmpresaOption {
  id: string
  nombre: string
}

export default function AdminUsuariosPage() {
  const [data, setData] = useState<UsuarioAdminData[]>([])
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UsuarioAdminData | null>(null)
  const [form, setForm] = useState({
    empresaId: "", nombre: "", apellido: "", email: "", password: "",
  })

  const load = useCallback(async () => {
    try {
      const [usuarios, emps] = await Promise.all([getUsuariosAdmin(), getEmpresas()])
      setData(usuarios as UsuarioAdminData[])
      setEmpresas(emps.map((e: any) => ({ id: e.id, nombre: e.nombre })))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ empresaId: "none", nombre: "", apellido: "", email: "", password: "" })
    setDialogOpen(true)
  }

  function openEdit(u: UsuarioAdminData) {
    setEditing(u)
    setForm({
      empresaId: u.empresa?.id ?? "none",
      nombre: u.nombre,
      apellido: u.apellido ?? "",
      email: u.email,
      password: "",
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const empId = form.empresaId === "none" ? null : form.empresaId
      if (editing) {
        await updateUsuarioAdmin(editing.id, {
          empresaId: empId,
          nombre: form.nombre,
          apellido: form.apellido || undefined,
          email: form.email,
          password: form.password || undefined,
        })
      } else {
        if (!empId) {
          throw new Error("Debe seleccionar una empresa para el usuario")
        }
        await createUsuarioAdmin({
          empresaId: empId,
          nombre: form.nombre,
          apellido: form.apellido || undefined,
          email: form.email,
          password: form.password,
        })
      }
      setDialogOpen(false)
      await load()
    } catch (err: any) {
      alert(err.message ?? "Error al guardar usuario")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleSuperAdmin(id: string) {
    await toggleSuperAdmin(id)
    await load()
  }

  async function handleToggleActivo(id: string) {
    await toggleUsuarioActivoAdmin(id)
    await load()
  }

  const filtered = data.filter((u) =>
    `${u.nombre} ${u.apellido ?? ""} ${u.email} ${u.empresa?.nombre ?? "Sin Empresa"}`
      .toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<UsuarioAdminData>[] = [
    {
      key: "nombre", header: "Nombre",
      render: (u) => `${u.nombre} ${u.apellido ?? ""}`.trim(),
    },
    { key: "email", header: "Email" },
    {
      key: "empresa", header: "Empresa",
      render: (u) => <Badge variant="outline">{u.empresa?.nombre ?? "Sin Empresa"}</Badge>,
    },
    {
      key: "superAdmin", header: "Super Admin",
      render: (u) => u.superAdmin
        ? <Badge variant="warning">Sí</Badge>
        : <Badge variant="secondary">No</Badge>,
    },
    {
      key: "roles", header: "Roles",
      render: (u) => (
        <div className="flex gap-1 flex-wrap">
          {u.roles.length === 0
            ? <span className="text-muted-foreground">—</span>
            : u.roles.map((r) => (
              <Badge key={r.rol.id} variant="secondary">{r.rol.nombre}</Badge>
            ))
          }
        </div>
      ),
    },
    {
      key: "activo", header: "Estado",
      render: (u) => u.activo
        ? <Badge variant="success">Activo</Badge>
        : <Badge variant="destructive">Inactivo</Badge>,
    },
    {
      key: "acciones", header: "Acciones", className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost" size="sm"
            onClick={() => openEdit(u)}
            title="Editar Usuario"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => handleToggleSuperAdmin(u.id)}
            title={u.superAdmin ? "Quitar Super Admin" : "Hacer Super Admin"}
          >
            {u.superAdmin ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => handleToggleActivo(u.id)}
            title={u.activo ? "Desactivar" : "Activar"}
          >
            {u.activo
              ? <ToggleRight className="h-4 w-4 text-destructive" />
              : <ToggleLeft className="h-4 w-4 text-success" />}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Gestiona todos los usuarios del sistema"
      />

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />Nuevo Usuario
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar usuario..."
        searchTerm={search}
        onSearch={setSearch}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Usuario" : "Nuevo Usuario"}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="usr-empresa">Empresa</Label>
            <Select value={form.empresaId} onValueChange={(v) => setForm({ ...form, empresaId: v })}>
              <SelectTrigger id="usr-empresa"><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin Empresa</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="usr-nombre">Nombre</Label>
              <Input id="usr-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
            </div>
            <div>
              <Label htmlFor="usr-apellido">Apellido</Label>
              <Input id="usr-apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="usr-email">Email</Label>
            <Input id="usr-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="usr-password">{editing ? "Contraseña (dejar vacío para mantener)" : "Contraseña"}</Label>
            <Input id="usr-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
          </div>
        </div>
      </FormDialog>
    </div>
  )
}
