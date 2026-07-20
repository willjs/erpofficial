"use client"

import { useActionState, useState, useEffect } from "react"
import { login } from "@/actions/auth"
import type { LoginState } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2 } from "lucide-react"

interface EmpresaPublic {
  id: string
  nombre: string
  logo: string | null
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(
    async (prev: LoginState, form: FormData) => login(prev, form),
    undefined
  )
  const [empresas, setEmpresas] = useState<EmpresaPublic[]>([])
  const [empresaSeleccionada, setEmpresaSeleccionada] = useState<string>("")
  const [logoActual, setLogoActual] = useState<string>("/images/orbys_logo.png")

  useEffect(() => {
    fetch("/api/empresas/public")
      .then((r) => r.json())
      .then((data: EmpresaPublic[]) => {
        setEmpresas(data)
        if (data.length === 1) {
          setEmpresaSeleccionada(data[0].id)
          if (data[0].logo) setLogoActual(data[0].logo)
        }
      })
      .catch(() => {})
  }, [])

  function handleEmpresaChange(value: string) {
    setEmpresaSeleccionada(value)
    const emp = empresas.find((e) => e.id === value)
    if (emp?.logo) {
      setLogoActual(emp.logo)
    } else {
      setLogoActual("/images/orbys_logo.png")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src={logoActual}
            alt="Logo"
            className="mx-auto mb-2"
            style={{ width: "72px", height: "auto" }}
            onError={(e) => { (e.target as HTMLImageElement).src = "/images/orbys_logo.png" }}
          />
          <CardDescription>Inicia sesión para acceder al sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" placeholder="correo@empresa.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" placeholder="••••••••" required />
            </div>
            {state?.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Iniciando sesión..." : "Iniciar Sesión"}
            </Button>
            {empresas.length > 1 && (
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Empresa</Label>
                <Select value={empresaSeleccionada} onValueChange={handleEmpresaChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        <span className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {e.nombre}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <input type="hidden" name="empresaId" value={empresaSeleccionada} />
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <a href="/solicitar-requisicion" className="font-medium text-primary hover:underline">
              Solicitar requisición
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
