"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Loader2, CheckCircle, AlertCircle, FileText, Lock, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { obtenerCotizacionPublica, aprobarCotizacionPublica } from "@/actions/publico"
import { formatDate } from "@/lib/utils"

export default function PublicCotizacionPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [codigo, setCodigo] = useState("")
  const [aprobando, setAprobando] = useState(false)
  const [aprobado, setAprobado] = useState(false)
  const [msgError, setMsgError] = useState("")

  useEffect(() => {
    obtenerCotizacionPublica(token).then((res) => {
      if (!res) setError("Link inválido o expirado")
      else setData(res)
    }).catch(() => setError("Error al cargar la cotización"))
    .finally(() => setLoading(false))
  }, [token])

  async function handleAprobar() {
    if (!codigo.trim()) { setMsgError("Ingrese el código de aprobación"); return }
    setAprobando(true)
    setMsgError("")
    try {
      const res = await aprobarCotizacionPublica(token, codigo)
      if (res.success) setAprobado(true)
    } catch (err: any) {
      setMsgError(err?.message ?? "Error al aprobar")
    } finally {
      setAprobando(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <p className="text-lg font-medium">{error}</p>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileText className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">Cotización #{data.numero}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
              <span className="font-medium text-muted-foreground">Fecha</span>
              <span>{formatDate(data.fecha)}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
              <span className="font-medium text-muted-foreground">Proveedor</span>
              <span>{data.proveedor}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
              <span className="font-medium text-muted-foreground">NIT</span>
              <span>{data.nit}</span>
            </div>
            {data.tiempoEntrega && (
              <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
                <span className="font-medium text-muted-foreground">Tiempo de entrega</span>
                <span>{data.tiempoEntrega}</span>
              </div>
            )}
            {data.formaPago && (
              <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
                <span className="font-medium text-muted-foreground">Forma de pago</span>
                <span>{data.formaPago}</span>
              </div>
            )}
            {data.observaciones && (
              <div className="border-b border-dashed border-gray-200 py-1.5">
                <span className="font-medium text-muted-foreground block mb-1">Observaciones</span>
                <p className="text-gray-700">{data.observaciones}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Ítems</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 pr-4">#</th>
                    <th className="text-left py-2 pr-4">Descripción</th>
                    <th className="text-left py-2 pr-4">U.M.</th>
                    <th className="text-right py-2 pr-4">Cantidad</th>
                    <th className="text-right py-2 pr-4">V. Unitario</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item: any) => (
                    <tr key={item.item} className="border-b">
                      <td className="py-2 pr-4">{item.item}</td>
                      <td className="py-2 pr-4">{item.descripcion}</td>
                      <td className="py-2 pr-4">{item.unidadMedida}</td>
                      <td className="text-right py-2 pr-4">{item.cantidad}</td>
                      <td className="text-right py-2 pr-4">${Number(item.valorUnitario).toLocaleString("es-CO")}</td>
                      <td className="text-right py-2">${Number(item.valorTotal).toLocaleString("es-CO")}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td colSpan={5} className="text-right py-2 pr-4">Total</td>
                    <td className="text-right py-2">${data.valorTotal.toLocaleString("es-CO")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {aprobado ? (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-green-700">Cotización aprobada</p>
              <p className="text-sm text-green-600">La cotización #{data.numero} ha sido aprobada exitosamente.</p>
            </CardContent>
          </Card>
        ) : data.aprobada ? (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-green-700">Ya fue aprobada</p>
              <p className="text-sm text-green-600">Esta cotización fue aprobada{data.fechaAprobacion ? ` el ${formatDate(data.fechaAprobacion)}` : ""}.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Aprobación
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para aprobar esta cotización, ingrese el código de aprobación proporcionado.
              </p>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código de aprobación</Label>
                <Input
                  id="codigo"
                  value={codigo}
                  onChange={(e) => { setCodigo(e.target.value.toUpperCase()); setMsgError("") }}
                  placeholder="Ingrese el código"
                  className="uppercase"
                />
                {msgError && <p className="text-sm text-destructive">{msgError}</p>}
              </div>
              <Button onClick={handleAprobar} disabled={aprobando} className="w-full">
                {aprobando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Aprobar cotización
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="text-center">
          <DollarSign className="h-5 w-5 text-muted-foreground inline-block mr-1" />
          <span className="text-xs text-muted-foreground">C.I. International Fuels</span>
        </div>
      </div>
    </div>
  )
}
