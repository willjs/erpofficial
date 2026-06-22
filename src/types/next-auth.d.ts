import "next-auth"

declare module "next-auth" {
  interface User {
    empresaId?: string
    empresas?: { id: string; nombre: string; rfc: string | null }[]
    roles?: string[]
    superAdmin?: boolean
  }
  interface Session {
    user: {
      id: string
      empresaId: string
      empresas: { id: string; nombre: string; rfc: string | null }[]
      roles: string[]
      superAdmin: boolean
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    empresaId: string
    empresas: { id: string; nombre: string; rfc: string | null }[]
    roles: string[]
    superAdmin: boolean
  }
}
