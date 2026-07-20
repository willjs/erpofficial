"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  PlusCircle, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, ShieldCheck,
  Zap, Copy, Eye, RefreshCw,
} from "lucide-react"
import {
  getEmpresa, updateEmpresa, uploadLogo, removeLogo,
  getDepartamentos, createDepartamento, updateDepartamento, deleteDepartamento,
  getUsuarios, createUsuario, updateUsuario, toggleUsuarioActivo,
  getRoles, createRol, updateRol, deleteRol,
  getPermisos, getPermisosByRol, updateRolPermisos, getSuperAdmin,
  getCentrosCostos, createCentroCostos, updateCentroCostos, deleteCentroCostos, toggleCentroCostosActivo,
  getTipoContabilidad, saveTipoContabilidad, probarConexionContable,
  assignRolToUser, removeRolFromUser,
} from "@/actions/configuracion"
import { useToast } from "@/components/ui/use-toast"
import {
  getAutomatizaciones, createAutomatizacion, updateAutomatizacion,
  toggleAutomatizacionActiva, deleteAutomatizacion, regenerarToken,
  getAuditoriaAutomatizaciones,
} from "@/actions/automatizaciones"

// ─── Types ────────────────────────────────────────────────

type TabName = "empresa" | "departamentos" | "usuarios" | "roles" | "centros-costos" | "contabilidad" | "automatizaciones"

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
        <TabButton active={tab === "automatizaciones"} onClick={() => setTab("automatizaciones")}>Automatizaciones</TabButton>
      </div>
      <Separator />
      {tab === "empresa" && <EmpresaTab />}
      {tab === "departamentos" && <DepartamentosTab />}
      {tab === "usuarios" && <UsuariosTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "centros-costos" && <CentrosCostosTab />}
      {tab === "contabilidad" && <ContabilidadConfigTab />}
      {tab === "automatizaciones" && <AutomatizacionesTab />}
    </div>
  )
}

// ─── Empresa Tab ─────────────────────────────────────────

