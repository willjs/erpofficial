"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  PlusCircle, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, ShieldCheck,
} from "lucide-react"
import {
  getEmpresa, updateEmpresa,
  getDepartamentos, createDepartamento, updateDepartamento, deleteDepartamento,
  getUsuarios, createUsuario, updateUsuario, toggleUsuarioActivo,
  getRoles, createRol, updateRol, deleteRol,
  getPermisos, getPermisosByRol, updateRolPermisos, getSuperAdmin,
  getCentrosCostos, createCentroCostos, updateCentroCostos, deleteCentroCostos, toggleCentroCostosActivo,
  getTipoContabilidad, saveTipoContabilidad, probarConexionContable,
  assignRolToUser, removeRolFromUser,
} from "@/actions/configuracion"
import { useToast } from "@/components/ui/use-toast"

// ─── Types ────────────────────────────────────────────────

type TabName = "empresa" | "departamentos" | "usuarios" | "roles" | "centros-costos" | "contabilidad"

interface EmpresaData {
  id: string
  nombre: string
  rfc: string | null
  direccion: string | null
  telefono: string | null
  email: string | null
  logo: string | null
  activo: boolean
  tipoContabilidad: string | null
}

interface DepartamentoData {
  id: string
  nombre: string
  descripcion: string | null
  gerenteId: string | null
  activo: boolean
  gerente: { id: string; nombre: string; apellido: string | null } | null
}

interface UsuarioData {
  id: string
  nombre: string
  apellido: string | null
  email: string
  activo: boolean
  departamentoId: string | null
  departamento: { id: string; nombre: string } | null
  roles: { rol: { id: string; nombre: string } }[]
}

interface RolData {
  id: string
  nombre: string
  descripcion: string | null
  esSistema: boolean
  totalPermisos: number
  totalUsuarios: number
}

interface PermisoData {
  id: string
  nombre: string
  descripcion: string | null
  modulo: string
  accion: string
  recurso: string
}

// ─── Tab Button ───────────────────────────────────────────

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
        active
          ? "bg-primary text-primary-foreground shadow"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  )
}

// ─── Page Component ──────────────────────────────────────

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<TabName>("empresa")

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configuración"
        description="Empresa, departamentos, usuarios, roles y permisos"
      />
      <div className="flex gap-2 flex-wrap">
        <TabButton active={tab === "empresa"} onClick={() => setTab("empresa")}>Empresa</TabButton>
        <TabButton active={tab === "departamentos"} onClick={() => setTab("departamentos")}>Departamentos</TabButton>
        <TabButton active={tab === "usuarios"} onClick={() => setTab("usuarios")}>Usuarios</TabButton>
        <TabButton active={tab === "roles"} onClick={() => setTab("roles")}>Roles / Permisos</TabButton>
        <TabButton active={tab === "centros-costos"} onClick={() => setTab("centros-costos")}>Centros de Costo</TabButton>
        <TabButton active={tab === "contabilidad"} onClick={() => setTab("contabilidad")}>Config. Contable</TabButton>
      </div>
      <Separator />
      {tab === "empresa" && <EmpresaTab />}
      {tab === "departamentos" && <DepartamentosTab />}
      {tab === "usuarios" && <UsuariosTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "centros-costos" && <CentrosCostosTab />}
      {tab === "contabilidad" && <ContabilidadConfigTab />}
    </div>
  )
}

// ─── Empresa Tab ─────────────────────────────────────────

