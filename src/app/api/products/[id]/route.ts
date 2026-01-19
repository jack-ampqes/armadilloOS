import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getProduct as getShopifyProduct } from '@/lib/shopify'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if this is a Shopify product ID (starts with "shopify-")
    if (id.startsWith('shopify-')) {
      // Extract variant ID from the prefixed ID
      const variantId = parseInt(id.replace('shopify-', ''))
      
      // Check if Shopify credentials are configured
      if (!process.env.SHOPIFY_STORE_DOMAIN || !process.env.SHOPIFY_ACCESS_TOKEN) {
        return NextResponse.json(
          { 
            error: 'Shopify integration not configured',
            message: 'Please set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN in your .env.local file'
          },
          { status: 400 }
        )
      }

      // Fetch all products to find the one with matching variant
      // We need to search through products to find the variant
      const { getProducts } = await import('@/lib/shopify')
      const shopifyProducts = await getProducts({ limit: 250 })
      
      // Find the product and variant
      let foundVariant = null
      let foundProduct = null
      
      for (const product of shopifyProducts) {
        const variant = product.variants.find(v => v.id === variantId)
        if (variant) {
          foundVariant = variant
          foundProduct = product
          break
        }
      }

      if (!foundVariant || !foundProduct) {
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }

      // Transform to match expected format
      const transformedProduct = {
        id: `shopify-${foundVariant.id}`,
        productId: `shopify-${foundProduct.id}`,
        name: foundProduct.variants.length > 1 
          ? `${foundProduct.title} - ${foundVariant.title}` 
          : foundProduct.title,
        description: foundProduct.body_html?.replace(/<[^>]*>/g, '') || '',
        sku: foundVariant.sku || `SHOP-${foundVariant.id}`,
        price: parseFloat(foundVariant.price),
        category: foundProduct.product_type || 'Uncategorized',
        source: 'shopify',
        inventory: {
          quantity: foundVariant.inventory_quantity,
          minStock: 10,
          inventoryItemId: foundVariant.inventory_item_id,
        },
        shopifyData: {
          productId: foundProduct.id,
          variantId: foundVariant.id,
          inventoryItemId: foundVariant.inventory_item_id,
          handle: foundProduct.handle,
          vendor: foundProduct.vendor,
          tags: foundProduct.tags,
          images: foundProduct.images,
        },
        orderItems: []
      }

      return NextResponse.json(transformedProduct)
    }

    // Local product - use SKU
    const sku = id

    // Get product by SKU using RPC function (products are in armadillo_inventory schema)
    const { data: productData, error: rpcError } = await supabase.rpc('get_product_by_sku', {
      product_sku: sku
    })

    if (rpcError) throw rpcError

    if (!productData || productData.length === 0) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const product = productData[0]

    // Get inventory information if available using RPC function
    const { data: inventoryData } = await supabase.rpc('get_inventory_by_sku', {
      inventory_sku: sku
    })

    // Transform data to match expected format
    const transformedProduct = {
      id: product.sku, // Using SKU as ID
      name: product.name,
      description: product.description,
      sku: product.sku,
      price: parseFloat(product.price),
      color: product.color || null,
      leadtime: product.leadtime || null,
      category: product.category || null,
      source: 'local',
      inventory: inventoryData && inventoryData.length > 0 ? {
        quantity: inventoryData[0].quantity || 0,
        minStock: inventoryData[0].min_stock || 0,
        location: inventoryData[0].location || null,
        lastUpdated: inventoryData[0].updated_at || null,
      } : null
    }

    return NextResponse.json(transformedProduct)
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sku } = await params
    const body = await request.json()
    const { name, description, price, color, leadtime, quantity, minStock, location } = body

    // Update product in armadillo_inventory.products table using RPC function
    const { data: productDataArray, error: productError } = await supabase.rpc('update_product', {
      product_sku: sku,
      product_name: name,
      product_description: description || null,
      product_price: price || 0,
      product_color: color || null,
      product_leadtime: leadtime || null
    })

    if (productError) {
      console.error('Error updating product:', productError)
      return NextResponse.json(
        { error: 'Failed to update product: ' + productError.message },
        { status: 500 }
      )
    }

    const productData = productDataArray?.[0] // RPC returns array, get first item
    if (!productData) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Update inventory if provided using RPC function
    if (quantity !== undefined) {
      const { error: inventoryError } = await supabase.rpc('upsert_inventory', {
        inventory_name: name || null,
        inventory_sku: sku,
        inventory_quantity: quantity !== undefined ? quantity : null,
        inventory_updated_at: null, // Will use NOW() in function
        inventory_price: price !== undefined ? price : null,
        inventory_color: color || null,
        inventory_leadtime: leadtime || null
      })
      
      if (inventoryError) {
        console.error('Error updating inventory:', inventoryError)
      }
    }

    // Fetch updated inventory using RPC function
    const { data: inventoryData } = await supabase.rpc('get_inventory_by_sku', {
      inventory_sku: sku
    })

    // Return updated product
    const response = {
      id: productData.sku,
      name: productData.name,
      description: productData.description,
      sku: productData.sku,
      price: parseFloat(productData.price),
      color: productData.color,
      leadtime: productData.leadtime,
      inventory: inventoryData && inventoryData.length > 0 ? {
        quantity: inventoryData[0].quantity || 0
      } : null
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    )
  }
}

