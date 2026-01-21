import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch manufacturer
    const { data: manufacturer, error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturers')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 })
      }
      throw error
    }

    // Fetch orders for this manufacturer
    const { data: orders, error: ordersError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('*')
      .eq('manufacturer_id', id)
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

    return NextResponse.json({
      ...manufacturer,
      orders: ordersWithItems
    })
  } catch (error) {
    console.error('Error fetching manufacturer:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manufacturer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const { data: manufacturer, error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturers')
      .update({
        name: body.name,
        contact_name: body.contact_name,
        contact_email: body.contact_email,
        contact_phone: body.contact_phone,
        website: body.website,
        address: body.address,
        city: body.city,
        state: body.state,
        zip_code: body.zip_code,
        country: body.country,
        lead_time: body.lead_time,
        payment_terms: body.payment_terms,
        notes: body.notes,
        is_active: body.is_active
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 })
      }
      throw error
    }

    return NextResponse.json(manufacturer)
  } catch (error) {
    console.error('Error updating manufacturer:', error)
    return NextResponse.json(
      { error: 'Failed to update manufacturer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturers')
      .update({ is_active: false })
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting manufacturer:', error)
    return NextResponse.json(
      { error: 'Failed to delete manufacturer', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
