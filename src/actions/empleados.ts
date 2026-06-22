"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { verificarPermiso } from "@/lib/permisos"
import { revalidatePath } from "next/cache"
import { z } from "zod"

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data))
}

const empleadoBaseSchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido"),
  apellido: z.string().min(1, "El apellido es requerido"),
  email: z.string().email("Email inválido"),
  telefono: z.string().optional().default(""),
  direccion: z.string().optional().default(""),
  fechaNacimiento: z.string().optional().default(""),
  fechaContratacion: z.string().optional().default(""),
  salario: z.coerce.number().min(0, "El salario no puede ser negativo"),
  puesto: z.string().optional().default(""),
  departamento: z.string().optional().default(""),
})

const createEmpleadoSchema = empleadoBaseSchema
const updateEmpleadoSchema = empleadoBaseSchema.partial().extend({
  estado: z.enum(["ACTIVO", "INACTIVO", "SUSPENDIDO", "BAJA"]).optional(),
})

const contratoSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  tipo: z.enum(["INDEFINIDO", "TEMPORAL", "PRACTICAS", "FREELANCE", "HONORARIOS"]),
  fechaInicio: z.string().min(1, "Fecha de inicio requerida"),
  fechaFin: z.string().optional().default(""),
  salarioBase: z.coerce.number().min(0, "El salario base no puede ser negativo"),
  puesto: z.string().min(1, "El puesto es requerido"),
  departamento: z.string().min(1, "El departamento es requerido"),
  jornada: z.string().optional().default("COMPLETA"),
  activo: z.boolean().optional().default(true),
})

const updateContratoSchema = contratoSchema.partial()

const incidenciaSchema = z.object({
  empleadoId: z.string().min(1, "Empleado requerido"),
  tipo: z.string().min(1, "El tipo es requerido"),
  fecha: z.string().min(1, "La fecha es requerida"),
  fechaFin: z.string().optional().default(""),
  descripcion: z.string().optional().default(""),
  horas: z.coerce.number().int().optional(),
  minutos: z.coerce.number().int().optional(),
})

const updateIncidenciaSchema = incidenciaSchema.partial()

export type CreateEmpleadoInput = z.infer<typeof createEmpleadoSchema>
export type UpdateEmpleadoInput = z.infer<typeof updateEmpleadoSchema>
export type CreateContratoInput = z.infer<typeof contratoSchema>
export type UpdateContratoInput = z.infer<typeof updateContratoSchema>
export type CreateIncidenciaInput = z.infer<typeof incidenciaSchema>
export type UpdateIncidenciaInput = z.infer<typeof updateIncidenciaSchema>

function generateCodigo(): string {
  const random = Math.floor(10000 + Math.random() * 90000)
  return `EMP-${random}`
}

// ==================== EMPLEADOS ====================

export async function getEmpleados() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "READ" })
  const data = await prisma.empleado.findMany({
    where: { empresaId },
    orderBy: { createdAt: "desc" },
  })
  return serialize(data)
}

export async function getEmpleado(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "READ" })
  const data = await prisma.empleado.findFirst({
    where: { id, empresaId },
  })
  return serialize(data)
}

export async function createEmpleado(input: CreateEmpleadoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "CREATE" })

  const validated = createEmpleadoSchema.parse(input)

  const existing = await prisma.empleado.findUnique({
    where: { email: validated.email },
  })
  if (existing) throw new Error("Ya existe un empleado con ese email")

  let codigo = generateCodigo()
  while (await prisma.empleado.findUnique({ where: { codigo } })) {
    codigo = generateCodigo()
  }

  const data = await prisma.empleado.create({
    data: {
      empresaId,
      codigo,
      creadoPorId: userId,
      nombre: validated.nombre,
      apellido: validated.apellido,
      email: validated.email,
      telefono: validated.telefono || null,
      direccion: validated.direccion || null,
      fechaNacimiento: validated.fechaNacimiento ? new Date(validated.fechaNacimiento) : null,
      fechaContratacion: validated.fechaContratacion
        ? new Date(validated.fechaContratacion)
        : new Date(),
      salario: validated.salario,
      puesto: validated.puesto || null,
      departamento: validated.departamento || null,
    },
  })

  revalidatePath("/empleados")
  return serialize(data)
}

