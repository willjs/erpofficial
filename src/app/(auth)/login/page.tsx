"use client"

import { useActionState } from "react"
import { login } from "@/actions/auth"
import type { LoginState } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const [state, action, pending] = useActionState(
    async (prev: LoginState, form: FormData) => login(prev, form),
    undefined
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">OficinaApp</CardTitle>
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
