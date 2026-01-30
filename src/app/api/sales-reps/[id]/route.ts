import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { data: salesRep, error } = await supabase
      .from('sales_reps')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !salesRep) {
      return NextResponse.json(
        { error: 'Sales rep not found' },
        { status: 404 }
      )
    }

    const transformed = {
      id: salesRep.id,
      name: salesRep.name,
      email: salesRep.email,
      phone: salesRep.phone,
      territory: salesRep.territory,
      commissionRate: salesRep.commission_rate
        ? parseFloat(salesRep.commission_rate)
        : null,
      color: salesRep.color ?? null,
      createdAt: salesRep.created_at,
      updatedAt: salesRep.updated_at
    }

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error fetching sales rep:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales rep' },
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
    const { name, email, phone, territory, commissionRate, color } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (email !== undefined) updates.email = email
    if (phone !== undefined) updates.phone = phone
    if (territory !== undefined) updates.territory = territory
    if (commissionRate !== undefined) updates.commission_rate = commissionRate
    if (color !== undefined) updates.color = color

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const { data: salesRep, error } = await supabase
      .from('sales_reps')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const transformed = {
      id: salesRep.id,
      name: salesRep.name,
      email: salesRep.email,
      phone: salesRep.phone,
      territory: salesRep.territory,
      commissionRate: salesRep.commission_rate
        ? parseFloat(salesRep.commission_rate)
        : null,
      color: salesRep.color ?? null,
      createdAt: salesRep.created_at,
      updatedAt: salesRep.updated_at
    }

    return NextResponse.json(transformed)
  } catch (error) {
    console.error('Error updating sales rep:', error)
    return NextResponse.json(
      { error: 'Failed to update sales rep' },
      { status: 500 }
    )
  }
}
