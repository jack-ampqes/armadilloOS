import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getProduct as getShopifyProduct } from '@/lib/shopify'
import { parseSkuToProduct } from '@/lib/sku-parser'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { syncSkuQuantityToShopify } from '@/lib/shopify-inventory-sync'
import { requirePermission } from '@/lib/auth'
import { checkLowStockAlerts } from '@/lib/alerts'

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
  const auth = requirePermission(request, 'InventoryEditing')
  if ('response' in auth) {
    return auth.response
  }
  const { user } = auth

  try {
    const { id: sku } = await params
    const body = await request.json()
    const { description, price, color, leadtime, quantity, minStock, location } = body

    // Product details and stock both live in armadillo_inventory.inventory.
    // (There is no armadillo_inventory.products table - the old update_product /
    // upsert_inventory RPCs pointed at one and always failed.)
    const { data: existing, error: fetchError } = await supabase
      .schema('armadillo_inventory')
      .from('inventory')
      .select('*')
      .eq('sku', sku)
      .single()

    if (fetchError && fetchError.code !== 'PGRST116') {
      throw fetchError
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    }

    // NOTE: inventory.name is a legacy uuid column, not the display name - never
    // write the product title into it. Display names are derived from the SKU.
    if (price !== undefined) updates.price = price
    if (color !== undefined) updates.color = color || null
    if (leadtime !== undefined) updates.leadtime = leadtime || null
    if (quantity !== undefined) updates.quantity = quantity

    // These columns only exist in some environments - only write them when present.
    if (description !== undefined && 'description' in existing) updates.description = description || null
    if (minStock !== undefined && 'min_stock' in existing) updates.min_stock = minStock
    if (location !== undefined && 'location' in existing) updates.location = location || null

    const { data: updated, error: updateError } = await supabase
      .schema('armadillo_inventory')
      .from('inventory')
      .update(updates)
      .eq('sku', sku)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating product:', updateError)
      return NextResponse.json(
        { error: 'Failed to update product: ' + updateError.message },
        { status: 500 }
      )
    }

    // Log the stock change so it shows up in inventory history
    const previousQuantity = existing.quantity ?? 0
    const newQuantity = updated.quantity ?? 0
    if (quantity !== undefined && newQuantity !== previousQuantity) {
      await supabase
        .schema('armadillo_inventory')
        .from('inventory_history')
        .insert({
          sku,
          quantity_change: newQuantity - previousQuantity,
          quantity_after: newQuantity,
          source: 'manual',
          user_id: user.id,
          user_email: user.email
        })

      try {
        await checkLowStockAlerts()
      } catch (alertError) {
        console.error('Error checking alerts after product update:', alertError)
      }
    }

    let shopifySync = null
    if (quantity !== undefined) {
      shopifySync = await syncSkuQuantityToShopify({
        sku,
        quantity: Number(newQuantity) || 0,
      })
    }

    const parsedSku = parseSkuToProduct(updated.sku || sku)

    // Return updated product
    const response = {
      id: updated.sku,
      name: parsedSku.valid && parsedSku.title ? parsedSku.title : `Product ${updated.sku}`,
      description: updated.description ?? null,
      sku: updated.sku,
      price: updated.price !== null && updated.price !== undefined ? parseFloat(updated.price) : 0,
      color: updated.color ?? parsedSku.colorName ?? null,
      leadtime: updated.leadtime ?? null,
      inventory: {
        quantity: newQuantity,
        minStock: updated.min_stock ?? null,
        location: updated.location ?? null,
        lastUpdated: updated.updated_at ?? null,
      },
      shopifySync
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

