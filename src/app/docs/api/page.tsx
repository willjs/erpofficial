"use client"

import { useEffect, useState } from "react"

export default function SwaggerDocsPage() {
  const [spec, setSpec] = useState<any>(null)

  useEffect(() => {
    fetch("/api/swagger")
      .then((r) => r.json())
      .then(setSpec)
      .catch(console.error)
  }, [])

  if (!spec) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Cargando documentación...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">FuelCore ERP — API REST Documentation</h1>
      <p className="text-muted-foreground mb-8">
        Documentación de los endpoints REST para integración con Microsoft Power Automate.
      </p>

      <div className="space-y-8">
        {spec.tags?.map((tag: any) => (
          <div key={tag.name}>
            <h2 className="text-xl font-semibold mb-4">{tag.name}</h2>
            <p className="text-sm text-muted-foreground mb-4">{tag.description}</p>

            {Object.entries(spec.paths || {})
              .filter(([_, methods]: [string, any]) =>
                Object.values(methods || {}).some((m: any) =>
                  m.tags?.includes(tag.name)
                )
              )
              .map(([path, methods]: [string, any]) =>
                Object.entries(methods)
                  .filter(([_, m]: [string, any]) => m.tags?.includes(tag.name))
                  .map(([method, operation]: [string, any]) => (
                    <div key={`${method}-${path}`} className="border rounded-lg p-4 mb-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span
                          className={`px-2 py-1 text-xs font-bold rounded ${
                            method === "get"
                              ? "bg-blue-100 text-blue-800"
                              : method === "post"
                              ? "bg-green-100 text-green-800"
                              : method === "put"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {method.toUpperCase()}
                        </span>
                        <code className="text-sm font-mono">{path}</code>
                      </div>
                      <p className="text-sm font-medium mb-1">{operation.summary}</p>
                      {operation.description && (
                        <p className="text-xs text-muted-foreground mb-2">{operation.description}</p>
                      )}
                      {operation.security && (
                        <p className="text-xs text-amber-600">🔒 Requiere Bearer Token</p>
                      )}
                    </div>
                  ))
              )}
          </div>
        ))}
      </div>
    </div>
  )
}
