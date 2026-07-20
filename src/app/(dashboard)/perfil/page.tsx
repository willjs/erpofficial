"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Save, User, Mail, Shield, Building, Briefcase, Camera, Trash2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { getPerfil, updatePerfil, uploadAvatar, removeAvatar, type PerfilFormData } from "@/actions/perfil"

export default function PerfilPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, update } = useSession()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<PerfilFormData>({ nombre: "", apellido: "", email: "", password: "" })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getPerfil()
      setPerfil(data)
      setForm({ nombre: data.nombre, apellido: data.apellido || "", email: data.email, password: "" })
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al cargar perfil", variant: "destructive" })
      router.push("/login")
    } finally {
      setLoading(false)
    }
  }, [toast, router])

  useEffect(() => { load() }, [load])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    try {
      const result = await updatePerfil({
        nombre: form.nombre,
        apellido: form.apellido,
        email: form.email,
        password: form.password || undefined,
      })
      if (result.success) {
        toast({ title: "Perfil actualizado", variant: "success" })
        setEditMode(false)
        setForm((prev) => ({ ...prev, password: "" }))
        load()
        await update()
      }
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al actualizar", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast({ title: "Error", description: "Solo se permiten imágenes", variant: "destructive" })
      return
    }

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1]
        await uploadAvatar(base64)
        toast({ title: "Foto actualizada", variant: "success" })
        load()
        await update()
      }
      reader.readAsDataURL(file)
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Error al subir foto", variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveAvatar() {
    try {
      await removeAvatar()
      toast({ title: "Foto eliminada", variant: "success" })
      load()
      await update()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "", variant: "destructive" })
    }
  }

  const initials = perfil
    ? `${perfil.nombre?.charAt(0) || ""}${perfil.apellido?.charAt(0) || ""}`.toUpperCase() || "U"
    : "U"

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!perfil) return null

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mi Perfil"
        description="Información personal de la cuenta"
        actions={
          !editMode ? (
            <Button onClick={() => setEditMode(true)}>Editar Perfil</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setEditMode(false); setForm({ nombre: perfil.nombre, apellido: perfil.apellido || "", email: perfil.email, password: "" }) }}>
                Cancelar
              </Button>
              <Button form="perfil-form" type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4">
                <div className="relative group">
                  <Avatar className="h-28 w-28">
                    <AvatarImage src={perfil.avatar || undefined} />
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="text-white h-full w-full" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                      <Camera className="h-6 w-6" />
                    </Button>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                <div className="text-center">
                  <p className="font-medium text-lg">{form.nombre} {form.apellido}</p>
                  <p className="text-sm text-muted-foreground">{perfil.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Camera className="h-4 w-4 mr-1" />}
                    Cambiar foto
                  </Button>
                  {perfil.avatar && (
                    <Button variant="outline" size="sm" onClick={handleRemoveAvatar}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {perfil.roles?.length > 0 ? (
                  perfil.roles.map((rol: string) => (
                    <Badge key={rol} variant="secondary">{rol}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">Sin roles asignados</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building className="h-4 w-4" />
                Empresa activa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{perfil.empresaNombre || "Sin empresa"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                Empresas vinculadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm space-y-1">
                {perfil.empresas?.map((emp: any) => (
                  <li key={emp.id}>{emp.nombre}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Datos personales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form id="perfil-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={form.nombre}
                    onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                    disabled={!editMode}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apellido">Apellido</Label>
                  <Input
                    id="apellido"
                    value={form.apellido}
                    onChange={(e) => setForm((p) => ({ ...p, apellido: e.target.value }))}
                    disabled={!editMode}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  disabled={!editMode}
                  required
                />
              </div>
              {editMode && (
                <div className="space-y-2">
                  <Label htmlFor="password">Nueva contraseña (dejar vacío para mantener actual)</Label>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                    placeholder="••••••••"
                  />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
