import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/shopify';
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const creds = await getDefaultShopifyCredentials();
    const order = await getOrder(id, { shopDomain: creds.shopDomain, accessToken: creds.accessToken });
    return NextResponse.json({ order });
  } catch (error) {
    console.error('Shopify order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

