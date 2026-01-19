import { NextResponse } from 'next/server';
import { getLocations } from '@/lib/shopify';

export async function GET() {
  try {
    const locations = await getLocations();
    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Shopify locations error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

