"use client"

import { ToastProvider } from "@/components/ui/toaster"

export function ToastWrapper({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
