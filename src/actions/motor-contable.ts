"use server"

import { prisma } from "@/lib/prisma"
import { getExportador } from "@/lib/exportadores/registro"
import type { DatosAsiento } from "@/lib/exportadores/types"

type EventoContable =
  | "FACTURA_PROVEEDOR"
  | "PAGO_PROVEEDOR"
  | "RECEPCION_OC"
  | "EGRESO"
  | "NOTA_DEBITO"
  | "NOTA_CREDITO"
  | "FACTURA_CLIENTE"

type BaseValues = {
  empresaId: string
  valorFactura: number
  iva: number
  valorTotal: number
  saldo: number
  fecha: Date
  concepto: string
  proveedorId?: string
  centroCostosId?: string
}

async function getBaseValues(evento: EventoContable, referenciaId: string): Promise<BaseValues> {
  switch (evento) {
    case "FACTURA_PROVEEDOR": {
      const cp = await prisma.cuentaPagar.findUnique({
        where: { id: referenciaId },
        include: { ordenCompra: { include: { proveedor: true } } },
      })
      if (!cp) throw new Error(`CuentaPagar ${referenciaId} no encontrada`)
      const valor = Number(cp.valor)
      const iva = Number(cp.ordenCompra.iva)
      return {
        empresaId: cp.empresaId,
        valorFactura: valor - iva,
        iva,
        valorTotal: valor,
        saldo: Number(cp.saldoPendiente),
        fecha: cp.fechaFactura ?? new Date(),
        concepto: `Factura ${cp.numeroFactura ?? ""} - ${cp.ordenCompra.proveedor.razonSocial}`,
        proveedorId: cp.ordenCompra.proveedorId,
        centroCostosId: cp.ordenCompra.centroCostosId ?? undefined,
      }
    }
    case "PAGO_PROVEEDOR": {
      const pago = await prisma.pago.findUnique({
        where: { id: referenciaId },
        include: { proveedor: true, cuentaPagar: { include: { ordenCompra: true } } },
      })
      if (!pago) throw new Error(`Pago ${referenciaId} no encontrado`)
      return {
        empresaId: pago.empresaId,
        valorFactura: Number(pago.valor),
        iva: 0,
        valorTotal: Number(pago.valor),
        saldo: 0,
        fecha: pago.fechaPago ?? new Date(),
        concepto: `Pago ${pago.proveedor.razonSocial}`,
        proveedorId: pago.proveedorId,
        centroCostosId: pago.cuentaPagar.ordenCompra.centroCostosId ?? undefined,
      }
    }
    case "RECEPCION_OC": {
      const recepcion = await prisma.recepcion.findUnique({
        where: { id: referenciaId },
        include: { ordenCompra: { include: { proveedor: true } } },
      })
      if (!recepcion) throw new Error(`Recepcion ${referenciaId} no encontrada`)
      const total = Number(recepcion.ordenCompra.valorTotal)
      const iva = Number(recepcion.ordenCompra.iva)
      return {
        empresaId: recepcion.empresaId,
        valorFactura: total - iva,
        iva,
        valorTotal: total,
        saldo: total,
        fecha: recepcion.fechaRecepcion,
        concepto: `Recepción OC #${recepcion.ordenCompra.numero} - ${recepcion.ordenCompra.proveedor.razonSocial}`,
        proveedorId: recepcion.ordenCompra.proveedorId,
        centroCostosId: recepcion.ordenCompra.centroCostosId ?? undefined,
      }
    }
    case "EGRESO": {
      const egreso = await prisma.egreso.findUnique({
        where: { id: referenciaId },
        include: {
          pago: {
            include: { proveedor: true, cuentaPagar: { include: { ordenCompra: true } } },
          },
          centroCostos: true,
        },
      })
      if (!egreso) throw new Error(`Egreso ${referenciaId} no encontrado`)
      return {
        empresaId: egreso.empresaId,
        valorFactura: Number(egreso.valor),
        iva: 0,
        valorTotal: Number(egreso.valor),
        saldo: 0,
        fecha: egreso.fecha,
        concepto: `Egreso #${egreso.numero} - ${egreso.beneficiario}`,
        centroCostosId: egreso.centroCostosId ?? undefined,
      }
    }
    case "NOTA_DEBITO": {
      const cpDebito = await prisma.cuentaPagar.findUnique({
        where: { id: referenciaId },
        include: { ordenCompra: { include: { proveedor: true } } },
      })
      if (!cpDebito) throw new Error(`CuentaPagar ${referenciaId} no encontrada para Nota Débito`)
      const valor = Number(cpDebito.valor)
      return {
        empresaId: cpDebito.empresaId,
        valorFactura: valor,
        iva: 0,
        valorTotal: valor,
        saldo: Number(cpDebito.saldoPendiente),
        fecha: cpDebito.fechaFactura ?? new Date(),
        concepto: `Nota Débito - ${cpDebito.numeroFactura ?? ""} ${cpDebito.ordenCompra.proveedor.razonSocial}`,
        proveedorId: cpDebito.ordenCompra.proveedorId,
        centroCostosId: cpDebito.ordenCompra.centroCostosId ?? undefined,
      }
    }
    case "NOTA_CREDITO": {
      const cpCredito = await prisma.cuentaPagar.findUnique({
        where: { id: referenciaId },
        include: { ordenCompra: { include: { proveedor: true } } },
      })
      if (!cpCredito) throw new Error(`CuentaPagar ${referenciaId} no encontrada para Nota Crédito`)
      const valor = Number(cpCredito.valor)
      return {
        empresaId: cpCredito.empresaId,
        valorFactura: valor,
        iva: 0,
        valorTotal: valor,
        saldo: Number(cpCredito.saldoPendiente),
        fecha: cpCredito.fechaFactura ?? new Date(),
        concepto: `Nota Crédito - ${cpCredito.numeroFactura ?? ""} ${cpCredito.ordenCompra.proveedor.razonSocial}`,
        proveedorId: cpCredito.ordenCompra.proveedorId,
        centroCostosId: cpCredito.ordenCompra.centroCostosId ?? undefined,
      }
    }
    case "FACTURA_CLIENTE": {
      const venta = await prisma.venta.findUnique({
        where: { id: referenciaId },
        include: { cliente: true },
      })
      if (!venta) throw new Error(`Venta ${referenciaId} no encontrada`)
      const total = Number(venta.total)
      const iva = Number(venta.impuesto)
      return {
        empresaId: venta.empresaId,
        valorFactura: total - iva,
        iva,
        valorTotal: total,
        saldo: Number(venta.total),
        fecha: venta.fecha,
        concepto: `Factura Cliente #${venta.numero} - ${venta.cliente.nombre}`,
        proveedorId: venta.clienteId,
      }
    }
    default:
      throw new Error(`Evento ${evento} no soportado`)
  }
}