function EmpresaTab() {
  const { toast } = useToast()
  const { update: updateSession } = useSession()
  const [empresa, setEmpresa] = useState<EmpresaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [form, setForm] = useState({ nombre: "", rfc: "", direccion: "", telefono: "", email: "", tipoContabilidad: "INTERNA" })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)

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
        setLogoPreview(data.logo ?? null)
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      toast({ title: "Archivo inválido", description: "Seleccione una imagen", variant: "destructive" })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Archivo muy grande", description: "Máximo 5MB", variant: "destructive" })
      return
    }
    setUploadingLogo(true)
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
      })
      const raw = base64.split(",")[1]
      const updated = await uploadLogo(raw)
      setEmpresa(updated)
      setLogoPreview(updated.logo)
      await updateSession()
      toast({ title: "Logo actualizado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al subir logo", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setUploadingLogo(false)
      e.target.value = ""
    }
  }

  async function handleRemoveLogo() {
    try {
      await removeLogo()
      setLogoPreview(null)
      if (empresa) setEmpresa({ ...empresa, logo: null })
      await updateSession()
      toast({ title: "Logo eliminado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error al eliminar logo", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-4 w-4" />Editar Empresa</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="relative group">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo empresa" className="h-28 w-auto object-contain border rounded-lg p-2 bg-background" />
              ) : (
                <div className="h-28 w-40 flex items-center justify-center border-2 border-dashed rounded-lg bg-muted text-muted-foreground text-xs text-center px-2">
                  Sin logo configurado
                </div>
              )}
              {uploadingLogo && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                <Button variant="outline" size="sm" asChild>
                  <span><Pencil className="mr-1.5 h-3.5 w-3.5" />{logoPreview ? "Cambiar logo" : "Subir logo"}</span>
                </Button>
              </label>
              {logoPreview && (
                <Button variant="destructive" size="sm" onClick={handleRemoveLogo}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />Eliminar
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Nombre</Label><p className="text-sm mt-1">{empresa?.nombre ?? "—"}</p></div>
            <div><Label>RFC</Label><p className="text-sm mt-1">{empresa?.rfc ?? "—"}</p></div>
            <div><Label>Dirección</Label><p className="text-sm mt-1">{empresa?.direccion ?? "—"}</p></div>
            <div><Label>Teléfono</Label><p className="text-sm mt-1">{empresa?.telefono ?? "—"}</p></div>
            <div><Label>Email</Label><p className="text-sm mt-1">{empresa?.email ?? "—"}</p></div>
            <div><Label>Tipo Contabilidad</Label><p className="text-sm mt-1">{empresa?.tipoContabilidad ?? "INTERNA"}</p></div>
          </div>
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

  async function handleSavePermisos() {
    console.log("handleSavePermisos called, editing:", editing?.id, "permisos count:", permisosRol.length)
    if (!editing) {
      toast({ title: "Error: no hay rol seleccionado", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await updateRolPermisos(editing.id, permisosRol)
      setPermisosOpen(false)
      await load()
      toast({ title: "Permisos actualizados", variant: "success" })
    } catch (err: unknown) {
      console.error("Error al guardar permisos:", err)
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

  const groupedPermisos = permisos.reduce<Record<string, PermisoData[]>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = []
    acc[p.modulo].push(p)
    return acc
  }, {})

  const MODULO_NAMES: Record<string, string> = {
    CORE: "Core", RRHH: "RRHH", NOMINA: "Nómina", TAREAS: "Tareas",
    INVENTARIO: "Inventario (Activos)", INVENTARIOS: "Inventarios",
    DOCUMENTOS: "Documentos", CONTABILIDAD: "Contabilidad",
    PRESUPUESTOS: "Presupuestos", TESORERIA: "Tesorería",
    CLIENTES: "Clientes", PERMISOS: "Permisos",
    REPORTES: "Reportes", COMPRAS: "Compras", PROVEEDORES: "Proveedores",
    VENTAS: "Ventas", PEDIDOS: "Pedidos", DESPACHOS: "Despachos",
    TRASPASOS: "Traspasos", OPERACIONES: "Operaciones",
    CUENTAS_COBRAR: "Cuentas por Cobrar", DASHBOARD: "Dashboard",
  }

  const ACCION_NAMES: Record<string, string> = {
    CREATE: "Crear", READ: "Ver", UPDATE: "Editar", DELETE: "Eliminar", ALL: "Total",
    APROBAR: "Aprobar", RECHAZAR: "Rechazar", ANULAR: "Anular",
    CERRAR: "Cerrar", REABRIR: "Reabrir", EXPORTAR: "Exportar",
    IMPORTAR: "Importar", ENVIAR: "Enviar", DUPLICAR: "Duplicar",
    CONCILIAR: "Conciliar",
  }

  const ACCIONES_BASICAS = ["CREATE", "READ", "UPDATE", "DELETE"]
  const ACCIONES_EXTRA = ["APROBAR", "RECHAZAR", "ANULAR", "CERRAR", "REABRIR", "EXPORTAR", "IMPORTAR", "ENVIAR", "DUPLICAR", "CONCILIAR"]

  const groupedRecursos = permisos.reduce<Record<string, Record<string, PermisoData[]>>>((acc, p) => {
    if (!acc[p.modulo]) acc[p.modulo] = {}
    if (!acc[p.modulo][p.recurso]) acc[p.modulo][p.recurso] = []
    acc[p.modulo][p.recurso].push(p)
    return acc
  }, {})

  function getRecursoPermisoIds(modulo: string, recurso: string): string[] {
    return (groupedRecursos[modulo]?.[recurso] ?? []).map((p) => p.id)
  }

  function isRecursoAllChecked(modulo: string, recurso: string): boolean {
    const ids = getRecursoPermisoIds(modulo, recurso)
    return ids.length > 0 && ids.every((id) => permisosRol.includes(id))
  }

  function isRecursoEditChecked(modulo: string, recurso: string): boolean {
    const perms = groupedRecursos[modulo]?.[recurso] ?? []
    const editPerms = perms.filter((p) => ["READ", "CREATE", "UPDATE"].includes(p.accion))
    return editPerms.length > 0 && editPerms.every((p) => permisosRol.includes(p.id))
  }

  function isRecursoReadChecked(modulo: string, recurso: string): boolean {
    const perms = groupedRecursos[modulo]?.[recurso] ?? []
    const readPerm = perms.find((p) => p.accion === "READ")
    return readPerm ? permisosRol.includes(readPerm.id) : false
  }

  function setRecursoLevel(modulo: string, recurso: string, level: "none" | "read" | "edit" | "all") {
    const perms = groupedRecursos[modulo]?.[recurso] ?? []
    setPermisosRol((prev) => {
      const ids = new Set(prev)
      for (const p of perms) {
        if (level === "none") ids.delete(p.id)
        else if (level === "read") { if (p.accion === "READ") ids.add(p.id); else ids.delete(p.id) }
        else if (level === "edit") { if (["READ", "CREATE", "UPDATE"].includes(p.accion)) ids.add(p.id); else ids.delete(p.id) }
        else ids.add(p.id)
      }
      return [...ids]
    })
  }

  function toggleExtraPermiso(permisoId: string) {
    setPermisosRol((prev) => {
      const ids = new Set(prev)
      if (ids.has(permisoId)) ids.delete(permisoId)
      else ids.add(permisoId)
      return [...ids]
    })
  }

  function getModuloLevel(modulo: string): "none" | "read" | "edit" | "all" {
    const perms = groupedPermisos[modulo] ?? []
    if (perms.length === 0) return "none"
    const allChecked = perms.every((p) => permisosRol.includes(p.id))
    if (allChecked) return "all"
    const editPerms = perms.filter((p) => ["READ", "CREATE", "UPDATE"].includes(p.accion))
    const editChecked = editPerms.length > 0 && editPerms.every((p) => permisosRol.includes(p.id))
    const anyExtraChecked = perms.some((p) => !["READ", "CREATE", "UPDATE"].includes(p.accion) && permisosRol.includes(p.id))
    if (editChecked && !anyExtraChecked) return "edit"
    const readPerms = perms.filter((p) => p.accion === "READ")
    const readChecked = readPerms.length > 0 && readPerms.every((p) => permisosRol.includes(p.id))
    const anyNonReadChecked = perms.some((p) => p.accion !== "READ" && permisosRol.includes(p.id))
    if (readChecked && !anyNonReadChecked) return "read"
    return "none"
  }

  function setModuloLevel(modulo: string, level: "none" | "read" | "edit" | "all") {
    const perms = groupedPermisos[modulo] ?? []
    setPermisosRol((prev) => {
      const ids = new Set(prev)
      for (const p of perms) {
        if (level === "none") ids.delete(p.id)
        else if (level === "read") { if (p.accion === "READ") ids.add(p.id); else ids.delete(p.id) }
        else if (level === "edit") { if (["READ", "CREATE", "UPDATE"].includes(p.accion)) ids.add(p.id); else ids.delete(p.id) }
        else ids.add(p.id)
      }
      return [...ids]
    })
  }

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
      <Dialog open={permisosOpen} onOpenChange={setPermisosOpen}>
        <DialogContent
          className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement
            if (target.closest("[data-radix-select-viewport]") || target.closest("[data-radix-popper-content-wrapper]")) {
              e.preventDefault()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{`Permisos: ${editing?.nombre ?? ""}`}</DialogTitle>
            <DialogDescription>Configura los permisos detallados para este rol por módulo, recurso y acción</DialogDescription>
          </DialogHeader>
          {rolPermisosLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {Object.keys(groupedPermisos).sort().map((modulo) => {
                const level = getModuloLevel(modulo)
                const isCore = modulo === "CORE"
                const recursos = Object.keys(groupedRecursos[modulo] ?? {}).sort()
                const isExpanded = level !== "none"
                return (
                  <div key={modulo} className={`rounded-md border ${isCore && !isSuperAdmin ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                      <span className="text-sm font-semibold">{MODULO_NAMES[modulo] ?? modulo}</span>
                      <Select
                        value={level}
                        onValueChange={(v) => setModuloLevel(modulo, v as "none" | "read" | "edit" | "all")}
                        disabled={isCore && !isSuperAdmin}
                      >
                        <SelectTrigger className="w-44 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin acceso</SelectItem>
                          <SelectItem value="read">Solo lectura</SelectItem>
                          <SelectItem value="edit">Ver + Editar</SelectItem>
                          <SelectItem value="all">Acceso total</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {isExpanded && (
                      <div className="px-3 py-2 space-y-2 border-t">
                        {recursos.map((recurso) => {
                          const recursoPerms = groupedRecursos[modulo][recurso]
                          const extraPerms = recursoPerms.filter((p) => ACCIONES_EXTRA.includes(p.accion))
                          return (
                            <div key={recurso} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground capitalize">{recurso.replace(/_/g, " ")}</span>
                              <div className="flex items-center gap-2">
                                <div className="flex gap-1">
                                  {ACCIONES_BASICAS.map((accion) => {
                                    const perm = recursoPerms.find((p) => p.accion === accion)
                                    if (!perm) return null
                                    const checked = permisosRol.includes(perm.id)
                                    return (
                                      <button
                                        key={accion}
                                        onClick={() => toggleExtraPermiso(perm.id)}
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                          checked
                                            ? accion === "READ" ? "bg-blue-100 text-blue-700"
                                            : accion === "CREATE" ? "bg-green-100 text-green-700"
                                            : accion === "UPDATE" ? "bg-amber-100 text-amber-700"
                                            : "bg-red-100 text-red-700"
                                            : "bg-muted text-muted-foreground"
                                        }`}
                                        title={ACCION_NAMES[accion]}
                                      >
                                        {ACCION_NAMES[accion]?.charAt(0)}
                                      </button>
                                    )
                                  })}
                                </div>
                                {extraPerms.length > 0 && (
                                  <div className="flex gap-1 border-l pl-2">
                                    {extraPerms.map((perm) => {
                                      const checked = permisosRol.includes(perm.id)
                                      return (
                                        <button
                                          key={perm.id}
                                          onClick={() => toggleExtraPermiso(perm.id)}
                                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                                            checked
                                              ? "bg-purple-100 text-purple-700"
                                              : "bg-muted text-muted-foreground"
                                          }`}
                                          title={ACCION_NAMES[perm.accion] ?? perm.accion}
                                        >
                                          {(ACCION_NAMES[perm.accion] ?? perm.accion).charAt(0)}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 text-[10px] text-muted-foreground flex flex-wrap gap-3">
            <span><span className="inline-block w-2 h-2 rounded bg-blue-400 mr-1" />Ver</span>
            <span><span className="inline-block w-2 h-2 rounded bg-green-400 mr-1" />Crear</span>
            <span><span className="inline-block w-2 h-2 rounded bg-amber-400 mr-1" />Editar</span>
            <span><span className="inline-block w-2 h-2 rounded bg-red-400 mr-1" />Eliminar</span>
            <span><span className="inline-block w-2 h-2 rounded bg-purple-400 mr-1" />Acciones extra</span>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPermisosOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePermisos} disabled={saving || rolPermisosLoading}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Permisos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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

// ─── Automatizaciones Tab ─────────────────────────────────

interface AutomatizacionRow {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  modulo: string
  evento: string
  urlPowerAutomate: string
  activo: boolean
  token: string
  createdAt: Date
  _count?: { auditorias: number }
}

interface AuditoriaRow {
  id: string
  codigoEvento: string
  entidadTipo: string
  entidadId: string
  respuestaHTTP: number | null
  tiempoEjecucionMs: number | null
  mensajeError: string | null
  createdAt: Date
  automatizacion: { codigo: string; nombre: string }
  usuario: { nombre: string; email: string } | null
}

const eventosDisponibles = [
  { codigo: "REQUISICION_CREADA", nombre: "Requisición Creada", modulo: "COMPRAS" },
  { codigo: "REQUISICION_ENVIADA", nombre: "Requisición Enviada", modulo: "COMPRAS" },
  { codigo: "OC_CREADA", nombre: "OC Creada", modulo: "COMPRAS" },
  { codigo: "OC_APROBADA", nombre: "OC Aprobada", modulo: "COMPRAS" },
  { codigo: "FACTURA_REGISTRADA", nombre: "Factura Registrada", modulo: "COMPRAS" },
  { codigo: "PAGO_REALIZADO", nombre: "Pago Realizado", modulo: "TESORERIA" },
  { codigo: "PROGRAMACION_CREADA", nombre: "Programación Creada", modulo: "OPERACIONES" },
  { codigo: "PROGRAMACION_APROBADA", nombre: "Programación Aprobada", modulo: "OPERACIONES" },
  { codigo: "ORDEN_CREADA", nombre: "Orden Operativa Creada", modulo: "OPERACIONES" },
  { codigo: "ORDEN_ASIGNADA", nombre: "Orden Operativa Asignada", modulo: "OPERACIONES" },
  { codigo: "DELIVERY_TICKET_CREADO", nombre: "DT Creado", modulo: "OPERACIONES" },
  { codigo: "DELIVERY_TICKET_CONFIRMADO", nombre: "DT Confirmado", modulo: "OPERACIONES" },
  { codigo: "DELIVERY_TICKET_CERRADO", nombre: "DT Cerrado", modulo: "OPERACIONES" },
  { codigo: "PEDIDO_CREADO", nombre: "Pedido Creado", modulo: "PEDIDOS" },
  { codigo: "PEDIDO_CONFIRMADO", nombre: "Pedido Confirmado", modulo: "PEDIDOS" },
  { codigo: "VENTA_CREADA", nombre: "Venta Creada", modulo: "VENTAS" },
  { codigo: "VENTA_CONFIRMADA", nombre: "Venta Confirmada", modulo: "VENTAS" },
  { codigo: "DESPACHO_CREADO", nombre: "Despacho Creado", modulo: "DESPACHOS" },
  { codigo: "DESPACHO_ENVIADO", nombre: "Despacho Enviado", modulo: "DESPACHOS" },
  { codigo: "PRODUCTO_CREADO", nombre: "Producto Creado", modulo: "INVENTARIOS" },
  { codigo: "STOCK_MINIMO", nombre: "Stock Mínimo", modulo: "INVENTARIOS" },
  { codigo: "TRASPASO_COMPLETADO", nombre: "Traspaso Completado", modulo: "TRASPASOS" },
  { codigo: "EMPLEADO_CREADO", nombre: "Empleado Creado", modulo: "RRHH" },
  { codigo: "NOMINA_APROBADA", nombre: "Nómina Aprobada", modulo: "NOMINA" },
  { codigo: "CUENTA_COBRAR_CREADA", nombre: "Cta. Cobrar Creada", modulo: "CUENTAS_COBRAR" },
  { codigo: "RECIBO_CAJA_REGISTRADO", nombre: "Recibo de Caja", modulo: "CUENTAS_COBRAR" },
]

function AutomatizacionesTab() {
  const { toast } = useToast()
  const [data, setData] = useState<AutomatizacionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<AutomatizacionRow | null>(null)
  const [search, setSearch] = useState("")
  const [form, setForm] = useState({
    codigo: "",
    nombre: "",
    descripcion: "",
    modulo: "",
    evento: "",
    urlPowerAutomate: "",
  })
  const [auditoriaOpen, setAuditoriaOpen] = useState(false)
  const [auditoriaData, setAuditoriaData] = useState<AuditoriaRow[]>([])
  const [auditoriaLoading, setAuditoriaLoading] = useState(false)
  const [tokenVisible, setTokenVisible] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getAutomatizaciones()
      setData(result)
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al cargar", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const filtered = data.filter((a) =>
    a.codigo.toLowerCase().includes(search.toLowerCase()) ||
    a.nombre.toLowerCase().includes(search.toLowerCase()) ||
    a.modulo.toLowerCase().includes(search.toLowerCase())
  )

  function openCreate() {
    setEditing(null)
    setForm({ codigo: "", nombre: "", descripcion: "", modulo: "", evento: "", urlPowerAutomate: "" })
    setDialogOpen(true)
  }

  function openEdit(item: AutomatizacionRow) {
    setEditing(item)
    setForm({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion || "",
      modulo: item.modulo,
      evento: item.evento,
      urlPowerAutomate: item.urlPowerAutomate || "",
    })
    setDialogOpen(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        descripcion: form.descripcion || undefined,
      }
      if (editing) {
        await updateAutomatizacion(editing.id, payload)
        toast({ title: "Automatización actualizada", variant: "success" })
      } else {
        await createAutomatizacion(payload)
        toast({ title: "Automatización creada", variant: "success" })
      }
      setDialogOpen(false)
      await load()
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al guardar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id: string) {
    try {
      await toggleAutomatizacionActiva(id)
      await load()
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta automatización?")) return
    try {
      await deleteAutomatizacion(id)
      await load()
      toast({ title: "Automatización eliminada", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  async function handleRegenerarToken(id: string) {
    if (!confirm("¿Regenerar el token? El token anterior dejará de funcionar.")) return
    try {
      const result = await regenerarToken(id)
      setTokenVisible(result.token)
      await load()
      toast({ title: "Token regenerado", variant: "success" })
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    }
  }

  async function openAuditoria(automatizacionId?: string) {
    setAuditoriaOpen(true)
    setAuditoriaLoading(true)
    try {
      const result = await getAuditoriaAutomatizaciones({ automatizacionId, limit: 50 })
      setAuditoriaData(result.auditorias as any)
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error", variant: "destructive" })
    } finally {
      setAuditoriaLoading(false)
    }
  }

  function copyToken(token: string) {
    navigator.clipboard.writeText(token)
    toast({ title: "Token copiado", variant: "success" })
  }

  const columns: Column<AutomatizacionRow>[] = [
    { key: "codigo", header: "Código", className: "font-mono text-xs" },
    { key: "nombre", header: "Nombre" },
    {
      key: "modulo",
      header: "Módulo",
      render: (item) => (
        <Badge variant={item.modulo === "OPERACIONES" ? "info" : item.modulo === "COMPRAS" ? "default" : "secondary"}>
          {item.modulo}
        </Badge>
      ),
    },
    { key: "evento", header: "Evento", hideOnMobile: true, className: "font-mono text-xs" },
    {
      key: "activo",
      header: "Estado",
      render: (item) => (
        <Badge variant={item.activo ? "success" : "secondary"}>
          {item.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "auditorias",
      header: "Ejecuciones",
      hideOnMobile: true,
      render: (item) => (
        <Button variant="ghost" size="sm" onClick={() => openAuditoria(item.id)}>
          <Eye className="h-4 w-4 mr-1" />
          {item._count?.auditorias || 0}
        </Button>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[180px]",
      render: (item) => (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" title="Editar" onClick={() => openEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title={item.activo ? "Desactivar" : "Activar"} onClick={() => handleToggle(item.id)}>
            {item.activo ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" title="Copiar token" onClick={() => copyToken(item.token)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Regenerar token" onClick={() => handleRegenerarToken(item.id)}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Eliminar" onClick={() => handleDelete(item.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configura las integraciones con Power Automate. Cada evento envía un webhook con el ID del documento.
        </p>
        <Button onClick={openCreate}>
          <PlusCircle className="mr-2 h-4 w-4" />Nueva Automatización
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={loading}
        searchable
        searchPlaceholder="Buscar por código, nombre o módulo..."
        onSearch={setSearch}
        mobileCardTitle={(item) => <span className="font-medium">{item.nombre}</span>}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? "Editar Automatización" : "Nueva Automatización"}
        onSubmit={handleSave}
        loading={saving}
        className="max-w-2xl"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Evento</Label>
            <Select
              value={form.codigo}
              onValueChange={(v) => {
                const ev = eventosDisponibles.find((e) => e.codigo === v)
                if (ev) {
                  setForm({ ...form, codigo: v, nombre: ev.nombre, modulo: ev.modulo, evento: v })
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar evento" />
              </SelectTrigger>
              <SelectContent>
                {eventosDisponibles.map((ev) => (
                  <SelectItem key={ev.codigo} value={ev.codigo}>
                    {ev.nombre} ({ev.modulo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Código</Label>
            <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Nombre</Label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label>Módulo</Label>
            <Input value={form.modulo} disabled />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Descripción</Label>
            <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>URL Power Automate (Webhook)</Label>
            <Input
              value={form.urlPowerAutomate}
              onChange={(e) => setForm({ ...form, urlPowerAutomate: e.target.value })}
              placeholder="https://prod-xx.region.logic.azure.com/workflows/..."
              type="url"
            />
          </div>
        </div>
        {editing && (
          <div className="mt-4 p-3 bg-muted rounded-md">
            <p className="text-xs text-muted-foreground mb-1">Token de autenticación:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all bg-background px-2 py-1 rounded flex-1">
                {tokenVisible || editing.token}
              </code>
              <Button type="button" variant="ghost" size="icon" onClick={() => copyToken(editing.token)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </FormDialog>

      {/* Auditoría Dialog */}
      <Dialog open={auditoriaOpen} onOpenChange={setAuditoriaOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de Ejecuciones</DialogTitle>
            <DialogDescription>Últimas ejecuciones de automatizaciones enviadas a Power Automate</DialogDescription>
          </DialogHeader>
          {auditoriaLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : auditoriaData.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No hay ejecuciones registradas</p>
          ) : (
            <div className="space-y-2">
              {auditoriaData.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-3 border rounded-md text-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={a.respuestaHTTP && a.respuestaHTTP < 400 ? "success" : "destructive"}>
                        {a.respuestaHTTP || "N/A"}
                      </Badge>
                      <span className="font-mono text-xs">{a.codigoEvento}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.entidadTipo} · {a.tiempoEjecucionMs || 0}ms
                      {a.mensajeError && <span className="text-destructive ml-2">· {a.mensajeError}</span>}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{a.usuario?.nombre || "Sistema"}</div>
                    <div>{new Date(a.createdAt).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
