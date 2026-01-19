import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const { data: salesReps, error } = await supabase
      .from('sales_reps')
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
    const transformedSalesReps = salesReps?.map((rep: any) => ({
      id: rep.id,
      name: rep.name,
      email: rep.email,
      phone: rep.phone,
      territory: rep.territory,
      commissionRate: rep.commission_rate ? parseFloat(rep.commission_rate) : null,
      createdAt: rep.created_at,
      updatedAt: rep.updated_at,
      orders: (rep.orders || []).map((order: any) => ({
        id: order.id,
        orderNumber: order.order_number,
        totalAmount: parseFloat(order.total_amount),
        status: order.status,
        createdAt: order.created_at
      })).sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    })) || []

    return NextResponse.json(transformedSalesReps)
  } catch (error) {
    console.error('Error fetching sales reps:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales reps' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, phone, territory, commissionRate } = body

    const { data: salesRep, error } = await supabase
      .from('sales_reps')
      .insert({
        name,
        email,
        phone,
        territory,
        commission_rate: commissionRate
      })
      .select()
      .single()

    if (error) throw error

    // Transform to expected format
    const transformedSalesRep = {
      id: salesRep.id,
      name: salesRep.name,
      email: salesRep.email,
      phone: salesRep.phone,
      territory: salesRep.territory,
      commissionRate: salesRep.commission_rate ? parseFloat(salesRep.commission_rate) : null,
      createdAt: salesRep.created_at,
      updatedAt: salesRep.updated_at
    }

    return NextResponse.json(transformedSalesRep, { status: 201 })
  } catch (error) {
    console.error('Error creating sales rep:', error)
    return NextResponse.json(
      { error: 'Failed to create sales rep' },
      { status: 500 }
    )
  }
}