type FormulaValue = {
  valorFactura: number
  iva: number
  valorTotal: number
  saldo: number
  porcentaje?: number
}

function evaluateFormula(formula: string, base: FormulaValue): number {
  switch (formula) {
    case "VALOR_FACTURA":
      return base.valorFactura
    case "IVA":
      return base.iva
    case "VALOR_TOTAL":
      return base.valorTotal
    case "SALDO":
      return base.saldo
    case "PORCENTAJE":
      if (!base.porcentaje) return 0
      return Math.round(base.valorFactura * (base.porcentaje / 100) * 100) / 100
    default:
      return 0
  }
}

async function getNextAsientoNumero(empresaId: string): Promise<number> {
  const last = await prisma.asientoContable.findFirst({
    where: { empresaId },
    orderBy: { numero: "desc" },
    select: { numero: true },
  })
  return (last?.numero ?? 0) + 1
}

export async function generarAsiento(evento: EventoContable, referenciaId: string) {
  try {
    const baseValues = await getBaseValues(evento, referenciaId)

    const empresa = await prisma.empresa.findUnique({
      where: { id: baseValues.empresaId },
      include: {
        plantillasContables: {
          where: { evento, activo: true },
          include: { lineas: true },
        },
      },
    })

    if (!empresa || empresa.plantillasContables.length === 0) {
      return { success: false, reason: `No hay plantilla activa para el evento ${evento}` }
    }

    const plantilla = empresa.plantillasContables[0]
    const tipoContabilidad = empresa.tipoContabilidad ?? "INTERNA"

    if (tipoContabilidad === "INTERNA") {
      const planCuentas = await prisma.planCuenta.findMany({
        where: { empresaId: empresa.id, codigo: { in: plantilla.lineas.map((l) => l.cuentaCodigo) } },
      })
      const cuentaMap = new Map(planCuentas.map((c) => [c.codigo, c.id]))

      const numero = await getNextAsientoNumero(empresa.id)
      const totalDebe = plantilla.lineas
        .filter((l) => l.tipo === "DEBE")
        .reduce((sum, l) => sum + evaluateFormula(l.formula, { ...baseValues, porcentaje: l.porcentaje ?? undefined }), 0)
      const totalHaber = plantilla.lineas
        .filter((l) => l.tipo === "HABER")
        .reduce((sum, l) => sum + evaluateFormula(l.formula, { ...baseValues, porcentaje: l.porcentaje ?? undefined }), 0)

      const asiento = await prisma.asientoContable.create({
        data: {
          empresaId: empresa.id,
          numero,
          fecha: baseValues.fecha,
          concepto: baseValues.concepto,
          tipo: "INGRESO",
          estado: "CONTABILIZADO",
          detalles: {
            create: plantilla.lineas.map((l) => {
              const valor = evaluateFormula(l.formula, { ...baseValues, porcentaje: l.porcentaje ?? undefined })
              const planCuentaId = cuentaMap.get(l.cuentaCodigo)
              if (!planCuentaId) throw new Error(`Cuenta contable ${l.cuentaCodigo} no encontrada`)
              return {
                planCuentaId,
                debe: l.tipo === "DEBE" ? valor : 0,
                haber: l.tipo === "HABER" ? valor : 0,
                descripcion: `${plantilla.concepto} - ${l.tipo}`,
              }
            }),
          },
        },
        include: {
          detalles: {
            include: {
              planCuenta: { select: { id: true, codigo: true, nombre: true } },
            },
          },
        },
      })

      return { success: true, tipo: "INTERNA", asientoId: asiento.id, totalDebe, totalHaber }
    }

    const exportador = getExportador(tipoContabilidad)
    if (!exportador) {
      return { success: false, tipo: tipoContabilidad, message: `Exportador ${tipoContabilidad} no disponible` }
    }

    const empresaNombre = empresa.nombre

    const planCuentas = await prisma.planCuenta.findMany({
      where: { empresaId: empresa.id, codigo: { in: plantilla.lineas.map((l) => l.cuentaCodigo) } },
    })
    const cuentaMap = new Map(planCuentas.map((c) => [c.codigo, { id: c.id, nombre: c.nombre }]))

    const numero = await getNextAsientoNumero(empresa.id)

    const lineas = plantilla.lineas.map((l) => {
      const valor = evaluateFormula(l.formula, { ...baseValues, porcentaje: l.porcentaje ?? undefined })
      const cuenta = cuentaMap.get(l.cuentaCodigo)
      return {
        cuentaCodigo: l.cuentaCodigo,
        cuentaNombre: cuenta?.nombre ?? l.cuentaCodigo,
        debe: l.tipo === "DEBE" ? valor : 0,
        haber: l.tipo === "HABER" ? valor : 0,
        centroCostosCodigo: l.centroCostosId ?? undefined,
        terceroId: baseValues.proveedorId,
        descripcion: `${plantilla.concepto} - ${l.tipo}`,
      }
    })

    const totalDebe = lineas.filter((l) => l.debe > 0).reduce((s, l) => s + l.debe, 0)
    const totalHaber = lineas.filter((l) => l.haber > 0).reduce((s, l) => s + l.haber, 0)

    const datosAsiento: DatosAsiento = {
      empresaId: empresa.id,
      empresaNombre,
      evento,
      fecha: baseValues.fecha,
      concepto: baseValues.concepto,
      numeroAsiento: numero,
      lineas,
      totalDebe,
      totalHaber,
    }

    const tipoConfig = await prisma.tipoContabilidad.findUnique({ where: { empresaId: empresa.id } })
    const config = (tipoConfig?.config ?? {}) as Record<string, unknown>

    const resultado = await exportador.exportar(datosAsiento, config)

    return {
      success: resultado.success,
      tipo: tipoContabilidad,
      formato: resultado.formato,
      destino: resultado.destino,
      data: resultado.data,
      error: resultado.error,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    return { success: false, reason: message, error: message }
  }
}
