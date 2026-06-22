import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { PrismaAdapter } from "@auth/prisma-adapter"
import bcrypt from "bcryptjs"
import { prisma } from "./prisma"

async function getEmpresasInfo(usuarioId: string) {
  const userEmpresas = await prisma.usuarioEmpresa.findMany({
    where: { usuarioId },
    include: { empresa: { select: { id: true, nombre: true, rfc: true } } },
  })
  return userEmpresas.map((ue) => ue.empresa)
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.usuario.findUnique({
          where: { email: credentials.email as string },
          include: {
            roles: {
              include: {
                rol: true,
              },
            },
          },
        })

        if (!user || !user.activo) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )

        if (!passwordMatch) return null

        // Si es super admin o no tiene UsuarioEmpresa registrado,
        // usar empresaId directo como fallback
        let empresas = await getEmpresasInfo(user.id)
        if (empresas.length === 0 && user.empresaId) {
          const emp = await prisma.empresa.findUnique({ where: { id: user.empresaId } })
          if (emp) empresas = [emp]
        }

        // Obtener modulosActivos de la empresa activa
        const empresaActivaId = user.empresaActivaId ?? user.empresaId ?? empresas[0]?.id
        let modulosActivos: string[] = []
        if (empresaActivaId) {
          const emp = await prisma.empresa.findUnique({ where: { id: empresaActivaId }, select: { modulosActivos: true } })
          if (emp?.modulosActivos) {
            modulosActivos = emp.modulosActivos.replace(/[\[\]"]/g, "").split(",").filter(Boolean).map(s => s.trim())
          }
        }

        return {
          id: user.id,
          email: user.email,
          name: `${user.nombre} ${user.apellido || ""}`,
          empresaId: empresaActivaId,
          empresas: empresas.map((e) => ({ id: e.id, nombre: e.nombre, rfc: e.rfc })),
          modulosActivos,
          roles: user.roles.map((r) => r.rol.nombre),
          superAdmin: user.superAdmin,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.empresaId = (user as any).empresaId
        token.empresas = (user as any).empresas
        token.modulosActivos = (user as any).modulosActivos
        token.roles = (user as any).roles
        token.superAdmin = (user as any).superAdmin
      }
      // Refrescar empresas + modulosActivos desde DB en cada update
      if (trigger === "update") {
        const userId = token.id as string
        const empresaId = session?.empresaId || (token.empresaId as string)

        // Refrescar lista de empresas del usuario
        const userEmpresas = await prisma.usuarioEmpresa.findMany({
          where: { usuarioId: userId },
          include: { empresa: { select: { id: true, nombre: true, rfc: true } } },
        })
        token.empresas = userEmpresas.map((ue) => ({ id: ue.empresa.id, nombre: ue.empresa.nombre, rfc: ue.empresa.rfc }))

        if (empresaId) {
          token.empresaId = session?.empresaId || token.empresaId
          const emp = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { modulosActivos: true } })
          if (emp?.modulosActivos) {
            token.modulosActivos = emp.modulosActivos.replace(/[\[\]"]/g, "").split(",").filter(Boolean).map(s => s.trim())
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        ;(session.user as any).empresaId = token.empresaId
        ;(session.user as any).empresas = token.empresas
        ;(session.user as any).modulosActivos = token.modulosActivos
        ;(session.user as any).roles = token.roles
        ;(session.user as any).superAdmin = token.superAdmin
      }
      return session
    },
  },
})
