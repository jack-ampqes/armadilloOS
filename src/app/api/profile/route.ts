import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

// Get user profile
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const userEmail = request.headers.get('x-user-email') || 
                     request.nextUrl.searchParams.get('email')

    // For now, we'll use email from localStorage (passed via header)
    // In production, you'd validate the token and get user from it
    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email required' },
        { status: 400 }
      )
    }

    // Query user from Supabase (use admin client to bypass RLS)
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, role, created_at, updated_at')
      .eq('email', userEmail.toLowerCase().trim())
      .single()

    if (error) {
      console.error('Profile fetch error:', error)
      // If columns don't exist, try without them
      if (error.message?.includes('column') || error.code === '42703') {
        const { data: basicUser, error: basicError } = await supabaseAdmin
          .from('users')
          .select('id, email, created_at, updated_at')
          .eq('email', userEmail.toLowerCase().trim())
          .single()
        
        if (basicError || !basicUser) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          )
        }
        
        // Return with default values for missing columns
        return NextResponse.json({
          ...basicUser,
          name: null,
          role: 'user',
        })
      }
      
      return NextResponse.json(
        { error: error.message || 'User not found' },
        { status: 404 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error('Profile fetch error:', error)
    return NextResponse.json(
      { error: 'An error occurred while fetching profile' },
      { status: 500 }
    )
  }
}

// Update user profile
export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const userEmail = request.headers.get('x-user-email') || 
                     request.nextUrl.searchParams.get('email')

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email required' },
        { status: 400 }
      )
    }

    const { name, email } = await request.json()

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400 }
        )
      }
    }

    // Check if new email already exists (if email is being changed)
    if (email && email.toLowerCase().trim() !== userEmail.toLowerCase().trim()) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .single()

      if (existingUser) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
        )
      }
    }

    // Update user
    const updateData: { name?: string; email?: string; updated_at?: string } = {}
    if (name !== undefined) updateData.name = name || null
    if (email !== undefined) updateData.email = email.toLowerCase().trim()
    updateData.updated_at = new Date().toISOString()

    const { data: updatedUser, error } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('email', userEmail.toLowerCase().trim())
      .select('id, email, name, role, created_at, updated_at')
      .single()

    if (error) {
      console.error('Profile update error:', error)
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Profile update error:', error)
    return NextResponse.json(
      { error: 'An error occurred while updating profile' },
      { status: 500 }
    )
  }
}
