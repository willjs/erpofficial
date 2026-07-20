"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { verificarAccesoModulo } from "@/actions/permisos-modulo"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ShieldAlert } from "lucide-react"

export function PermissionGuard({
  modulo,
  children,
}: {
  modulo: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  useEffect(() => {
    verificarAccesoModulo(modulo)
      .then((res) => {
        if (!res.permitido) {
          setOpen(true)
        }
        setChecking(false)
      })
      .catch(() => {
        setOpen(true)
        setChecking(false)
      })
  }, [modulo])

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (open) {
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setOpen(false); router.push("/") } }}>
        <DialogContent className="sm:max-w-md text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl">Acceso restringido</DialogTitle>
              <DialogDescription className="text-base">
                Usuario no permitido para este módulo
              </DialogDescription>
            </DialogHeader>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return <>{children}</>
}
