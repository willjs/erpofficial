import type { Metadata } from "next"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

export const metadata: Metadata = {
  title: "Orbys",
  description: "Sistema de gestión empresarial",
  icons: {
    icon: [
      { url: "/images/orbys_logo.png", sizes: "any", type: "image/png" },
    ],
    apple: "/images/orbys_logo.png",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
