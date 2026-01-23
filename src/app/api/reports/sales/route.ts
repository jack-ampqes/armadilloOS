import { NextRequest, NextResponse } from 'next/server'
import { getOrders } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'monthly' // daily, weekly, monthly, yearly
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const credentials = await getDefaultShopifyCredentials()

    // Fetch orders from Shopify
    const orders = await getOrders({
      limit: 250,
      status: 'any',
      created_at_min: startDate || undefined,
      created_at_max: endDate || undefined,
    }, {
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
    })

    // Group orders by period
    const revenueByPeriod: Record<string, { revenue: number; orders: number }> = {}
    const salesByCustomer: Record<string, { revenue: number; orders: number }> = {}
    const salesByProduct: Record<string, { revenue: number; quantity: number }> = {}
    const statusBreakdown: Record<string, number> = {}

    orders.forEach(order => {
      const orderDate = new Date(order.created_at)
      const revenue = parseFloat(order.total_price)
      
      // Group by period
      let periodKey = ''
      switch (period) {
        case 'daily':
          periodKey = orderDate.toISOString().split('T')[0]
          break
        case 'weekly':
          const week = getWeekNumber(orderDate)
          periodKey = `${orderDate.getFullYear()}-W${week}`
          break
        case 'monthly':
          periodKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`
          break
        case 'yearly':
          periodKey = String(orderDate.getFullYear())
          break
      }

      if (!revenueByPeriod[periodKey]) {
        revenueByPeriod[periodKey] = { revenue: 0, orders: 0 }
      }
      revenueByPeriod[periodKey].revenue += revenue
      revenueByPeriod[periodKey].orders += 1

      // Group by customer
      const customerName = order.customer 
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim() || order.email
        : order.email || 'Unknown'
      
      if (!salesByCustomer[customerName]) {
        salesByCustomer[customerName] = { revenue: 0, orders: 0 }
      }
      salesByCustomer[customerName].revenue += revenue
      salesByCustomer[customerName].orders += 1

      // Group by product
      order.line_items.forEach((item: any) => {
        const productName = item.title || item.name || 'Unknown Product'
        if (!salesByProduct[productName]) {
          salesByProduct[productName] = { revenue: 0, quantity: 0 }
        }
        const itemRevenue = parseFloat(item.original_unit_price || item.price || '0') * item.quantity
        salesByProduct[productName].revenue += itemRevenue
        salesByProduct[productName].quantity += item.quantity
      })

      // Status breakdown
      const status = order.fulfillment_status || 'unfulfilled'
      statusBreakdown[status] = (statusBreakdown[status] || 0) + 1
    })

    // Convert to arrays and sort
    const revenueTrend = Object.entries(revenueByPeriod)
      .map(([date, data]) => ({ date, revenue: data.revenue, orders: data.orders }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const topCustomers = Object.entries(salesByCustomer)
      .map(([name, data]) => ({ name, value: data.revenue, count: data.orders }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const topProducts = Object.entries(salesByProduct)
      .map(([name, data]) => ({ name, value: data.revenue, quantity: data.quantity }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    const statusDistribution = Object.entries(statusBreakdown)
      .map(([name, value]) => ({ name, value }))

    // Calculate totals
    const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.total_price), 0)
    const totalOrders = orders.length
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return NextResponse.json({
      revenueTrend,
      topCustomers,
      topProducts,
      statusDistribution,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
      },
    })
  } catch (error) {
    console.error('Error generating sales report:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorMessage.includes('Missing Shopify credentials') || errorMessage.includes('not configured')) {
      return NextResponse.json(
        { 
          error: 'Shopify integration not configured',
          message: errorMessage
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate sales report', message: errorMessage },
      { status: 500 }
    )
  }
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
