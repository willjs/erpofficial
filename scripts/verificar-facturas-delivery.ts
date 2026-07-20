import { prisma } from "../src/lib/prisma"

async function verificarFacturas() {
    console.log("🔍 Verificando FacturaDeliveryTicket en la base de datos...\n")

    const facturas = await prisma.facturaDeliveryTicket.findMany({
        include: {
            deliveryTicket: {
                select: {
                    numero: true,
                    motonave: true,
                    estado: true,
                    empresa: { select: { nombre: true } },
                },
            },
        },
    })

    console.log(`📊 Total FacturaDeliveryTicket: ${facturas.length}\n`)

    if (facturas.length === 0) {
        console.log("⚠️  No hay facturas registradas")
        await prisma.$disconnect()
        return
    }

    facturas.forEach((f, i) => {
        console.log(`${i + 1}. DT #${f.deliveryTicket.numero} - ${f.deliveryTicket.motonave}`)
        console.log(`   Empresa: ${f.deliveryTicket.empresa.nombre}`)
        console.log(`   Valor: $${Number(f.valor).toFixed(2)}`)
        console.log(`   Estado: ${f.estado}`)
        console.log(`   Número Factura: ${f.numeroFactura}`)
        console.log(`   Observaciones: ${f.observaciones || "N/A"}`)
        console.log()
    })

    await prisma.$disconnect()
}

verificarFacturas().catch((error) => {
    console.error("❌ Error:", error)
    process.exit(1)
})