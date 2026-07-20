"use server"

import { prisma } from "@/lib/prisma"
import { verifySession } from "@/lib/dal"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { verificarPermiso } from "@/lib/permisos"
import { AutomationService } from "@/lib/automation-service"

function serializar<T>(obj: T): T {
  if (obj == null || typeof obj !== "object") return obj
  if (obj instanceof Date) return obj.toISOString() as any
  if (typeof (obj as any).toNumber === "function") return Number(obj as any) as T
  if (Array.isArray(obj)) return obj.map(serializar) as T
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializar(value)
  }
  return result as T
}

// ─── Almacenes ─────────────────────────────────────

const almacenSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  direccion: z.string().optional(),
})

export type AlmacenFormData = z.infer<typeof almacenSchema>

export async function getAlmacenes() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "almacen", accion: "READ" })
  return prisma.almacen.findMany({
    where: { empresaId },
    include: { _count: { select: { stocks: true } } },
    orderBy: { codigo: "asc" },
  })
}

export async function createAlmacen(data: AlmacenFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "almacen", accion: "CREATE" })
  const validated = almacenSchema.parse(data)
  const existing = await prisma.almacen.findFirst({ where: { empresaId, codigo: validated.codigo } })
  if (existing) throw new Error("Ya existe un almacén con ese código")
  const result = await prisma.almacen.create({
    data: { empresaId, ...validated },
  })
  revalidatePath("/inventarios")
  return result
}

export async function updateAlmacen(id: string, data: AlmacenFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "almacen", accion: "UPDATE" })
  const validated = almacenSchema.parse(data)
  const existing = await prisma.almacen.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Almacén no encontrado")
  const dup = await prisma.almacen.findFirst({ where: { empresaId, codigo: validated.codigo, id: { not: id } } })
  if (dup) throw new Error("Ya existe otro almacén con ese código")
  const result = await prisma.almacen.update({ where: { id }, data: validated })
  revalidatePath("/inventarios")
  return result
}

export async function toggleAlmacen(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "almacen", accion: "UPDATE" })
  const existing = await prisma.almacen.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Almacén no encontrado")
  const result = await prisma.almacen.update({
    where: { id },
    data: { activo: !existing.activo },
  })
  revalidatePath("/inventarios")
  return result
}

// ─── Productos ─────────────────────────────────────

const productoSchema = z.object({
  codigo: z.string().min(1, "Código requerido"),
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().optional(),
  categoria: z.string().optional(),
  unidadMedida: z.string().default("UNIDAD"),
  precioUnitario: z.coerce.number().optional().nullable(),
})

export type ProductoFormData = z.infer<typeof productoSchema>

export async function getProductos() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "READ" })
  const data = await prisma.producto.findMany({
    where: { empresaId },
    include: {
      stocks: {
        include: { almacen: { select: { id: true, nombre: true } } },
      },
    },
    orderBy: { codigo: "asc" },
  })
  return serializar(data)
}

export async function createProducto(data: ProductoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "CREATE" })
  const validated = productoSchema.parse(data)
  const dup = await prisma.producto.findFirst({ where: { empresaId, codigo: validated.codigo } })
  if (dup) throw new Error("Ya existe un producto con ese código")
  const result = await prisma.producto.create({
    data: {
      empresaId,
      ...validated,
      precioUnitario: validated.precioUnitario ?? undefined,
    },
    include: {
      stocks: {
        include: { almacen: { select: { id: true, nombre: true } } },
      },
    },
  })

  AutomationService.ejecutarEvento({
    empresaId,
    codigoEvento: "PRODUCTO_CREADO",
    entidadTipo: "PRODUCTO",
    entidadId: result.id,
    usuarioId: userId,
  }).catch(() => {})

  revalidatePath("/inventarios")
  return result
}

export async function updateProducto(id: string, data: ProductoFormData) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "UPDATE" })
  const validated = productoSchema.parse(data)
  const existing = await prisma.producto.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Producto no encontrado")
  const dup = await prisma.producto.findFirst({ where: { empresaId, codigo: validated.codigo, id: { not: id } } })
  if (dup) throw new Error("Ya existe otro producto con ese código")
  const result = await prisma.producto.update({
    where: { id },
    data: {
      ...validated,
      precioUnitario: validated.precioUnitario ?? undefined,
    },
    include: {
      stocks: {
        include: { almacen: { select: { id: true, nombre: true } } },
      },
    },
  })
  revalidatePath("/inventarios")
  return result
}

export async function deleteProducto(id: string) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "DELETE" })
  const existing = await prisma.producto.findFirst({ where: { id, empresaId } })
  if (!existing) throw new Error("Producto no encontrado")
  await prisma.producto.delete({ where: { id } })
  revalidatePath("/inventarios")
}

// ─── Stock ──────────────────────────────────────────

