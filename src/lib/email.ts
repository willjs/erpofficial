import nodemailer from "nodemailer"

function getTransporter() {
  const host = process.env.SMTP_HOST
  if (!host) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER ?? "",
      pass: process.env.SMTP_PASS ?? "",
    },
  })
}

export async function enviarCorreo({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  const transporter = getTransporter()
  if (!transporter) {
    console.warn("SMTP no configurado. Define SMTP_HOST en .env")
    return { success: false, error: "SMTP no configurado" }
  }
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"Oficina App" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    return { success: true }
  } catch (err) {
    console.error("Error enviando correo:", err)
    return { success: false, error: err instanceof Error ? err.message : "Error al enviar" }
  }
}
