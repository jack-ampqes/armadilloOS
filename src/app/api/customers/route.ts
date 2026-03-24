import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1)
    const pageSize = Math.min(Math.max(parseInt(searchParams.get('pageSize') || '250', 10), 1), 500)
    const search = (searchParams.get('search') || '').trim()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true })
      .range(from, to)

    if (search) {
      const escaped = search.replace(/[%_]/g, '\\$&')
      query = query.or(`name.ilike.%${escaped}%,company_name.ilike.%${escaped}%,email.ilike.%${escaped}%,phone.ilike.%${escaped}%`)
    }

    const { data: customers, error, count } = await query

    if (error) throw error

    // Transform data to match expected format
    const transformedCustomers = customers?.map((customer: any) => ({
      id: customer.id,
      name: customer.name,
      companyName: customer.company_name,
      email: customer.email,
      emails: Array.isArray(customer.emails) ? customer.emails : [],
      phone: customer.phone,
      phones: Array.isArray(customer.phones) ? customer.phones : [],
      address: customer.address,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zip_code,
      country: customer.country,
      createdAt: customer.created_at,
      updatedAt: customer.updated_at,
      // Keep API shape stable even if no customer->orders FK exists in DB.
      orders: []
    })) || []

    return NextResponse.json({
      data: transformedCustomers,
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(Math.ceil((count ?? 0) / pageSize), 1),
      },
    })
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
        emails: email ? [email] : [],
        phone,
        phones: phone ? [phone] : [],
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
      companyName: customer.company_name,
      email: customer.email,
      emails: Array.isArray(customer.emails) ? customer.emails : [],
      phone: customer.phone,
      phones: Array.isArray(customer.phones) ? customer.phones : [],
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

