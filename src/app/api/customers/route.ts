import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select(`
        *,
        orders(
          id,
          order_number,
          total_amount,
          status,
          created_at
        )
      `)
      .order('name', { ascending: true })

    if (error) throw error

    // Transform data to match expected format
    const transformedCustomers = customers?.map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zip_code,
      country: customer.country,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      orders: (customer.orders || []).map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        createdAt: order.created_at
      })).sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    })) || []

    return NextResponse.json(transformedCustomers)
  } catch (error) {
    console.error('Error fetching customers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, address, city, state, zipCode, country } = body

    const { data: customer, error } = await supabase
      .from('customers')
      .insert({
        name,
        email,
        phone,
        address,
        city,
        state,
        zip_code: zipCode,
        country
      })
      .select()
      .single()

    if (error) throw error

    // Transform to expected format
    const transformedCustomer = {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zip_code,
      country: customer.country,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at
    }

    return NextResponse.json(transformedCustomer, { status: 201 })
  } catch (error) {
    console.error('Error creating customer:', error)
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}

