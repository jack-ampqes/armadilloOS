import { NextRequest, NextResponse } from 'next/server'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { queryEstimates } from '@/lib/quickbooks'
import { mapQuickBooksEstimateToQuote } from '@/lib/quote-quickbooks'
import { generateQuoteNumber } from '@/lib/quote-number'
import { supabaseAdmin } from '@/lib/supabase'
import { quoteApiToInsertRow, quoteItemApiToInsertRow } from '@/lib/quote-supabase'

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
        const quoteNumber = mapped.quoteNumber.startsWith('QB-')
          ? await generateQuoteNumber()
          : mapped.quoteNumber

        const { data: existingRows } = await supabaseAdmin
          .from('quotes')
          .select('id, quote_number')
          .eq('quickbooks_estimate_id', qb.Id)
          .limit(1)
        const existing = existingRows?.[0]

        if (existing) {
          await supabaseAdmin.from('quote_items').delete().eq('quote_id', existing.id)

          const updateRow = {
            status: mapped.status,
            customer_name: mapped.customerName,
            customer_email: mapped.customerEmail,
            customer_phone: mapped.customerPhone,
            customer_address: mapped.customerAddress,
            customer_city: mapped.customerCity,
            customer_state: mapped.customerState,
            customer_zip: mapped.customerZip,
            customer_country: mapped.customerCountry,
            subtotal: mapped.subtotal,
            discount_type: mapped.discountType,
            discount_value: mapped.discountValue,
            discount_amount: mapped.discountAmount,
            total: mapped.total,
            valid_until: mapped.validUntil ? new Date(mapped.validUntil).toISOString() : null,
            notes: mapped.notes,
            quickbooks_synced_at: new Date().toISOString(),
          }
          await supabaseAdmin.from('quotes').update(updateRow).eq('id', existing.id)

          const itemsToInsert = mapped.quoteItems.map((item) =>
            quoteItemApiToInsertRow(existing.id, {
              productName: item.productName,
              sku: item.sku ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })
          )
          await supabaseAdmin.from('quote_items').insert(itemsToInsert)
          updated += 1
        } else {
          const { data: conflictRow } = await supabaseAdmin
            .from('quotes')
            .select('id')
            .eq('quote_number', mapped.quoteNumber)
            .limit(1)
            .single()
          const finalQuoteNumber = conflictRow ? await generateQuoteNumber() : mapped.quoteNumber

          const insertRow = quoteApiToInsertRow({
            quoteNumber: finalQuoteNumber,
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
            validUntil: mapped.validUntil ? new Date(mapped.validUntil).toISOString() : null,
            notes: mapped.notes,
          })
          const { data: newQuote, error: insertErr } = await supabaseAdmin
            .from('quotes')
            .insert({
              ...insertRow,
              status: mapped.status,
              quickbooks_estimate_id: qb.Id,
              quickbooks_synced_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (insertErr || !newQuote) {
            throw new Error(insertErr?.message ?? 'Insert failed')
          }

          const itemsToInsert = mapped.quoteItems.map((item) =>
            quoteItemApiToInsertRow(newQuote.id, {
              productName: item.productName,
              sku: item.sku ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })
          )
          await supabaseAdmin.from('quote_items').insert(itemsToInsert)
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
    const isConfig =
      message.includes('not configured') ||
      message.includes('Reconnect') ||
      message.includes('QuickBooks')
    return NextResponse.json(
      { ok: false, error: message, created: 0, updated: 0 },
      { status: isConfig ? 401 : 502 }
    )
  }
}
