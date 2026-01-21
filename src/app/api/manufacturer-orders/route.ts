import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const manufacturerId = searchParams.get('manufacturerId')
    const status = searchParams.get('status')

    let query = supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('*')
      .order('order_date', { ascending: false })

    if (manufacturerId) {
      query = query.eq('manufacturer_id', manufacturerId)
    }

    if (status) {
      query = query.eq('status', status)
    }

    const { data: orders, error } = await query

    if (error) throw error

    // Fetch all order items
    const orderIds = (orders || []).map(o => o.id)
    let orderItems: any[] = []
    
    if (orderIds.length > 0) {
      const { data: items, error: itemsError } = await supabase
        .schema('armadillo_inventory')
        .from('manufacturer_order_items')
        .select('*')
        .in('order_id', orderIds)

      if (itemsError) throw itemsError
      orderItems = items || []
    }

    // Attach items to orders
    const ordersWithItems = (orders || []).map(order => ({
      ...order,
      items: orderItems.filter(item => item.order_id === order.id)
    }))

    return NextResponse.json(ordersWithItems)
  } catch (error) {
    console.error('Error fetching manufacturer orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manufacturer orders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      manufacturer_id,
      order_number,
      expected_delivery,
      tracking_number,
      tracking_url,
      carrier,
      shipping_method,
      subtotal,
      shipping_cost,
      tax,
      total_amount,
      po_number,
      notes,
      items
    } = body

    if (!manufacturer_id) {
      return NextResponse.json(
        { error: 'Manufacturer ID is required' },
        { status: 400 }
      )
    }

    // Generate order number if not provided
    const orderNumber = order_number || `MO-${Date.now()}`

    // Create the order
    const { data: order, error: orderError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .insert({
        order_number: orderNumber,
        manufacturer_id,
        status: 'pending',
        order_date: new Date().toISOString(),
        expected_delivery,
        tracking_number,
        tracking_url,
        carrier,
        shipping_method,
        subtotal: subtotal || 0,
        shipping_cost: shipping_cost || 0,
        tax: tax || 0,
        total_amount: total_amount || 0,
        po_number,
        notes
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Create order items if provided
    if (items && items.length > 0) {
      const orderItems = items.map((item: any) => ({
        order_id: order.id,
        sku: item.sku,
        product_name: item.product_name,
        quantity_ordered: item.quantity_ordered || item.quantity,
        quantity_received: 0,
        unit_cost: item.unit_cost,
        total_cost: item.total_cost || (item.unit_cost * (item.quantity_ordered || item.quantity)),
        manufacturer_sku: item.manufacturer_sku,
        notes: item.notes
      }))

      const { error: itemsError } = await supabase
        .schema('armadillo_inventory')
        .from('manufacturer_order_items')
        .insert(orderItems)

      if (itemsError) throw itemsError
    }

    // Fetch the complete order with items
    const { data: completeOrder, error: fetchError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('*')
      .eq('id', order.id)
      .single()

    if (fetchError) throw fetchError

    const { data: createdItems } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_order_items')
      .select('*')
      .eq('order_id', order.id)

    return NextResponse.json({
      ...completeOrder,
      items: createdItems || []
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating manufacturer order:', error)
    return NextResponse.json(
      { error: 'Failed to create manufacturer order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
