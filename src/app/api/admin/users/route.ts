import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

/** GET /api/admin/users — list all users (Admin only). */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Admin users list error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to list users' },
        { status: 500 }
      )
    }

    return NextResponse.json(users ?? [])
  } catch (error) {
    console.error('Admin users list error:', error)
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    )
  }
}
