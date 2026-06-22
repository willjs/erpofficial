"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import {
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Star,
  Users,
  Phone,
  Mail,
} from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import {
  getClientes,
  createCliente,
  updateCliente,
  toggleClienteActivo,
  deleteCliente,
  getContactos,
  createContacto,
  updateContacto,
  setContactoPrincipal,
  deleteContacto,
  getInteracciones,
  createInteraccion,
  updateInteraccion,
  deleteInteraccion,
} from "@/actions/clientes"

interface ClienteRow {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  direccion: string | null
  rfc: string | null
  tipo: string
  notas: string | null
  activo: boolean
  _count?: { contactos: number; interacciones: number }
}

interface ContactoRow {
  id: string
  clienteId: string
  nombre: string
  cargo: string | null
  email: string | null
  telefono: string | null
  principal: boolean
}

interface InteraccionRow {
  id: string
  clienteId: string
  tipo: string
  fecha: string
  descripcion: string
  cliente?: { id: string; nombre: string }
}

const tipoInteraccionVariant: Record<string, "info" | "default" | "warning" | "secondary" | "success"> = {
  LLAMADA: "info",
  EMAIL: "default",
  REUNION: "warning",
  NOTA: "secondary",
  PROPUESTA: "success",
}

export default function ClientesPage() {
  const { toast } = useToast()
  const [tab, setTab] = useState("clientes")

  const [clientes, setClientes] = useState<ClienteRow[]>([])
  const [clientesLoading, setClientesLoading] = useState(true)
  const [clientesSearch, setClientesSearch] = useState("")
  const [clienteDialogOpen, setClienteDialogOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<ClienteRow | null>(null)
  const [clienteLoading, setClienteLoading] = useState(false)

  const [selectedClienteId, setSelectedClienteId] = useState("")
  const [contactos, setContactos] = useState<ContactoRow[]>([])
  const [contactosLoading, setContactosLoading] = useState(false)
  const [contactoDialogOpen, setContactoDialogOpen] = useState(false)
  const [editingContacto, setEditingContacto] = useState<ContactoRow | null>(null)
  const [contactoLoading, setContactoLoading] = useState(false)

  const [interacciones, setInteracciones] = useState<InteraccionRow[]>([])
  const [interaccionesLoading, setInteraccionesLoading] = useState(true)
  const [interaccionDialogOpen, setInteraccionDialogOpen] = useState(false)
  const [editingInteraccion, setEditingInteraccion] = useState<InteraccionRow | null>(null)
  const [interaccionLoading, setInteraccionLoading] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const loadClientes = useCallback(async () => {
    setClientesLoading(true)
    try {
      const data = await getClientes()
      setClientes(data)
    } catch {
      toast({ title: "Error al cargar clientes", variant: "destructive" })
    } finally {
      setClientesLoading(false)
    }
  }, [toast])

  const loadContactos = useCallback(async (clienteId: string) => {
    if (!clienteId) {
      setContactos([])
      return
    }
    setContactosLoading(true)
    try {
      const data = await getContactos(clienteId)
      setContactos(data)
    } catch {
      toast({ title: "Error al cargar contactos", variant: "destructive" })
    } finally {
      setContactosLoading(false)
    }
  }, [toast])

  const loadInteracciones = useCallback(async () => {
    setInteraccionesLoading(true)
    try {
      const data = await getInteracciones()
      setInteracciones(data as unknown as InteraccionRow[])
    } catch {
      toast({ title: "Error al cargar interacciones", variant: "destructive" })
    } finally {
      setInteraccionesLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadClientes()
  }, [loadClientes])

  useEffect(() => {
    loadInteracciones()
  }, [loadInteracciones])

  useEffect(() => {
    if (tab === "contactos" && selectedClienteId) {
      loadContactos(selectedClienteId)
    }
  }, [tab, selectedClienteId, loadContactos])

  const filteredClientes = useMemo(() => {
    if (!clientesSearch) return clientes
    const q = clientesSearch.toLowerCase()
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.rfc && c.rfc.toLowerCase().includes(q))
    )
  }, [clientes, clientesSearch])

  const selectedClienteNombre = useMemo(
    () => clientes.find((c) => c.id === selectedClienteId)?.nombre || "",
    [clientes, selectedClienteId]
  )

  const handleClienteSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setClienteLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (editingCliente) {
        await updateCliente(editingCliente.id, fd)
        toast({ title: "Cliente actualizado", variant: "success" })
      } else {
        await createCliente(fd)
        toast({ title: "Cliente creado", variant: "success" })
      }
      setClienteDialogOpen(false)
      setEditingCliente(null)
      await loadClientes()
    } catch {
      toast({ title: "Error al guardar cliente", variant: "destructive" })
    } finally {
      setClienteLoading(false)
    }
  }

  const handleContactoSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setContactoLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (editingContacto) {
        await updateContacto(editingContacto.id, fd)
        toast({ title: "Contacto actualizado", variant: "success" })
      } else {
        fd.set("clienteId", selectedClienteId)
        await createContacto(fd)
        toast({ title: "Contacto creado", variant: "success" })
      }
      setContactoDialogOpen(false)
      setEditingContacto(null)
      await loadContactos(selectedClienteId)
    } catch {
      toast({ title: "Error al guardar contacto", variant: "destructive" })
    } finally {
      setContactoLoading(false)
    }
  }

  const handleInteraccionSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setInteraccionLoading(true)
    try {
      const fd = new FormData(e.currentTarget)
      if (editingInteraccion) {
        await updateInteraccion(editingInteraccion.id, fd)
        toast({ title: "Interacción actualizada", variant: "success" })
      } else {
        await createInteraccion(fd)
        toast({ title: "Interacción creada", variant: "success" })
      }
      setInteraccionDialogOpen(false)
      setEditingInteraccion(null)
      await loadInteracciones()
    } catch {
      toast({ title: "Error al guardar interacción", variant: "destructive" })
    } finally {
      setInteraccionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleteLoading(true)
    try {
      const { type, id } = deleteTarget
      if (type === "cliente") {
        await deleteCliente(id)
        toast({ title: "Cliente eliminado", variant: "success" })
        await loadClientes()
      } else if (type === "contacto") {
        await deleteContacto(id)
        toast({ title: "Contacto eliminado", variant: "success" })
        await loadContactos(selectedClienteId)
      } else if (type === "interaccion") {
        await deleteInteraccion(id)
        toast({ title: "Interacción eliminada", variant: "success" })
        await loadInteracciones()
      }
      setDeleteTarget(null)
    } catch {
      toast({ title: "Error al eliminar", variant: "destructive" })
    } finally {
      setDeleteLoading(false)
    }
  }

  const openClienteDialog = (cliente?: ClienteRow) => {
    setEditingCliente(cliente || null)
    setClienteDialogOpen(true)
  }

  const openContactoDialog = (contacto?: ContactoRow) => {
    setEditingContacto(contacto || null)
    setContactoDialogOpen(true)
  }

  const openInteraccionDialog = (interaccion?: InteraccionRow) => {
    setEditingInteraccion(interaccion || null)
    setInteraccionDialogOpen(true)
  }

  const clienteColumns: Column<ClienteRow>[] = [
    { key: "nombre", header: "Nombre" },
    {
      key: "email",
      header: "Email",
      render: (c) =>
        c.email ? (
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            {c.email}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "telefono",
      header: "Teléfono",
      render: (c) =>
        c.telefono ? (
          <span className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            {c.telefono}
          </span>
        ) : (
          "—"
        ),
    },
    { key: "rfc", header: "RFC", render: (c) => c.rfc || "—" },
    {
      key: "tipo",
      header: "Tipo",
      render: (c) => <Badge variant="outline">{c.tipo}</Badge>,
    },
    {
      key: "contactos",
      header: "Contactos",
      render: (c) => c._count?.contactos ?? 0,
    },
    {
      key: "interacciones",
      header: "Interacciones",
      render: (c) => c._count?.interacciones ?? 0,
    },
    {
      key: "activo",
      header: "Estado",
      render: (c) => (
        <Badge variant={c.activo ? "success" : "destructive"}>
          {c.activo ? "Activo" : "Inactivo"}
        </Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[140px]",
      render: (c) => (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            title="Ver contactos"
            onClick={() => {
              setSelectedClienteId(c.id)
              setTab("contactos")
            }}
          >
            <Users className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Editar"
            onClick={() => openClienteDialog(c)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={c.activo ? "Desactivar" : "Activar"}
            onClick={async () => {
              try {
                await toggleClienteActivo(c.id)
                toast({ title: c.activo ? "Cliente desactivado" : "Cliente activado", variant: "success" })
                loadClientes()
              } catch {
                toast({ title: "Error al cambiar estado", variant: "destructive" })
              }
            }}
          >
            {c.activo ? (
              <PowerOff className="h-4 w-4" />
            ) : (
              <Power className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Eliminar"
            onClick={() => setDeleteTarget({ type: "cliente", id: c.id })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const contactoColumns: Column<ContactoRow>[] = [
    { key: "nombre", header: "Nombre" },
    { key: "cargo", header: "Cargo", render: (c) => c.cargo || "—" },
    {
      key: "email",
      header: "Email",
      render: (c) =>
        c.email ? (
          <span className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            {c.email}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "telefono",
      header: "Teléfono",
      render: (c) =>
        c.telefono ? (
          <span className="flex items-center gap-1">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />
            {c.telefono}
          </span>
        ) : (
          "—"
        ),
    },
    {
      key: "principal",
      header: "Principal",
      render: (c) =>
        c.principal ? (
          <Badge variant="success">
            <Star className="mr-1 h-3 w-3 fill-current" />
            Principal
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[140px]",
      render: (c) => (
        <div className="flex items-center gap-0.5">
          {!c.principal && (
            <Button
              variant="ghost"
              size="icon"
              title="Establecer como principal"
              onClick={async () => {
                try {
                  await setContactoPrincipal(c.id, c.clienteId)
                  toast({ title: "Contacto principal actualizado", variant: "success" })
                  loadContactos(selectedClienteId)
                } catch {
                  toast({ title: "Error al actualizar contacto principal", variant: "destructive" })
                }
              }}
            >
              <Star className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            title="Editar"
            onClick={() => openContactoDialog(c)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Eliminar"
            onClick={() => setDeleteTarget({ type: "contacto", id: c.id })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const interaccionColumns: Column<InteraccionRow>[] = [
    {
      key: "fecha",
      header: "Fecha",
      render: (i) => formatDate(i.fecha),
    },
    {
      key: "cliente",
      header: "Cliente",
      render: (i) => i.cliente?.nombre || "—",
    },
    {
      key: "tipo",
      header: "Tipo",
      render: (i) => (
        <Badge variant={tipoInteraccionVariant[i.tipo] || "default"}>
          {i.tipo}
        </Badge>
      ),
    },
    {
      key: "descripcion",
      header: "Descripción",
      className: "max-w-md truncate",
      render: (i) => i.descripcion || "—",
    },
    {
      key: "acciones",
      header: "",
      className: "w-[100px]",
      render: (i) => (
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            title="Editar"
            onClick={() => openInteraccionDialog(i)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Eliminar"
            onClick={() => setDeleteTarget({ type: "interaccion", id: i.id })}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestión de clientes y CRM"
      />

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex border-b">
          <Tabs.Trigger
            value="clientes"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground"
          >
            Clientes
          </Tabs.Trigger>
          <Tabs.Trigger
            value="contactos"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground"
          >
            Contactos
          </Tabs.Trigger>
          <Tabs.Trigger
            value="interacciones"
            className="px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-foreground text-muted-foreground"
          >
            Interacciones
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="clientes" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div />
            <Button onClick={() => openClienteDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Cliente
            </Button>
          </div>

          <DataTable
            columns={clienteColumns}
            data={filteredClientes}
            loading={clientesLoading}
            searchable
            searchPlaceholder="Buscar por nombre, email o RFC..."
            searchTerm={clientesSearch}
            onSearch={setClientesSearch}
          />

          <FormDialog
            open={clienteDialogOpen}
            onOpenChange={(open) => {
              setClienteDialogOpen(open)
              if (!open) setEditingCliente(null)
            }}
            title={editingCliente ? "Editar Cliente" : "Nuevo Cliente"}
            onSubmit={handleClienteSubmit}
            loading={clienteLoading}
            submitLabel={editingCliente ? "Actualizar" : "Crear"}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  name="nombre"
                  defaultValue={editingCliente?.nombre || ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={editingCliente?.email || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  defaultValue={editingCliente?.telefono || ""}
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="direccion">Dirección</Label>
                <Input
                  id="direccion"
                  name="direccion"
                  defaultValue={editingCliente?.direccion || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rfc">RFC</Label>
                <Input
                  id="rfc"
                  name="rfc"
                  defaultValue={editingCliente?.rfc || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  name="tipo"
                  defaultValue={editingCliente?.tipo || "EMPRESA"}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="EMPRESA">Empresa</option>
                  <option value="PERSONA">Persona</option>
                </select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="notas">Notas</Label>
                <textarea
                  id="notas"
                  name="notas"
                  rows={3}
                  defaultValue={editingCliente?.notas || ""}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                />
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>

        <Tabs.Content value="contactos" className="space-y-4 pt-4">
          <div className="flex items-end gap-4">
            <div className="space-y-2 min-w-[300px]">
              <Label>Seleccionar Cliente</Label>
              <Select
                value={selectedClienteId}
                onValueChange={(val) => {
                  setSelectedClienteId(val)
                  loadContactos(val)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClienteId && (
              <Button onClick={() => openContactoDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Contacto
              </Button>
            )}
          </div>

          {!selectedClienteId ? (
            <div className="text-center py-12 text-muted-foreground">
              Selecciona un cliente para ver sus contactos
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Contactos de: <strong>{selectedClienteNombre}</strong>
              </p>
              <DataTable
                columns={contactoColumns}
                data={contactos}
                loading={contactosLoading}
              />
            </>
          )}

          <FormDialog
            open={contactoDialogOpen}
            onOpenChange={(open) => {
              setContactoDialogOpen(open)
              if (!open) setEditingContacto(null)
            }}
            title={editingContacto ? "Editar Contacto" : "Nuevo Contacto"}
            onSubmit={handleContactoSubmit}
            loading={contactoLoading}
            submitLabel={editingContacto ? "Actualizar" : "Crear"}
          >
            <input type="hidden" name="clienteId" value={selectedClienteId} />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="contacto-nombre">Nombre *</Label>
                <Input
                  id="contacto-nombre"
                  name="nombre"
                  defaultValue={editingContacto?.nombre || ""}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto-cargo">Cargo</Label>
                <Input
                  id="contacto-cargo"
                  name="cargo"
                  defaultValue={editingContacto?.cargo || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto-email">Email</Label>
                <Input
                  id="contacto-email"
                  name="email"
                  type="email"
                  defaultValue={editingContacto?.email || ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contacto-telefono">Teléfono</Label>
                <Input
                  id="contacto-telefono"
                  name="telefono"
                  defaultValue={editingContacto?.telefono || ""}
                />
              </div>
              <div className="space-y-2 flex items-end pb-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    name="principal"
                    value="true"
                    defaultChecked={editingContacto?.principal || false}
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium">Contacto principal</span>
                </label>
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>

        <Tabs.Content value="interacciones" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div />
            <Button onClick={() => openInteraccionDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Interacción
            </Button>
          </div>

          <DataTable
            columns={interaccionColumns}
            data={interacciones}
            loading={interaccionesLoading}
          />

          <FormDialog
            open={interaccionDialogOpen}
            onOpenChange={(open) => {
              setInteraccionDialogOpen(open)
              if (!open) setEditingInteraccion(null)
            }}
            title={
              editingInteraccion
                ? "Editar Interacción"
                : "Nueva Interacción"
            }
            onSubmit={handleInteraccionSubmit}
            loading={interaccionLoading}
            submitLabel={editingInteraccion ? "Actualizar" : "Crear"}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="interaccion-cliente">Cliente *</Label>
                <select
                  id="interaccion-cliente"
                  name="clienteId"
                  defaultValue={editingInteraccion?.clienteId || ""}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="" disabled>
                    Selecciona un cliente...
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interaccion-tipo">Tipo *</Label>
                <select
                  id="interaccion-tipo"
                  name="tipo"
                  defaultValue={editingInteraccion?.tipo || ""}
                  required
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                >
                  <option value="" disabled>
                    Selecciona tipo...
                  </option>
                  <option value="LLAMADA">Llamada</option>
                  <option value="EMAIL">Email</option>
                  <option value="REUNION">Reunión</option>
                  <option value="NOTA">Nota</option>
                  <option value="PROPUESTA">Propuesta</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interaccion-fecha">Fecha *</Label>
                <Input
                  id="interaccion-fecha"
                  name="fecha"
                  type="date"
                  defaultValue={
                    editingInteraccion
                      ? editingInteraccion.fecha?.split("T")[0]
                      : new Date().toISOString().split("T")[0]
                  }
                  required
                />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="interaccion-descripcion">Descripción *</Label>
                <textarea
                  id="interaccion-descripcion"
                  name="descripcion"
                  rows={3}
                  defaultValue={editingInteraccion?.descripcion || ""}
                  required
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
                />
              </div>
            </div>
          </FormDialog>
        </Tabs.Content>
      </Tabs.Root>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de eliminar este registro? Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLoading}
              onClick={handleDelete}
            >
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
