"use client"

import { useState, useEffect, useCallback } from "react"
import {
  getUsuariosAdmin, toggleSuperAdmin, toggleUsuarioActivoAdmin, createUsuarioAdmin, updateUsuarioAdmin,
  getEmpresas, getRolesAdmin, asignarEmpresaAUsuario, removerEmpresaDeUsuario,
} from "@/actions/admin"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
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
  empresas: { empresa: { id: string; nombre: string } }[]
  roles: { rol: { id: string; nombre: string } }[]
}

interface EmpresaOption {
  id: string
  nombre: string
}

interface RolOption {
  id: string
  nombre: string
}

export default function AdminUsuariosPage() {
  const [data, setData] = useState<UsuarioAdminData[]>([])
  const [empresas, setEmpresas] = useState<EmpresaOption[]>([])
  const [roles, setRoles] = useState<RolOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UsuarioAdminData | null>(null)
  const [form, setForm] = useState({
    empresaId: "", nombre: "", apellido: "", email: "", password: "", rolId: "",
  })
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([])

  const loadRoles = useCallback(async (empresaId: string) => {
    if (!empresaId || empresaId === "none") {
      setRoles([])
      return
    }
    try {
      const rolesData = await getRolesAdmin(empresaId)
      setRoles(rolesData.map((r: any) => ({ id: r.id, nombre: r.nombre })))
    } catch {
      setRoles([])
    }
  }, [])

  const load = useCallback(async () => {
    try {
      const [usuarios, emps] = await Promise.all([getUsuariosAdmin(), getEmpresas()])
      setData(usuarios as UsuarioAdminData[])
      setEmpresas(emps.map((e: any) => ({ id: e.id, nombre: e.nombre })))
      if (emps.length > 0) {
        loadRoles(emps[0].id)
      }
    } finally {
      setLoading(false)
    }
  }, [loadRoles])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ empresaId: "none", nombre: "", apellido: "", email: "", password: "", rolId: "__none__" })
    setSelectedEmpresas([])
    const firstEmpresa = empresas[0]
    if (firstEmpresa) {
      setForm((prev) => ({ ...prev, empresaId: firstEmpresa.id }))
      setSelectedEmpresas([firstEmpresa.id])
      loadRoles(firstEmpresa.id)
    }
    setDialogOpen(true)
  }

  function openEdit(u: UsuarioAdminData) {
    setEditing(u)
    const empId = u.empresa?.id ?? "none"
    if (empId !== "none") loadRoles(empId)
    const linkedEmpresas = u.empresas.map((ue) => ue.empresa.id)
    setSelectedEmpresas(linkedEmpresas.length > 0 ? linkedEmpresas : empId !== "none" ? [empId] : [])
    setForm({
      empresaId: empId,
      nombre: u.nombre,
      apellido: u.apellido ?? "",
      email: u.email,
      password: "",
      rolId: u.roles[0]?.rol?.id ?? "__none__",
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
          rolId: form.rolId && form.rolId !== "__none__" ? form.rolId : null,
        })
        // Sync empresas vinculadas
        const currentLinked = editing.empresas.map((ue) => ue.empresa.id)
        for (const eid of selectedEmpresas) {
          if (!currentLinked.includes(eid)) {
            await asignarEmpresaAUsuario(editing.id, eid)
          }
        }
        for (const eid of currentLinked) {
          if (!selectedEmpresas.includes(eid)) {
            await removerEmpresaDeUsuario(editing.id, eid)
          }
        }
      } else {
        if (!empId) {
          throw new Error("Debe seleccionar una empresa para el usuario")
        }
        const newUser = await createUsuarioAdmin({
          empresaId: empId,
          nombre: form.nombre,
          apellido: form.apellido || undefined,
          email: form.email,
          password: form.password,
          rolId: form.rolId && form.rolId !== "__none__" ? form.rolId : undefined,
        })
        // Asignar empresas adicionales seleccionadas
        for (const eid of selectedEmpresas) {
          if (eid !== empId) {
            await asignarEmpresaAUsuario((newUser as any).id, eid)
          }
        }
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

  const filtered = data.filter((u) => {
    const allEmpresas = u.empresas.map((ue) => ue.empresa.nombre).join(" ")
    return `${u.nombre} ${u.apellido ?? ""} ${u.email} ${allEmpresas}`
      .toLowerCase().includes(search.toLowerCase())
  })

  const columns: Column<UsuarioAdminData>[] = [
    {
      key: "nombre", header: "Nombre",
      render: (u) => `${u.nombre} ${u.apellido ?? ""}`.trim(),
    },
    { key: "email", header: "Email" },
    {
      key: "empresa", header: "Empresas",
      render: (u) => {
        const allEmpresas = u.empresas.map((ue) => ue.empresa.nombre)
        if (allEmpresas.length === 0) return <Badge variant="outline">{u.empresa?.nombre ?? "Sin Empresa"}</Badge>
        return (
          <div className="flex gap-1 flex-wrap">
            {allEmpresas.map((nombre) => (
              <Badge key={nombre} variant="outline">{nombre}</Badge>
            ))}
          </div>
        )
      },
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
            <Label>Empresa principal</Label>
            <Select value={form.empresaId} onValueChange={(v) => { setForm({ ...form, empresaId: v, rolId: "" }); loadRoles(v); if (v !== "none" && !selectedEmpresas.includes(v)) setSelectedEmpresas([...selectedEmpresas, v]) }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar empresa" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin Empresa</SelectItem>
                {empresas.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Empresas vinculadas</Label>
            <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto">
              {empresas.map((e) => (
                <label key={e.id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedEmpresas.includes(e.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedEmpresas([...selectedEmpresas, e.id])
                      } else {
                        setSelectedEmpresas(selectedEmpresas.filter((id) => id !== e.id))
                      }
                    }}
                  />
                  <span className="text-sm">{e.nombre}</span>
                  {e.id === form.empresaId && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">Principal</Badge>
                  )}
                </label>
              ))}
              {empresas.length === 0 && (
                <p className="text-sm text-muted-foreground">No hay empresas disponibles</p>
              )}
            </div>
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
          <div>
            <Label htmlFor="usr-rol">Rol</Label>
            <Select value={form.rolId} onValueChange={(v) => setForm({ ...form, rolId: v })}>
              <SelectTrigger id="usr-rol"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin rol</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
    </div>
  )
}
