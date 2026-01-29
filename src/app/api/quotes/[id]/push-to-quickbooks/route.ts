import { NextRequest, NextResponse } from 'next/server'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { pushQuoteToQuickBooks } from '@/lib/quote-quickbooks'
import { supabaseAdmin } from '@/lib/supabase'
import { quoteRowToQuickBooksShape, type QuoteWithItemsRow } from '@/lib/quote-supabase'

/** POST /api/quotes/[id]/push-to-quickbooks — push this quote to QuickBooks (create or update estimate). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data: quoteRow, error } = await supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', id)
      .single()

    if (error || !quoteRow) {
      return NextResponse.json({ ok: false, error: 'Quote not found' }, { status: 404 })
    }

    const quote = quoteRowToQuickBooksShape(quoteRow as QuoteWithItemsRow)
    const creds = await getDefaultQuickBooksCredentials()
    const { quickbooksEstimateId } = await pushQuoteToQuickBooks(quote, creds)

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('quotes')
      .update({
        quickbooks_estimate_id: quickbooksEstimateId,
        quickbooks_synced_at: now,
      })
      .eq('id', id)

    return NextResponse.json({ ok: true, quickbooksEstimateId })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to push to QuickBooks'
    const isConfig =
      message.includes('not configured') ||
      message.includes('Reconnect') ||
      message.includes('QuickBooks')
    return NextResponse.json(
      { ok: false, error: message },
      { status: isConfig ? 401 : 502 }
    )
  }
}
