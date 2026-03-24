import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    const name = body.name?.trim()
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const email = body.email?.trim() || null
    const phone = body.phone?.trim() || null

    const updatePayload = {
      name,
      company_name: body.companyName?.trim() || null,
      email,
      emails: email ? [email] : [],
      phone,
      phones: phone ? [phone] : [],
      address: body.address?.trim() || null,
      city: body.city?.trim() || null,
      state: body.state?.trim() || null,
      zip_code: body.zipCode?.trim() || null,
      country: body.country?.trim() || null,
    }

    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({
      id: data.id,
      name: data.name,
      companyName: data.company_name,
      email: data.email,
      emails: Array.isArray(data.emails) ? data.emails : [],
      phone: data.phone,
      phones: Array.isArray(data.phones) ? data.phones : [],
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zip_code,
      country: data.country,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      orders: [],
    })
  } catch (error) {
    console.error('Error updating customer:', error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
}

