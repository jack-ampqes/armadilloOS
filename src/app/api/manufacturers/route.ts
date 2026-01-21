import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeOrders = searchParams.get('includeOrders') === 'true'
    const activeOnly = searchParams.get('activeOnly') !== 'false' // Default to active only

    // Fetch manufacturers
    let query = supabase
      .schema('armadillo_inventory')
      .from('manufacturers')
      .select('*')
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data: manufacturers, error } = await query

    if (error) {
      console.error('Supabase error fetching manufacturers:', error)
      // If table doesn't exist, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json([])
      }
      throw error
    }

    // If includeOrders, fetch orders for each manufacturer
    if (includeOrders && manufacturers && manufacturers.length > 0) {
      const manufacturerIds = manufacturers.map(m => m.id)
      
      // Fetch all orders for these manufacturers
      const { data: orders, error: ordersError } = await supabase
        .schema('armadillo_inventory')
        .from('manufacturer_orders')
        .select('*')
        .in('manufacturer_id', manufacturerIds)
        .order('order_date', { ascending: false })

      if (ordersError) throw ordersError

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

      // Attach orders to manufacturers
      const manufacturersWithOrders = manufacturers.map(manufacturer => ({
        ...manufacturer,
        orders: ordersWithItems.filter(order => order.manufacturer_id === manufacturer.id)
      }))

      return NextResponse.json(manufacturersWithOrders)
    }

    return NextResponse.json(manufacturers || [])
  } catch (error: any) {
    console.error('Error fetching manufacturers:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch manufacturers', 
        details: error?.message || error?.details || JSON.stringify(error) || 'Unknown error',
        code: error?.code
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      contact_name,
      contact_email,
      contact_phone,
      website,
      address,
      city,
      state,
      zip_code,
      country,
      lead_time,
      payment_terms,
      notes
    } = body

    if (!name) {
      return NextResponse.json(
        { error: 'Manufacturer name is required' },
        { status: 400 }
      )
    }

    const { data: manufacturer, error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturers')
      .insert({
        name,
        contact_name,
        contact_email,
        contact_phone,
        website,
        address,
        city,
        state,
        zip_code,
        country,
        lead_time,
        payment_terms,
        notes,
        is_active: true
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json(manufacturer, { status: 201 })
  } catch (error) {
    console.error('Error creating manufacturer:', error)
    return NextResponse.json(
      { error: 'Failed to create manufacturer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
