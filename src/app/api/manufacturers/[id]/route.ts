import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const LOGO_BUCKET = 'manufacturer-logos'

async function getManufacturerLogoUrl(manufacturerId: string): Promise<string | null> {
  const { data: files, error } = await supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .list(manufacturerId, {
      limit: 50,
      sortBy: { column: 'updated_at', order: 'desc' },
    })

  if (error || !files || files.length === 0) {
    return null
  }

  const preferred =
    files.find((f) => f.name.startsWith('logo.')) ||
    files.find((f) => /\.(png|jpe?g|webp|gif)$/i.test(f.name)) ||
    files[0]

  const { data } = supabaseAdmin.storage
    .from(LOGO_BUCKET)
    .getPublicUrl(`${manufacturerId}/${preferred.name}`)

  return data.publicUrl || null
}

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
    let orderItems: Array<{ order_id: string }> = []
    
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

    const logoUrl = await getManufacturerLogoUrl(id)

    return NextResponse.json({
      ...manufacturer,
      logo_url: logoUrl,
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
