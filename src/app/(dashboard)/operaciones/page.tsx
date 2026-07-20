"use client"

import { useState, useEffect, useCallback } from "react"
import { getProgramaciones } from "@/actions/operaciones-programacion"
import { getOrdenes } from "@/actions/operaciones-ordenes"
import { getDeliveryTickets } from "@/actions/operaciones-delivery"
import { useToast } from "@/components/ui/use-toast"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Anchor, ClipboardList, Ship, CalendarDays, RefreshCw, FileText, CheckCircle2, BarChart3 } from "lucide-react"
import { PageHeader } from "@/components/shared/page-header"
import Link from "next/link"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"

// ─── Stat Card (dashboard style) ───────────────────────
const cardAccents: Record<string, { iconBg: string; border: string }> = {
  blue: { iconBg: "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300", border: "border-l-blue-500" },
  green: { iconBg: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900 dark:text-emerald-300", border: "border-l-emerald-500" },
  amber: { iconBg: "bg-amber-100 text-amber-600 dark:bg-amber-900 dark:text-amber-300", border: "border-l-amber-500" },
  violet: { iconBg: "bg-violet-100 text-violet-600 dark:bg-violet-900 dark:text-violet-300", border: "border-l-violet-500" },
}

function StatCard({ title, value, subtitle, icon: Icon, color = "blue", href }: { title: string; value: string; subtitle: string; icon: React.ComponentType<{ className?: string }>; color?: string; href?: string }) {
  const a = cardAccents[color] ?? cardAccents.blue
  const content = (
    <div className={`rounded-xl border border-l-4 bg-card p-5 ${a.border} shadow-sm h-full`}>
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
  return href ? <Link href={href} className="block h-full">{content}</Link> : content
}

// ─── Mini KPI (dashboard style) ───────────────────────
function MiniKpi({ label, value, icon: Icon, href }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; href?: string }) {
  const content = (
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
  return href ? <Link href={href}>{content}</Link> : content
}

export default function OperacionesDashboard() {
  const { toast } = useToast()
  const [programaciones, setProgramaciones] = useState<any[]>([])
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [progs, ords, dts] = await Promise.all([getProgramaciones(), getOrdenes(), getDeliveryTickets()])
      setProgramaciones(progs)
      setOrdenes(ords)
      setDeliveries(dts)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al cargar datos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const progBorrador = programaciones.filter(p => p.estado === "BORRADOR").length
  const progProgramada = programaciones.filter(p => p.estado === "PROGRAMADA").length
  const progAprobada = programaciones.filter(p => p.estado === "APROBADA").length

  const ordPendiente = ordenes.filter(o => o.estado === "PENDIENTE").length
  const ordEnProceso = ordenes.filter(o => ["ASIGNADA", "EN_PROCESO"].includes(o.estado)).length
  const ordCerrada = ordenes.filter(o => o.estado === "CERRADA").length

  const dtBorrador = deliveries.filter(d => d.estado === "BORRADOR").length
  const dtCerrado = deliveries.filter(d => d.estado === "CERRADO").length

  const totalVolumen = deliveries.reduce((sum, d) => sum + Number(d.cantidadEntregada || 0), 0)

  const chartData = [
    { name: "Programaciones", value: programaciones.length },
    { name: "Órdenes", value: ordenes.length },
    { name: "Deliveries", value: deliveries.length },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Operaciones Marítimas</h1>
          <p className="text-muted-foreground">Dashboard operacional de suministro de combustibles marinos</p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* ── Top 4 Stat Cards ─────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Programaciones" value={String(programaciones.length)} subtitle={`${progAprobada} aprobadas`} icon={CalendarDays} color="blue" href="/operaciones/programacion" />
        <StatCard title="Órdenes Operativas" value={String(ordenes.length)} subtitle={`${ordPendiente} pendientes`} icon={ClipboardList} color="green" href="/operaciones/ordenes" />
        <StatCard title="Delivery Tickets" value={String(deliveries.length)} subtitle={`${dtCerrado} cerrados`} icon={Ship} color="amber" href="/operaciones/delivery" />
        <StatCard title="Volumen Total" value={`${totalVolumen.toFixed(0)} TON`} subtitle="Suministrado" icon={Anchor} color="violet" />
      </div>

      {/* ── Charts Row ───────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Distribución por Módulo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%" cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={["#3b82f6", "#10b981", "#f59e0b"][i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: any, name: any) => [v, name]}
                />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-sm">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Estados Clave
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <MiniKpi label="Prog. Borrador" value={String(progBorrador)} icon={CalendarDays} href="/operaciones/programacion" />
              <MiniKpi label="Prog. Programadas" value={String(progProgramada)} icon={CalendarDays} href="/operaciones/programacion" />
              <MiniKpi label="Prog. Aprobadas" value={String(progAprobada)} icon={CheckCircle2} href="/operaciones/programacion" />
              <MiniKpi label="Órd. Pendientes" value={String(ordPendiente)} icon={ClipboardList} href="/operaciones/ordenes" />
              <MiniKpi label="Órd. En Proceso" value={String(ordEnProceso)} icon={Anchor} href="/operaciones/ordenes" />
              <MiniKpi label="Órd. Cerradas" value={String(ordCerrada)} icon={CheckCircle2} href="/operaciones/ordenes" />
              <MiniKpi label="DT Borrador" value={String(dtBorrador)} icon={Ship} href="/operaciones/delivery" />
              <MiniKpi label="DT Cerrados" value={String(dtCerrado)} icon={CheckCircle2} href="/operaciones/delivery" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Footer Stats ──────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MiniKpi label="Total Prog." value={String(programaciones.length)} icon={CalendarDays} href="/operaciones/programacion" />
        <MiniKpi label="Total Órdenes" value={String(ordenes.length)} icon={ClipboardList} href="/operaciones/ordenes" />
        <MiniKpi label="Total DT" value={String(deliveries.length)} icon={Ship} href="/operaciones/delivery" />
        <MiniKpi label="Volumen TON" value={`${totalVolumen.toFixed(0)} TON`} icon={Anchor} />
      </div>
    </div>
  )
}
