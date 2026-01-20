import { NextRequest, NextResponse } from 'next/server'
import { getOrders as getShopifyOrders } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const credentials = await getDefaultShopifyCredentials()

    // Fetch from Shopify API (Headless API)
    const shopifyOrders = await getShopifyOrders({
      limit: parseInt(searchParams.get('limit') || '50'),
      status: (searchParams.get('status') as 'open' | 'closed' | 'cancelled' | 'any') || 'any',
      fulfillment_status: searchParams.get('fulfillment_status') as 'shipped' | 'partial' | 'unshipped' | 'any' | undefined,
      financial_status: searchParams.get('financial_status') as 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any' | undefined,
      created_at_min: searchParams.get('created_at_min') || undefined,
      created_at_max: searchParams.get('created_at_max') || undefined,
    }, {
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
    })

    // Transform Shopify orders to match expected format
    const transformedOrders = shopifyOrders.map((order) => ({
      id: `shopify-${order.id}`,
      orderNumber: order.name,
      status: mapShopifyStatus(order.financial_status, order.fulfillment_status),
      totalAmount: parseFloat(order.total_price),
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      source: 'shopify',
      customer: order.customer ? {
        id: `shopify-${order.customer.id}`,
        name: `${order.customer.first_name} ${order.customer.last_name}`.trim() || order.email,
        email: order.customer.email || order.email,
        phone: order.customer.phone,
      } : {
        id: 'unknown',
        name: order.email || 'Unknown Customer',
        email: order.email || '',
      },
      salesRep: null,
      orderItems: order.line_items.map((item) => ({
        id: `shopify-${item.id}`,
        quantity: item.quantity,
        unitPrice: parseFloat(item.price),
        product: {
          id: `shopify-${item.product_id}`,
          name: item.title,
          sku: item.sku,
        }
      })),
      shopifyData: {
        financialStatus: order.financial_status,
        fulfillmentStatus: order.fulfillment_status,
        tags: order.tags,
        note: order.note,
      }
    }))

    return NextResponse.json(transformedOrders)
  } catch (error) {
    console.error('Error fetching orders from Shopify:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Check if it's a credentials error
    if (errorMessage.includes('Missing Shopify credentials') || errorMessage.includes('not configured')) {
      return NextResponse.json(
        { 
          error: 'Shopify integration not configured',
          message: errorMessage
        },
        { status: 400 }
      )
    }
    
    // Check if it's an API error
    if (errorMessage.includes('Shopify API error')) {
      // Extract the actual error from Shopify's response
      let shopifyError = errorMessage
      let upstreamStatus: number | null = null
      try {
        // Shopify errors are often in format: "Shopify API error (401): {\"errors\":\"...\"}"
        const match = errorMessage.match(/\((\d+)\):\s*(.+)/)
        if (match) {
          const statusCode = match[1]
          upstreamStatus = Number(statusCode)
          const errorBody = match[2]
          try {
            const parsed = JSON.parse(errorBody)
            shopifyError = parsed.errors || parsed.error || errorBody
          } catch {
            shopifyError = errorBody
          }
        }
      } catch {
        // Keep original error message
      }
      
      return NextResponse.json(
        { 
          error: 'Shopify API error',
          message: shopifyError,
          statusCode: upstreamStatus ?? undefined,
          hint:
            upstreamStatus === 401
              ? 'Your Admin API access token is invalid (or you are using a Storefront token by mistake).'
              : upstreamStatus === 403
                ? 'Your Admin API token is valid, but it likely lacks the required scopes (need read_orders).'
                : undefined,
        },
        {
          // If Shopify explicitly tells us it is unauthorized/forbidden, pass that through so the UI can react.
          status: upstreamStatus === 401 || upstreamStatus === 403 ? upstreamStatus : 502,
        }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders from Shopify',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

// Map Shopify status to display format
function mapShopifyStatus(
  financialStatus: string,
  fulfillmentStatus: string | null
): string {
  // Prioritize fulfillment status
  if (fulfillmentStatus === 'fulfilled') return 'FULFILLED'
  if (fulfillmentStatus === 'partial') return 'PARTIALLY_FULFILLED'
  
  // Then check financial status
  if (financialStatus === 'paid') return 'PAID'
  if (financialStatus === 'pending') return 'PENDING'
  if (financialStatus === 'authorized') return 'AUTHORIZED'
  if (financialStatus === 'partially_paid') return 'PARTIALLY_PAID'
  if (financialStatus === 'refunded') return 'REFUNDED'
  if (financialStatus === 'partially_refunded') return 'PARTIALLY_REFUNDED'
  if (financialStatus === 'voided') return 'VOIDED'
  
  return 'UNFULFILLED'
}

// Note: Order creation should be done through Shopify API
// This endpoint is now read-only for Shopify orders
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      error: 'Order creation not supported via this endpoint',
      message: 'Orders must be created through Shopify. Use the Shopify Admin API or Storefront API to create orders.'
    },
    { status: 405 }
  )
}

