import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Fetch order
    const { data: order, error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      throw error
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_order_items')
      .select('*')
      .eq('order_id', id)

    if (itemsError) throw itemsError

    // Fetch manufacturer info
    const { data: manufacturer } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturers')
      .select('*')
      .eq('id', order.manufacturer_id)
      .single()

    return NextResponse.json({
      ...order,
      items: items || [],
      manufacturer
    })
  } catch (error) {
    console.error('Error fetching manufacturer order:', error)
    return NextResponse.json(
      { error: 'Failed to fetch manufacturer order', details: error instanceof Error ? error.message : 'Unknown error' },
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

    // Update the order
    const { data: order, error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .update({
        status: body.status,
        expected_delivery: body.expected_delivery,
        actual_delivery: body.actual_delivery,
        tracking_number: body.tracking_number,
        tracking_url: body.tracking_url,
        carrier: body.carrier,
        shipping_method: body.shipping_method,
        subtotal: body.subtotal,
        shipping_cost: body.shipping_cost,
        tax: body.tax,
        total_amount: body.total_amount,
        payment_status: body.payment_status,
        payment_method: body.payment_method,
        payment_reference: body.payment_reference,
        paid_at: body.paid_at,
        po_number: body.po_number,
        notes: body.notes,
        internal_notes: body.internal_notes
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 })
      }
      throw error
    }

    // Update order items if provided
    if (body.items) {
      // For simplicity, we'll update quantity_received on existing items
      for (const item of body.items) {
        if (item.id) {
          await supabase
            .schema('armadillo_inventory')
            .from('manufacturer_order_items')
            .update({
              quantity_received: item.quantity_received,
              notes: item.notes
            })
            .eq('id', item.id)
        }
      }
    }

    // Fetch updated items
    const { data: items } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_order_items')
      .select('*')
      .eq('order_id', id)

    return NextResponse.json({
      ...order,
      items: items || []
    })
  } catch (error) {
    console.error('Error updating manufacturer order:', error)
    return NextResponse.json(
      { error: 'Failed to update manufacturer order', details: error instanceof Error ? error.message : 'Unknown error' },
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

    // Delete order (items will cascade delete)
    const { error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting manufacturer order:', error)
    return NextResponse.json(
      { error: 'Failed to delete manufacturer order', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
