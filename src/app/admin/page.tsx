import { getEstadisticasGlobales } from "@/actions/admin"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2, Users, Briefcase, ShoppingCart, FileText } from "lucide-react"

export default async function AdminDashboardPage() {
  const stats = await getEstadisticasGlobales()

  const cards = [
    { title: "Empresas Activas", value: stats.totalEmpresas, icon: Building2, description: "Total de empresas registradas" },
    { title: "Usuarios", value: stats.totalUsuarios, icon: Users, description: "Usuarios en el sistema" },
    { title: "Empleados", value: stats.totalEmpleados, icon: Briefcase, description: "Empleados registrados" },
    { title: "Requisiciones", value: stats.totalRequisiciones, icon: ShoppingCart, description: "Requisiciones creadas" },
    { title: "Órdenes de Compra", value: stats.totalOrdenesCompra, icon: FileText, description: "Órdenes generadas" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel Global</h1>
        <p className="text-muted-foreground">Estadísticas generales de todas las empresas</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