export async function updateEmpleado(id: string, input: UpdateEmpleadoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "UPDATE" })

  const empleado = await prisma.empleado.findFirst({ where: { id, empresaId } })
  if (!empleado) throw new Error("Empleado no encontrado")

  const validated = updateEmpleadoSchema.parse(input)

  if (validated.email && validated.email !== empleado.email) {
    const existing = await prisma.empleado.findUnique({
      where: { email: validated.email },
    })
    if (existing) throw new Error("Ya existe un empleado con ese email")
  }

  const data = await prisma.empleado.update({
    where: { id },
    data: {
      ...(validated.nombre !== undefined && { nombre: validated.nombre }),
      ...(validated.apellido !== undefined && { apellido: validated.apellido }),
      ...(validated.email !== undefined && { email: validated.email }),
      ...(validated.telefono !== undefined && { telefono: validated.telefono || null }),
      ...(validated.direccion !== undefined && { direccion: validated.direccion || null }),
      ...(validated.fechaNacimiento !== undefined && {
        fechaNacimiento: validated.fechaNacimiento ? new Date(validated.fechaNacimiento) : null,
      }),
      ...(validated.fechaContratacion !== undefined && {
        fechaContratacion: validated.fechaContratacion
          ? new Date(validated.fechaContratacion)
          : undefined,
      }),
      ...(validated.salario !== undefined && { salario: validated.salario }),
      ...(validated.puesto !== undefined && { puesto: validated.puesto || null }),
      ...(validated.departamento !== undefined && { departamento: validated.departamento || null }),
      ...(validated.estado !== undefined && { estado: validated.estado }),
    },
  })

  revalidatePath("/empleados")
  return serialize(data)
}

export async function deleteEmpleado(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "empleado", accion: "UPDATE" })

  const empleado = await prisma.empleado.findFirst({ where: { id, empresaId } })
  if (!empleado) throw new Error("Empleado no encontrado")

  await prisma.empleado.update({
    where: { id },
    data: { estado: "BAJA", fechaBaja: new Date() },
  })

  revalidatePath("/empleados")
}

// ==================== CONTRATOS ====================

async function verifyEmpleadoEmpresa(empleadoId: string, empresaId: string) {
  const empleado = await prisma.empleado.findFirst({
    where: { id: empleadoId, empresaId },
  })
  if (!empleado) throw new Error("Empleado no encontrado")
  return empleado
}

export async function getContratos(empleadoId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contrato", accion: "READ" })
  await verifyEmpleadoEmpresa(empleadoId, empresaId)

  const data = await prisma.contrato.findMany({
    where: { empleadoId },
    orderBy: { createdAt: "desc" },
  })
  return serialize(data)
}

export async function createContrato(input: CreateContratoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contrato", accion: "CREATE" })
  const validated = contratoSchema.parse(input)
  await verifyEmpleadoEmpresa(validated.empleadoId, empresaId)

  if (validated.activo) {
    await prisma.contrato.updateMany({
      where: { empleadoId: validated.empleadoId, activo: true },
      data: { activo: false },
    })
  }

  const data = await prisma.contrato.create({
    data: {
      empleadoId: validated.empleadoId,
      tipo: validated.tipo,
      fechaInicio: new Date(validated.fechaInicio),
      fechaFin: validated.fechaFin ? new Date(validated.fechaFin) : null,
      salarioBase: validated.salarioBase,
      puesto: validated.puesto,
      departamento: validated.departamento,
      jornada: validated.jornada,
      activo: validated.activo ?? true,
    },
  })

  revalidatePath("/empleados")
  return serialize(data)
}

