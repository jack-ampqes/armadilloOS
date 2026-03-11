import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/** GET /api/admin/companies — list all companies (Admin only). */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id, name, icon_url, logo_url, created_at, updated_at')
      .order('name', { ascending: true })

    if (error) {
      console.error('Admin companies list error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to list companies' },
        { status: 500 }
      )
    }
    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Admin companies list error:', error)
    return NextResponse.json(
      { error: 'Failed to list companies' },
      { status: 500 }
    )
  }
}

/** POST /api/admin/companies — create a company (Admin only). */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert({
        name,
        updated_at: new Date().toISOString(),
      })
      .select('id, name, icon_url, logo_url, created_at, updated_at')
      .single()

    if (error) {
      console.error('Admin companies create error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to create company' },
        { status: 500 }
      )
    }
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Admin companies create error:', error)
    return NextResponse.json(
      { error: 'Failed to create company' },
      { status: 500 }
    )
  }
}
