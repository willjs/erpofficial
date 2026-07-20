"use client"

import { useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { getDeliveryTicket } from "@/actions/operaciones-delivery"
import { Printer, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VistaPrevia } from "@/components/delivery/vista-previa"

const PRINTABLE_HEIGHT = 740

export default function DeliveryTicketPrintPage() {
  const params = useParams()
  const id = params.id as string
  const [dt, setDt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getDeliveryTicket(id)
      .then(setDt)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  const handlePrint = () => {
    const el = contentRef.current
    if (!el) return
    const height = el.scrollHeight
    const s = Math.min(1, PRINTABLE_HEIGHT / height)
    el.style.transform = `scale(${s})`
    el.style.transformOrigin = "top left"
    const parent = el.parentElement
    if (parent) {
      parent.style.width = `${990 * s}px`
      parent.style.height = `${height * s}px`
    }
    setTimeout(() => window.print(), 100)
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
    </div>
  )
  if (error) return <div className="p-8 text-red-600 text-center">{error}</div>
  if (!dt) return <div className="p-8 text-center">Sin datos</div>

  return (
    <>
      <div className="no-print flex flex-col sm:flex-row justify-center gap-3 p-4 sm:p-6 bg-gray-100 border-b sticky top-0 z-10">
        <Button onClick={handlePrint} size="lg" className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto">
          <Printer className="h-5 w-5 mr-2" /> Imprimir / Guardar PDF
        </Button>
        <Button variant="outline" size="lg" onClick={() => window.close()} className="w-full sm:w-auto">
          Cerrar
        </Button>
      </div>

      <div style={{ overflowX: "auto", margin: "20px auto" }}>
        <div ref={contentRef} style={{ width: 990 }}>
          <VistaPrevia dt={dt} />
        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { size: legal landscape; margin: 5mm; }
          aside, header, .no-print { display: none !important; }
          .h-screen { display: block !important; height: auto !important; }
          .overflow-hidden { overflow: visible !important; }
          .flex-1 { flex: none !important; }
          main { display: block !important; padding: 0 !important; overflow: visible !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  )
}
