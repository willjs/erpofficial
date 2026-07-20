"use client"

import { useState, useCallback } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileDown, FileSpreadsheet, Loader2 } from "lucide-react"
import * as XLSX from "xlsx"

type ReporteKey = "compras" | "tesoreria" | "nomina" | "contabilidad" | "clientes" | "inventario" | "pedidos" | "ventas" | "despachos" | "traspasos"

interface ReporteDef {
  key: ReporteKey
  label: string
  descripcion: string
  icon: React.ComponentType<{ className?: string }>
}

const reportes: ReporteDef[] = [
  { key: "compras", label: "Reporte de Compras", descripcion: "Requisiciones, órdenes de compra y gastos por período", icon: FileSpreadsheet },
  { key: "tesoreria", label: "Reporte de Tesorería", descripcion: "Flujo de caja, cuentas por pagar y pagos realizados", icon: FileSpreadsheet },
  { key: "nomina", label: "Reporte de Nómina", descripcion: "Totales de nómina, empleados y prestaciones", icon: FileSpreadsheet },
  { key: "contabilidad", label: "Reporte Contable", descripcion: "Balance general, estado de resultados y asientos", icon: FileSpreadsheet },
  { key: "clientes", label: "Reporte de Clientes", descripcion: "Clientes activos, contactos e interacciones", icon: FileSpreadsheet },
  { key: "inventario", label: "Reporte de Inventario", descripcion: "Stock, activos fijos y movimientos", icon: FileSpreadsheet },
  { key: "pedidos", label: "Reporte de Pedidos", descripcion: "Pedidos de clientes, estados y montos", icon: FileSpreadsheet },
  { key: "ventas", label: "Reporte de Ventas", descripcion: "Facturación, ventas por período y pagos", icon: FileSpreadsheet },
  { key: "despachos", label: "Reporte de Despachos", descripcion: "Envíos realizados y pendientes", icon: FileSpreadsheet },
  { key: "traspasos", label: "Reporte de Traspasos", descripcion: "Traspasos entre almacenes", icon: FileSpreadsheet },
]

