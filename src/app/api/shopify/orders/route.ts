import { NextRequest, NextResponse } from 'next/server';
import { getOrders, getOrderCount } from '@/lib/shopify';
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const creds = await getDefaultShopifyCredentials();
    const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken };
    
    // Check if we just want count
    if (searchParams.get('count') === 'true') {
      const count = await getOrderCount({
        status: (searchParams.get('status') as 'open' | 'closed' | 'cancelled' | 'any') || 'any',
      }, credentials);
      return NextResponse.json({ count });
    }

    // Get orders with filters
    const orders = await getOrders({
      limit: parseInt(searchParams.get('limit') || '50'),
      status: (searchParams.get('status') as 'open' | 'closed' | 'cancelled' | 'any') || 'any',
      fulfillment_status: searchParams.get('fulfillment_status') as 'shipped' | 'partial' | 'unshipped' | 'any' | undefined,
      financial_status: searchParams.get('financial_status') as 'paid' | 'pending' | 'any' | undefined,
      created_at_min: searchParams.get('created_at_min') || undefined,
      created_at_max: searchParams.get('created_at_max') || undefined,
    }, credentials);

    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Shopify orders error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

