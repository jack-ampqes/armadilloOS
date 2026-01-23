import { NextRequest, NextResponse } from 'next/server'
import { getOrders } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { PrismaClient } from '@prisma/client'
import { supabaseAdmin } from '@/lib/supabase'

const prisma = new PrismaClient()

export async function GET(request: NextRequest) {
  try {
    // Get date ranges
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisYear = new Date(now.getFullYear(), 0, 1)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const credentials = await getDefaultShopifyCredentials()

    // Fetch recent orders from Shopify
    const orders = await getOrders({
      limit: 250,
      status: 'any',
      created_at_min: thirtyDaysAgo.toISOString(),
    }, {
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
    })

    // Calculate revenue metrics
    const revenueToday = orders
      .filter(o => new Date(o.created_at) >= today)
      .reduce((sum, o) => sum + parseFloat(o.total_price), 0)

    const revenueThisMonth = orders
      .filter(o => new Date(o.created_at) >= thisMonth)
      .reduce((sum, o) => sum + parseFloat(o.total_price), 0)

    const revenueThisYear = orders
      .filter(o => new Date(o.created_at) >= thisYear)
      .reduce((sum, o) => sum + parseFloat(o.total_price), 0)

    // Pending orders
    const pendingOrders = orders.filter(o => 
      o.fulfillment_status === 'unfulfilled' || 
      o.fulfillment_status === null ||
      o.financial_status === 'pending'
    )
    const pendingOrdersValue = pendingOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)

    // Revenue trend (last 30 days)
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
      .slice(-30)

    // Top products (last 30 days)
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

    return NextResponse.json({
      revenue: {
        today: revenueToday,
        thisMonth: revenueThisMonth,
        thisYear: revenueThisYear,
      },
      orders: {
        pending: pendingOrders.length,
        pendingValue: pendingOrdersValue,
        total: orders.length,
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
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Return partial data if Shopify is not configured
    if (errorMessage.includes('Missing Shopify credentials') || errorMessage.includes('not configured')) {
      // Still return inventory and quotes data
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

      return NextResponse.json({
        revenue: {
          today: 0,
          thisMonth: 0,
          thisYear: 0,
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
        error: 'Shopify integration not configured',
      })
    }

    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats', message: errorMessage },
      { status: 500 }
    )
  }
}
