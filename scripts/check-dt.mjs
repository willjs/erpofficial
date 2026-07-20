import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const estados = await p.deliveryTicket.groupBy({ by: ['estado'], _count: true })
console.log('Estados:', JSON.stringify(estados))
const total = await p.deliveryTicket.count()
console.log('Total DTs:', total)
const facturas = await p.facturaDeliveryTicket.count()
console.log('Total Facturas:', facturas)
await p.$disconnect()
