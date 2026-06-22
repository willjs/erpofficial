"use client"

import { useState, useEffect, useRef } from "react"
import { useActionState } from "react"
import { crearPedidoPublico, type PublicPedidoState } from "@/actions/public-pedidos"
import { getProductosPublicos, getServiciosPublicos } from "@/actions/public-productos"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface CatalogoItem {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  unidadMedida: string
  precioUnitario: string | number | null
}

interface ItemRow {
  key: string
  tipoItem: string
  descripcion: string
  codigo: string
  unidadMedida: string
  cantidad: string
  precioRef: string
  catalogoId: string
}

function emptyItem(): ItemRow {
  return {
    key: crypto.randomUUID(),
    tipoItem: "PRODUCTO",
    descripcion: "",
    codigo: "",
    unidadMedida: "UNIDAD",
    cantidad: "1",
    precioRef: "",
    catalogoId: "",
  }
}

function MultiSelectCombobox({
  catalogo,
  tipo,
  selectedIds,
  onToggle,
}: {
  catalogo: CatalogoItem[]
  tipo: string
  selectedIds: Set<string>
  onToggle: (item: CatalogoItem) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  const filtrados = catalogo.filter((c) => {
    const q = query.toLowerCase()
    if (!q) return true
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.codigo.toLowerCase().includes(q) ||
      (c.descripcion && c.descripcion.toLowerCase().includes(q))
    )
  })

  const selectedItems = catalogo.filter((c) => selectedIds.has(c.id))

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex min-h-9 w-full flex-wrap gap-1 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm cursor-text"
        onClick={() => {
          setOpen(true)
          ;(ref.current?.querySelector("input") as HTMLInputElement)?.focus()
        }}
      >
        {selectedItems.map((s) => (
          <span
            key={s.id}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium"
          >
            {s.codigo}
            <button
              type="button"
              className="ml-0.5 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onToggle(s)
              }}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          placeholder={selectedIds.size === 0 ? "Seleccione una o más opciones" : ""}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="min-w-[120px] flex-1 border-none bg-transparent outline-none text-sm py-0.5"
        />
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
          {filtrados.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {query ? "Sin resultados" : "No hay " + (tipo === "PRODUCTO" ? "productos" : "servicios") + " disponibles"}
            </div>
          )}
          {filtrados.map((c) => {
            const isSelected = selectedIds.has(c.id)
            return (
              <label
                key={c.id}
                className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggle(c)}
                  className="h-4 w-4 rounded border-gray-300 text-primary"
                />
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{c.codigo}</span> — {c.nombre}
                </span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {c.precioUnitario ? `$${Number(c.precioUnitario).toFixed(2)}` : ""}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function SolicitarPedidoPage() {
  const [items, setItems] = useState<ItemRow[]>([emptyItem()])
  const [productos, setProductos] = useState<CatalogoItem[]>([])
  const [servicios, setServicios] = useState<CatalogoItem[]>([])
  const [tipoFiltro, setTipoFiltro] = useState("PRODUCTO")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [state, action, pending] = useActionState(
    async (_prev: PublicPedidoState, form: FormData) => {
      const allItems = items.filter((it) => it.descripcion.trim())
      allItems.forEach((item, idx) => {
        form.set(`items.${idx}.tipoItem`, item.tipoItem)
        form.set(`items.${idx}.descripcion`, item.descripcion)
        form.set(`items.${idx}.unidadMedida`, item.unidadMedida)
        form.set(`items.${idx}.cantidad`, item.cantidad)
      })
      return crearPedidoPublico(_prev, form)
    },
    undefined
  )

  useEffect(() => {
    getProductosPublicos().then(setProductos)
    getServiciosPublicos().then(setServicios)
  }, [])

  function getCatalogo(tipo: string): CatalogoItem[] {
    return tipo === "PRODUCTO" ? productos : servicios
  }

  function handleToggleCatalogo(item: CatalogoItem) {
    const isSelected = selectedIds.has(item.id)
    if (isSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.id)
        return next
      })
      setItems((prev) => prev.filter((it) => it.catalogoId !== item.id))
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.add(item.id)
        return next
      })
      setItems((prev) => [
        ...prev.filter((it) => it.descripcion.trim()),
        {
          key: crypto.randomUUID(),
          tipoItem: tipoFiltro === "PRODUCTO" ? "PRODUCTO" : "SERVICIO",
          descripcion: item.nombre,
          codigo: item.codigo,
          unidadMedida: item.unidadMedida,
          cantidad: "1",
          precioRef: item.precioUnitario ? `$${Number(item.precioUnitario).toFixed(2)}` : "",
          catalogoId: item.id,
        },
      ])
    }
  }

  function addManualItem() {
    setItems((prev) => [
      ...prev.filter((it) => it.descripcion.trim()),
      {
        key: crypto.randomUUID(),
        tipoItem: tipoFiltro === "PRODUCTO" ? "PRODUCTO" : "SERVICIO",
        descripcion: "",
        codigo: "",
        unidadMedida: "UNIDAD",
        cantidad: "1",
        precioRef: "",
        catalogoId: "",
      },
    ])
  }

  function removeItem(key: string) {
    const item = items.find((it) => it.key === key)
    if (item && item.catalogoId) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(item.catalogoId)
        return next
      })
    }
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  const visibleItems = items.filter((it) => it.descripcion.trim() || it === items[items.length - 1])

  if (state?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
        <Card className="w-full max-w-lg text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Pedido Enviado</CardTitle>
            <CardDescription>
              Su pedido ha sido recibido y será revisado por nuestro equipo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Recibirá una respuesta a la brevedad posible.
            </p>
            <Button onClick={() => window.location.reload()}>
              Nuevo Pedido
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/50 p-4 pt-12">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-2xl">Solicitud de Pedido</CardTitle>
          <CardDescription>
            Complete el formulario para solicitar productos o servicios.
            Su pedido será revisado por nuestro equipo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="clienteNombre">Nombre / Empresa</Label>
              <Input
                id="clienteNombre"
                name="clienteNombre"
                placeholder="Nombre completo o razón social"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="clienteEmail">Email</Label>
                <Input
                  id="clienteEmail"
                  name="clienteEmail"
                  type="email"
                  placeholder="correo@ejemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clienteTelefono">Teléfono</Label>
                <Input
                  id="clienteTelefono"
                  name="clienteTelefono"
                  placeholder="Número de contacto"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Productos / Servicios</Label>

              <div className="flex gap-2">
                <button
                  type="button"
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${tipoFiltro === "PRODUCTO" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  onClick={() => setTipoFiltro("PRODUCTO")}
                >
                  Productos
                </button>
                <button
                  type="button"
                  className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${tipoFiltro === "SERVICIO" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                  onClick={() => setTipoFiltro("SERVICIO")}
                >
                  Servicios
                </button>
              </div>

              <MultiSelectCombobox
                catalogo={getCatalogo(tipoFiltro)}
                tipo={tipoFiltro}
                selectedIds={selectedIds}
                onToggle={handleToggleCatalogo}
              />

              {visibleItems.length > 0 && (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2 font-medium w-[90px]">Código</th>
                        <th className="text-left px-3 py-2 font-medium">Descripción</th>
                        <th className="text-left px-3 py-2 font-medium w-[90px]">Unidad</th>
                        <th className="text-left px-3 py-2 font-medium w-[90px]">Cantidad</th>
                        <th className="text-right px-3 py-2 font-medium w-[90px]">P. Ref.</th>
                        <th className="w-10" />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleItems.map((item) => (
                        <tr key={item.key} className="border-b last:border-0">
                          <td className="px-3 py-1.5 text-xs text-muted-foreground">
                            {item.codigo || "—"}
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              placeholder="Descripción del ítem"
                              value={item.descripcion}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((it) =>
                                    it.key === item.key ? { ...it, descripcion: e.target.value } : it
                                  )
                                )
                              }
                              className="h-9"
                              required
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              placeholder="UNIDAD"
                              value={item.unidadMedida}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((it) =>
                                    it.key === item.key ? { ...it, unidadMedida: e.target.value } : it
                                  )
                                )
                              }
                              className="h-9"
                              required
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              type="number"
                              placeholder="Cant."
                              min="0.01"
                              step="0.01"
                              value={item.cantidad}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((it) =>
                                    it.key === item.key ? { ...it, cantidad: e.target.value } : it
                                  )
                                )
                              }
                              className="h-9"
                              required
                            />
                          </td>
                          <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
                            {item.precioRef || ""}
                          </td>
                          <td className="px-1 py-1.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeItem(item.key)}
                            >
                              ✕
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <Button type="button" variant="outline" size="sm" onClick={addManualItem}>
                + Agregar ítem manual
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas (opcional)</Label>
              <Textarea
                id="notas"
                name="notas"
                placeholder="Información adicional..."
                rows={3}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Enviando..." : "Enviar Pedido"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
