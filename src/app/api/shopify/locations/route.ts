import { NextResponse } from 'next/server';
import { getLocations } from '@/lib/shopify';
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection';

export async function GET() {
  try {
    const creds = await getDefaultShopifyCredentials();
    const locations = await getLocations({ shopDomain: creds.shopDomain, accessToken: creds.accessToken });
    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Shopify locations error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

