import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import type { QuoteWithItemsRow } from '@/lib/quote-supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    let query = supabaseAdmin
      .from('quotes')
      .select('*, quote_items(*)')
      .order('created_at', { ascending: false })

    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString())
    }
    if (endDate) {
      query = query.lte('created_at', new Date(endDate).toISOString())
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Error fetching quotes for report:', error)
      return NextResponse.json(
        { error: 'Failed to generate quote report' },
        { status: 500 }
      )
    }

    const quotes = (rows || []) as QuoteWithItemsRow[]

    const totalQuotes = quotes.length
    const acceptedQuotes = quotes.filter((q) => q.status === 'ACCEPTED').length
    const sentQuotes = quotes.filter((q) => q.status === 'SENT').length
    const draftQuotes = quotes.filter((q) => q.status === 'DRAFT').length
    const rejectedQuotes = quotes.filter((q) => q.status === 'REJECTED').length
    const expiredQuotes = quotes.filter(
      (q) =>
        q.status === 'EXPIRED' ||
        (q.valid_until && new Date(q.valid_until) < new Date())
    ).length

    const totalValue = quotes.reduce((sum, q) => sum + q.total, 0)
    const averageQuoteValue = totalQuotes > 0 ? totalValue / totalQuotes : 0
    const conversionRate = sentQuotes > 0 ? (acceptedQuotes / sentQuotes) * 100 : 0

    const statusBreakdown = [
      { name: 'Draft', value: draftQuotes },
      { name: 'Sent', value: sentQuotes },
      { name: 'Accepted', value: acceptedQuotes },
      { name: 'Rejected', value: rejectedQuotes },
      { name: 'Expired', value: expiredQuotes },
    ]

    const quotesByCustomer: Record<string, { count: number; totalValue: number }> = {}
    quotes.forEach((quote) => {
      const customerName = quote.customer_name
      if (!quotesByCustomer[customerName]) {
        quotesByCustomer[customerName] = { count: 0, totalValue: 0 }
      }
      quotesByCustomer[customerName].count += 1
      quotesByCustomer[customerName].totalValue += quote.total
    })

    const topCustomers = Object.entries(quotesByCustomer)
      .map(([name, data]) => ({ name, count: data.count, value: data.totalValue }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const quotesByMonth: Record<string, { count: number; totalValue: number }> = {}
    quotes.forEach((quote) => {
      const date = new Date(quote.created_at)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!quotesByMonth[monthKey]) {
        quotesByMonth[monthKey] = { count: 0, totalValue: 0 }
      }
      quotesByMonth[monthKey].count += 1
      quotesByMonth[monthKey].totalValue += quote.total
    })

    const quoteTrend = Object.entries(quotesByMonth)
      .map(([date, data]) => ({ date, count: data.count, value: data.totalValue }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expiringSoon = quotes.filter(
      (q) =>
        q.valid_until &&
        q.status === 'SENT' &&
        new Date(q.valid_until) >= now &&
        new Date(q.valid_until) <= sevenDaysFromNow
    )

    return NextResponse.json({
      summary: {
        totalQuotes,
        acceptedQuotes,
        sentQuotes,
        draftQuotes,
        rejectedQuotes,
        expiredQuotes,
        totalValue,
        averageQuoteValue,
        conversionRate: parseFloat(conversionRate.toFixed(2)),
      },
      statusBreakdown,
      topCustomers,
      quoteTrend,
      expiringSoon: expiringSoon.map((q) => ({
        id: q.id,
        quoteNumber: q.quote_number,
        customerName: q.customer_name,
        total: q.total,
        validUntil: q.valid_until ?? null,
      })),
    })
  } catch (error) {
    console.error('Error generating quote report:', error)
    return NextResponse.json(
      { error: 'Failed to generate quote report' },
      { status: 500 }
    )
  }
}
