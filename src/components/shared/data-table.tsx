"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"

export interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
  hideOnMobile?: boolean
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  onSearch?: (term: string) => void
  searchTerm?: string
  mobileCardTitle?: (item: T) => React.ReactNode
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading,
  searchable,
  searchPlaceholder = "Buscar...",
  onSearch,
  searchTerm,
  mobileCardTitle,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const pageSize = 10
  const totalPages = Math.ceil(data.length / pageSize)
  const paginated = data.slice((page - 1) * pageSize, page * pageSize)

  const desktopColumns = columns.filter((c) => !c.hideOnMobile)

  return (
    <div className="space-y-4">
      {searchable && (
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => onSearch?.(e.target.value)}
            className="pl-8"
          />
        </div>
      )}

      {/* Vista móvil: tarjetas */}
      <div className="space-y-3 md:hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : paginated.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No se encontraron registros</p>
        ) : (
          paginated.map((item, i) => (
            <div key={item.id || i} className="rounded-lg border bg-card p-4 space-y-2 shadow-sm">
              {mobileCardTitle && (
                <div className="font-semibold text-sm border-b pb-2 mb-2">{mobileCardTitle(item)}</div>
              )}
              {columns.map((col) => {
                if (col.hideOnMobile) return null
                const value = col.render ? col.render(item) : item[col.key] ?? "—"
                if (!value) return null
                return (
                  <div key={col.key} className="flex justify-between items-start gap-2 text-sm">
                    <span className="text-muted-foreground shrink-0">{col.header}:</span>
                    <span className="text-right">{value}</span>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </div>

      {/* Vista desktop: tabla */}
      <div className="rounded-md hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              {desktopColumns.map((col) => (
                <TableHead key={col.key} className={col.className}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={desktopColumns.length} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={desktopColumns.length} className="h-24 text-center text-muted-foreground">
                  No se encontraron registros
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((item, i) => (
                <TableRow key={item.id || i}>
                  {desktopColumns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.render ? col.render(item) : item[col.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
