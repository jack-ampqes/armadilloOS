import { NextRequest, NextResponse } from 'next/server'
import { getOrders } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { getProfitAndLoss, parseProfitAndLoss } from '@/lib/quickbooks'
import { PrismaClient } from '@prisma/client'
import { supabaseAdmin } from '@/lib/supabase'

const prisma = new PrismaClient()

type AnalyticsPeriod = 'thisMonth' | 'last3Months' | 'last6Months' | 'ytd' | 'lastYear' | 'allTime'

function getDateRangeForPeriod(period: AnalyticsPeriod): { startDate: Date; endDate: Date; label: string } {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
  
  switch (period) {
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      return { startDate: start, endDate: today, label: 'This Month' }
    }
    case 'last3Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1)
      return { startDate: start, endDate: today, label: 'Last 3 Months' }
    }
    case 'last6Months': {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      return { startDate: start, endDate: today, label: 'Last 6 Months' }
    }
    case 'ytd': {
      const start = new Date(now.getFullYear(), 0, 1)
      return { startDate: start, endDate: today, label: 'Year to Date' }
    }
    case 'lastYear': {
      const start = new Date(now.getFullYear() - 1, 0, 1)
      const end = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59)
      return { startDate: start, endDate: end, label: 'Last Year' }
    }
    case 'allTime':
    default: {
      const start = new Date(2020, 0, 1) // Far enough back
      return { startDate: start, endDate: today, label: 'All Time' }
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get period from query params
    const period = (request.nextUrl.searchParams.get('period') || 'thisMonth') as AnalyticsPeriod
    const { startDate, endDate, label } = getDateRangeForPeriod(period)
    
    // Get date ranges
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisYear = new Date(now.getFullYear(), 0, 1)

    const credentials = await getDefaultShopifyCredentials()

    // Fetch orders from Shopify for the selected period
    const orders = await getOrders({
      limit: 250,
      status: 'any',
      created_at_min: startDate.toISOString(),
      created_at_max: endDate.toISOString(),
    }, {
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
    })

    // Calculate revenue metrics for selected period
    const totalRevenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)
    const totalOrders = orders.length

    // Pending orders (within selected period)
    const pendingOrders = orders.filter(o => 
      o.fulfillment_status === 'unfulfilled' || 
      o.fulfillment_status === null ||
      o.financial_status === 'pending'
    )
    const pendingOrdersValue = pendingOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)

    // Revenue trend for selected period
    const revenueTrend: Record<string, number> = {}
    orders.forEach(order => {
      const date = new Date(order.created_at).toISOString().split('T')[0]
      if (!revenueTrend[date]) {
        revenueTrend[date] = 0
      }
      revenueTrend[date] += parseFloat(order.total_price)
    })

    const revenueTrendData = Object.entries(revenueTrend)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Top products for selected period
    const productSales: Record<string, { revenue: number; quantity: number }> = {}
    orders.forEach(order => {
      order.line_items.forEach((item: any) => {
        const productName = item.title || item.name || 'Unknown'
        if (!productSales[productName]) {
          productSales[productName] = { revenue: 0, quantity: 0 }
        }
        productSales[productName].revenue += parseFloat(item.original_unit_price || item.price || '0') * item.quantity
        productSales[productName].quantity += item.quantity
      })
    })

    const topProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, revenue: data.revenue, quantity: data.quantity }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // Order status distribution
    const statusDistribution: Record<string, number> = {}
    orders.forEach(order => {
      const status = order.fulfillment_status || 'unfulfilled'
      statusDistribution[status] = (statusDistribution[status] || 0) + 1
    })

    const statusData = Object.entries(statusDistribution)
      .map(([name, value]) => ({ name, value }))

    // Inventory stats
    const { data: inventoryData } = await supabaseAdmin
      .schema('armadillo_inventory')
      .from('inventory')
      .select('quantity, min_stock')

    const lowStockCount = (inventoryData || []).filter(item => {
      const qty = item.quantity || 0
      const min = item.min_stock || 0
      return qty > 0 && qty <= min
    }).length

    const outOfStockCount = (inventoryData || []).filter(item => (item.quantity || 0) === 0).length

    // Quotes stats
    const activeQuotes = await prisma.quote.count({
      where: {
        status: {
          in: ['DRAFT', 'SENT']
        }
      }
    })

    // Top customers (last 30 days)
    const customerSales: Record<string, number> = {}
    orders.forEach(order => {
      const customerName = order.customer 
        ? `${order.customer.first_name} ${order.customer.last_name}`.trim() || order.email
        : order.email || 'Unknown'
      if (!customerSales[customerName]) {
        customerSales[customerName] = 0
      }
      customerSales[customerName] += parseFloat(order.total_price)
    })

    const topCustomers = Object.entries(customerSales)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)

    // QuickBooks financials (optional - only if connected)
    let quickbooks: {
      connected: boolean
      thisMonth?: { totalIncome: number; totalExpenses: number; netIncome: number; grossProfit: number }
      thisYear?: { totalIncome: number; totalExpenses: number; netIncome: number; grossProfit: number }
    } = { connected: false }

    try {
      const qbCreds = await getDefaultQuickBooksCredentials()
      
      // This month P&L
      const thisMonthStart = thisMonth.toISOString().split('T')[0]
      const todayStr = now.toISOString().split('T')[0]
      const plThisMonth = await getProfitAndLoss(qbCreds, thisMonthStart, todayStr)
      const parsedMonth = parseProfitAndLoss(plThisMonth)
      
      // This year P&L
      const thisYearStart = thisYear.toISOString().split('T')[0]
      const plThisYear = await getProfitAndLoss(qbCreds, thisYearStart, todayStr)
      const parsedYear = parseProfitAndLoss(plThisYear)

      quickbooks = {
        connected: true,
        thisMonth: parsedMonth,
        thisYear: parsedYear,
      }
    } catch {
      // QuickBooks not connected or error - continue without it
    }

    return NextResponse.json({
      period,
      periodLabel: label,
      revenue: {
        total: totalRevenue,
        orderCount: totalOrders,
      },
      orders: {
        pending: pendingOrders.length,
        pendingValue: pendingOrdersValue,
        total: totalOrders,
      },
      inventory: {
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
      quotes: {
        active: activeQuotes,
      },
      charts: {
        revenueTrend: revenueTrendData,
        topProducts,
        statusDistribution: statusData,
      },
      topCustomers,
      quickbooks,
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Return partial data if Shopify is not configured
    if (errorMessage.includes('Missing Shopify credentials') || errorMessage.includes('not configured')) {
      // Still return inventory, quotes, and QuickBooks data
      const { data: inventoryData } = await supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory')
        .select('quantity, min_stock')

      const lowStockCount = (inventoryData || []).filter(item => {
        const qty = item.quantity || 0
        const min = item.min_stock || 0
        return qty > 0 && qty <= min
      }).length

      const outOfStockCount = (inventoryData || []).filter(item => (item.quantity || 0) === 0).length

      const activeQuotes = await prisma.quote.count({
        where: {
          status: {
            in: ['DRAFT', 'SENT']
          }
        }
      })

      // Try to get QuickBooks data even if Shopify fails
      let quickbooks: {
        connected: boolean
        thisMonth?: { totalIncome: number; totalExpenses: number; netIncome: number; grossProfit: number }
        thisYear?: { totalIncome: number; totalExpenses: number; netIncome: number; grossProfit: number }
      } = { connected: false }

      try {
        const now = new Date()
        const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        const thisYear = new Date(now.getFullYear(), 0, 1)
        const qbCreds = await getDefaultQuickBooksCredentials()
        
        const thisMonthStart = thisMonth.toISOString().split('T')[0]
        const todayStr = now.toISOString().split('T')[0]
        const plThisMonth = await getProfitAndLoss(qbCreds, thisMonthStart, todayStr)
        const parsedMonth = parseProfitAndLoss(plThisMonth)
        
        const thisYearStart = thisYear.toISOString().split('T')[0]
        const plThisYear = await getProfitAndLoss(qbCreds, thisYearStart, todayStr)
        const parsedYear = parseProfitAndLoss(plThisYear)

        quickbooks = {
          connected: true,
          thisMonth: parsedMonth,
          thisYear: parsedYear,
        }
      } catch {
        // QuickBooks not connected
      }

      const period = (request.nextUrl.searchParams.get('period') || 'thisMonth') as AnalyticsPeriod
      const { label } = getDateRangeForPeriod(period)

      return NextResponse.json({
        period,
        periodLabel: label,
        revenue: {
          total: 0,
          orderCount: 0,
        },
        orders: {
          pending: 0,
          pendingValue: 0,
          total: 0,
        },
        inventory: {
          lowStock: lowStockCount,
          outOfStock: outOfStockCount,
        },
        quotes: {
          active: activeQuotes,
        },
        charts: {
          revenueTrend: [],
          topProducts: [],
          statusDistribution: [],
        },
        topCustomers: [],
        quickbooks,
        error: 'Shopify integration not configured',
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', message: errorMessage },
      { status: 500 }
    )
  }
}