function EmpresaTab() {
  const { toast } = useToast()
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ nombre: "", rfc: "", direccion: "", telefono: "", email: "", tipoContabilidad: "INTERNA" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getEmpresa()
      setEmpresa(data)
      if (data) {
        setForm({
          nombre: data.nombre ?? "",
          rfc: data.rfc ?? "",
          direccion: data.direccion ?? "",
          telefono: data.telefono ?? "",
          email: data.email ?? "",
          tipoContabilidad: data.tipoContabilidad ?? "INTERNA",
        })
      }
    } catch (err: unknown) {
      toast({ title: "Error al cargar empresa", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const updated = await updateEmpresa(form)
      setEmpresa(updated)
      setEditOpen(false)
      toast({ title: "Empresa actualizada", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al actualizar empresa", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Editar Empresa</Button>
      </div>
      <Card>
        <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Nombre</Label><p className="text-sm mt-1">{empresa?.nombre ?? "—"}</p></div>
          <div><Label>RFC</Label><p className="text-sm mt-1">{empresa?.rfc ?? "—"}</p></div>
          <div><Label>Dirección</Label><p className="text-sm mt-1">{empresa?.direccion ?? "—"}</p></div>
          <div><Label>Teléfono</Label><p className="text-sm mt-1">{empresa?.telefono ?? "—"}</p></div>
          <div><Label>Email</Label><p className="text-sm mt-1">{empresa?.email ?? "—"}</p></div>
          <div><Label>Tipo Contabilidad</Label><p className="text-sm mt-1">{empresa?.tipoContabilidad ?? "INTERNA"}</p></div>
        </CardContent>
      </Card>

      <FormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Editar Empresa"
        onSubmit={handleSave}
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

// ─── Departamentos Tab ───────────────────────────────────

function DepartamentosTab() {
  const { toast } = useToast()
  const [data, setData] = useState<DepartamentoData[]>([])
  const [usuarios, setUsuarios] = useState<{ id: string; nombre: string; apellido: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<DepartamentoData | null>(null)
  const [form, setForm] = useState({ nombre: "", descripcion: "", gerenteId: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [deptos, users] = await Promise.all([getDepartamentos(), getUsuarios()])
      setData(deptos as DepartamentoData[])
      setUsuarios(users.map((u: { id: string; nombre: string; apellido: string | null }) => ({ id: u.id, nombre: u.nombre, apellido: u.apellido })))
    } catch (err: unknown) {
      toast({ title: "Error al cargar departamentos", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ nombre: "", descripcion: "", gerenteId: "none" })
    setDialogOpen(true)
  }

  function openEdit(item: DepartamentoData) {
    setEditing(item)
    setForm({
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
      gerenteId: item.gerenteId ?? "none",
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { nombre: form.nombre, descripcion: form.descripcion || undefined, gerenteId: form.gerenteId === "none" ? null : form.gerenteId }
      if (editing) {
        await updateDepartamento(editing.id, payload)
      } else {
        await createDepartamento(payload)
      }
      setDialogOpen(false)
      await load()
      toast({ title: editing ? "Departamento actualizado" : "Departamento creado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al guardar departamento", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este departamento?")) return
    try {
      await deleteDepartamento(id)
      await load()
      toast({ title: "Departamento eliminado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al eliminar departamento", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  const filtered = data.filter((d) =>
    d.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<DepartamentoData>[] = [
    { key: "nombre", header: "Nombre" },
    {
      key: "descripcion", header: "Descripción",
      render: (d) => d.descripcion ?? "—",
    },
    {
      key: "gerente", header: "Gerente",
      render: (d) => d.gerente ? `${d.gerente.nombre} ${d.gerente.apellido ?? ""}`.trim() : "—",
    },
    {
      key: "activo", header: "Estado",
      render: (d) => d.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>,
    },
    {
      key: "acciones", header: "Acciones", className: "text-right",
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><PlusCircle className="mr-2 h-4 w-4" />Nuevo Departamento</Button>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar departamento..."
        searchTerm={search}
        onSearch={setSearch}
      />
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Departamento" : "Nuevo Departamento"}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="dept-nombre">Nombre</Label>
            <Input id="dept-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="dept-desc">Descripción</Label>
            <Input id="dept-desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="dept-gerente">Gerente</Label>
            <Select value={form.gerenteId} onValueChange={(v) => setForm({ ...form, gerenteId: v })}>
              <SelectTrigger id="dept-gerente"><SelectValue placeholder="Seleccionar gerente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin gerente</SelectItem>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.nombre} {u.apellido ?? ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
    </div>
  )
}

// ─── Usuarios Tab ────────────────────────────────────────

function UsuariosTab() {
  const { toast } = useToast()
  const [data, setData] = useState<UsuarioData[]>([])
  const [departamentos, setDepartamentos] = useState<{ id: string; nombre: string }[]>([])
  const [roles, setRoles] = useState<{ id: string; nombre: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false)
  const [editing, setEditing] = useState<UsuarioData | null>(null)
  const [selectedUserRoles, setSelectedUserRoles] = useState<string[]>([])
  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", departamentoId: "none" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [users, deptos, rols] = await Promise.all([getUsuarios(), getDepartamentos(), getRoles()])
      setData(users as UsuarioData[])
      setDepartamentos(deptos.map((d: { id: string; nombre: string }) => ({ id: d.id, nombre: d.nombre })))
      setRoles(rols as { id: string; nombre: string; totalPermisos: number; totalUsuarios: number; esSistema: boolean; descripcion: string | null }[])
    } catch (err: unknown) {
      toast({ title: "Error al cargar usuarios", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ nombre: "", apellido: "", email: "", password: "", departamentoId: "none" })
    setDialogOpen(true)
  }

  function openEdit(item: UsuarioData) {
    setEditing(item)
    setForm({
      nombre: item.nombre,
      apellido: item.apellido ?? "",
      email: item.email,
      password: "",
      departamentoId: item.departamentoId ?? "none",
    })
    setDialogOpen(true)
  }

  function openRoles(item: UsuarioData) {
    setEditing(item)
    setSelectedUserRoles(item.roles.map((r) => r.rol.id))
    setRolesDialogOpen(true)
  }

  function toggleUserRol(rolId: string) {
    setSelectedUserRoles((prev) =>
      prev.includes(rolId) ? prev.filter((id) => id !== rolId) : [...prev, rolId]
    )
  }

  async function handleSaveRoles() {
    if (!editing) return
    setSaving(true)
    try {
      const currentRoles = editing.roles.map((r) => r.rol.id)
      const toAdd = selectedUserRoles.filter((id) => !currentRoles.includes(id))
      const toRemove = currentRoles.filter((id) => !selectedUserRoles.includes(id))
      for (const rolId of toAdd) {
        await assignRolToUser(editing.id, rolId)
      }
      for (const rolId of toRemove) {
        await removeRolFromUser(editing.id, rolId)
      }
      setRolesDialogOpen(false)
      await load()
      toast({ title: "Roles actualizados", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al actualizar roles", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        nombre: form.nombre,
        apellido: form.apellido || undefined,
        email: form.email,
        password: form.password || undefined,
        departamentoId: form.departamentoId === "none" ? null : form.departamentoId,
      }
      if (editing) {
        await updateUsuario(editing.id, payload)
      } else {
        await createUsuario(payload)
      }
      setDialogOpen(false)
      await load()
      toast({ title: editing ? "Usuario actualizado" : "Usuario creado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al guardar usuario", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string) {
    if (!confirm("¿Cambiar estado del usuario?")) return
    try {
      await toggleUsuarioActivo(id)
      await load()
      toast({ title: "Estado del usuario actualizado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al cambiar estado", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  const filtered = data.filter((u) =>
    `${u.nombre} ${u.apellido ?? ""} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<UsuarioData>[] = [
    {
      key: "nombre", header: "Nombre",
      render: (u) => `${u.nombre} ${u.apellido ?? ""}`.trim(),
    },
    { key: "email", header: "Email" },
    {
      key: "departamento", header: "Departamento",
      render: (u) => u.departamento?.nombre ?? "—",
    },
    {
      key: "roles", header: "Roles",
      render: (u) => (
        <div className="flex gap-1 flex-wrap">
          {u.roles.length === 0 ? <span className="text-muted-foreground">—</span> : u.roles.map((r) => (
            <Badge key={r.rol.id} variant="secondary">{r.rol.nombre}</Badge>
          ))}
        </div>
      ),
    },
    {
      key: "activo", header: "Estado",
      render: (u) => u.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>,
    },
    {
      key: "acciones", header: "Acciones", className: "text-right",
      render: (u) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openRoles(u)} title="Asignar roles"><ShieldCheck className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(u)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleToggle(u.id)}>
            {u.activo ? <ToggleRight className="h-4 w-4 text-destructive" /> : <ToggleLeft className="h-4 w-4 text-success" />}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><PlusCircle className="mr-2 h-4 w-4" />Nuevo Usuario</Button>
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
            <Label htmlFor="usr-password">{editing ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}</Label>
            <Input id="usr-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
          </div>
          <div>
            <Label htmlFor="usr-depto">Departamento</Label>
            <Select value={form.departamentoId} onValueChange={(v) => setForm({ ...form, departamentoId: v })}>
              <SelectTrigger id="usr-depto"><SelectValue placeholder="Seleccionar departamento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin departamento</SelectItem>
                {departamentos.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.nombre}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>

      {/* Roles Dialog */}
      <FormDialog
        open={rolesDialogOpen}
        onOpenChange={setRolesDialogOpen}
        title={`Roles: ${editing?.nombre ?? ""}`}
        description="Asigna o quita roles al usuario"
        onSubmit={handleSaveRoles}
        loading={saving}
        submitLabel="Guardar Roles"
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {roles.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm rounded px-2 py-1 cursor-pointer hover:bg-accent">
              <input
                type="checkbox"
                checked={selectedUserRoles.includes(r.id)}
                onChange={() => toggleUserRol(r.id)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium">{r.nombre}</span>
            </label>
          ))}
        </div>
      </FormDialog>
    </div>
  )
}

// ─── Roles Tab ───────────────────────────────────────────

function RolesTab() {
  const { toast } = useToast()
  const [data, setData] = useState<RolData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [permisosOpen, setPermisosOpen] = useState(false)
  const [editing, setEditing] = useState<RolData | null>(null)
  const [permisosRol, setPermisosRol] = useState<string[]>([])
  const [permisos, setPermisos] = useState<PermisoData[]>([])
  const [rolPermisosLoading, setRolPermisosLoading] = useState(false)
  const [form, setForm] = useState({ nombre: "", descripcion: "" })
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [roles, perms, { superAdmin }] = await Promise.all([getRoles(), getPermisos(), getSuperAdmin()])
      setData(roles as RolData[])
      setPermisos(perms as PermisoData[])
      setIsSuperAdmin(superAdmin)
    } catch (err: unknown) {
      toast({ title: "Error al cargar roles", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ nombre: "", descripcion: "" })
    setDialogOpen(true)
  }

  function openEdit(item: RolData) {
    setEditing(item)
    setForm({ nombre: item.nombre, descripcion: item.descripcion ?? "" })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { nombre: form.nombre, descripcion: form.descripcion || undefined }
      if (editing) {
        await updateRol(editing.id, payload)
      } else {
        await createRol(payload)
      }
      setDialogOpen(false)
      await load()
      toast({ title: editing ? "Rol actualizado" : "Rol creado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al guardar rol", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este rol?")) return
    try {
      await deleteRol(id)
      await load()
      toast({ title: "Rol eliminado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al eliminar rol", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  async function openPermisos(item: RolData) {
    setEditing(item)
    setRolPermisosLoading(true)
    setPermisosOpen(true)
    try {
      const ids = await getPermisosByRol(item.id)
      setPermisosRol(ids)
    } catch (err: unknown) {
      toast({ title: "Error al cargar permisos", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setRolPermisosLoading(false)
    }
  }

  function togglePermiso(permisoId: string) {
    setPermisosRol((prev) =>
      prev.includes(permisoId) ? prev.filter((id) => id !== permisoId) : [...prev, permisoId]
    )
  }

  async function handleSavePermisos() {
    if (!editing) return
    setSaving(true)
    try {
      await updateRolPermisos(editing.id, permisosRol)
      setPermisosOpen(false)
      await load()
      toast({ title: "Permisos actualizados", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al guardar permisos", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const filtered = data.filter((r) =>
    r.nombre.toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<RolData>[] = [
    { key: "nombre", header: "Nombre" },
    {
      key: "descripcion", header: "Descripción",
      render: (r) => r.descripcion ?? "—",
    },
    {
      key: "totalPermisos", header: "Permisos",
      render: (r) => <Badge variant="info">{r.totalPermisos}</Badge>,
    },
    {
      key: "totalUsuarios", header: "Usuarios",
      render: (r) => <Badge variant="secondary">{r.totalUsuarios}</Badge>,
    },
    {
      key: "esSistema", header: "Tipo",
      render: (r) => r.esSistema ? <Badge variant="warning">Sistema</Badge> : <Badge variant="success">Personalizado</Badge>,
    },
    {
      key: "acciones", header: "Acciones", className: "text-right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openPermisos(r)} title="Asignar permisos">
            <ShieldCheck className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)} disabled={r.esSistema}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)} disabled={r.esSistema}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  const ACCIONES: Record<string, string> = {
    CREATE: "Crear", READ: "Leer", UPDATE: "Editar", DELETE: "Eliminar", ALL: "Acceso total",
  }
  const RECURSOS: Record<string, string> = {
    empresa: "empresa", departamento: "departamento", usuario: "usuario", rol: "rol",
    permiso: "permiso", empleado: "empleado", contrato: "contrato", expediente: "expediente",
    nomina: "nómina", nomina_detalle: "detalle de nómina", incidencia: "incidencia",
    concepto: "concepto", proyecto: "proyecto", tarea: "tarea", comentario: "comentario",
    categoria_activo: "categoría", activo: "activo", movimiento_activo: "movimiento",
    almacen: "almacén", producto: "producto", inventario_stock: "stock",
    movimiento_inventario: "movimiento de inventario", carpeta: "carpeta", documento: "documento",
    plan_cuenta: "plan de cuentas", asiento_contable: "asiento contable",
    asiento_detalle: "detalle de asiento", plantilla_contable: "plantilla contable",
    presupuesto: "presupuesto", cuenta_bancaria: "cuenta bancaria",
    movimiento_bancario: "movimiento bancario", cliente: "cliente",
    contacto_cliente: "contacto", interaccion_cliente: "interacción",
    tipo_permiso: "tipo de permiso", solicitud_permiso: "solicitud de permiso",
    reporte: "reporte", dashboard: "dashboard", centro_costos: "centro de costos",
    proveedor: "proveedor", requisicion: "requisición", cotizacion: "cotización",
    orden_compra: "orden de compra", recepcion: "recepción", cuenta_pagar: "cuenta por pagar",
    pago: "pago", egreso: "egreso",
  }
  function formatearPermiso(p: PermisoData): string {
    const recurso = RECURSOS[p.recurso] ?? p.recurso
    if (p.accion === "ALL") return `Acceso total a ${recurso}`
    return `${ACCIONES[p.accion] ?? p.accion} ${recurso}`
  }

  const groupedPermisos = permisos.reduce<Record<string, PermisoData[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = []
    acc[p.modulo].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><PlusCircle className="mr-2 h-4 w-4" />Nuevo Rol</Button>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar rol..."
        searchTerm={search}
        onSearch={setSearch}
      />
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Rol" : "Nuevo Rol"}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="rol-nombre">Nombre</Label>
            <Input id="rol-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="rol-desc">Descripción</Label>
            <Input id="rol-desc" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
      </FormDialog>

      {/* Permisos Dialog */}
      <FormDialog
        open={permisosOpen}
        onOpenChange={setPermisosOpen}
        title={`Permisos: ${editing?.nombre ?? ""}`}
        description="Selecciona los permisos para este rol"
        onSubmit={handleSavePermisos}
        loading={saving}
        submitLabel="Guardar Permisos"
      >
        {rolPermisosLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(groupedPermisos).map(([modulo, perms]) => (
              <div key={modulo}>
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{modulo}</h4>
                <div className="space-y-1 ml-2">
                  {modulo === "CORE" && !isSuperAdmin && (
                    <p className="text-xs text-muted-foreground italic px-2">
                      Solo el super administrador puede modificar permisos del módulo CORE
                    </p>
                  )}
                  {perms.map((p) => {
                    const isCore = modulo === "CORE"
                    return (
                      <label key={p.id} className={`flex items-center gap-2 text-sm rounded px-2 py-1 ${isCore && !isSuperAdmin ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-accent"}`}>
                        <input
                          type="checkbox"
                          checked={permisosRol.includes(p.id)}
                          onChange={() => togglePermiso(p.id)}
                          disabled={isCore && !isSuperAdmin}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span className="font-medium">{formatearPermiso(p)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </FormDialog>
    </div>
  )
}

// ─── Centros de Costo Tab ───────────────────────────────

interface CentroCostosData {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  activo: boolean
}

function CentrosCostosTab() {
  const { toast } = useToast()
  const [data, setData] = useState<CentroCostosData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CentroCostosData | null>(null)
  const [form, setForm] = useState({ codigo: "", nombre: "", descripcion: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCentrosCostos()
      setData(data as CentroCostosData[])
    } catch (err: unknown) {
      toast({ title: "Error al cargar centros de costo", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ codigo: "", nombre: "", descripcion: "" })
    setDialogOpen(true)
  }

  function openEdit(item: CentroCostosData) {
    setEditing(item)
    setForm({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? "",
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { codigo: form.codigo, nombre: form.nombre, descripcion: form.descripcion || undefined }
      if (editing) {
        await updateCentroCostos(editing.id, payload)
      } else {
        await createCentroCostos(payload)
      }
      setDialogOpen(false)
      await load()
      toast({ title: editing ? "Centro de costo actualizado" : "Centro de costo creado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al guardar centro de costo", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este centro de costo?")) return
    try {
      await deleteCentroCostos(id)
      await load()
      toast({ title: "Centro de costo eliminado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al eliminar centro de costo", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  async function handleToggle(id: string) {
    if (!confirm("¿Cambiar estado del centro de costo?")) return
    try {
      await toggleCentroCostosActivo(id)
      await load()
      toast({ title: "Estado actualizado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al cambiar estado", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  const filtered = data.filter((d) =>
    `${d.codigo} ${d.nombre}`.toLowerCase().includes(search.toLowerCase())
  )

  const columns: Column<CentroCostosData>[] = [
    { key: "codigo", header: "Código" },
    { key: "nombre", header: "Nombre" },
    {
      key: "descripcion", header: "Descripción",
      render: (d) => d.descripcion ?? "—",
    },
    {
      key: "activo", header: "Estado",
      render: (d) => d.activo ? <Badge variant="success">Activo</Badge> : <Badge variant="destructive">Inactivo</Badge>,
    },
    {
      key: "acciones", header: "Acciones", className: "text-right",
      render: (d) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(d)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" onClick={() => handleToggle(d.id)}>
            {d.activo ? <ToggleRight className="h-4 w-4 text-destructive" /> : <ToggleLeft className="h-4 w-4 text-success" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate}><PlusCircle className="mr-2 h-4 w-4" />Nuevo Centro de Costo</Button>
      </div>
      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar centro de costo..."
        searchTerm={search}
        onSearch={setSearch}
      />
      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Centro de Costo" : "Nuevo Centro de Costo"}
        onSubmit={handleSubmit}
        loading={saving}
      >
        <div className="space-y-3">
          <div>
            <Label htmlFor="cc-codigo">Código</Label>
            <Input id="cc-codigo" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="cc-nombre">Nombre</Label>
            <Input id="cc-nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <Label htmlFor="cc-descripcion">Descripción</Label>
            <Input id="cc-descripcion" value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
        </div>
      </FormDialog>
    </div>
  )
}

// ─── Configuración Contable Tab ──────────────────────

function ContabilidadConfigTab() {
  const { toast } = useToast()
  const [tipoContabilidad, setTipoContabilidad] = useState<string>("INTERNA")
  const [config, setConfig] = useState<string>("{}")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testeando, setTesteando] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; mensaje: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const tc = await getTipoContabilidad()
      if (tc) {
        setTipoContabilidad(tc.tipo)
        setConfig(tc.config ? JSON.stringify(tc.config, null, 2) : "{}")
      } else {
        setTipoContabilidad("INTERNA")
        setConfig("{}")
      }
    } catch (err: unknown) {
      toast({ title: "Error al cargar configuración contable", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      let parsedConfig = {}
      try { parsedConfig = JSON.parse(config) } catch { parsedConfig = {} }
      await saveTipoContabilidad({ tipo: tipoContabilidad as any, config: parsedConfig })
      toast({ title: "Configuración contable guardada", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al guardar configuración contable", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesteando(true)
    setTestResult(null)
    try {
      let parsedConfig = {}
      try { parsedConfig = JSON.parse(config) } catch { parsedConfig = {} }
      const res = await probarConexionContable(tipoContabilidad, parsedConfig)
      setTestResult(res)
    } catch (err: any) {
      setTestResult({ success: false, mensaje: err.message })
    } finally {
      setTesteando(false)
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Contabilidad</Label>
              <Select value={tipoContabilidad} onValueChange={setTipoContabilidad}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNA">Interna (en el sistema)</SelectItem>
                  <SelectItem value="WORD_OFFICE">Word Office</SelectItem>
                  <SelectItem value="SYSCAR">Syscar</SelectItem>
                  <SelectItem value="ZEUS">Zeus</SelectItem>
                  <SelectItem value="OTRO">Otro</SelectItem>
                </SelectContent>
              </Select>
              {tipoContabilidad === "INTERNA" && (
                <p className="text-sm text-muted-foreground mt-1">
                  La contabilidad se gestiona dentro del sistema. Los asientos se generan automáticamente al facturar, pagar o recibir bienes.
                </p>
              )}
            </div>

            {tipoContabilidad !== "INTERNA" && (
              <div className="space-y-2">
                <Label>Configuración de conexión (JSON)</Label>
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Campos comunes:</p>
                  <code className="block">apiUrl</code>
                  <code className="block">token</code>
                  <code className="block">authType</code>
                  <code className="block">healthEndpoint</code>
                  <code className="block">healthMethod</code>
                  {tipoContabilidad === "WORD_OFFICE" && <p className="mt-1">Word Office espera: apiUrl como base, authType bearer, healthEndpoint /api/health</p>}
                  {tipoContabilidad === "SYSCAR" && <p className="mt-1">Syscar espera: apiUrl, authType basic, usuario y contraseña en el JSON</p>}
                  {tipoContabilidad === "ZEUS" && <p className="mt-1">Zeus espera: apiUrl, token, healthEndpoint /api/v1/ping</p>}
                  {tipoContabilidad === "OTRO" && <p className="mt-1">Define los campos que tu proveedor necesite. La prueba de conexión usará apiUrl + healthEndpoint.</p>}
                </div>
                <textarea
                  className="w-full min-h-[200px] rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono"
                  value={config}
                  onChange={(e) => setConfig(e.target.value)}
                  placeholder={tipoContabilidad === "OTRO" ? '{\n  "apiUrl": "https://tu-proveedor.com/api",\n  "token": "tu-token",\n  "authType": "bearer",\n  "healthEndpoint": "/status",\n  "healthMethod": "GET"\n}' : '{\n  "apiUrl": "https://...",\n  "token": "..."\n}'}
                />
              </div>
            )}

            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Guardar Configuración
            </Button>
            {tipoContabilidad !== "INTERNA" && (
              <Button type="button" variant="outline" onClick={handleTest} disabled={testeando}>
                {testeando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Probar conexión
              </Button>
            )}
            {testResult && (
              <p className={`text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                {testResult.mensaje}
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
