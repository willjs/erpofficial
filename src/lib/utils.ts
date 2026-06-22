import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const currencyLocales: Record<string, string> = {
  COP: "es-CO",
  MXN: "es-MX",
  USD: "en-US",
  EUR: "de-DE",
}

export function formatMoney(amount: number | string, currency = "COP"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat(currencyLocales[currency] || "es-CO", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

export function serializar(obj: unknown): unknown {
  if (obj == null || typeof obj !== "object") return obj
  if (obj instanceof Date) return obj.toISOString()
  if (Array.isArray(obj)) return obj.map(serializar)
  if (typeof (obj as any).toNumber === "function") return Number(obj as any)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    result[key] = serializar(value)
  }
  return result
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-"
  try {
    const d = date instanceof Date ? date : new Date(date as any)
    if (!d || typeof d.getTime !== "function" || isNaN(d.getTime())) return "-"
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d)
  } catch {
    return "-"
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-"
  try {
    const d = date instanceof Date ? date : new Date(date as any)
    if (!d || typeof d.getTime !== "function" || isNaN(d.getTime())) return "-"
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return "-"
  }
}
