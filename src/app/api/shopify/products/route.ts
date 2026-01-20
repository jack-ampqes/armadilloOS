import { NextRequest, NextResponse } from 'next/server';
import { getProducts, getProduct } from '@/lib/shopify';
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('id');
    const creds = await getDefaultShopifyCredentials();
    const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken };

    // Get single product if ID provided
    if (productId) {
      const product = await getProduct(productId, credentials);
      return NextResponse.json({ product });
    }

    // Get all products with filters
    const products = await getProducts({
      limit: parseInt(searchParams.get('limit') || '50'),
      status: (searchParams.get('status') as 'active' | 'archived' | 'draft') || undefined,
      product_type: searchParams.get('product_type') || undefined,
      vendor: searchParams.get('vendor') || undefined,
    }, credentials);

    return NextResponse.json({ products });
  } catch (error) {
    console.error('Shopify products error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

