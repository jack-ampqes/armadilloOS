import { NextRequest, NextResponse } from 'next/server'
import { checkQuoteExpirationAlerts } from '@/lib/alerts'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { pushQuoteToQuickBooks } from '@/lib/quote-quickbooks'
import { requirePermission } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  mapQuoteRowToApi,
  quoteApiToInsertRow,
  quoteItemApiToInsertRow,
  quoteRowToQuickBooksShape,
  type QuoteWithItemsRow,
} from '@/lib/quote-supabase'

function buildQuickBooksEstimateOpenUrl(realmId: string, estimateId: string): string {
  const useSandbox = process.env.QUICKBOOKS_SANDBOX === 'true'
  const base = useSandbox ? 'https://sandbox.qbo.intuit.com' : 'https://qbo.intuit.com'
  return `${base}/app/estimate?companyId=${realmId}&id=${encodeURIComponent(estimateId)}`
}

// GET /api/quotes/[id] - Get a single quote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'Quoting')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params

    const { data: quoteRow, error } = await supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', id)
      .single()

    if (error || !quoteRow) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const json = mapQuoteRowToApi(quoteRow as QuoteWithItemsRow) as Record<string, unknown>
    ;(json as Record<string, unknown>).quickbooksOpenUrl = undefined
    if (quoteRow.quickbooks_estimate_id) {
      try {
        const creds = await getDefaultQuickBooksCredentials()
        ;(json as Record<string, unknown>).quickbooksOpenUrl = buildQuickBooksEstimateOpenUrl(
          creds.realmId,
          quoteRow.quickbooks_estimate_id
        )
      } catch {
        // omit URL if QB not connected
      }
    }
    return NextResponse.json(json)
  } catch (error) {
    console.error('Error fetching quote:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote' },
      { status: 500 }
    )
  }
}

