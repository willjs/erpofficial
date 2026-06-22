import { useState, useCallback, createContext, useContext } from "react"

export interface Toast {
  id: string
  title: string
  description?: string
  variant?: "default" | "destructive" | "success"
}

export interface ToastContextType {
  toasts: Toast[]
  toast: (t: Omit<Toast, "id">) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    return {
      toasts: [] as Toast[],
      toast: (_: Omit<Toast, "id">) => {},
      dismiss: (_: string) => {},
    }
  }
  return ctx
}

export function useToastState() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...t, id }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id))
    }, 4000)
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  return { toasts, toast, dismiss }
}