export async function updateContrato(id: string, input: UpdateContratoInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contrato", accion: "UPDATE" })

  const contrato = await prisma.contrato.findUnique({ where: { id } })
  if (!contrato) throw new Error("Contrato no encontrado")
  await verifyEmpleadoEmpresa(contrato.empleadoId, empresaId)

  const validated = updateContratoSchema.parse(input)

  if (validated.activo === true) {
    await prisma.contrato.updateMany({
      where: { empleadoId: contrato.empleadoId, activo: true, id: { not: id } },
      data: { activo: false },
    })
  }

  const data = await prisma.contrato.update({
    where: { id },
    data: {
      ...(validated.tipo !== undefined && { tipo: validated.tipo }),
      ...(validated.fechaInicio !== undefined && { fechaInicio: new Date(validated.fechaInicio) }),
      ...(validated.fechaFin !== undefined && {
        fechaFin: validated.fechaFin ? new Date(validated.fechaFin) : null,
      }),
      ...(validated.salarioBase !== undefined && { salarioBase: validated.salarioBase }),
      ...(validated.puesto !== undefined && { puesto: validated.puesto }),
      ...(validated.departamento !== undefined && { departamento: validated.departamento }),
      ...(validated.jornada !== undefined && { jornada: validated.jornada }),
      ...(validated.activo !== undefined && { activo: validated.activo }),
    },
  })

  revalidatePath("/empleados")
  return serialize(data)
}

export async function deleteContrato(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "contrato", accion: "DELETE" })
  const contrato = await prisma.contrato.findUnique({ where: { id } })
  if (!contrato) throw new Error("Contrato no encontrado")
  await verifyEmpleadoEmpresa(contrato.empleadoId, empresaId)

  await prisma.contrato.delete({ where: { id } })
  revalidatePath("/empleados")
}

// ==================== INCIDENCIAS ====================

export async function getIncidencias(empleadoId: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "incidencia", accion: "READ" })
  await verifyEmpleadoEmpresa(empleadoId, empresaId)

  const data = await prisma.incidencia.findMany({
    where: { empleadoId },
    orderBy: { createdAt: "desc" },
  })
  return serialize(data)
}

export async function createIncidencia(input: CreateIncidenciaInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "incidencia", accion: "CREATE" })
  const validated = incidenciaSchema.parse(input)
  await verifyEmpleadoEmpresa(validated.empleadoId, empresaId)

  const data = await prisma.incidencia.create({
    data: {
      empleadoId: validated.empleadoId,
      tipo: validated.tipo,
      fecha: new Date(validated.fecha),
      fechaFin: validated.fechaFin ? new Date(validated.fechaFin) : null,
      descripcion: validated.descripcion || null,
      horas: validated.horas ?? null,
      minutos: validated.minutos ?? null,
    },
  })

  revalidatePath("/empleados")
  return serialize(data)
}

export async function updateIncidencia(id: string, input: UpdateIncidenciaInput) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "incidencia", accion: "UPDATE" })

  const incidencia = await prisma.incidencia.findUnique({ where: { id } })
  if (!incidencia) throw new Error("Incidencia no encontrada")
  await verifyEmpleadoEmpresa(incidencia.empleadoId, empresaId)

  const validated = updateIncidenciaSchema.parse(input)

  const data = await prisma.incidencia.update({
    where: { id },
    data: {
      ...(validated.tipo !== undefined && { tipo: validated.tipo }),
      ...(validated.fecha !== undefined && { fecha: new Date(validated.fecha) }),
      ...(validated.fechaFin !== undefined && {
        fechaFin: validated.fechaFin ? new Date(validated.fechaFin) : null,
      }),
      ...(validated.descripcion !== undefined && { descripcion: validated.descripcion || null }),
      ...(validated.horas !== undefined && { horas: validated.horas }),
      ...(validated.minutos !== undefined && { minutos: validated.minutos }),
    },
  })

  revalidatePath("/empleados")
  return serialize(data)
}

export async function deleteIncidencia(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "incidencia", accion: "DELETE" })
  const incidencia = await prisma.incidencia.findUnique({ where: { id } })
  if (!incidencia) throw new Error("Incidencia no encontrada")
  await verifyEmpleadoEmpresa(incidencia.empleadoId, empresaId)

  await prisma.incidencia.delete({ where: { id } })
  revalidatePath("/empleados")
}
