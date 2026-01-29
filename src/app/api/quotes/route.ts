import { NextRequest, NextResponse } from 'next/server'
import { checkQuoteExpirationAlerts } from '@/lib/alerts'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { pushQuoteToQuickBooks } from '@/lib/quote-quickbooks'
import { generateQuoteNumber } from '@/lib/quote-number'
import { requirePermission } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  mapQuoteRowToApi,
  quoteApiToInsertRow,
  quoteItemApiToInsertRow,
  quoteRowToQuickBooksShape,
  type QuoteWithItemsRow,
} from '@/lib/quote-supabase'

// GET /api/quotes - Get all quotes
export async function GET(request: NextRequest) {
  const auth = requirePermission(request, 'Quoting')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { data: rows, error } = await supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching quotes:', error)
      return NextResponse.json(
        { error: 'Failed to fetch quotes' },
        { status: 500 }
      )
    }

    const quotes = (rows || []).map((r) => mapQuoteRowToApi(r as QuoteWithItemsRow))
    return NextResponse.json(quotes)
  } catch (error) {
    console.error('Error fetching quotes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    )
  }
}

// POST /api/quotes - Create a new quote
export async function POST(request: NextRequest) {
  const auth = requirePermission(request, 'Quoting')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json()

    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      customerCountry,
      quoteItems,
      discountType,
      discountValue,
      validUntil,
      notes,
    } = body

    if (!customerName) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    if (!quoteItems || quoteItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one quote item is required' },
        { status: 400 }
      )
    }

    const subtotal = quoteItems.reduce(
      (sum: number, item: { unitPrice: number; quantity: number }) =>
        sum + item.unitPrice * item.quantity,
      0
    )
    let discountAmount = 0
    if (discountType && discountValue > 0) {
      discountAmount = discountType === 'percentage' ? subtotal * (discountValue / 100) : discountValue
    }
    const total = subtotal - discountAmount

    const quoteNumber = await generateQuoteNumber()

    const insertRow = quoteApiToInsertRow({
      quoteNumber,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      customerCity,
      customerState,
      customerZip,
      customerCountry,
      subtotal,
      discountType,
      discountValue,
      discountAmount,
      total,
      validUntil: validUntil ? new Date(validUntil).toISOString() : null,
      notes,
    })

    const { data: quoteRow, error: quoteError } = await supabaseAdmin
      .from('quotes')
      .insert(insertRow)
      .select()
      .single()

    if (quoteError || !quoteRow) {
      console.error('Error creating quote:', quoteError)
      return NextResponse.json(
        { error: 'Failed to create quote' },
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
        quoteItemApiToInsertRow(quoteRow.id, {
          productId: item.productId ?? null,
          productName: item.productName,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice * item.quantity,
        })
    )

    const { error: itemsError } = await supabaseAdmin.from('quote_items').insert(itemsToInsert)
    if (itemsError) {
      console.error('Error creating quote items:', itemsError)
      await supabaseAdmin.from('quotes').delete().eq('id', quoteRow.id)
      return NextResponse.json(
        { error: 'Failed to create quote items' },
        { status: 500 }
      )
    }

    try {
      await checkQuoteExpirationAlerts()
    } catch (alertError) {
      console.error('Error checking alerts after quote creation:', alertError)
    }

    const quoteWithItems: QuoteWithItemsRow = {
      ...quoteRow,
      quote_items: quoteItems.map(
        (item: { productName: string; sku?: string; quantity: number; unitPrice: number }) => ({
          id: '',
          quote_id: quoteRow.id,
          product_id: null,
          product_name: item.productName,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.unitPrice * item.quantity,
        })
      ),
    }
    const quoteApi = mapQuoteRowToApi(quoteWithItems)

    if (quoteRow) {
      try {
        const creds = await getDefaultQuickBooksCredentials()
        const shape = quoteRowToQuickBooksShape(quoteWithItems)
        const { quickbooksEstimateId } = await pushQuoteToQuickBooks(shape, creds)
        const now = new Date().toISOString()
        await supabaseAdmin
          .from('quotes')
          .update({ quickbooks_estimate_id: quickbooksEstimateId, quickbooks_synced_at: now })
          .eq('id', quoteRow.id)
        const { data: updated } = await supabaseAdmin
          .from('quotes')
          .select('*, quote_items(*)')
          .eq('id', quoteRow.id)
          .single()
        if (updated) {
          return NextResponse.json(mapQuoteRowToApi(updated as QuoteWithItemsRow), { status: 201 })
        }
        return NextResponse.json(quoteApi, { status: 201 })
      } catch (qbError) {
        console.error('QuickBooks push after quote create:', qbError)
        return NextResponse.json(
          {
            ...quoteApi,
            warning:
              qbError instanceof Error ? qbError.message : 'Could not push to QuickBooks',
          },
          { status: 201 }
        )
      }
    }

    return NextResponse.json(quoteApi, { status: 201 })
  } catch (error) {
    console.error('Error creating quote:', error)
    return NextResponse.json(
      { error: 'Failed to create quote' },
      { status: 500 }
    )
  }
}
