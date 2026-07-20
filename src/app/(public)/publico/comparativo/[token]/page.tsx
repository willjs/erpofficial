"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Loader2, CheckCircle, AlertCircle, FileText, Lock, DollarSign, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { obtenerComparativoPublico, aprobarComparativoPublico } from "@/actions/publico"
import { formatDate } from "@/lib/utils"
import * as Accordion from "@radix-ui/react-accordion"
import { Badge } from "@/components/ui/badge"

export default function PublicComparativoPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [codigos, setCodigos] = useState<Record<string, string>>({})
  const [aprobando, setAprobando] = useState<string | null>(null)
  const [msgErrors, setMsgErrors] = useState<Record<string, string>>({})
  const [aprobadoExitosamente, setAprobadoExitosamente] = useState(false)

  useEffect(() => {
    obtenerComparativoPublico(token).then((res) => {
      if (!res) setError("Link inválido o expirado")
      else setData(res)
    }).catch(() => setError("Error al cargar el comparativo"))
    .finally(() => setLoading(false))
  }, [token])

  async function handleAprobar(cotizacionId: string) {
    const codigo = codigos[cotizacionId]
    if (!codigo?.trim()) { 
      setMsgErrors(p => ({ ...p, [cotizacionId]: "Ingrese el código de aprobación" }))
      return 
    }
    setAprobando(cotizacionId)
    setMsgErrors(p => ({ ...p, [cotizacionId]: "" }))
    try {
      const res = await aprobarComparativoPublico(token, cotizacionId, codigo)
      if (res.success) {
        setAprobadoExitosamente(true)
      }
    } catch (err: any) {
      setMsgErrors(p => ({ ...p, [cotizacionId]: err?.message ?? "Error al aprobar" }))
    } finally {
      setAprobando(null)
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

  const req = data.requisicion
  const cotizaciones = data.cotizaciones || []
  
  // Calculate min, max values to determine colors
  const values = cotizaciones.map((c: any) => c.valorTotal)
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)

  const getCardColor = (val: number) => {
    if (val === minValue) return "border-green-500 bg-green-50/30"
    if (val === maxValue) return "border-red-500 bg-red-50/30"
    return "border-orange-500 bg-orange-50/30"
  }

  const getTextColor = (val: number) => {
    if (val === minValue) return "text-green-700"
    if (val === maxValue) return "text-red-700"
    return "text-orange-700"
  }

  const yaAprobada = cotizaciones.find((c: any) => c.aprobada)

  if (aprobadoExitosamente || yaAprobada) {
    const ganadora = cotizaciones.find((c: any) => c.ganadora) || yaAprobada || cotizaciones[0]
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-lg border-green-500 bg-green-50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <p className="text-2xl font-semibold text-green-700 mb-2">Cotización Aprobada</p>
            <p className="text-green-600 mb-4">La cotización #{ganadora.numero} del proveedor <strong>{ganadora.proveedor}</strong> ha sido seleccionada como ganadora.</p>
            <div className="text-sm bg-white/60 p-4 rounded-md inline-block text-left">
              <p><strong>Requisición:</strong> #{req.numero}</p>
              <p><strong>Valor Total:</strong> ${ganadora.valorTotal.toLocaleString("es-CO")}</p>
              {ganadora.fechaAprobacion && <p><strong>Fecha de aprobación:</strong> {formatDate(ganadora.fechaAprobacion)}</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <FileText className="h-6 w-6 text-primary" />
            <div>
              <CardTitle className="text-xl">Comparativo de Cotizaciones</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Requisición #{req.numero}</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
              <span className="font-medium text-muted-foreground">Fecha Requisición</span>
              <span>{formatDate(req.fecha)}</span>
            </div>
            <div className="flex justify-between border-b border-dashed border-gray-200 py-1.5">
              <span className="font-medium text-muted-foreground">Solicitante</span>
              <span>{req.requeridoPor}</span>
            </div>
            {req.observaciones && (
              <div className="border-b border-dashed border-gray-200 py-1.5">
                <span className="font-medium text-muted-foreground block mb-1">Observaciones de Requisición</span>
                <p className="text-gray-700">{req.observaciones}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <h2 className="text-lg font-semibold text-gray-800">Cotizaciones Disponibles ({cotizaciones.length})</h2>

        <Accordion.Root type="single" collapsible className="space-y-4">
          {cotizaciones.map((cot: any) => {
            const cardColor = getCardColor(cot.valorTotal)
            const textColor = getTextColor(cot.valorTotal)

            return (
              <Accordion.Item value={cot.id} key={cot.id} className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all ${cardColor}`}>
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center justify-between p-4 focus:outline-none hover:bg-black/5 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6 text-left">
                      <div>
                        <span className="text-sm text-muted-foreground font-medium">Proveedor</span>
                        <p className="font-semibold text-base">{cot.proveedor}</p>
                      </div>
                      <div className="hidden sm:block h-8 w-px bg-gray-300" />
                      <div>
                        <span className="text-sm text-muted-foreground font-medium">Valor Total</span>
                        <p className={`font-bold text-lg ${textColor}`}>${cot.valorTotal.toLocaleString("es-CO")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {cot.valorTotal === minValue && <Badge variant="success" className="hidden sm:flex">Más Económica</Badge>}
                      <ChevronDown className="h-5 w-5 text-gray-500 transition-transform duration-200" aria-hidden />
                    </div>
                  </Accordion.Trigger>
                </Accordion.Header>

                <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <div className="p-4 pt-0 border-t border-black/5 bg-white/50">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                      
                      {/* Detalles y Items */}
                      <div className="md:col-span-2 space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm bg-white p-3 rounded-lg border shadow-sm">
                          <div><span className="text-muted-foreground block text-xs">NIT</span>{cot.nit}</div>
                          <div><span className="text-muted-foreground block text-xs">Tiempo Entrega</span>{cot.tiempoEntrega || "—"}</div>
                          <div className="col-span-2"><span className="text-muted-foreground block text-xs">Forma de Pago</span>{cot.formaPago || "—"}</div>
                          {cot.observaciones && <div className="col-span-2"><span className="text-muted-foreground block text-xs">Observaciones</span>{cot.observaciones}</div>}
                        </div>

                        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b bg-muted/50">
                                  <th className="text-left px-3 py-2 font-medium">Item</th>
                                  <th className="text-right px-3 py-2 font-medium">Cant</th>
                                  <th className="text-right px-3 py-2 font-medium">V. Unitario</th>
                                  <th className="text-right px-3 py-2 font-medium">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cot.items.map((item: any) => (
                                  <tr key={item.item} className="border-b last:border-0">
                                    <td className="px-3 py-2">{item.descripcion}</td>
                                    <td className="px-3 py-2 text-right">{item.cantidad} {item.unidadMedida}</td>
                                    <td className="px-3 py-2 text-right">${item.valorUnitario.toLocaleString("es-CO")}</td>
                                    <td className="px-3 py-2 text-right font-medium">${item.valorTotal.toLocaleString("es-CO")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Caja de Aprobación */}
                      <div className="bg-white p-4 rounded-lg border shadow-sm h-fit">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Lock className="h-4 w-4" />Aprobar Cotización</h3>
                        <p className="text-xs text-muted-foreground mb-4">Para elegir esta cotización como la ganadora, ingresa tu código de aprobación de seguridad.</p>
                        
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs">Código de Aprobación</Label>
                            <Input
                              value={codigos[cot.id] || ""}
                              onChange={(e) => {
                                setCodigos(p => ({ ...p, [cot.id]: e.target.value.toUpperCase() }))
                                setMsgErrors(p => ({ ...p, [cot.id]: "" }))
                              }}
                              placeholder="Ej: AB12CD"
                              className="uppercase"
                            />
                            {msgErrors[cot.id] && <p className="text-xs text-destructive mt-1">{msgErrors[cot.id]}</p>}
                          </div>
                          
                          <Button 
                            onClick={() => handleAprobar(cot.id)} 
                            disabled={aprobando === cot.id} 
                            className="w-full"
                          >
                            {aprobando === cot.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                            Aprobar
                          </Button>
                        </div>
                      </div>

                    </div>
                  </div>
                </Accordion.Content>
              </Accordion.Item>
            )
          })}
        </Accordion.Root>

        <div className="text-center pt-8">
          <DollarSign className="h-5 w-5 text-muted-foreground inline-block mr-1" />
          <span className="text-xs text-muted-foreground">C.I. International Fuels</span>
        </div>
      </div>
    </div>
  )
}
