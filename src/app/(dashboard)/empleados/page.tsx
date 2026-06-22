"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import * as Tabs from "@radix-ui/react-tabs"
import {
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Users,
  FileText,
  AlertTriangle,
} from "lucide-react"

import {
  getEmpleados,
  createEmpleado,
  updateEmpleado,
  deleteEmpleado,
  getContratos,
  createContrato,
  updateContrato,
  deleteContrato,
  getIncidencias,
  createIncidencia,
  updateIncidencia,
  deleteIncidencia,
} from "@/actions/empleados"
import type {
  CreateEmpleadoInput,
  UpdateEmpleadoInput,
  CreateContratoInput,
  UpdateContratoInput,
  CreateIncidenciaInput,
  UpdateIncidenciaInput,
} from "@/actions/empleados"

import { PageHeader } from "@/components/shared/page-header"
import { DataTable } from "@/components/shared/data-table"
import type { Column } from "@/components/shared/data-table"
import { FormDialog } from "@/components/shared/form-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/use-toast"
import { formatMoney, formatDate } from "@/lib/utils"

type Empleado = Awaited<ReturnType<typeof getEmpleados>>[number]
type Contrato = Awaited<ReturnType<typeof getContratos>>[number]
type Incidencia = Awaited<ReturnType<typeof getIncidencias>>[number]

const estadoBadge: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ACTIVO: "success",
  INACTIVO: "secondary",
  SUSPENDIDO: "warning",
  BAJA: "destructive",
}

const tipoContratoBadge: Record<string, "success" | "warning" | "info" | "secondary" | "default"> = {
  INDEFINIDO: "success",
  TEMPORAL: "warning",
  PRACTICAS: "info",
  FREELANCE: "secondary",
  HONORARIOS: "default",
}

const empleadoFormSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido"),
  telefono: z.string().optional(),
  direccion: z.string().optional(),
  fechaNacimiento: z.string().optional(),
  fechaContratacion: z.string().optional(),
  salario: z.coerce.number().min(0, "El salario no puede ser negativo"),
  puesto: z.string().optional(),
  departamento: z.string().optional(),
})

const contratoFormSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  tipo: z.enum(["INDEFINIDO", "TEMPORAL", "PRACTICAS", "FREELANCE", "HONORARIOS"]),
  fechaInicio: z.string().min(1, "Fecha de inicio requerida"),
  fechaFin: z.string().optional(),
  salarioBase: z.coerce.number().min(0, "El salario base no puede ser negativo"),
  puesto: z.string().min(1, "El puesto es requerido"),
  departamento: z.string().min(1, "El departamento es requerido"),
  jornada: z.string().optional(),
  activo: z.boolean().optional(),
})

const incidenciaFormSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  tipo: z.string().min(1, "El tipo es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  fechaFin: z.string().optional(),
  descripcion: z.string().optional(),
  horas: z.coerce.number().int().optional(),
  minutos: z.coerce.number().int().optional(),
})

type EmpleadoForm = z.infer<typeof empleadoFormSchema>
type ContratoForm = z.infer<typeof contratoFormSchema>
type IncidenciaForm = z.infer<typeof incidenciaFormSchema>

