"use client"

import { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"

interface SignaturePadProps {
  onSave?: (dataUrl: string) => void
  width?: number
  height?: number
}

export function SignaturePad({ onSave, width = 400, height = 160 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    // Draw guide line
    ctx.beginPath()
    ctx.moveTo(20, height - 30)
    ctx.lineTo(width - 20, height - 30)
    ctx.strokeStyle = "#d0d0d0"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
  }, [width, height])

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }, [])

  const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setHasContent(true)
  }, [getPos])

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }, [isDrawing, getPos])

  const stopDraw = useCallback(() => {
    setIsDrawing(false)
  }, [])

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.clearRect(0, 0, width, height)
    setHasContent(false)
    // Redraw guide
    ctx.beginPath()
    ctx.moveTo(20, height - 30)
    ctx.lineTo(width - 20, height - 30)
    ctx.strokeStyle = "#d0d0d0"
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSave?.(canvas.toDataURL("image/png"))
  }

  return (
    <div className="space-y-2">
      <div className="border rounded-md overflow-hidden bg-white" style={{ width, height }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Trash2 className="h-3 w-3 mr-1" />Limpiar
        </Button>
        {onSave && hasContent && (
          <Button type="button" size="sm" onClick={save} className="bg-primary text-white">
            Usar firma
          </Button>
        )}
      </div>
    </div>
  )
}
