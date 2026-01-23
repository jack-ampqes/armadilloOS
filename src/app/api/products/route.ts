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
    const { name, description, sku, price, category, quantity, minStock, location } = body

    // Validate required fields
    if (!name || !sku || price === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: name, sku, and price are required' },
        { status: 400 }
      )
    }

    // Create product using RPC function
    // Note: The insert_product RPC expects color and leadtime, but we're receiving category
    // We'll pass null for color and leadtime since category isn't in the products table
    // Use supabaseAdmin for RPC calls to ensure proper permissions
    const { data: productData, error: productError } = await supabaseAdmin.rpc('insert_product', {
      product_sku: sku,
      product_name: name,
      product_description: description || null,
      product_price: parseFloat(price.toString()) || 0,
      product_color: null, // Category is not stored in products table
      product_leadtime: null
    })

    if (productError) {
      console.error('Error creating product via RPC:', productError)
      // If RPC fails, try direct insert as fallback
      console.log('Attempting direct insert as fallback...')
      const { data: directInsertData, error: directInsertError } = await supabaseAdmin
        .schema('armadillo_inventory')
        .from('products')
        .insert({
          sku: sku,
          name: name,
          description: description || null,
          price: parseFloat(price.toString()) || 0,
          color: null,
          leadtime: null
        })
        .select()
        .single()

      if (directInsertError) {
        console.error('Direct insert also failed:', directInsertError)
        throw new Error(`Failed to create product: ${productError.message || productError}. Direct insert error: ${directInsertError.message || directInsertError}`)
      }

      // Use direct insert result
      const product = directInsertData
      if (!product) {
        throw new Error('Product was not created successfully')
      }

      // Continue with inventory creation...
      if (quantity !== undefined || minStock !== undefined || location !== undefined) {
        const { error: inventoryError } = await supabaseAdmin
          .schema('armadillo_inventory')
          .from('inventory')
          .upsert({
            sku: sku,
            name: name || null,
            quantity: quantity !== undefined ? quantity : 0,
            min_stock: minStock !== undefined ? minStock : null,
            location: location || null,
            price: price !== undefined ? parseFloat(price.toString()) : null,
            category: category || null,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'sku'
          })
        
        if (inventoryError) {
          console.error('Error creating inventory:', inventoryError)
        }
      }

      const { data: inventoryData } = await supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory')
        .select('quantity, min_stock, location')
        .eq('sku', sku)
        .single()

      return NextResponse.json({
        id: product.sku,
        name: product.name,
        description: product.description,
        sku: product.sku,
        price: parseFloat(product.price),
        color: product.color,
        leadtime: product.leadtime,
        category: category || null,
        inventory: inventoryData ? {
          quantity: inventoryData.quantity || 0,
          minStock: inventoryData.min_stock || null,
          location: inventoryData.location || null
        } : null
      }, { status: 201 })
    }
    
    const product = productData?.[0] // RPC returns array, get first item

    if (!product) {
      throw new Error('Product was not created successfully')
    }

    // Create/update inventory record with quantity, minStock, and location
    // Use direct Supabase upsert to handle both creation and updates
    if (quantity !== undefined || minStock !== undefined || location !== undefined) {
      const { error: inventoryError } = await supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory')
        .upsert({
          sku: sku,
          name: name || null,
          quantity: quantity !== undefined ? quantity : 0,
          min_stock: minStock !== undefined ? minStock : null,
          location: location || null,
          price: price !== undefined ? price : null,
          category: category || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'sku'
        })
      
      if (inventoryError) {
        console.error('Error creating inventory:', inventoryError)
        // Don't fail the request if inventory creation fails, but log it
      }
    }

    // Fetch created inventory to return in response
    const { data: inventoryData } = await supabaseAdmin
      .schema('armadillo_inventory')
      .from('inventory')
      .select('quantity, min_stock, location')
      .eq('sku', sku)
      .single()

    // Return product with inventory in expected format
    const response = {
      id: product.sku, // Using SKU as ID since there's no id column
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: parseFloat(product.price),
      color: product.color,
      leadtime: product.leadtime,
      category: category || null,
      inventory: inventoryData ? {
        quantity: inventoryData.quantity || 0,
        minStock: inventoryData.min_stock || null,
        location: inventoryData.location || null
      } : null
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

