import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build date filter
    const dateFilter: any = {}
    if (startDate || endDate) {
      dateFilter.createdAt = {}
      if (startDate) {
        dateFilter.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        dateFilter.createdAt.lte = new Date(endDate)
      }
    }

    // Fetch all quotes
    const quotes = await prisma.quote.findMany({
      where: dateFilter,
      include: {
        quoteItems: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Calculate metrics
    const totalQuotes = quotes.length
    const acceptedQuotes = quotes.filter(q => q.status === 'ACCEPTED').length
    const sentQuotes = quotes.filter(q => q.status === 'SENT').length
    const draftQuotes = quotes.filter(q => q.status === 'DRAFT').length
    const rejectedQuotes = quotes.filter(q => q.status === 'REJECTED').length
    const expiredQuotes = quotes.filter(q => q.status === 'EXPIRED' || (q.validUntil && new Date(q.validUntil) < new Date())).length

    const totalValue = quotes.reduce((sum, q) => sum + q.total, 0)
    const averageQuoteValue = totalQuotes > 0 ? totalValue / totalQuotes : 0
    const conversionRate = sentQuotes > 0 ? (acceptedQuotes / sentQuotes) * 100 : 0

    // Status breakdown
    const statusBreakdown = [
      { name: 'Draft', value: draftQuotes },
      { name: 'Sent', value: sentQuotes },
      { name: 'Accepted', value: acceptedQuotes },
      { name: 'Rejected', value: rejectedQuotes },
      { name: 'Expired', value: expiredQuotes },
    ]

    // Quotes by customer
    const quotesByCustomer: Record<string, { count: number; totalValue: number }> = {}
    quotes.forEach(quote => {
      const customerName = quote.customerName
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

    // Quote value distribution over time (monthly)
    const quotesByMonth: Record<string, { count: number; totalValue: number }> = {}
    quotes.forEach(quote => {
      const date = new Date(quote.createdAt)
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

    // Expiring soon (within 7 days)
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const expiringSoon = quotes.filter(q => 
      q.validUntil && 
      q.status === 'SENT' &&
      new Date(q.validUntil) >= now &&
      new Date(q.validUntil) <= sevenDaysFromNow
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
      expiringSoon: expiringSoon.map(q => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        customerName: q.customerName,
        total: q.total,
        validUntil: q.validUntil,
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
