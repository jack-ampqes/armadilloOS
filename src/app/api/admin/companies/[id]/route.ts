import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/** GET /api/admin/companies/[id] — get one company (Admin only). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id, name, icon_url, logo_url, created_at, updated_at')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Admin company get error:', error)
    return NextResponse.json(
      { error: 'Failed to get company' },
      { status: 500 }
    )
  }
}

/** PATCH /api/admin/companies/[id] — update company name (Admin only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    if (name === undefined) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({
        name: name || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, icon_url, logo_url, created_at, updated_at')
      .single()

    if (error) {
      console.error('Admin company update error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update company' },
        { status: 500 }
      )
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error('Admin company update error:', error)
    return NextResponse.json(
      { error: 'Failed to update company' },
      { status: 500 }
    )
  }
}

/** DELETE /api/admin/companies/[id] — delete company; unassigns users (Admin only). */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params

    await supabaseAdmin
      .from('users')
      .update({ company_id: null, updated_at: new Date().toISOString() })
      .eq('company_id', id)

    const { error } = await supabaseAdmin
      .from('companies')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Admin company delete error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to delete company' },
        { status: 500 }
      )
    }
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error('Admin company delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete company' },
      { status: 500 }
    )
  }
}