export default function ReportesPage() {
  const { toast } = useToast()
  const [exporting, setExporting] = useState<ReporteKey | null>(null)

  const exportReport = useCallback(async (key: ReporteKey) => {
    setExporting(key)
    try {
      const { getDashboardData } = await import("@/actions/dashboard")
      const result = await getDashboardData()
      if (result.error || !result.data) {
        toast({ title: "Error al obtener datos", description: result.error ?? "Sin datos disponibles", variant: "destructive" })
        return
      }

      const d = result.data
      const wb = XLSX.utils.book_new()
      const dateStr = new Date().toISOString().slice(0, 10)

      switch (key) {
        case "compras": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Requisiciones Pendientes", Valor: d.compras.reqPendientes },
              { Indicador: "Órdenes de Compra Pendientes", Valor: d.compras.ocPendientes },
              { Indicador: "Compras del Mes", Valor: d.compras.comprasMes },
            ]), "Compras")
          break
        }
        case "tesoreria": {
          const { getReporteTesoreria } = await import("@/actions/reporte-tesoreria")
          const r = await getReporteTesoreria()

          // Sheet 1 — Resumen
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Saldo Total en Bancos", Valor: r.resumen.saldoTotal },
              { Indicador: "Cuentas por Pagar Pendientes", Valor: r.resumen.cuentasPagarPendientes },
              { Indicador: "Cuentas por Pagar Pagadas", Valor: r.resumen.cuentasPagarPagadas },
              { Indicador: "Total Pendiente por Pagar", Valor: r.resumen.totalPendiente },
              { Indicador: "Total Pagado", Valor: r.resumen.totalPagado },
              { Indicador: "Pagos Realizados este Mes", Valor: r.resumen.pagosDelMes },
              { Indicador: "Egresos este Mes", Valor: r.resumen.egresosDelMes },
              { Indicador: "Ingresos este Mes", Valor: r.resumen.ingresosDelMes },
            ]), "Resumen")

          // Sheet 2 — Flujo Mensual
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet(r.flujoMensual.map(f => ({
              Mes: f.mes,
              Ingresos: f.ingresos,
              Egresos: f.egastos,
              "Saldo del Período": f.saldo,
            }))), "Flujo Mensual")

          // Sheet 3 — Flujo Trimestral
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet(r.flujoTrimestral.map(f => ({
              Trimestre: f.trimestre,
              Ingresos: f.ingresos,
              Egresos: f.egastos,
              "Saldo del Período": f.saldo,
            }))), "Flujo Trimestral")

          // Sheet 4 — Flujo Anual
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet(r.flujoAnual.map(f => ({
              Año: f.anio,
              Ingresos: f.ingresos,
              Egresos: f.egastos,
              "Saldo del Período": f.saldo,
            }))), "Flujo Anual")

          // Sheet 5 — Cuentas por Pagar
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet(r.cuentasPagar.map(c => ({
              Proveedor: c.proveedor,
              "OC #": c.oc,
              Factura: c.factura ?? "—",
              Valor: c.valor,
              "Saldo Pend.": c.saldoPendiente,
              Estado: c.estado,
              "Vencimiento": c.fechaVencimiento ?? "—",
            }))), "Cuentas por Pagar")

          // Sheet 6 — Egresos
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet(r.egresos.map(e => ({
              "#": e.numero,
              Fecha: e.fecha,
              Beneficiario: e.beneficiario,
              "Cuenta Bancaria": e.cuenta ?? "—",
              Valor: e.valor,
              Factura: e.factura ?? "—",
            }))), "Egresos")

          // Sheet 7 — Movimientos Bancarios
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet(r.movimientos.map(m => ({
              Fecha: m.fecha,
              Tipo: m.tipo,
              Monto: m.monto,
              Descripción: m.descripcion ?? "—",
              Cuenta: m.cuenta,
              Estado: m.estado,
            }))), "Movimientos")
          break
        }
        case "nomina": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Total Nómina del Mes", Valor: d.nomina.totalPagar },
              { Indicador: "Nóminas Generadas", Valor: d.nomina.nominasCount },
              { Indicador: "Empleados Activos", Valor: d.nomina.empleadosActivos },
            ]), "Nómina")
          break
        }
        case "contabilidad": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Asientos Pendientes", Valor: d.contabilidad.asientosPendientes },
              { Indicador: "Resultado del Mes", Valor: d.contabilidad.resultadoMes },
            ]), "Contabilidad")
          break
        }
        case "clientes": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Clientes Activos", Valor: d.clientes.activos },
              { Indicador: "Interacciones esta Semana", Valor: d.clientes.interaccionesSemana },
            ]), "Clientes")
          break
        }
        case "inventario": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Productos con Stock Bajo", Valor: d.inventario.stockBajo },
              { Indicador: "Activos Fijos Asignados", Valor: d.inventario.activosAsignados },
            ]), "Inventario")
          break
        }
        case "pedidos": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Pedidos Pendientes", Valor: d.pedidos.pendientes },
              { Indicador: "Total Pedidos del Mes", Valor: d.pedidos.totalMes },
            ]), "Pedidos")
          break
        }
        case "ventas": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Ventas Pendientes", Valor: d.ventas.pendientes },
              { Indicador: "Total Ventas del Mes", Valor: d.ventas.totalMes },
            ]), "Ventas")
          break
        }
        case "despachos": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Despachos Pendientes", Valor: d.despachos.pendientes },
              { Indicador: "Despachos del Mes", Valor: d.despachos.totalMes },
            ]), "Despachos")
          break
        }
        case "traspasos": {
          XLSX.utils.book_append_sheet(wb,
            XLSX.utils.json_to_sheet([
              { Indicador: "Traspasos Pendientes", Valor: d.traspasos.pendientes },
              { Indicador: "Traspasos Completados del Mes", Valor: d.traspasos.completadoMes },
            ]), "Traspasos")
          break
        }
      }

      XLSX.writeFile(wb, `${key}_${dateStr}.xlsx`)
      toast({ title: "Reporte exportado", description: `Reporte de ${key} generado exitosamente`, variant: "success" })
    } catch (err) {
      toast({
        title: "Error al exportar reporte",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setExporting(null)
    }
  }, [toast])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reportes</h1>
        <p className="text-muted-foreground">Exporte reportes ejecutivos en formato Excel</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reportes.map((r) => {
          const Icon = r.icon
          const isExporting = exporting === r.key
          return (
            <Card key={r.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-5 w-5 text-primary" />
                  {r.label}
                </CardTitle>
                <CardDescription>{r.descripcion}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => exportReport(r.key)}
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  {isExporting ? "Exportando..." : "Exportar Excel"}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
