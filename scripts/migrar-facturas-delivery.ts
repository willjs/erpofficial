import { prisma } from "../src/lib/prisma"

async function migrarFacturasDelivery() {
    console.log("🔍 Buscando Delivery Tickets cerrados sin FacturaDeliveryTicket...\n")

    // Buscar todos los DTs cerrados
    const dtsCerrados = await prisma.deliveryTicket.findMany({
        where: { estado: "CERRADO" },
        include: {
            producto: true,
            cliente: true,
            facturas: true,
            empresa: { select: { id: true, nombre: true } },
        },
    })

    console.log(`📊 Total DTs cerrados encontrados: ${dtsCerrados.length}`)

    // Filtrar los que no tienen factura
    const sinFactura = dtsCerrados.filter((dt) => dt.facturas.length === 0)

    console.log(`⚠️  DTs sin FacturaDeliveryTicket: ${sinFactura.length}\n`)

    if (sinFactura.length === 0) {
        console.log("✅ Todos los DTs cerrados ya tienen su FacturaDeliveryTicket")
        await prisma.$disconnect()
        return
    }

    let creados = 0
    let errores = 0

    for (const dt of sinFactura) {
        try {
            // Calcular el valor total (cantidad * precio unitario)
            const cantidad = Number(dt.cantidadEntregada)
            const precioUnitario = Number(dt.producto.precioUnitario ?? 0)
            const totalVenta = cantidad * precioUnitario

            // Crear la FacturaDeliveryTicket
            await prisma.facturaDeliveryTicket.create({
                data: {
                    empresaId: dt.empresaId,
                    deliveryTicketId: dt.id,
                    numeroFactura: `DT #${dt.numero}`,
                    valor: totalVenta,
                    documentoUrl: null,
                    comprobanteUrl: null,
                    estado: "PENDIENTE",
                    observaciones: `Migrado desde DT #${dt.numero} - ${dt.motonave}`,
                },
            })

            creados++
            console.log(`✅ [${creados}/${sinFactura.length}] DT #${dt.numero} (${dt.empresa.nombre}) → Factura creada por $${totalVenta.toFixed(2)}`)
        } catch (error) {
            errores++
            console.error(`❌ Error en DT #${dt.numero}:`, error)
        }
    }

    console.log(`\n📈 Resumen:`)
    console.log(`   ✅ Creadas: ${creados}`)
    console.log(`   ❌ Errores: ${errores}`)
    console.log(`   ⏭️  Ya existían: ${dtsCerrados.length - sinFactura.length}`)

    await prisma.$disconnect()
}

migrarFacturasDelivery().catch((error) => {
    console.error("❌ Error fatal:", error)
    process.exit(1)
})