export default function EmpleadosPage() {
  const [tab, setTab] = useState("empleados")
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [contratos, setContratos] = useState<Contrato[]>([])
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()

  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState("")

  const [empleadoDialogOpen, setEmpleadoDialogOpen] = useState(false)
  const [editingEmpleado, setEditingEmpleado] = useState<Empleado | null>(null)

  const [contratoDialogOpen, setContratoDialogOpen] = useState(false)
  const [editingContrato, setEditingContrato] = useState<Contrato | null>(null)

  const [incidenciaDialogOpen, setIncidenciaDialogOpen] = useState(false)
  const [editingIncidencia, setEditingIncidencia] = useState<Incidencia | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "empleado" | "contrato" | "incidencia"
    id: string
    label: string
  } | null>(null)

  const empleadoForm = useForm<EmpleadoForm>({
    resolver: zodResolver(empleadoFormSchema) as any,
  })
  const contratoForm = useForm<ContratoForm>({
    resolver: zodResolver(contratoFormSchema) as any,
  })
  const incidenciaForm = useForm<IncidenciaForm>({
    resolver: zodResolver(incidenciaFormSchema) as any,
  })

  const fetchEmpleados = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getEmpleados()
      setEmpleados(data)
    } catch {
      toast({ title: "Error al cargar empleados", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEmpleados()
  }, [fetchEmpleados])

  const fetchContratos = useCallback(async (empleadoId: string) => {
    if (!empleadoId) {
      setContratos([])
      return
    }
    try {
      const data = await getContratos(empleadoId)
      setContratos(data)
    } catch {
      toast({ title: "Error al cargar contratos", variant: "destructive" })
    }
  }, [])

  const fetchIncidencias = useCallback(async (empleadoId: string) => {
    if (!empleadoId) {
      setIncidencias([])
      return
    }
    try {
      const data = await getIncidencias(empleadoId)
      setIncidencias(data)
    } catch {
      toast({ title: "Error al cargar incidencias", variant: "destructive" })
    }
  }, [])

  useEffect(() => {
    if (tab === "contratos" && selectedEmpleadoId) {
      fetchContratos(selectedEmpleadoId)
    }
  }, [tab, selectedEmpleadoId, fetchContratos])

  useEffect(() => {
    if (tab === "incidencias" && selectedEmpleadoId) {
      fetchIncidencias(selectedEmpleadoId)
    }
  }, [tab, selectedEmpleadoId, fetchIncidencias])

  const openCreateEmpleado = () => {
    setEditingEmpleado(null)
    empleadoForm.reset({
      nombre: "",
      apellido: "",
      email: "",
      telefono: "",
      direccion: "",
      fechaNacimiento: "",
      fechaContratacion: new Date().toISOString().split("T")[0],
      salario: 0,
      puesto: "",
      departamento: "",
    })
    setEmpleadoDialogOpen(true)
  }

  const openEditEmpleado = (empleado: Empleado) => {
    setEditingEmpleado(empleado)
    empleadoForm.reset({
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      email: empleado.email,
      telefono: empleado.telefono ?? "",
      direccion: empleado.direccion ?? "",
      fechaNacimiento: empleado.fechaNacimiento
        ? new Date(empleado.fechaNacimiento).toISOString().split("T")[0]
        : "",
      fechaContratacion: empleado.fechaContratacion
        ? new Date(empleado.fechaContratacion).toISOString().split("T")[0]
        : "",
      salario: Number(empleado.salario),
      puesto: empleado.puesto ?? "",
      departamento: empleado.departamento ?? "",
    })
    setEmpleadoDialogOpen(true)
  }

  const onSubmitEmpleado = async (data: EmpleadoForm) => {
    try {
      setSubmitting(true)
      setError("")
      if (editingEmpleado) {
        await updateEmpleado(editingEmpleado.id, data as UpdateEmpleadoInput)
      } else {
        await createEmpleado(data as CreateEmpleadoInput)
      }
      setEmpleadoDialogOpen(false)
      await fetchEmpleados()
      toast({ title: editingEmpleado ? "Empleado actualizado" : "Empleado creado", variant: "success" })
    } catch (e: any) {
      toast({ title: e?.message ?? "Error al guardar empleado", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEmpleado = async (id: string) => {
    try {
      setError("")
      await deleteEmpleado(id)
      setDeleteConfirm(null)
      await fetchEmpleados()
      toast({ title: "Empleado dado de baja", variant: "success" })
    } catch (e: any) {
      toast({ title: e?.message ?? "Error al eliminar empleado", variant: "destructive" })
    }
  }

  const openCreateContrato = () => {
    setEditingContrato(null)
    contratoForm.reset({
      empleadoId: selectedEmpleadoId,
      tipo: "INDEFINIDO",
      fechaInicio: new Date().toISOString().split("T")[0],
      fechaFin: "",
      salarioBase: 0,
      puesto: "",
      departamento: "",
      jornada: "COMPLETA",
      activo: true,
    })
    setContratoDialogOpen(true)
  }

  const openEditContrato = (contrato: Contrato) => {
    setEditingContrato(contrato)
    contratoForm.reset({
      empleadoId: contrato.empleadoId,
      tipo: contrato.tipo as any,
      fechaInicio: new Date(contrato.fechaInicio).toISOString().split("T")[0],
      fechaFin: contrato.fechaFin
        ? new Date(contrato.fechaFin).toISOString().split("T")[0]
        : "",
      salarioBase: Number(contrato.salarioBase),
      puesto: contrato.puesto,
      departamento: contrato.departamento,
      jornada: contrato.jornada,
      activo: contrato.activo,
    })
    setContratoDialogOpen(true)
  }

  const onSubmitContrato = async (data: ContratoForm) => {
    try {
      setSubmitting(true)
      setError("")
      if (editingContrato) {
        await updateContrato(editingContrato.id, data as UpdateContratoInput)
      } else {
        await createContrato(data as CreateContratoInput)
      }
      setContratoDialogOpen(false)
      await fetchContratos(selectedEmpleadoId)
      toast({ title: editingContrato ? "Contrato actualizado" : "Contrato creado", variant: "success" })
    } catch (e: any) {
      toast({ title: e?.message ?? "Error al guardar contrato", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteContrato = async (id: string) => {
    try {
      setError("")
      await deleteContrato(id)
      setDeleteConfirm(null)
      await fetchContratos(selectedEmpleadoId)
      toast({ title: "Contrato eliminado", variant: "success" })
    } catch (e: any) {
      toast({ title: e?.message ?? "Error al eliminar contrato", variant: "destructive" })
    }
  }

  const openCreateIncidencia = () => {
    setEditingIncidencia(null)
    incidenciaForm.reset({
      empleadoId: selectedEmpleadoId,
      tipo: "",
      fecha: new Date().toISOString().split("T")[0],
      fechaFin: "",
      descripcion: "",
      horas: undefined,
      minutos: undefined,
    })
    setIncidenciaDialogOpen(true)
  }

  const openEditIncidencia = (incidencia: Incidencia) => {
    setEditingIncidencia(incidencia)
    incidenciaForm.reset({
      empleadoId: incidencia.empleadoId,
      tipo: incidencia.tipo,
      fecha: new Date(incidencia.fecha).toISOString().split("T")[0],
      fechaFin: incidencia.fechaFin
        ? new Date(incidencia.fechaFin).toISOString().split("T")[0]
        : "",
      descripcion: incidencia.descripcion ?? "",
      horas: incidencia.horas ?? undefined,
      minutos: incidencia.minutos ?? undefined,
    })
    setIncidenciaDialogOpen(true)
  }

  const onSubmitIncidencia = async (data: IncidenciaForm) => {
    try {
      setSubmitting(true)
      setError("")
      if (editingIncidencia) {
        await updateIncidencia(editingIncidencia.id, data as UpdateIncidenciaInput)
      } else {
        await createIncidencia(data as CreateIncidenciaInput)
      }
      setIncidenciaDialogOpen(false)
      await fetchIncidencias(selectedEmpleadoId)
      toast({ title: editingIncidencia ? "Incidencia actualizada" : "Incidencia creada", variant: "success" })
    } catch (e: any) {
      toast({ title: e?.message ?? "Error al guardar incidencia", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteIncidencia = async (id: string) => {
    try {
      setError("")
      await deleteIncidencia(id)
      setDeleteConfirm(null)
      await fetchIncidencias(selectedEmpleadoId)
      toast({ title: "Incidencia eliminada", variant: "success" })
    } catch (e: any) {
      toast({ title: e?.message ?? "Error al eliminar incidencia", variant: "destructive" })
    }
  }

  const filteredEmpleados = empleados.filter((e) => {
    const term = searchTerm.toLowerCase()
    return (
      e.nombre.toLowerCase().includes(term) ||
      e.apellido.toLowerCase().includes(term) ||
      e.email.toLowerCase().includes(term) ||
      (e.puesto ?? "").toLowerCase().includes(term) ||
      (e.departamento ?? "").toLowerCase().includes(term) ||
      e.codigo.toLowerCase().includes(term)
    )
  })

  const empleadoColumns: Column<Empleado>[] = [
    { key: "codigo", header: "Código" },
    {
      key: "nombreCompleto",
      header: "Nombre",
      render: (item) => `${item.nombre} ${item.apellido}`,
    },
    { key: "email", header: "Email" },
    { key: "puesto", header: "Puesto", render: (item) => item.puesto ?? "—" },
    {
      key: "salario",
      header: "Salario",
      render: (item) => formatMoney(Number(item.salario)),
    },
    {
      key: "estado",
      header: "Estado",
      render: (item) => (
        <Badge variant={estadoBadge[item.estado] ?? "secondary"}>{item.estado}</Badge>
      ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[60px]",
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditEmpleado(item)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setDeleteConfirm({
                  type: "empleado",
                  id: item.id,
                  label: `${item.nombre} ${item.apellido}`,
                })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const contratoColumns: Column<Contrato>[] = [
    {
      key: "tipo",
      header: "Tipo",
      render: (item) => (
        <Badge variant={tipoContratoBadge[item.tipo] ?? "default"}>{item.tipo}</Badge>
      ),
    },
    {
      key: "fechaInicio",
      header: "Inicio",
      render: (item) => formatDate(item.fechaInicio),
    },
    {
      key: "fechaFin",
      header: "Fin",
      render: (item) => (item.fechaFin ? formatDate(item.fechaFin) : "—"),
    },
    {
      key: "salarioBase",
      header: "Salario Base",
      render: (item) => formatMoney(Number(item.salarioBase)),
    },
    { key: "puesto", header: "Puesto" },
    { key: "jornada", header: "Jornada" },
    {
      key: "activo",
      header: "Estado",
      render: (item) =>
        item.activo ? (
          <Badge variant="success">Activo</Badge>
        ) : (
          <Badge variant="secondary">Inactivo</Badge>
        ),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[60px]",
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditContrato(item)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setDeleteConfirm({
                  type: "contrato",
                  id: item.id,
                  label: `${item.tipo} - ${item.puesto}`,
                })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const incidenciaColumns: Column<Incidencia>[] = [
    { key: "tipo", header: "Tipo" },
    {
      key: "fecha",
      header: "Fecha",
      render: (item) => formatDate(item.fecha),
    },
    {
      key: "fechaFin",
      header: "Fecha Fin",
      render: (item) => (item.fechaFin ? formatDate(item.fechaFin) : "—"),
    },
    {
      key: "descripcion",
      header: "Descripción",
      render: (item) => item.descripcion ?? "—",
    },
    {
      key: "horas",
      header: "Horas",
      render: (item) => (item.horas != null ? `${item.horas}h` : "—"),
    },
    {
      key: "minutos",
      header: "Minutos",
      render: (item) => (item.minutos != null ? `${item.minutos}m` : "—"),
    },
    {
      key: "acciones",
      header: "",
      className: "w-[60px]",
      render: (item) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditIncidencia(item)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() =>
                setDeleteConfirm({
                  type: "incidencia",
                  id: item.id,
                  label: `${item.tipo} - ${formatDate(item.fecha)}`,
                })
              }
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const selectedEmpleado = empleados.find((e) => e.id === selectedEmpleadoId)

  const inputClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"

  return (
    <div className="space-y-6">
      <PageHeader
        title="Empleados"
        description="Gestión de recursos humanos"
        actions={
          tab === "empleados" && (
            <Button onClick={openCreateEmpleado}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Empleado
            </Button>
          )
        }
      />

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2" onClick={() => setError("")}>
            X
          </Button>
        </div>
      )}

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List className="flex border-b">
          <Tabs.Trigger
            value="empleados"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <Users className="h-4 w-4" />
            Empleados
          </Tabs.Trigger>
          <Tabs.Trigger
            value="contratos"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <FileText className="h-4 w-4" />
            Contratos
          </Tabs.Trigger>
          <Tabs.Trigger
            value="incidencias"
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary"
          >
            <AlertTriangle className="h-4 w-4" />
            Incidencias
          </Tabs.Trigger>
        </Tabs.List>

        {/* ==================== EMPLEADOS TAB ==================== */}
        <Tabs.Content value="empleados" className="pt-4">
          <DataTable<Empleado>
            columns={empleadoColumns}
            data={filteredEmpleados}
            loading={loading}
            searchable
            searchPlaceholder="Buscar empleados..."
            searchTerm={searchTerm}
            onSearch={setSearchTerm}
          />
        </Tabs.Content>

        {/* ==================== CONTRATOS TAB ==================== */}
        <Tabs.Content value="contratos" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Empleado</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedEmpleadoId}
                onValueChange={(val) => {
                  setSelectedEmpleadoId(val)
                  fetchContratos(val)
                }}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Selecciona un empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.codigo} - {emp.nombre} {emp.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedEmpleado ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Contratos de{" "}
                    <span className="font-medium text-foreground">
                      {selectedEmpleado.nombre} {selectedEmpleado.apellido}
                    </span>
                  </p>
                </div>
                <Button onClick={openCreateContrato} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nuevo Contrato
                </Button>
              </div>
              <DataTable<Contrato>
                columns={contratoColumns}
                data={contratos}
                loading={loading}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Selecciona un empleado para ver sus contratos</p>
              </CardContent>
            </Card>
          )}
        </Tabs.Content>

        {/* ==================== INCIDENCIAS TAB ==================== */}
        <Tabs.Content value="incidencias" className="pt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleccionar Empleado</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedEmpleadoId}
                onValueChange={(val) => {
                  setSelectedEmpleadoId(val)
                  fetchIncidencias(val)
                }}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Selecciona un empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {empleados.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.codigo} - {emp.nombre} {emp.apellido}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedEmpleado ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Incidencias de{" "}
                    <span className="font-medium text-foreground">
                      {selectedEmpleado.nombre} {selectedEmpleado.apellido}
                    </span>
                  </p>
                </div>
                <Button onClick={openCreateIncidencia} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Nueva Incidencia
                </Button>
              </div>
              <DataTable<Incidencia>
                columns={incidenciaColumns}
                data={incidencias}
                loading={loading}
              />
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <AlertTriangle className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>Selecciona un empleado para ver sus incidencias</p>
              </CardContent>
            </Card>
          )}
        </Tabs.Content>
      </Tabs.Root>

      {/* ==================== EMPLEADO DIALOG ==================== */}
      <FormDialog
        open={empleadoDialogOpen}
        onOpenChange={(open) => {
          setEmpleadoDialogOpen(open)
          if (!open) setEditingEmpleado(null)
        }}
        title={editingEmpleado ? "Editar Empleado" : "Nuevo Empleado"}
        description={
          editingEmpleado
            ? `Editando a ${editingEmpleado.nombre} ${editingEmpleado.apellido}`
            : "Registra un nuevo empleado en el sistema"
        }
        onSubmit={empleadoForm.handleSubmit(onSubmitEmpleado as any)}
        loading={submitting}
        submitLabel={editingEmpleado ? "Actualizar" : "Crear Empleado"}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input id="nombre" {...empleadoForm.register("nombre")} placeholder="Nombre" />
            {empleadoForm.formState.errors.nombre && (
              <p className="text-xs text-destructive">{empleadoForm.formState.errors.nombre.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="apellido">Apellido *</Label>
            <Input id="apellido" {...empleadoForm.register("apellido")} placeholder="Apellido" />
            {empleadoForm.formState.errors.apellido && (
              <p className="text-xs text-destructive">{empleadoForm.formState.errors.apellido.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input id="email" type="email" {...empleadoForm.register("email")} placeholder="correo@ejemplo.com" />
          {empleadoForm.formState.errors.email && (
            <p className="text-xs text-destructive">{empleadoForm.formState.errors.email.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="telefono">Teléfono</Label>
            <Input id="telefono" {...empleadoForm.register("telefono")} placeholder="+52 555 123 4567" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salario">Salario *</Label>
            <Input id="salario" type="number" step="0.01" {...empleadoForm.register("salario")} placeholder="0.00" />
            {empleadoForm.formState.errors.salario && (
              <p className="text-xs text-destructive">{empleadoForm.formState.errors.salario.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="puesto">Puesto</Label>
            <Input id="puesto" {...empleadoForm.register("puesto")} placeholder="Puesto" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="departamento">Departamento</Label>
            <Input id="departamento" {...empleadoForm.register("departamento")} placeholder="Departamento" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fechaNacimiento">Fecha de Nacimiento</Label>
            <Input id="fechaNacimiento" type="date" {...empleadoForm.register("fechaNacimiento")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fechaContratacion">Fecha de Contratación</Label>
            <Input id="fechaContratacion" type="date" {...empleadoForm.register("fechaContratacion")} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="direccion">Dirección</Label>
          <Input id="direccion" {...empleadoForm.register("direccion")} placeholder="Dirección completa" />
        </div>
      </FormDialog>

      {/* ==================== CONTRATO DIALOG ==================== */}
      <FormDialog
        open={contratoDialogOpen}
        onOpenChange={(open) => {
          setContratoDialogOpen(open)
          if (!open) setEditingContrato(null)
        }}
        title={editingContrato ? "Editar Contrato" : "Nuevo Contrato"}
        description={
          editingContrato
            ? `Editando contrato ${editingContrato.tipo}`
            : "Registra un nuevo contrato para el empleado"
        }
        onSubmit={contratoForm.handleSubmit(onSubmitContrato as any)}
        loading={submitting}
        submitLabel={editingContrato ? "Actualizar" : "Crear Contrato"}
      >
        <input type="hidden" {...contratoForm.register("empleadoId")} />

        <div className="space-y-2">
          <Label htmlFor="contrato-tipo">Tipo de Contrato *</Label>
          <Select
            value={contratoForm.watch("tipo")}
            onValueChange={(val) => contratoForm.setValue("tipo", val as any, { shouldValidate: true })}
          >
            <SelectTrigger id="contrato-tipo">
              <SelectValue placeholder="Selecciona tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INDEFINIDO">Indefinido</SelectItem>
              <SelectItem value="TEMPORAL">Temporal</SelectItem>
              <SelectItem value="PRACTICAS">Prácticas</SelectItem>
              <SelectItem value="FREELANCE">Freelance</SelectItem>
              <SelectItem value="HONORARIOS">Honorarios</SelectItem>
            </SelectContent>
          </Select>
          {contratoForm.formState.errors.tipo && (
            <p className="text-xs text-destructive">{contratoForm.formState.errors.tipo.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contrato-fechaInicio">Fecha de Inicio *</Label>
            <Input id="contrato-fechaInicio" type="date" {...contratoForm.register("fechaInicio")} />
            {contratoForm.formState.errors.fechaInicio && (
              <p className="text-xs text-destructive">{contratoForm.formState.errors.fechaInicio.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contrato-fechaFin">Fecha de Fin</Label>
            <Input id="contrato-fechaFin" type="date" {...contratoForm.register("fechaFin")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contrato-salarioBase">Salario Base *</Label>
            <Input
              id="contrato-salarioBase"
              type="number"
              step="0.01"
              {...contratoForm.register("salarioBase")}
              placeholder="0.00"
            />
            {contratoForm.formState.errors.salarioBase && (
              <p className="text-xs text-destructive">{contratoForm.formState.errors.salarioBase.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contrato-jornada">Jornada</Label>
            <Input id="contrato-jornada" {...contratoForm.register("jornada")} placeholder="COMPLETA" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="contrato-puesto">Puesto *</Label>
            <Input id="contrato-puesto" {...contratoForm.register("puesto")} placeholder="Puesto" />
            {contratoForm.formState.errors.puesto && (
              <p className="text-xs text-destructive">{contratoForm.formState.errors.puesto.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="contrato-departamento">Departamento *</Label>
            <Input id="contrato-departamento" {...contratoForm.register("departamento")} placeholder="Departamento" />
            {contratoForm.formState.errors.departamento && (
              <p className="text-xs text-destructive">{contratoForm.formState.errors.departamento.message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="contrato-activo"
            type="checkbox"
            {...contratoForm.register("activo")}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="contrato-activo">Contrato activo</Label>
        </div>
      </FormDialog>

      {/* ==================== INCIDENCIA DIALOG ==================== */}
      <FormDialog
        open={incidenciaDialogOpen}
        onOpenChange={(open) => {
          setIncidenciaDialogOpen(open)
          if (!open) setEditingIncidencia(null)
        }}
        title={editingIncidencia ? "Editar Incidencia" : "Nueva Incidencia"}
        description="Registra una incidencia para el empleado"
        onSubmit={incidenciaForm.handleSubmit(onSubmitIncidencia as any)}
        loading={submitting}
        submitLabel={editingIncidencia ? "Actualizar" : "Crear Incidencia"}
      >
        <input type="hidden" {...incidenciaForm.register("empleadoId")} />

        <div className="space-y-2">
          <Label htmlFor="incidencia-tipo">Tipo *</Label>
          <Input id="incidencia-tipo" {...incidenciaForm.register("tipo")} placeholder="Ej: Permiso, Retardo, Falta, Incapacidad" />
          {incidenciaForm.formState.errors.tipo && (
            <p className="text-xs text-destructive">{incidenciaForm.formState.errors.tipo.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="incidencia-fecha">Fecha *</Label>
            <Input id="incidencia-fecha" type="date" {...incidenciaForm.register("fecha")} />
            {incidenciaForm.formState.errors.fecha && (
              <p className="text-xs text-destructive">{incidenciaForm.formState.errors.fecha.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="incidencia-fechaFin">Fecha Fin</Label>
            <Input id="incidencia-fechaFin" type="date" {...incidenciaForm.register("fechaFin")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="incidencia-horas">Horas</Label>
            <Input id="incidencia-horas" type="number" {...incidenciaForm.register("horas")} placeholder="0" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incidencia-minutos">Minutos</Label>
            <Input id="incidencia-minutos" type="number" {...incidenciaForm.register("minutos")} placeholder="0" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="incidencia-descripcion">Descripción</Label>
          <textarea
            id="incidencia-descripcion"
            {...incidenciaForm.register("descripcion")}
            className={`${inputClass} min-h-[80px] resize-y`}
            placeholder="Descripción de la incidencia..."
          />
        </div>
      </FormDialog>

      {/* ==================== DELETE CONFIRMATION ==================== */}
      <Dialog
        open={deleteConfirm !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null)
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              {deleteConfirm?.type === "empleado"
                ? `Se dará de baja al empleado ${deleteConfirm?.label}. Esta acción no se puede deshacer.`
                : `Se eliminará ${deleteConfirm?.type === "contrato" ? "el contrato" : "la incidencia"} de ${deleteConfirm?.label}. Esta acción no se puede deshacer.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteConfirm) return
                if (deleteConfirm.type === "empleado") handleDeleteEmpleado(deleteConfirm.id)
                else if (deleteConfirm.type === "contrato") handleDeleteContrato(deleteConfirm.id)
                else if (deleteConfirm.type === "incidencia") handleDeleteIncidencia(deleteConfirm.id)
              }}
            >
              Eliminar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
