import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')

    // Query inventory from armadillo_inventory schema using RPC functions
    let inventoryData: any[]
    
    if (sku) {
      // Get inventory for specific SKU
      const { data, error } = await supabase.rpc('get_inventory_by_sku', {
        inventory_sku: sku
      })
      
      if (error) throw error
      inventoryData = data || []
    } else {
      // Get all inventory
      const { data, error } = await supabase.rpc('get_inventory')
      
      if (error) throw error
      inventoryData = data || []
    }

    // Transform inventory data (inventory table already has product info: name, price, color, leadtime)
    const transformedInventory = inventoryData.map((item: any) => ({
      id: item.sku, // Using SKU as ID
      sku: item.sku,
      quantity: item.quantity || 0,
      updatedAt: item.updated_at,
      // Product info is stored directly in inventory table
      product: {
        id: item.sku,
        name: item.name,
        sku: item.sku,
        price: parseFloat(item.price || 0),
        color: item.color,
        leadtime: item.leadtime
      }
    }))

    return NextResponse.json({ inventory: transformedInventory })
  } catch (error) {
    console.error('Error fetching inventory:', error)
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sku, quantity } = body

    if (!sku) {
      return NextResponse.json(
        { error: 'SKU is required' },
        { status: 400 }
      )
    }

    // Use the update_stock function in armadillo_inventory schema
    const { data: inventoryData, error: updateError } = await supabase.rpc('update_stock', {
      target_sku: sku,
      count_change: quantity || 0
    })

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update inventory: ' + updateError.message },
        { status: 500 }
      )
    }

    const inventory = inventoryData?.[0]

    // Transform to expected format (product info is in inventory table)
    const transformedInventory = {
      id: inventory?.sku || sku,
      sku: inventory?.sku || sku,
      quantity: inventory?.quantity || quantity || 0,
      updatedAt: inventory?.updated_at || new Date().toISOString(),
      product: inventory ? {
        id: inventory.sku,
        name: inventory.name,
        sku: inventory.sku,
        price: parseFloat(inventory.price || 0),
        color: inventory.color,
        leadtime: inventory.leadtime
      } : null
    }

    return NextResponse.json(transformedInventory, { status: 201 })
  } catch (error) {
    console.error('Error creating inventory:', error)
    return NextResponse.json(
      { error: 'Failed to create inventory' },
      { status: 500 }
    )
  }
}

