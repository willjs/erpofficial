"use client"

import { useState, useEffect } from "react"
import { verificarPermisoSilenciosoAction } from "@/actions/permisos-modulo"

export function usePermiso(recurso: string, accion: string) {
  const [tienePermiso, setTienePermiso] = useState<boolean>(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    verificarPermisoSilenciosoAction(recurso, accion)
      .then((result) => {
        if (mounted) {
          setTienePermiso(result.tienePermiso)
          setLoading(false)
        }
      })
      .catch(() => {
        if (mounted) {
          setTienePermiso(false)
          setLoading(false)
        }
      })
    return () => { mounted = false }
  }, [recurso, accion])

  return { tienePermiso, loading }
}
