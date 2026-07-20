"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Loader2, AlertCircle, FileText, DollarSign, Mail, CheckCircle, Upload, ArrowRight, Phone, User, Building2, Hash, Calendar, MapPin, CreditCard, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { obtenerOrdenCompraPublica, registrarFacturaDesdeOC } from "@/actions/publico"
import { formatDate } from "@/lib/utils"

export default function PublicOrdenCompraPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const [numFactura, setNumFactura] = useState("")
  const [valorFactura, setValorFactura] = useState("")
  const [fechaFactura, setFechaFactura] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [msgError, setMsgError] = useState("")

  useEffect(() => {
    obtenerOrdenCompraPublica(token).then((res) => {
      if (!res) setError("Link inválido o expirado")
      else {
        setData(res)
        if (res.facturaRegistrada) setEnviado(true)
        setValorFactura(String(res.valorTotal))
        setFechaFactura(new Date().toISOString().split("T")[0])
      }
    }).catch(() => setError("Error al cargar la orden de compra"))
    .finally(() => setLoading(false))
  }, [token])

  async function handleEnviarFactura() {
    if (!numFactura.trim()) { setMsgError("Ingrese el número de factura"); return }
    if (!valorFactura || Number(valorFactura) <= 0) { setMsgError("Ingrese un valor válido"); return }
    setEnviando(true)
    setMsgError("")
    try {
      const res = await registrarFacturaDesdeOC(token, {
        numeroFactura: numFactura.trim(),
        valor: Number(valorFactura),
        fechaFactura: fechaFactura || undefined,
      })
      if (res.success) setEnviado(true)
    } catch (err: any) {
      setMsgError(err?.message ?? "Error al registrar factura")
    } finally {
      setEnviando(false)
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
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Encabezado con logo */}
        <Card>
          <CardContent className="pt-6 pb-4">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {data.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.logo} alt="Logo" className="h-16 w-auto object-contain" />
              )}
              <div className="text-center sm:text-left">
                <h1 className="text-2xl font-bold">ORDEN DE COMPRA Y/O SUMINISTRO</h1>
                <p className="text-muted-foreground">{data.empresa}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Información principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Columna izquierda: Empresa/OC */}
          <Card>
            <CardContent className="pt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">OC No.:</span>
                <span className="font-mono">#{data.numero}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">Fecha:</span>
                <span>{formatDate(data.fecha)}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">Req No.:</span>
                <span className="font-mono">#{data.numeroRequisicion}</span>
              </div>
              {data.numeroCotizacion && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Cotización No.:</span>
                  <span className="font-mono">#{data.numeroCotizacion}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Columna derecha: Proveedor */}
          <Card>
            <CardContent className="pt-4 space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">Proveedor:</span>
                <span>{data.proveedor}</span>
              </div>
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">NIT:</span>
                <span>{data.nit}</span>
              </div>
              {data.contacto && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Contacto:</span>
                  <span>{data.contacto}</span>
                </div>
              )}
              {data.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Email:</span>
                  <span>{data.email}</span>
                </div>
              )}
              {data.telefono && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Teléfono:</span>
                  <span>{data.telefono}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Condiciones */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Condiciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {data.formaPago && (
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Forma de pago:</span>
                  <span>{data.formaPago}</span>
                </div>
              )}
              {data.fechaEntrega && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Fecha entrega:</span>
                  <span>{formatDate(data.fechaEntrega)}</span>
                </div>
              )}
              {data.sitioEntrega && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Sitio entrega:</span>
                  <span>{data.sitioEntrega}</span>
                </div>
              )}
              {data.centroCostos && (
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">Centro costo:</span>
                  <span>{data.centroCostos}</span>
                </div>
              )}
              {data.condicionesComerciales && (
                <div className="sm:col-span-2 flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="font-medium">Condiciones comerciales:</span>
                  <span>{data.condicionesComerciales}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Items */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ítems</CardTitle>
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
                    <th className="text-right py-2 pr-4">Total</th>
                    <th className="text-center py-2">IVA</th>
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
                      <td className="text-right py-2 pr-4">${Number(item.valorTotal).toLocaleString("es-CO")}</td>
                      <td className="text-center py-2 text-xs">{item.tipoIva === "IVA_19" ? "19%" : item.tipoIva === "IVA_5" ? "5%" : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-medium text-muted-foreground">
                    <td colSpan={6} className="text-right py-1 pr-4">Subtotal</td>
                    <td className="text-right py-1">${Number(data.subtotal).toLocaleString("es-CO")}</td>
                  </tr>
                  {Number(data.descuento) > 0 && (
                    <tr className="font-medium text-muted-foreground">
                      <td colSpan={6} className="text-right py-1 pr-4">Descuento</td>
                      <td className="text-right py-1 text-destructive">-${Number(data.descuento).toLocaleString("es-CO")}</td>
                    </tr>
                  )}
                  <tr className="font-medium text-muted-foreground">
                    <td colSpan={6} className="text-right py-1 pr-4">IVA</td>
                    <td className="text-right py-1">${Number(data.iva).toLocaleString("es-CO")}</td>
                  </tr>
                  <tr className="font-bold text-base">
                    <td colSpan={6} className="text-right py-2 pr-4">Total</td>
                    <td className="text-right py-2">${data.valorTotal.toLocaleString("es-CO")}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Observaciones */}
        {data.observaciones && (
          <Card>
            <CardContent className="pt-4 text-sm">
              <span className="font-medium text-muted-foreground">Observaciones:</span>
              <p className="mt-1 text-gray-700">{data.observaciones}</p>
            </CardContent>
          </Card>
        )}

        <Separator />

        {/* Sección: Enviar factura electrónica */}
        {enviado && data.facturaRegistrada ? (
          <Card className="border-green-500 bg-green-50">
            <CardContent className="pt-6 pb-6 text-center">
              <CheckCircle className="h-14 w-14 text-green-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-green-700 mb-1">¡Factura registrada exitosamente!</p>
              <p className="text-sm text-green-600">
                Factura No. <strong>{data.facturaRegistrada.numeroFactura}</strong> por <strong>${Number(data.facturaRegistrada.valor).toLocaleString("es-CO")}</strong>
              </p>
              <p className="text-xs text-green-500 mt-2">Gracias por enviar su factura electrónica. Será procesada a la brevedad.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Enviar factura electrónica
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Para dar continuidad al proceso de pago, por favor registre los datos de su factura electrónica asociada a esta orden de compra.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="numFactura">Número de factura *</Label>
                  <Input
                    id="numFactura"
                    value={numFactura}
                    onChange={(e) => { setNumFactura(e.target.value); setMsgError("") }}
                    placeholder="Ej: F-001-2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valorFactura">Valor de la factura *</Label>
                  <Input
                    id="valorFactura"
                    type="number"
                    value={valorFactura}
                    onChange={(e) => { setValorFactura(e.target.value); setMsgError("") }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fechaFactura">Fecha de factura</Label>
                  <Input
                    id="fechaFactura"
                    type="date"
                    value={fechaFactura}
                    onChange={(e) => setFechaFactura(e.target.value)}
                  />
                </div>
              </div>

              {msgError && <p className="text-sm text-destructive">{msgError}</p>}

              <Button onClick={handleEnviarFactura} disabled={enviando} className="w-full sm:w-auto">
                {enviando ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Enviando...</>
                ) : (
                  <><ArrowRight className="h-4 w-4 mr-2" /> Enviar factura</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>{data.empresa}</p>
        </div>
      </div>
    </div>
  )
}
