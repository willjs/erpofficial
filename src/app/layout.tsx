import type { Metadata } from "next"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

export const metadata: Metadata = {
  title: "OficinaApp - Sistema de Gestión Empresarial",
  description: "Plataforma integral para la administración de oficina",
  icons: {
    icon: [
      { url: "/images/favicon.ico", sizes: "any" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/images/apple-touch-icon.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
