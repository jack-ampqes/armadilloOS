import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseSkuToProduct } from '@/lib/sku-parser'
import { checkLowStockAlerts } from '@/lib/alerts'
import { requirePermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, 'InventoryViewing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')

    // Query inventory directly from armadillo_inventory.inventory table
    let query = supabase
      .schema('armadillo_inventory')
      .from('inventory')
      .select('*')
    
    if (sku) {
      query = query.eq('sku', sku)
    }
    
    const { data: inventoryData, error } = await query
    
    if (error) throw error

    // Debug: Log first item to see structure
    if (inventoryData && inventoryData.length > 0) {
      console.log('Sample inventory item:', JSON.stringify(inventoryData[0], null, 2))
    }

    // Transform inventory data and generate product names from SKU
    const transformedInventory = (inventoryData || []).map((item: any) => {
      // Try to find SKU field - could be 'sku', 'SKU', 'product_sku', etc.
      const skuValue = item.sku || item.SKU || item.product_sku || item.sku_code || ''
      
      // If no SKU found, log warning
      if (!skuValue) {
        console.warn('No SKU found in inventory item:', Object.keys(item))
      }
      
      // Always generate product name from SKU (prioritize SKU-generated name)
      let productName = 'Unknown Product'
      
      // Check if DB name looks like a UUID (we should ignore those)
      const dbName = item.name || item.product_name
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
      
      // Get parsed SKU for additional fields (even if invalid, we can use what we have)
      const parsedSku = parseSkuToProduct(skuValue || '')
      
      return {
        id: skuValue || item.id, // Use SKU as ID, fallback to item.id
        sku: skuValue,
        quantity: item.quantity ?? null,
        min_stock: item.min_stock ?? item.minStock ?? null,
        location: item.location,
        updatedAt: item.updated_at || item.updatedAt,
        // Product info is stored directly in inventory table
        product: {
          id: skuValue || item.id,
          name: productName,
          sku: skuValue,
          price: item.price ?? null,
          color: item.color || parsedSku.colorName,
          leadtime: item.leadtime,
          description: item.description,
          // Include parsed SKU data for additional context
          category: parsedSku.productType || item.category,
          familyName: parsedSku.familyName,
          productType: parsedSku.productType
        }
      }
    })

    return NextResponse.json({ inventory: transformedInventory })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, 'InventoryEditing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json()
    const { sku, quantity } = body

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    // Update inventory directly in armadillo_inventory.inventory table
    // First, check if inventory record exists
    const { data: existingInventory, error: fetchError } = await supabase
      .schema('armadillo_inventory')
      .from('inventory')
      .select('*')
      .eq('sku', sku)
      .single()

    let inventory
    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "not found"
      throw fetchError
    }

    if (existingInventory) {
      // Update existing inventory
      const { data: updatedInventory, error: updateError } = await supabase
        .schema('armadillo_inventory')
        .from('inventory')
        .update({ 
          quantity: (existingInventory.quantity || 0) + (quantity || 0),
          updated_at: new Date().toISOString()
        })
        .eq('sku', sku)
        .select()
        .single()

      if (updateError) throw updateError
      inventory = updatedInventory
    } else {
      // Create new inventory record (if product exists, you may want to handle this differently)
      return NextResponse.json(
        { error: 'Inventory record not found. Product must exist first.' },
        { status: 404 }
      )
    }

    // Transform to expected format and generate product name from SKU if needed
    const parsedSku = parseSkuToProduct(inventory?.sku || sku)
    const productName = inventory?.name || parsedSku.title || `Product ${inventory?.sku || sku}`
    
    const transformedInventory = {
      id: inventory?.sku || sku,
      sku: inventory?.sku || sku,
      quantity: inventory?.quantity ?? (quantity ?? 0),
      min_stock: inventory?.min_stock ?? inventory?.minStock ?? null,
      location: inventory?.location,
      updatedAt: inventory?.updated_at || new Date().toISOString(),
      product: inventory ? {
        id: inventory.sku,
        name: productName,
        sku: inventory.sku,
        price: inventory.price ? parseFloat(inventory.price) : null,
        color: inventory.color || parsedSku.colorName,
        leadtime: inventory.leadtime,
        description: inventory.description,
        category: parsedSku.productType || inventory.category,
        familyName: parsedSku.familyName,
        productType: parsedSku.productType
      } : null
    }

    // Check for low stock alerts after inventory update
    try {
      await checkLowStockAlerts()
    } catch (alertError) {
      console.error('Error checking alerts after inventory update:', alertError)
      // Don't fail the request if alert check fails
    }

    return NextResponse.json(transformedInventory, { status: 201 })
  } catch (error) {
    console.error('Error updating inventory:', error)
    return NextResponse.json(
      { error: 'Failed to update inventory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