// PATCH /api/quotes/[id] - Update a quote
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'Quoting')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    const body = await request.json()

    const {
      status,
      quoteItems,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      customerCountry,
      discountType,
      discountValue,
      validUntil,
      notes,
      pushToQuickBooks,
      ...otherUpdates
    } = body

    const validStatuses = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const updatePayload: Record<string, unknown> = {
      ...(status && { status }),
      ...(customerName && { customer_name: customerName }),
      ...(customerEmail !== undefined && { customer_email: customerEmail }),
      ...(customerPhone !== undefined && { customer_phone: customerPhone }),
      ...(customerAddress !== undefined && { customer_address: customerAddress }),
      ...(customerCity !== undefined && { customer_city: customerCity }),
      ...(customerState !== undefined && { customer_state: customerState }),
      ...(customerZip !== undefined && { customer_zip: customerZip }),
      ...(customerCountry !== undefined && { customer_country: customerCountry }),
      ...(discountType !== undefined && { discount_type: discountType }),
      ...(discountValue !== undefined && { discount_value: discountValue }),
      ...(validUntil !== undefined && {
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      }),
      ...(notes !== undefined && { notes }),
      ...otherUpdates,
    }

    if (quoteItems && Array.isArray(quoteItems)) {
      await supabaseAdmin.from('quote_items').delete().eq('quote_id', id)

      const subtotal = quoteItems.reduce(
        (sum: number, item: { unitPrice: number; quantity: number }) =>
          sum + item.unitPrice * item.quantity,
        0
      )
      const finalDiscountType = discountType !== undefined ? discountType : null
      const finalDiscountValue = discountValue !== undefined ? discountValue : null
      let discountAmount = 0
      if (finalDiscountType && finalDiscountValue > 0) {
        discountAmount =
          finalDiscountType === 'percentage'
            ? subtotal * (finalDiscountValue / 100)
            : finalDiscountValue
      }
      const total = subtotal - discountAmount

      updatePayload.subtotal = subtotal
      updatePayload.discount_amount = discountAmount
      updatePayload.total = total

      const { error: updateErr } = await supabaseAdmin
        .from('quotes')
        .update(updatePayload)
        .eq('id', id)
      if (updateErr) {
        console.error('Error updating quote:', updateErr)
        return NextResponse.json(
          { error: 'Failed to update quote' },
          { status: 500 }
        )
      }

      const itemsToInsert = quoteItems.map(
        (item: {
          productId?: string | null
          productName: string
          sku?: string
          quantity: number
          unitPrice: number
        }) =>
          quoteItemApiToInsertRow(id, {
            productId: item.productId ?? null,
            productName: item.productName,
            sku: item.sku ?? null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice * item.quantity,
          })
      )
      await supabaseAdmin.from('quote_items').insert(itemsToInsert)
    } else if (discountType !== undefined || discountValue !== undefined) {
      const { data: existingQuote } = await supabaseAdmin
        .from('quotes')
        .select('*, quote_items(*)')
        .eq('id', id)
        .single()

      if (existingQuote && existingQuote.quote_items) {
        const items = existingQuote.quote_items as { unit_price: number; quantity: number }[]
        const subtotal = items.reduce(
          (sum, item) => sum + item.unit_price * item.quantity,
          0
        )
        const finalDiscountType =
          discountType !== undefined ? discountType : existingQuote.discount_type
        const finalDiscountValue =
          discountValue !== undefined ? discountValue : existingQuote.discount_value
        let discountAmount = 0
        if (finalDiscountType && finalDiscountValue && finalDiscountValue > 0) {
          discountAmount =
            finalDiscountType === 'percentage'
              ? subtotal * (finalDiscountValue / 100)
              : finalDiscountValue
        }
        updatePayload.subtotal = subtotal
        updatePayload.discount_amount = discountAmount
        updatePayload.total = subtotal - discountAmount
        await supabaseAdmin.from('quotes').update(updatePayload).eq('id', id)
      }
    } else {
      await supabaseAdmin.from('quotes').update(updatePayload).eq('id', id)
    }

    try {
      await checkQuoteExpirationAlerts()
    } catch (alertError) {
      console.error('Error checking alerts after quote update:', alertError)
    }

    let quoteRow: QuoteWithItemsRow | null = null
    const { data: updated } = await supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .eq('id', id)
      .single()
    quoteRow = updated as QuoteWithItemsRow

    if (pushToQuickBooks && quoteRow) {
      try {
        const creds = await getDefaultQuickBooksCredentials()
        const shape = quoteRowToQuickBooksShape(quoteRow)
        const { quickbooksEstimateId } = await pushQuoteToQuickBooks(shape, creds)
        const now = new Date().toISOString()
        await supabaseAdmin
          .from('quotes')
          .update({ quickbooks_estimate_id: quickbooksEstimateId, quickbooks_synced_at: now })
          .eq('id', id)
        const { data: afterQb } = await supabaseAdmin
          .from('quotes')
          .select('*, quote_items(*)')
          .eq('id', id)
          .single()
        quoteRow = afterQb as QuoteWithItemsRow
      } catch (qbError) {
        console.error('QuickBooks push after quote update:', qbError)
        return NextResponse.json({
          ...mapQuoteRowToApi(quoteRow),
          warning:
            qbError instanceof Error ? qbError.message : 'Could not push to QuickBooks',
        })
      }
    }

    return NextResponse.json(quoteRow ? mapQuoteRowToApi(quoteRow) : {})
  } catch (error) {
    console.error('Error updating quote:', error)
    return NextResponse.json(
      { error: 'Failed to update quote' },
      { status: 500 }
    )
  }
}

// DELETE /api/quotes/[id] - Delete a quote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'Quoting')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    await supabaseAdmin.from('quotes').delete().eq('id', id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting quote:', error)
    return NextResponse.json(
      { error: 'Failed to delete quote' },
      { status: 500 }
    )
  }
}