export async function getStock() {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "inventario_stock", accion: "READ" })
  const data = await prisma.inventarioStock.findMany({
    where: { empresaId },
    include: {
      producto: { select: { id: true, codigo: true, nombre: true, unidadMedida: true } },
      almacen: { select: { id: true, codigo: true, nombre: true } },
    },
    orderBy: [
      { almacen: { codigo: "asc" } },
      { producto: { codigo: "asc" } },
    ],
  })
  return serializar(data)
}

export async function ajustarStock(data: {
  productoId: string
  almacenId: string
  cantidad: number
  observaciones?: string
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "inventario_stock", accion: "UPDATE" })
  const { productoId, almacenId, cantidad, observaciones } = data

  return prisma.$transaction(async (tx: any) => {
    const stock = await tx.inventarioStock.upsert({
      where: {
        productoId_almacenId: { productoId, almacenId },
      },
      update: { cantidad: { increment: cantidad } },
      create: {
        empresaId,
        productoId,
        almacenId,
        cantidad,
      },
    })

    await tx.movimientoInventario.create({
      data: {
        empresaId,
        productoId,
        almacenDestinoId: almacenId,
        tipo: cantidad >= 0 ? "ENTRADA" : "SALIDA",
        cantidad: Math.abs(cantidad),
        observaciones: observaciones ?? "Ajuste manual",
      },
    })

    return stock
  })
}

// ─── Import Excel ─────────────────────────────────

export type ProductoImportRow = {
  codigo: string
  nombre: string
  categoria?: string
  unidadMedida: string
  precioUnitario?: number | null
  descripcion?: string
  stockInicial?: number
  stockMinimo?: number
  almacenCodigo?: string
}

export async function importProductosExcel(data: ProductoImportRow[], modo: "crear" | "actualizar" = "actualizar") {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "producto", accion: "CREATE" })

  const result = { creados: 0, actualizados: 0, errores: 0, total: data.length, detalles: [] as string[] }

  let almacenes = await prisma.almacen.findMany({ where: { empresaId } })

  // Auto-create default warehouse if none exist and any row needs stock
  if (almacenes.length === 0 && data.some((r) => r.stockInicial && r.stockInicial > 0)) {
    const defaultAlmacen = await prisma.almacen.create({
      data: { empresaId, codigo: "PPL", nombre: "Principal", activo: true },
    })
    almacenes = [defaultAlmacen]
    result.detalles.push("Almacén 'Principal' (PPL) creado automáticamente")
  }

  for (const row of data) {
    try {
      if (!row.codigo || !row.nombre) {
        result.errores++
        result.detalles.push(`Fila sin código o nombre: ${JSON.stringify(row)}`)
        continue
      }

      const existente = await prisma.producto.findFirst({ where: { empresaId, codigo: row.codigo } })

      if (existente) {
        if (modo === "crear") {
          result.errores++
          result.detalles.push(`Código ${row.codigo} ya existe, omitido (modo solo crear)`)
          continue
        }

        // Update existing product
        await prisma.producto.update({
          where: { id: existente.id },
          data: {
            nombre: row.nombre,
            descripcion: row.descripcion ?? null,
            categoria: row.categoria ?? null,
            unidadMedida: row.unidadMedida || "UNIDAD",
            precioUnitario: row.precioUnitario !== undefined ? row.precioUnitario : undefined,
          },
        })

        // Upsert stock if stockInicial is provided (set absolute value, not increment)
        if (row.stockInicial !== undefined && row.stockInicial !== null) {
        const almacen = (() => {
          if (!row.almacenCodigo) return almacenes[0]
          const cod = row.almacenCodigo
          return almacenes.find((a) => a.codigo === cod)
            ?? almacenes.find((a) => a.nombre.toLowerCase() === cod.toLowerCase())
        })()

        if (almacen) {
          const currentStock = await prisma.inventarioStock.findUnique({
              where: {
                productoId_almacenId: { productoId: existente.id, almacenId: almacen.id },
              },
            })

            const currentCant = currentStock ? Number(currentStock.cantidad) : 0
            const diff = row.stockInicial - currentCant

            if (diff !== 0) {
              await prisma.inventarioStock.upsert({
                where: { productoId_almacenId: { productoId: existente.id, almacenId: almacen.id } },
                update: {
                  cantidad: { increment: diff },
                  cantidadMinima: row.stockMinimo ?? undefined,
                },
                create: {
                  empresaId,
                  productoId: existente.id,
                  almacenId: almacen.id,
                  cantidad: row.stockInicial,
                  cantidadMinima: row.stockMinimo ?? 0,
                },
              })

              await prisma.movimientoInventario.create({
                data: {
                  empresaId,
                  productoId: existente.id,
                  almacenDestinoId: diff > 0 ? almacen.id : undefined,
                  almacenOrigenId: diff < 0 ? almacen.id : undefined,
                  tipo: diff > 0 ? "ENTRADA" : "SALIDA",
                  cantidad: Math.abs(diff),
                  referencia: "Importación masiva",
                  observaciones: `Ajuste desde Excel (${row.stockInicial} - ${currentCant} actual = ${diff > 0 ? "+" : ""}${diff})`,
                },
              })
            }
          }
        }

        result.actualizados++
        result.detalles.push(`Código ${row.codigo} actualizado`)
      } else {
        // Create new product
        const producto = await prisma.producto.create({
          data: {
            empresaId,
            codigo: row.codigo,
            nombre: row.nombre,
            descripcion: row.descripcion ?? null,
            categoria: row.categoria ?? null,
            unidadMedida: row.unidadMedida || "UNIDAD",
            precioUnitario: row.precioUnitario ?? undefined,
          },
        })

        // Create initial stock and movement if stockInicial > 0
        if (row.stockInicial && row.stockInicial > 0) {
          const almacen = (() => {
            if (!row.almacenCodigo) return almacenes[0]
            const cod = row.almacenCodigo
            return almacenes.find((a) => a.codigo === cod)
              ?? almacenes.find((a) => a.nombre.toLowerCase() === cod.toLowerCase())
          })()

          if (almacen) {
            await prisma.inventarioStock.upsert({
              where: { productoId_almacenId: { productoId: producto.id, almacenId: almacen.id } },
              update: { cantidad: { increment: row.stockInicial } },
              create: {
                empresaId,
                productoId: producto.id,
                almacenId: almacen.id,
                cantidad: row.stockInicial,
                cantidadMinima: row.stockMinimo ?? 0,
              },
            })

            await prisma.movimientoInventario.create({
              data: {
                empresaId,
                productoId: producto.id,
                almacenDestinoId: almacen.id,
                tipo: "ENTRADA",
                cantidad: row.stockInicial,
                referencia: "Importación masiva",
                observaciones: `Importado desde Excel (stock inicial)`,
              },
            })
          }
        }

        result.creados++
      }
    } catch {
      result.errores++
      result.detalles.push(`Error al procesar ${row.codigo || row.nombre}`)
    }
  }

  revalidatePath("/inventarios")
  return result
}

