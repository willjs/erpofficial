"use client"

import { ToastContext, useToastState } from "@/components/ui/use-toast"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { toasts, toast, dismiss } = useToastState()

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <ToasterItems toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToasterItems({ toasts, dismiss }: { toasts: { id: string; title: string; description?: string; variant?: string }[]; dismiss: (id: string) => void }) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "rounded-lg border px-4 py-3 shadow-lg text-sm flex items-start gap-3 animate-in slide-in-from-right",
            t.variant === "destructive" && "bg-destructive text-destructive-foreground border-destructive",
            t.variant === "success" && "bg-green-600 text-white border-green-700",
            (!t.variant || t.variant === "default") && "bg-background text-foreground border-border",
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium">{t.title}</p>
            {t.description && <p className="text-xs opacity-90 mt-0.5">{t.description}</p>}
          </div>
          <button type="button" onClick={() => dismiss(t.id)} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
