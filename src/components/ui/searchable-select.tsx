"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchableSelectProps {
  options: readonly string[]
  value?: string
  onValueChange: (value: string) => void
  name?: string
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  className?: string
  renderOption?: (option: string) => React.ReactNode
  renderValue?: (value: string) => React.ReactNode
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  name,
  placeholder = "Seleccionar...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Sin resultados",
  className,
  renderOption,
  renderValue,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const selectedRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search]
  )

  React.useEffect(() => {
    if (open) {
      setSearch("")
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  React.useEffect(() => {
    if (open && filtered.length > 0 && value && selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [open, filtered, value])

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler, true)
    return () => document.removeEventListener("mousedown", handler, true)
  }, [open])

  function select(option: string) {
    onValueChange(option)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false) }}
        className={cn(
          "relative flex h-[38px] w-full cursor-pointer items-center border px-[10px] text-left text-[13px] outline-none transition-colors select-none",
          "border-[#a0a0a0] bg-white hover:border-[#7a7a7a]",
          "focus-visible:border-[#4a90d9] focus-visible:shadow-[0_0_0_2px_rgba(74,144,217,0.3)]",
          value ? "text-[#222]" : "text-[#888]",
          className
        )}
        style={{ borderRadius: "0", fontFamily: "inherit", lineHeight: "1.4" }}
      >
        {value && renderValue ? (
          <span className="mr-[6px] flex items-center text-[15px] leading-none">{renderValue(value)}</span>
        ) : null}
        <span className="flex-1 truncate">{value || placeholder}</span>
        <svg
          className="pointer-events-none absolute right-[8px] top-1/2 h-4 w-4 -translate-y-1/2 text-[#555]"
          aria-hidden="true"
          viewBox="0 0 16 16"
        >
          <polyline
            points="3.5,6.5 8,11 12.5,6.5"
            strokeWidth="2"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 z-[200] mt-[1px] w-full border border-[#a0a0a0] bg-white shadow-lg"
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-center border-b border-[#e0e0e0] px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 text-[#888]" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              onKeyDown={(e) => {
                if (e.key === "Escape") { e.stopPropagation(); setOpen(false) }
              }}
              className="h-9 w-full border-0 bg-transparent px-0 text-[13px] outline-none placeholder:text-[#bbb]"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-[#888]">{emptyMessage}</div>
            ) : (
              filtered.map((option) => {
                const isSelected = value === option
                return (
                  <div
                    key={option}
                    ref={isSelected ? selectedRef : undefined}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(option)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(option) }
                    }}
                    tabIndex={0}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center gap-2 py-[7px] pl-[10px] pr-8 text-[13px] outline-none",
                      "hover:bg-[#e8f0fe]",
                      isSelected && "bg-[#e8f0fe]"
                    )}
                  >
                    <span className="flex-1 flex items-center gap-1.5">
                      {renderOption ? renderOption(option) : option}
                    </span>
                    {isSelected && (
                      <svg className="absolute right-2 h-4 w-4 text-[#1a73e8]" viewBox="0 0 16 16">
                        <polyline points="3.5,6.5 8,11 12.5,6.5" strokeWidth="2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
