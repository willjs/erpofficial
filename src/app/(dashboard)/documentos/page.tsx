"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card } from "@/components/ui/card"
import { FormDialog } from "@/components/shared/form-dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate, formatDateTime } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import type {
  CarpetaTreeNode,
  BreadcrumbItem,
  FolderContent,
} from "@/actions/documentos"
import {
  getCarpetaTree,
  getBreadcrumb,
  getFolderContent,
  createCarpeta,
  updateCarpeta,
  deleteCarpeta,
  createDocumento,
  deleteDocumento,
} from "@/actions/documentos"
import {
  Folder,
  File,
  FileText,
  ImageIcon,
  FileSpreadsheet,
  FileArchive,
  Search,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  Upload,
  FolderPlus,
  Loader2,
  Home,
  AlertTriangle,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function getFileIcon(tipo: string) {
  const t = tipo.toLowerCase()
  if (["jpg", "jpeg", "png", "gif", "svg", "webp", "bmp"].includes(t))
    return <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
  if (["pdf"].includes(t))
    return <FileText className="h-4 w-4 shrink-0 text-red-500" />
  if (["xls", "xlsx", "csv"].includes(t))
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-green-600" />
  if (["zip", "rar", "7z", "tar", "gz"].includes(t))
    return <FileArchive className="h-4 w-4 shrink-0 text-amber-600" />
  if (["doc", "docx"].includes(t))
    return <FileText className="h-4 w-4 shrink-0 text-blue-700" />
  return <File className="h-4 w-4 shrink-0 text-muted-foreground" />
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function FolderTreeItem({
  node,
  currentFolderId,
  onSelect,
  depth = 0,
}: {
  node: CarpetaTreeNode
  currentFolderId: string | null
  onSelect: (id: string) => void
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 1)
  const isActive = currentFolderId === node.id
  const hasHijos = node.hijos.length > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelect(node.id)
          setExpanded(true)
        }}
        className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent ${
          isActive ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasHijos ? (
          <span
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            className="shrink-0"
          >
            {expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <Folder className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-amber-500"}`} />
        <span className="truncate">{node.nombre}</span>
      </button>
      {expanded &&
        hasHijos &&
        node.hijos.map((hijo) => (
          <FolderTreeItem
            key={hijo.id}
            node={hijo}
            currentFolderId={currentFolderId}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

function getDocumentTypeLabel(tipo: string) {
  return tipo.toUpperCase()
}

export default function DocumentosPage() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<CarpetaTreeNode[]>([])
  const [breadcrumb, setBreadcrumb] = useState<BreadcrumbItem[]>([
    { id: null, nombre: "Inicio" },
  ])
  const [carpetas, setCarpetas] = useState<FolderContent["carpetas"]>([])
  const [documentos, setDocumentos] = useState<FolderContent["documentos"]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [loading, setLoading] = useState(true)

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<{
    id: string
    nombre: string
  } | null>(null)
  const [renameName, setRenameName] = useState("")

  const [createDocOpen, setCreateDocOpen] = useState(false)
  const [docForm, setDocForm] = useState({
    nombre: "",
    tipo: "pdf",
  })

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    type: "carpeta" | "documento"
    nombre: string
  } | null>(null)

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const { toast } = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [tree, content, bc] = await Promise.all([
        getCarpetaTree(),
        getFolderContent(currentFolderId, searchTerm || undefined),
        getBreadcrumb(currentFolderId),
      ])
      setFolderTree(tree)
      setCarpetas(content.carpetas)
      setDocumentos(content.documentos)
      setBreadcrumb(bc)
    } catch (err) {
      toast({
        title: "Error al cargar documentos",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [currentFolderId, searchTerm])

  useEffect(() => {
    loadData()
  }, [loadData])

  const navigateToFolder = (id: string | null) => {
    setCurrentFolderId(id)
    setSearchTerm("")
  }

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)
    try {
      const form = new FormData()
      form.set("nombre", newFolderName)
      form.set("padreId", currentFolderId ?? "")
      const result = await createCarpeta(form)
      if (result?.error) {
        setActionError(result.error)
        toast({ title: "Error", description: result.error, variant: "destructive" })
        return
      }
      toast({ title: "Carpeta creada", variant: "success" })
      setCreateFolderOpen(false)
      setNewFolderName("")
      loadData()
    } catch (err) {
      toast({ title: "Error al crear carpeta", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRenameFolder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!renameTarget) return
    setActionLoading(true)
    setActionError(null)
    try {
      const form = new FormData()
      form.set("id", renameTarget.id)
      form.set("nombre", renameName)
      const result = await updateCarpeta(form)
      if (result?.error) {
        setActionError(result.error)
        toast({ title: "Error", description: result.error, variant: "destructive" })
        return
      }
      toast({ title: "Carpeta renombrada", variant: "success" })
      setRenameOpen(false)
      setRenameTarget(null)
      loadData()
    } catch (err) {
      toast({ title: "Error al renombrar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setActionLoading(true)
    setActionError(null)
    try {
      const result =
        deleteTarget.type === "carpeta"
          ? await deleteCarpeta(deleteTarget.id)
          : await deleteDocumento(deleteTarget.id)
      if (result?.error) {
        setActionError(result.error)
        toast({ title: "Error", description: result.error, variant: "destructive" })
        return
      }
      toast({ title: deleteTarget.type === "carpeta" ? "Carpeta eliminada" : "Documento eliminado", variant: "success" })
      setDeleteOpen(false)
      const targetId = deleteTarget.id
      const targetType = deleteTarget.type
      setDeleteTarget(null)
      if (targetType === "carpeta" && currentFolderId === targetId) {
        navigateToFolder(null)
      } else {
        loadData()
      }
    } catch (err) {
      toast({ title: "Error al eliminar", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const handleCreateDocument = async (e: React.FormEvent) => {
    e.preventDefault()
    setActionLoading(true)
    setActionError(null)
    try {
      const simSize = Math.floor(Math.random() * 5000) + 50
      const simUrl = `/uploads/${Date.now()}_${docForm.nombre.replace(/\s+/g, "_")}.${docForm.tipo}`
      const form = new FormData()
      form.set("nombre", docForm.nombre)
      form.set("tipo", docForm.tipo)
      form.set("tamaño", String(simSize))
      form.set("url", simUrl)
      form.set("carpetaId", currentFolderId ?? "")
      form.set("empleadoId", "")
      const result = await createDocumento(form)
      if (result?.error) {
        setActionError(result.error)
        toast({ title: "Error", description: result.error, variant: "destructive" })
        return
      }
      toast({ title: "Documento subido", variant: "success" })
      setCreateDocOpen(false)
      setDocForm({ nombre: "", tipo: "pdf" })
      loadData()
    } catch (err) {
      toast({ title: "Error al subir documento", description: err instanceof Error ? err.message : "Error desconocido", variant: "destructive" })
    } finally {
      setActionLoading(false)
    }
  }

  const openRename = (item: { id: string; nombre: string }) => {
    setRenameTarget(item)
    setRenameName(item.nombre)
    setRenameOpen(true)
    setActionError(null)
  }

  const openDelete = (item: { id: string; type: "carpeta" | "documento"; nombre: string }) => {
    setDeleteTarget(item)
    setDeleteOpen(true)
    setActionError(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documentos</h1>
          <p className="text-muted-foreground">Gestión documental y archivos</p>
        </div>
      </div>

      <div className="flex gap-6">
        <Card className="hidden w-64 shrink-0 md:block">
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                CARPETAS
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigateToFolder(null)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent ${
                currentFolderId === null
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <Home className="h-4 w-4" />
              <span>Inicio</span>
            </button>
            <Separator className="my-2" />
            <div className="space-y-0.5">
              {folderTree.length === 0 && (
                <p className="px-2 text-xs text-muted-foreground">
                  Sin carpetas
                </p>
              )}
              {folderTree.map((node) => (
                <FolderTreeItem
                  key={node.id}
                  node={node}
                  currentFolderId={currentFolderId}
                  onSelect={(id) => navigateToFolder(id)}
                  depth={0}
                />
              ))}
            </div>
          </div>
        </Card>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {breadcrumb.map((item, i) => (
              <span key={item.id ?? "root"} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
                {item.id !== null ? (
                  <button
                    type="button"
                    onClick={() => navigateToFolder(item.id)}
                    className="hover:text-foreground"
                  >
                    {item.nombre}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigateToFolder(null)}
                    className="hover:text-foreground"
                  >
                    {item.nombre}
                  </button>
                )}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar documentos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewFolderName("")
                setActionError(null)
                setCreateFolderOpen(true)
              }}
            >
              <FolderPlus className="mr-1.5 h-4 w-4" />
              Nueva carpeta
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setDocForm({ nombre: "", tipo: "pdf" })
                setActionError(null)
                setCreateDocOpen(true)
              }}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              Subir documento
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : carpetas.length === 0 && documentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <Folder className="h-12 w-12" />
              <p className="text-sm">Esta carpeta está vacía</p>
              <p className="text-xs">
                Cree una carpeta o suba un documento para comenzar
              </p>
            </div>
          ) : (
            <Card>
              <div className="divide-y">
                {carpetas.map((c) => (
                  <div
                    key={c.id}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  >
                    <button
                      type="button"
                      onClick={() => navigateToFolder(c.id)}
                      className="flex flex-1 items-center gap-3 text-left"
                    >
                      <Folder className="h-5 w-5 shrink-0 text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {c.nombre}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Creado {formatDate(c.createdAt)}
                        </p>
                      </div>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => openRename({ id: c.id, nombre: c.nombre })}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Renombrar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            openDelete({
                              id: c.id,
                              type: "carpeta",
                              nombre: c.nombre,
                            })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {carpetas.length > 0 && documentos.length > 0 && (
                  <Separator />
                )}
                {documentos.map((d) => (
                  <div
                    key={d.id}
                    className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex flex-1 items-center gap-3">
                      {getFileIcon(d.tipo)}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">
                            {d.nombre}
                          </p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            v{d.version}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium uppercase">
                            {getDocumentTypeLabel(d.tipo)}
                          </span>
                          <span>{formatFileSize(d.tamaño)}</span>
                          <span>{formatDateTime(d.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(d.url, "_blank")
                          }
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Ver documento
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() =>
                            openDelete({
                              id: d.id,
                              type: "documento",
                              nombre: d.nombre,
                            })
                          }
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      <FormDialog
        open={createFolderOpen}
        onOpenChange={(o) => {
          setCreateFolderOpen(o)
          if (!o) setActionError(null)
        }}
        title="Nueva carpeta"
        onSubmit={handleCreateFolder as unknown as () => void}
        loading={actionLoading}
        submitLabel="Crear"
      >
        <div className="space-y-2">
          <Label htmlFor="folder-name">Nombre de la carpeta</Label>
          <Input
            id="folder-name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Ej: Facturas 2024"
            autoFocus
            required
          />
        </div>
        {actionError && (
          <p className="text-sm text-destructive">{actionError}</p>
        )}
      </FormDialog>

      <FormDialog
        open={renameOpen}
        onOpenChange={(o) => {
          setRenameOpen(o)
          if (!o) setActionError(null)
        }}
        title="Renombrar carpeta"
        onSubmit={handleRenameFolder as unknown as () => void}
        loading={actionLoading}
        submitLabel="Guardar"
      >
        <div className="space-y-2">
          <Label htmlFor="rename-name">Nuevo nombre</Label>
          <Input
            id="rename-name"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            autoFocus
            required
          />
        </div>
        {actionError && (
          <p className="text-sm text-destructive">{actionError}</p>
        )}
      </FormDialog>

      <FormDialog
        open={createDocOpen}
        onOpenChange={(o) => {
          setCreateDocOpen(o)
          if (!o) setActionError(null)
        }}
        title="Subir documento"
        description="Complete los datos del documento (simulación)"
        onSubmit={handleCreateDocument as unknown as () => void}
        loading={actionLoading}
        submitLabel="Subir"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-name">Nombre del archivo</Label>
            <Input
              id="doc-name"
              value={docForm.nombre}
              onChange={(e) =>
                setDocForm((prev) => ({ ...prev, nombre: e.target.value }))
              }
              placeholder="Ej: Reporte mensual"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-type">Tipo de archivo</Label>
            <Select
              value={docForm.tipo}
              onValueChange={(v) =>
                setDocForm((prev) => ({ ...prev, tipo: v }))
              }
            >
              <SelectTrigger id="doc-type">
                <SelectValue placeholder="Seleccione un tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">Word (DOCX)</SelectItem>
                <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                <SelectItem value="jpg">Imagen (JPG)</SelectItem>
                <SelectItem value="png">Imagen (PNG)</SelectItem>
                <SelectItem value="zip">Archivo (ZIP)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {actionError && (
          <p className="text-sm text-destructive">{actionError}</p>
        )}
      </FormDialog>

      <FormDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o)
          if (!o) setActionError(null)
        }}
        title="Confirmar eliminación"
        onSubmit={handleDelete}
        loading={actionLoading}
        submitLabel="Eliminar"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <p className="text-sm">
              ¿Está seguro de eliminar{" "}
              <strong>
                {deleteTarget?.type === "carpeta" ? "la carpeta" : "el documento"}
              </strong>{" "}
              <strong>&quot;{deleteTarget?.nombre}&quot;</strong>?
            </p>
            {deleteTarget?.type === "carpeta" && (
              <p className="mt-1 text-xs text-muted-foreground">
                La carpeta debe estar vacía para poder eliminarla.
              </p>
            )}
          </div>
        </div>
        {actionError && (
          <p className="text-sm text-destructive">{actionError}</p>
        )}
      </FormDialog>
    </div>
  )
}
