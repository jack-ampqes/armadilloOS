import { NextRequest, NextResponse } from 'next/server'
import { getOrders } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ number: string }> }
) {
  try {
    const { number } = await params
    
    // Get credentials (OAuth token from Supabase or fallback to env)
    const credentials = await getDefaultShopifyCredentials()

    // Use the getOrders function with a name query filter
    const orders = await getOrders(
      {
        limit: 1,
        name: number,
      },
      credentials || undefined
    )

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: `Order #${number} not found` },
        { status: 404 }
      )
    }

    return NextResponse.json({ order: orders[0] })
  } catch (error) {
    console.error('Error fetching order by number:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    )
  }
}
