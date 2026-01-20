import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getProduct as getShopifyProduct } from '@/lib/shopify'
import { parseSkuToProduct } from '@/lib/sku-parser'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'

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
      const creds = await getDefaultShopifyCredentials()
      const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken }

      // Fetch all products to find the one with matching variant
      // We need to search through products to find the variant
      const { getProducts } = await import('@/lib/shopify')
      const shopifyProducts = await getProducts({ limit: 250 }, credentials)
      
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

    // Query inventory directly from armadillo_inventory.inventory table (same approach as inventory list)
    const { data: inventoryData, error } = await supabase
      .schema('armadillo_inventory')
      .from('inventory')
      .select('*')
      .eq('sku', sku)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return NextResponse.json(
          { error: 'Product not found' },
          { status: 404 }
        )
      }
      throw error
    }

    if (!inventoryData) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Generate product name from SKU (same logic as inventory API)
    const skuValue = inventoryData.sku || ''
    let productName = 'Unknown Product'
    
    // Check if DB name looks like a UUID (we should ignore those)
    const dbName = inventoryData.name || inventoryData.product_name
    const isUuid = dbName && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbName)
    
    if (skuValue) {
      const parsedSku = parseSkuToProduct(skuValue)
      // Use SKU-generated name if valid, otherwise fallback
      if (parsedSku.valid && parsedSku.title) {
        productName = parsedSku.title
      } else {
        // If SKU parsing failed, try DB name (but not if it's a UUID) or use SKU as fallback
        productName = (!isUuid && dbName) ? dbName : `Product ${skuValue}`
      }
    } else {
      // No SKU found, use DB name (but not if it's a UUID) or generic
      productName = (!isUuid && dbName) ? dbName : 'Unknown Product'
    }

    // Get parsed SKU for additional fields
    const parsedSku = parseSkuToProduct(skuValue || '')

    // Transform data to match expected format (same structure as inventory list)
    const transformedProduct = {
      id: skuValue,
      name: productName,
      description: inventoryData.description || null,
      sku: skuValue,
      price: inventoryData.price ? parseFloat(inventoryData.price) : 0,
      color: inventoryData.color || parsedSku.colorName || null,
      leadtime: inventoryData.leadtime || null,
      category: parsedSku.productType || inventoryData.category || null,
      source: 'local' as const,
      inventory: {
        quantity: inventoryData.quantity ?? 0,
        minStock: inventoryData.min_stock ?? inventoryData.minStock ?? 0,
        location: inventoryData.location || null,
        lastUpdated: inventoryData.updated_at || inventoryData.updatedAt || null,
      }
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

