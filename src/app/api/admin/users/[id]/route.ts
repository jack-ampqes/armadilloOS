import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import type { Role } from '@/lib/permissions'

const VALID_ROLES: Role[] = ['Admin', 'Sales Rep', 'Distributor', 'Technician']

/** PATCH /api/admin/users/[id] — update a user's role (Admin only). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'FullAccess')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    const body = await request.json()
    const { role } = body

    if (!role || typeof role !== 'string') {
      return NextResponse.json(
        { error: 'Role is required' },
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

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .update({
        role: trimmedRole,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, email, name, role, created_at, updated_at')
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
