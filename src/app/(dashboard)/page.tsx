"use client"

import { useState, useEffect, useCallback } from "react"
import { getDashboardData, type DashboardData } from "@/actions/dashboard"
import { getEmpresa } from "@/actions/configuracion"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ShoppingCart, Wallet, Users, BarChart3, Package, CheckSquare, Building2, FileDown, TrendingUp, Receipt, ArrowUpRight, BookOpen, DollarSign } from "lucide-react"
import { formatMoney } from "@/lib/utils"
import * as XLSX from "xlsx"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { useDashboardPermiso } from "@/components/dashboard-permiso-provider"

// ─── Dashboard Minimalista ─────────────────────────────
function DashboardMinimalista() {
  const [logo, setLogo] = useState("/images/fuel_logo.png")

  useEffect(() => {
    getEmpresa().then((emp) => {
      if (emp?.logo) setLogo(emp.logo)
    }).catch(() => {})
  }, [])

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <img
        src={logo}
        alt="Logo"
        className="w-64 sm:w-72 md:w-80 h-auto select-none"
        onError={(e) => { (e.target as HTMLImageElement).src = "/images/fuel_logo.png" }}
      />
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-6 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-11 w-11 rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-muted" />
          <div className="h-5 w-32 rounded bg-muted" />
        </div>
      </div>
      <div className="h-3 w-24 rounded bg-muted" />
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────
const cardAccents: Record<string, { iconBg: string; border: string }> = {
  blue: { iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300", border: "border-l-blue-500" },
  green: { iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300", border: "border-l-emerald-500" },
  amber: { iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300", border: "border-l-amber-500" },
  violet: { iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300", border: "border-l-violet-500" },
}

function StatCard({ title, value, subtitle, icon: Icon, color = "blue", loading }: { title: string; value: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; color?: string; loading?: boolean }) {
  if (loading) return <CardSkeleton />
  const a = cardAccents[color] ?? cardAccents.blue
  return (
    <div className={`rounded-xl border border-l-4 bg-card p-5 ${a.border} shadow-sm`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <div className={`rounded-lg p-2.5 ${a.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

// ─── Chart Data ───────────────────────────────────────
function buildChartData(d: DashboardData) {
  return [
    { name: "Compras", value: d.compras.comprasMes },
    { name: "Flujo Caja", value: d.tesoreria.flujoCaja },
    { name: "Ventas", value: d.ventas.totalMes },
    { name: "Pedidos", value: d.pedidos.totalMes },
  ]
}

// ─── Mini KPI ─────────────────────────────────────────
function MiniKpi({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-semibold">{value}</p>
      </div>
    </div>
  )
}

// ─── Dashboard Presidencia ────────────────────────────
function DashboardPresidencia() {
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
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { Indicador: "Requisiciones Pendientes", Valor: data.compras.reqPendientes },
        { Indicador: "OC Pendientes", Valor: data.compras.ocPendientes },
        { Indicador: "Compras del Mes", Valor: data.compras.comprasMes },
      ]), "Compras")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { Indicador: "Pagos Pendientes", Valor: data.tesoreria.pagosPendientes },
        { Indicador: "Saldo Pendiente", Valor: data.tesoreria.saldoPendiente },
        { Indicador: "Flujo de Caja", Valor: data.tesoreria.flujoCaja },
        { Indicador: "Cuentas por Pagar", Valor: data.tesoreria.cuentasPagarCount },
      ]), "Tesorería")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { Indicador: "Total Nómina del Mes", Valor: data.nomina.totalPagar },
        { Indicador: "Nóminas Generadas", Valor: data.nomina.nominasCount },
        { Indicador: "Empleados Activos", Valor: data.nomina.empleadosActivos },
      ]), "Nómina")
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
        { Indicador: "Asientos Pendientes", Valor: data.contabilidad.asientosPendientes },
        { Indicador: "Resultado del Mes", Valor: data.contabilidad.resultadoMes },
      ]), "Contabilidad")
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Flujo de Caja" value={formatMoney(data.tesoreria.flujoCaja)} subtitle={`${data.tesoreria.cuentasPagarCount} cuentas por pagar`} icon={Wallet} color="blue" />
            <StatCard title="Ventas del Mes" value={formatMoney(data.ventas.totalMes)} subtitle={`${data.ventas.pendientes} pendientes`} icon={TrendingUp} color="green" />
            <StatCard title="Compras del Mes" value={formatMoney(data.compras.comprasMes)} subtitle={`${data.compras.ocPendientes} OC pendientes`} icon={ShoppingCart} color="amber" />
            <StatCard title="Resultado del Mes" value={formatMoney(data.contabilidad.resultadoMes)} subtitle={data.contabilidad.resultadoMes >= 0 ? "Positivo" : "Negativo"} icon={DollarSign} color={data.contabilidad.resultadoMes >= 0 ? "green" : "violet"} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Comparativo del Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={buildChartData(data)} cx="50%" cy="50%" innerRadius={70} outerRadius={110} dataKey="value" paddingAngle={3}>
                      {buildChartData(data).map((_, i) => (
                        <Cell key={i} fill={["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"][i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(v: any) => [formatMoney(Number(v) || 0), "Valor"]} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-sm">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Resumen Rápido
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <MiniKpi label="Reqs. Pendientes" value={String(data.compras.reqPendientes)} icon={Package} />
                  <MiniKpi label="OC Pendientes" value={String(data.compras.ocPendientes)} icon={ShoppingCart} />
                  <MiniKpi label="Pagos Pendientes" value={String(data.tesoreria.pagosPendientes)} icon={Wallet} />
                  <MiniKpi label="CxP Total" value={formatMoney(data.tesoreria.cuentasPagarTotal)} icon={Receipt} />
                  <MiniKpi label="Nómina del Mes" value={formatMoney(data.nomina.totalPagar)} icon={BarChart3} />
                  <MiniKpi label="Empleados Activos" value={String(data.nomina.empleadosActivos)} icon={Users} />
                  <MiniKpi label="Asientos Pend." value={String(data.contabilidad.asientosPendientes)} icon={BookOpen} />
                  <MiniKpi label="Clientes Activos" value={String(data.clientes.activos)} icon={Building2} />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MiniKpi label="Pedidos Pendientes" value={String(data.pedidos.pendientes)} icon={CheckSquare} />
            <MiniKpi label="Despachos Pend." value={String(data.despachos.pendientes)} icon={Package} />
            <MiniKpi label="Traspasos Pend." value={String(data.traspasos.pendientes)} icon={ArrowUpRight} />
            <MiniKpi label="Interacciones Sem." value={String(data.clientes.interaccionesSemana)} icon={Users} />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────
export default function DashboardPage() {
  const { puedeVerDashboard } = useDashboardPermiso()

  if (!puedeVerDashboard) {
    return <DashboardMinimalista />
  }

  return <DashboardPresidencia />
}
