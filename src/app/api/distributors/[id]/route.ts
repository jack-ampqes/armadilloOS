import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geocode'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data: distributor, error } = await supabase
      .from('distributors')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !distributor) {
      return NextResponse.json(
        { error: 'Distributor not found' },
        { status: 404 }
      )
    }

    const transformed = {
      id: distributor.id,
      name: distributor.name,
      contactName: distributor.contact_name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      longitude: distributor.longitude ?? null,
      latitude: distributor.latitude ?? null,
      discountRate: distributor.discount_rate ? parseFloat(distributor.discount_rate) : null,
      color: distributor.color ?? null,
      createdAt: distributor.created_at,
      updatedAt: distributor.updated_at
    }

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error fetching distributor:', error)
    return NextResponse.json(
      { error: 'Failed to fetch distributor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, contactName, email, phone, address, discountRate, color, longitude, latitude } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (contactName !== undefined) updates.contact_name = contactName
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (address !== undefined) updates.address = address
    if (discountRate !== undefined) updates.discount_rate = discountRate
    if (color !== undefined) updates.color = color
    if (longitude !== undefined) updates.longitude = Number(longitude)
    if (latitude !== undefined) updates.latitude = Number(latitude)

    // If address changed and no lat/long provided, geocode before update
    const addressChanged = updates.address !== undefined
    const hasCoords = updates.longitude !== undefined && updates.latitude !== undefined
    if (addressChanged && !hasCoords) {
      const addressStr = (updates.address as string)?.trim()
      if (addressStr) {
        const geo = await geocodeAddress(addressStr)
        if (geo) {
          updates.longitude = Number(geo.longitude)
          updates.latitude = Number(geo.latitude)
        } else {
          updates.longitude = null
          updates.latitude = null
        }
      } else {
        updates.longitude = null
        updates.latitude = null
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: distributor, error } = await supabase
      .from('distributors')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const transformed = {
      id: distributor.id,
      name: distributor.name,
      contactName: distributor.contact_name,
      email: distributor.email,
      phone: distributor.phone,
      address: distributor.address,
      longitude: distributor.longitude ?? null,
      latitude: distributor.latitude ?? null,
      discountRate: distributor.discount_rate ? parseFloat(distributor.discount_rate) : null,
      color: distributor.color ?? null,
      createdAt: distributor.created_at,
      updatedAt: distributor.updated_at
    }

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error updating distributor:', error)
    return NextResponse.json(
      { error: 'Failed to update distributor' },
      { status: 500 }
    )
  }
}
