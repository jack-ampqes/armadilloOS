import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { Role } from '@/lib/permissions'

const VALID_ROLES: Role[] = ['Admin', 'Sales Rep', 'Distributor', 'Technician']

/** PATCH /api/admin/users/[id] — update a user's role and/or name (Admin only). */
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
    const body = await request.json()
    const { role, name, company_id } = body

    const updates: { role?: string; name?: string | null; company_id?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    }

    if (role !== undefined) {
      if (!role || typeof role !== 'string') {
        return NextResponse.json(
          { error: 'Role must be a non-empty string' },
          { status: 400 }
        )
      }
      const trimmedRole = role.trim()
      if (!VALID_ROLES.includes(trimmedRole as Role)) {
        return NextResponse.json(
          { error: `Role must be one of: ${VALID_ROLES.join(', ')}` },
          { status: 400 }
        )
      }
      updates.role = trimmedRole
    }

    if (name !== undefined) {
      updates.name = typeof name === 'string' ? (name.trim() || null) : null
    }

    if (company_id !== undefined) {
      updates.company_id = company_id === null || company_id === '' ? null : String(company_id)
    }

    if (role === undefined && name === undefined && company_id === undefined) {
      return NextResponse.json(
        { error: 'Provide at least one of: role, name, company_id' },
        { status: 400 }
      )
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', id)
      .select('id, email, name, role, avatar_url, company_id, created_at, updated_at, companies(id, name, icon_url, logo_url)')
      .single()

    if (error) {
      console.error('Admin user update error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to update user' },
        { status: 500 }
      )
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Admin user update error:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
