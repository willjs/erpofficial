"use client"

import { useState, useEffect, useCallback } from "react"
import { getDashboardData, type DashboardData } from "@/actions/dashboard"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ShoppingCart, DollarSign, Wallet, BookOpen, Package, CheckSquare,
  Users, BarChart3, Landmark, Building2, Archive, ClipboardList, FileDown,
} from "lucide-react"
import { formatMoney } from "@/lib/utils"
import * as XLSX from "xlsx"

function CardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-20 animate-pulse rounded bg-muted" />
        <div className="mt-1 h-3 w-28 animate-pulse rounded bg-muted" />
      </CardContent>
    </Card>
  )
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  loading,
}: {
  title: string
  value: string
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  loading?: boolean
}) {
  if (loading) return <CardSkeleton />
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

function ResultadoCard({ resultado, loading }: { resultado: number; loading?: boolean }) {
  if (loading) return <CardSkeleton />
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Resultado del Mes</CardTitle>
        <Landmark className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${resultado >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatMoney(resultado)}
        </div>
        <p className="text-xs text-muted-foreground">Ingresos - Gastos</p>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { toast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getDashboardData()
      if (result.error) {
        setError(result.error)
        toast({ title: "Error al cargar dashboard", description: result.error, variant: "destructive" })
      } else if (result.data) {
        setData(result.data)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido"
      setError(msg)
      toast({ title: "Error al cargar dashboard", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { loadData() }, [loadData])

  function exportToExcel() {
    if (!data) return
    try {
      const wb = XLSX.utils.book_new()

      const comprasSheet = XLSX.utils.json_to_sheet([
        { Indicador: "Requisiciones Pendientes", Valor: data.compras.reqPendientes },
        { Indicador: "OC Pendientes", Valor: data.compras.ocPendientes },
        { Indicador: "Compras del Mes", Valor: data.compras.comprasMes },
      ])
      XLSX.utils.book_append_sheet(wb, comprasSheet, "Compras")

      const tesoreriaSheet = XLSX.utils.json_to_sheet([
        { Indicador: "Pagos Pendientes", Valor: data.tesoreria.pagosPendientes },
        { Indicador: "Saldo Pendiente", Valor: data.tesoreria.saldoPendiente },
        { Indicador: "Flujo de Caja", Valor: data.tesoreria.flujoCaja },
        { Indicador: "Cuentas por Pagar", Valor: data.tesoreria.cuentasPagarCount },
      ])
      XLSX.utils.book_append_sheet(wb, tesoreriaSheet, "Tesorería")

      const nominaSheet = XLSX.utils.json_to_sheet([
        { Indicador: "Total Nómina del Mes", Valor: data.nomina.totalPagar },
        { Indicador: "Nóminas Generadas", Valor: data.nomina.nominasCount },
        { Indicador: "Empleados Activos", Valor: data.nomina.empleadosActivos },
      ])
      XLSX.utils.book_append_sheet(wb, nominaSheet, "Nómina")

      const contabilidadSheet = XLSX.utils.json_to_sheet([
        { Indicador: "Asientos Pendientes", Valor: data.contabilidad.asientosPendientes },
        { Indicador: "Resultado del Mes", Valor: data.contabilidad.resultadoMes },
      ])
      XLSX.utils.book_append_sheet(wb, contabilidadSheet, "Contabilidad")

      XLSX.writeFile(wb, `Dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`)
      toast({ title: "Exportación exitosa", description: "Dashboard exportado a Excel", variant: "success" })
    } catch (err) {
      toast({ title: "Error al exportar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    }
  }

  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Presidencia</h1>
            <p className="text-muted-foreground">Resumen ejecutivo de la empresa</p>
          </div>
        </div>
        <Card className="p-12 text-center">
          <p className="text-destructive text-lg font-medium">Error al cargar los datos</p>
          <p className="text-muted-foreground mt-1">{error}</p>
          <Button className="mt-4" onClick={loadData}>Reintentar</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard Presidencia</h1>
          <p className="text-muted-foreground">Resumen ejecutivo de la empresa</p>
        </div>
        <Button variant="outline" onClick={exportToExcel} disabled={!data || loading}>
          <FileDown className="h-4 w-4 mr-2" />
          Exportar Excel
        </Button>
      </div>

      {loading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {!loading && data && (
        <>
          <div>
            <h2 className="text-lg font-semibold mb-3">Compras</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Requisiciones Pendientes" value={String(data.compras.reqPendientes)} subtitle="Por aprobar" icon={ShoppingCart} />
              <KpiCard title="OC Pendientes" value={String(data.compras.ocPendientes)} subtitle="Por recibir" icon={Package} />
              <KpiCard title="Compras del Mes" value={formatMoney(data.compras.comprasMes)} subtitle="Ordenes de compra" icon={DollarSign} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Tesorería</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Pagos Pendientes" value={String(data.tesoreria.pagosPendientes)} subtitle={`${formatMoney(data.tesoreria.saldoPendiente)} total`} icon={Wallet} />
              <KpiCard title="Flujo de Caja" value={formatMoney(data.tesoreria.flujoCaja)} subtitle="Saldo en bancos" icon={DollarSign} />
              <KpiCard title="Cuentas por Pagar" value={String(data.tesoreria.cuentasPagarCount)} subtitle={`${formatMoney(data.tesoreria.cuentasPagarTotal)} total`} icon={BookOpen} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Nómina</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Nómina del Mes" value={formatMoney(data.nomina.totalPagar)} subtitle={`${data.nomina.nominasCount} nóminas generadas`} icon={BarChart3} />
              <KpiCard title="Empleados Activos" value={String(data.nomina.empleadosActivos)} subtitle="Total empleados" icon={Users} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Contabilidad</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Asientos Pendientes" value={String(data.contabilidad.asientosPendientes)} subtitle="Por contabilizar" icon={BookOpen} />
              <ResultadoCard resultado={data.contabilidad.resultadoMes} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Clientes</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Clientes Activos" value={String(data.clientes.activos)} subtitle={`${data.clientes.interaccionesSemana} interacciones esta semana`} icon={Users} />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">Inventario</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <KpiCard title="Productos con Stock Bajo" value={String(data.inventario.stockBajo)} subtitle="Por debajo del mínimo" icon={Archive} />
              <KpiCard title="Activos Asignados" value={String(data.inventario.activosAsignados)} subtitle="En uso por empleados" icon={ClipboardList} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
