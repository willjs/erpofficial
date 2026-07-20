"use client"

import * as React from "react"
import { cn, formatMoney } from "@/lib/utils"

interface MoneyInputProps {
  value: number
  onChange: (value: number) => void
  className?: string
  placeholder?: string
}

export function MoneyInput({ value, onChange, className, placeholder }: MoneyInputProps) {
  const [focused, setFocused] = React.useState(false)
  const [raw, setRaw] = React.useState("")

  const displayValue = focused ? raw : (value === 0 ? "" : formatMoney(value))

  const handleFocus = () => {
    setFocused(true)
    setRaw(value === 0 ? "" : String(value))
  }

  const handleBlur = () => {
    setFocused(false)
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed >= 0) {
      onChange(parsed)
    }
    setRaw("")
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (/^\d*\.?\d*$/.test(val)) {
      setRaw(val)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      ;(e.target as HTMLInputElement).blur()
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || "$ 0,00"}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-right",
          className
        )}
      />
    </div>
  )
}
