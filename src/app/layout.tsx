import type { Metadata } from "next"
import { SessionProvider } from "next-auth/react"
import "./globals.css"

export const metadata: Metadata = {
  title: "C.I. International Fuels",
  description: "Sistema de gestión empresarial",
  icons: {
    icon: [
      { url: "/images/favicon.ico", sizes: "any" },
      { url: "/images/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/images/favicon-32x32.png",
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
