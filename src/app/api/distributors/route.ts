import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geocode'

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
    const { name, contactName, email, phone, address, discountRate, longitude, latitude } = body

    const insertData: Record<string, unknown> = {
      name,
      contact_name: contactName,
      email,
      phone,
      address,
      discount_rate: discountRate
    }
    if (longitude !== undefined) insertData.longitude = Number(longitude)
    if (latitude !== undefined) insertData.latitude = Number(latitude)

    const { data: distributor, error } = await supabase
      .from('distributors')
      .insert(insertData)
      .select()
      .single()

    if (error) throw error

    // Geocode address → lat/long if not provided
    const hasCoords = distributor.longitude != null && distributor.latitude != null
    if (!hasCoords) {
      const addressStr = distributor.address?.trim()
      if (addressStr) {
        const geo = await geocodeAddress(addressStr)
        if (geo) {
        await supabase
          .from('distributors')
          .update({
            longitude: Number(geo.longitude),
            latitude: Number(geo.latitude)
          })
          .eq('id', distributor.id)
        }
      }
    }

    // Transform to expected format
    const transformedDistributor = {
      id: distributor.id,
      name: distributor.name,
      contactName: distributor.contact_name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
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

