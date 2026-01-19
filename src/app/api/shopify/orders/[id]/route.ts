import { NextRequest, NextResponse } from 'next/server';
import { getOrder } from '@/lib/shopify';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const order = await getOrder(id);
    return NextResponse.json({ order });
  } catch (error) {
    console.error('Shopify order error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

