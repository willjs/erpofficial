import { NextResponse } from "next/server"

const swaggerSpec = {
  openapi: "3.0.3",
  info: {
    title: "FuelCore ERP — API REST para Power Automate",
    description:
      "API REST del ERP FuelCore para integración con Microsoft Power Automate. " +
      "Los endpoints están protegidos con JWT Bearer. " +
      "Primero obtén un token con POST /api/automation/token usando el código y token de la automatización.",
    version: "1.0.0",
  },
  servers: [{ url: "/", description: "FuelCore ERP" }],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT obtenido de POST /api/automation/token",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "string" },
        },
      },
      SuccessResponse: {
        type: "object",
        properties: {
          success: { type: "boolean", example: true },
          data: { type: "object" },
        },
      },
    },
  },
  paths: {
    "/api/automation/token": {
      post: {
        tags: ["Autenticación"],
        summary: "Obtener token JWT para automatizaciones",
        description:
          "Intercambia el código y token de una automatización por un JWT válido por 24 horas.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["codigo", "token"],
                properties: {
                  codigo: {
                    type: "string",
                    example: "REQUISICION_CREADA",
                    description: "Código de la automatización configurada en el ERP",
                  },
                  token: {
                    type: "string",
                    description: "Token de autenticación de la automatización",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Token JWT generado exitosamente",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", example: true },
                    token: { type: "string", description: "JWT válido por 24h" },
                    empresaId: { type: "string" },
                    expires_in: { type: "string", example: "24h" },
                  },
                },
              },
            },
          },
          "401": { description: "Credenciales inválidas", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/api/requisiciones/{id}": {
      get: {
        tags: ["Requisiciones"],
        summary: "Obtener detalle de una requisición",
        description: "Retorna la requisición con sus items, cotizaciones y órdenes de compra.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" }, description: "ID de la requisición" },
        ],
        responses: {
          "200": { description: "Requisición encontrada", content: { "application/json": { schema: { type: "object", properties: { success: { type: "boolean" }, data: { type: "object" } } } } } },
          "404": { description: "No encontrada" },
        },
      },
    },
    "/api/requisiciones/{id}/adjuntos": {
      get: {
        tags: ["Requisiciones"],
        summary: "Obtener adjuntos de una requisición",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Lista de archivos adjuntos" },
          "404": { description: "No encontrada" },
        },
      },
    },
    "/api/requisiciones/{id}/pdf": {
      get: {
        tags: ["Requisiciones"],
        summary: "Obtener datos para generar PDF de una requisición",
        description: "Retorna los datos estructurados de la requisición para que Power Automate genere el PDF.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: {
          "200": { description: "Datos de la requisición para PDF" },
          "404": { description: "No encontrada" },
        },
      },
    },
    "/api/requisiciones/{id}/aprobar": {
      put: {
        tags: ["Requisiciones"],
        summary: "Aprobar una requisición",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  observacion: { type: "string", description: "Observación de la aprobación" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Requisición aprobada" },
          "400": { description: "Estado inválido para aprobación" },
          "404": { description: "No encontrada" },
        },
      },
    },
    "/api/requisiciones/{id}/rechazar": {
      put: {
        tags: ["Requisiciones"],
        summary: "Rechazar una requisición",
        description: "Rechaza y cierra la requisición.",
        security: [{ BearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  observacion: { type: "string", description: "Motivo del rechazo" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Requisición rechazada y cerrada" },
          "400": { description: "Ya está cerrada" },
          "404": { description: "No encontrada" },
        },
      },
    },
  },
  tags: [
    { name: "Autenticación", description: "Obtención de tokens JWT" },
    { name: "Requisiciones", description: "API de requisiciones de compra" },
  ],
}

export async function GET() {
  return NextResponse.json(swaggerSpec)
}
