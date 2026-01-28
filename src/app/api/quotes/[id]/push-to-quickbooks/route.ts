import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { pushQuoteToQuickBooks } from '@/lib/quote-quickbooks'

const prisma = new PrismaClient()

/** POST /api/quotes/[id]/push-to-quickbooks — push this quote to QuickBooks (create or update estimate). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const quote = await prisma.quote.findUnique({
      where: { id },
      include: { quoteItems: true },
    })
    if (!quote) {
      return NextResponse.json({ ok: false, error: 'Quote not found' }, { status: 404 })
    }

    const creds = await getDefaultQuickBooksCredentials()
    const { quickbooksEstimateId } = await pushQuoteToQuickBooks(quote, creds)

    const now = new Date()
    await prisma.quote.update({
      where: { id },
      data: {
        quickbooksEstimateId,
        quickbooksSyncedAt: now,
      },
    })

    return NextResponse.json({ ok: true, quickbooksEstimateId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to push to QuickBooks'
    const isConfig = message.includes('not configured') || message.includes('Reconnect') || message.includes('QuickBooks')
    return NextResponse.json(
      { ok: false, error: message },
      { status: isConfig ? 401 : 502 }
    )
  }
}
