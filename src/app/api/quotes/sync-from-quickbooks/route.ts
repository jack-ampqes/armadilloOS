import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { queryEstimates } from '@/lib/quickbooks'
import { mapQuickBooksEstimateToQuote } from '@/lib/quote-quickbooks'
import { generateQuoteNumber } from '@/lib/quote-number'

const prisma = new PrismaClient()

/** POST /api/quotes/sync-from-quickbooks — fetch QB estimates and upsert local quotes. */
export async function POST(request: NextRequest) {
  try {
    const creds = await getDefaultQuickBooksCredentials()
    const estimates = await queryEstimates(creds, { maxResults: 100 })

    let created = 0
    let updated = 0
    const errors: string[] = []

    for (const qb of estimates) {
      try {
        const mapped = mapQuickBooksEstimateToQuote(qb)
        const quoteNumber = mapped.quoteNumber.startsWith('QB-') ? await generateQuoteNumber(prisma) : mapped.quoteNumber

        const existing = await prisma.quote.findFirst({
          where: { quickbooksEstimateId: qb.Id },
          include: { quoteItems: true },
        })

        if (existing) {
          await prisma.quoteItem.deleteMany({ where: { quoteId: existing.id } })
          await prisma.quote.update({
            where: { id: existing.id },
            data: {
              quoteNumber: existing.quoteNumber,
              status: mapped.status,
              customerName: mapped.customerName,
              customerEmail: mapped.customerEmail,
              customerPhone: mapped.customerPhone,
              customerAddress: mapped.customerAddress,
              customerCity: mapped.customerCity,
              customerState: mapped.customerState,
              customerZip: mapped.customerZip,
              customerCountry: mapped.customerCountry,
              subtotal: mapped.subtotal,
              discountType: mapped.discountType,
              discountValue: mapped.discountValue,
              discountAmount: mapped.discountAmount,
              total: mapped.total,
              validUntil: mapped.validUntil ? new Date(mapped.validUntil) : null,
              notes: mapped.notes,
              quickbooksSyncedAt: new Date(),
              quoteItems: {
                create: mapped.quoteItems.map((item) => ({
                  productName: item.productName,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                })),
              },
            },
          })
          updated += 1
        } else {
          const conflict = await prisma.quote.findUnique({ where: { quoteNumber: mapped.quoteNumber } })
          const finalQuoteNumber = conflict ? await generateQuoteNumber(prisma) : mapped.quoteNumber

          await prisma.quote.create({
            data: {
              quoteNumber: finalQuoteNumber,
              status: mapped.status,
              customerName: mapped.customerName,
              customerEmail: mapped.customerEmail,
              customerPhone: mapped.customerPhone,
              customerAddress: mapped.customerAddress,
              customerCity: mapped.customerCity,
              customerState: mapped.customerState,
              customerZip: mapped.customerZip,
              customerCountry: mapped.customerCountry,
              subtotal: mapped.subtotal,
              discountType: mapped.discountType,
              discountValue: mapped.discountValue,
              discountAmount: mapped.discountAmount,
              total: mapped.total,
              validUntil: mapped.validUntil ? new Date(mapped.validUntil) : null,
              notes: mapped.notes,
              quickbooksEstimateId: qb.Id,
              quickbooksSyncedAt: new Date(),
              quoteItems: {
                create: mapped.quoteItems.map((item) => ({
                  productName: item.productName,
                  sku: item.sku,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  totalPrice: item.totalPrice,
                })),
              },
            },
          })
          created += 1
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errors.push(`Estimate ${qb.Id}: ${msg}`)
      }
    }

    return NextResponse.json({
      ok: true,
      created,
      updated,
      total: estimates.length,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to sync from QuickBooks'
    const isConfig = message.includes('not configured') || message.includes('Reconnect') || message.includes('QuickBooks')
    return NextResponse.json(
      { ok: false, error: message, created: 0, updated: 0 },
      { status: isConfig ? 401 : 502 }
    )
  }
}
