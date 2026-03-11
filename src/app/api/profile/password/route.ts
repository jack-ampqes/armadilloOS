import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuthWithRole } from '@/lib/auth'
import crypto from 'crypto'

/** POST /api/profile/password — change password for the current user. */
export async function POST(request: NextRequest) {
  const auth = requireAuthWithRole(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || typeof currentPassword !== 'string') {
      return NextResponse.json(
        { error: 'Current password is required' },
        { status: 400 }
      )
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      )
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters' },
        { status: 400 }
      )
    }

    const userEmail = auth.user.email
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('id, password_hash')
      .eq('email', userEmail.toLowerCase().trim())
      .single()

    if (fetchError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const currentHash = crypto
      .createHash('sha256')
      .update(currentPassword)
      .digest('hex')

    if (user.password_hash !== currentHash) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    const newHash = crypto
      .createHash('sha256')
      .update(newPassword)
      .digest('hex')

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('Password update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update password' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Password change error:', error)
    return NextResponse.json(
      { error: 'An error occurred while changing password' },
      { status: 500 }
    )
  }
}