// ─── Movimientos ────────────────────────────────────

export async function getMovimientosInventario(limit = 50) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_inventario", accion: "READ" })
  const data = await prisma.movimientoInventario.findMany({
    where: { empresaId },
    include: {
      producto: { select: { id: true, codigo: true, nombre: true } },
      almacenOrigen: { select: { id: true, nombre: true } },
      almacenDestino: { select: { id: true, nombre: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  })
  return serializar(data)
}

export async function ingresarStock(data: {
  productoId: string
  almacenId: string
  cantidad: number
  valorUnitario?: number
  referencia?: string
  observaciones?: string
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_inventario", accion: "CREATE" })

  return prisma.$transaction(async (tx: any) => {
    await tx.inventarioStock.upsert({
      where: {
        productoId_almacenId: { productoId: data.productoId, almacenId: data.almacenId },
      },
      update: { cantidad: { increment: data.cantidad } },
      create: {
        empresaId,
        productoId: data.productoId,
        almacenId: data.almacenId,
        cantidad: data.cantidad,
      },
    })

    return tx.movimientoInventario.create({
      data: {
        empresaId,
        productoId: data.productoId,
        almacenDestinoId: data.almacenId,
        tipo: "ENTRADA",
        cantidad: data.cantidad,
        valorUnitario: data.valorUnitario ?? undefined,
        referencia: data.referencia,
        observaciones: data.observaciones,
      },
    })
  })
}

export async function retirarStock(data: {
  productoId: string
  almacenId: string
  cantidad: number
  referencia?: string
  observaciones?: string
}) {
  const { empresaId, userId } = await verifySession()
  await verificarPermiso(userId, { recurso: "movimiento_inventario", accion: "CREATE" })

  return prisma.$transaction(async (tx: any) => {
    const stock = await tx.inventarioStock.findUnique({
      where: {
        productoId_almacenId: { productoId: data.productoId, almacenId: data.almacenId },
      },
    })

    if (!stock || Number(stock.cantidad) < data.cantidad) {
      throw new Error("Stock insuficiente")
    }

    await tx.inventarioStock.update({
      where: {
        productoId_almacenId: { productoId: data.productoId, almacenId: data.almacenId },
      },
      data: { cantidad: { decrement: data.cantidad } },
    })

    return tx.movimientoInventario.create({
      data: {
        empresaId,
        productoId: data.productoId,
        almacenOrigenId: data.almacenId,
        tipo: "SALIDA",
        cantidad: data.cantidad,
        referencia: data.referencia,
        observaciones: data.observaciones,
      },
    })
  })
}
