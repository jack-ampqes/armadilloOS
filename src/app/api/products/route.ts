import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { getProducts as getShopifyProducts, getProduct as getShopifyProduct } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')
    const source = searchParams.get('source')

    // If source=shopify, fetch from Shopify API
    if (source === 'shopify') {
      const creds = await getDefaultShopifyCredentials()
      const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken }

      const shopifyProducts = await getShopifyProducts({
        limit: parseInt(searchParams.get('limit') || '50'),
        status: 'active',
      }, credentials)

      // Transform Shopify products to match local format
      const transformedProducts = shopifyProducts.flatMap((product) => 
        product.variants.map((variant) => ({
          id: `shopify-${variant.id}`,
          productId: `shopify-${product.id}`,
          name: product.variants.length > 1 
            ? `${product.title} - ${variant.title}` 
            : product.title,
          description: product.body_html?.replace(/<[^>]*>/g, '') || '',
          sku: variant.sku || `SHOP-${variant.id}`,
          price: parseFloat(variant.price),
          category: product.product_type || 'Uncategorized',
          source: 'shopify',
          inventory: {
            quantity: variant.inventory_quantity,
            minStock: 10, // Default min stock for Shopify items
            inventoryItemId: variant.inventory_item_id,
          },
          shopifyData: {
            productId: product.id,
            variantId: variant.id,
            inventoryItemId: variant.inventory_item_id,
            handle: product.handle,
            vendor: product.vendor,
            tags: product.tags,
            images: product.images,
          },
          orderItems: []
        }))
      )

      return NextResponse.json(transformedProducts)
    }

    // Default: fetch from Supabase
    let products
    let error

    if (sku) {
      // Get single product by SKU using RPC
      const { data, error: rpcError } = await supabase.rpc('get_product_by_sku', {
        product_sku: sku
      })
      products = data
      error = rpcError
    } else {
      // Get all products using RPC
      const { data, error: rpcError } = await supabase.rpc('get_products')
      products = data
      error = rpcError
    }

    if (error) throw error

    // Transform data to match expected format
    const transformedProducts = products?.map((product: any) => ({
      id: product.sku, // Using SKU as ID since there's no id column
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: parseFloat(product.price),
      color: product.color,
      leadtime: product.leadtime,
      source: 'local',
      inventory: null, // Inventory is tracked separately in armadillo_inventory.inventory table
      orderItems: []
    })) || []

    if (sku) {
      return NextResponse.json({ products: transformedProducts })
    }

    return NextResponse.json(transformedProducts)
  } catch (error) {
    console.error('Error fetching products:', error)
    
    // Check if it's a Shopify credentials error
    if (error instanceof Error && error.message.includes('Missing Shopify credentials')) {
      return NextResponse.json(
        { 
          error: 'Shopify integration not configured',
          message: error.message
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch products',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sku, price, color, leadtime, quantity } = body

    // Validate required fields
    if (!sku || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: sku and price are required' },
        { status: 400 }
      )
    }

    // Insert directly into inventory table with only the schema fields
    const { data: productData, error: insertError } = await supabaseAdmin
      .schema('armadillo_inventory')
      .from('inventory')
      .insert({
        sku: sku,
        price: parseFloat(price.toString()) || 0,
        color: color || null,
        leadtime: leadtime || null,
        quantity: quantity !== undefined ? parseInt(quantity.toString()) : 0
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating product:', insertError)
      throw new Error(`Failed to create product: ${insertError.message || JSON.stringify(insertError)}`)
    }

    if (!productData) {
      throw new Error('Product was not created successfully')
    }

    // Return product in expected format
    const response = {
      id: productData.sku,
      sku: productData.sku,
      price: parseFloat(productData.price),
      color: productData.color || null,
      leadtime: productData.leadtime || null,
      quantity: productData.quantity || 0
    }

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorDetails = error instanceof Error && 'details' in error ? (error as any).details : undefined
    const errorHint = error instanceof Error && 'hint' in error ? (error as any).hint : undefined
    
    return NextResponse.json(
      { 
        error: 'Failed to create product',
        message: errorMessage,
        details: errorDetails,
        hint: errorHint
      },
      { status: 500 }
    )
  }
}

