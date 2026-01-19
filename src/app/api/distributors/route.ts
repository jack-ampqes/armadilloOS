import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: distributors, error } = await supabase
      .from('distributors')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error

    // Transform data to match expected format
    const transformedDistributors = distributors?.map((distributor: any) => ({
      id: distributor.id,
      name: distributor.name,
      contactName: distributor.contact_name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      city: distributor.city,
      state: distributor.state,
      zipCode: distributor.zip_code,
      country: distributor.country,
      discountRate: distributor.discount_rate ? parseFloat(distributor.discount_rate) : null,
      createdAt: distributor.created_at,
      updatedAt: distributor.updated_at
    })) || []

    return NextResponse.json(transformedDistributors)
  } catch (error) {
    console.error('Error fetching distributors:', error)
    return NextResponse.json(
      { error: 'Failed to fetch distributors' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, contactName, email, phone, address, city, state, zipCode, country, discountRate } = body

    const { data: distributor, error } = await supabase
      .from('distributors')
      .insert({
        name,
        contact_name: contactName,
        email,
        phone,
        address,
        city,
        state,
        zip_code: zipCode,
        country,
        discount_rate: discountRate
      })
      .select()
      .single()

    if (error) throw error

    // Transform to expected format
    const transformedDistributor = {
      id: distributor.id,
      name: distributor.name,
      contactName: distributor.contact_name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      city: distributor.city,
      state: distributor.state,
      zipCode: distributor.zip_code,
      country: distributor.country,
      discountRate: distributor.discount_rate ? parseFloat(distributor.discount_rate) : null,
      createdAt: distributor.created_at,
      updatedAt: distributor.updated_at
    }

    return NextResponse.json(transformedDistributor, { status: 201 })
  } catch (error) {
    console.error('Error creating distributor:', error)
    return NextResponse.json(
      { error: 'Failed to create distributor' },
      { status: 500 }
    )
  }
}

