import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .limit(1)

    if (checkError) {
      console.error('Error checking existing user:', JSON.stringify(checkError, null, 2))
      const errorMsg = process.env.NODE_ENV === 'development' 
        ? `Check error: ${checkError.message || JSON.stringify(checkError)}`
        : 'Failed to check existing account. Please try again.'
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      )
    }

    // If user exists, return error
    if (existingUsers && existingUsers.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = crypto
      .createHash('sha256')
      .update(password)
      .digest('hex')

    // Create user - always try admin client first (bypasses RLS), fallback to regular client
    // For server-side operations, admin client is preferred
    let clientToUse = supabaseAdmin
    let insertError = null
    let user = null
    
    // Try with admin client first (if service role key is set)
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const result = await supabaseAdmin
        .from('users')
        .insert({
          email: email.toLowerCase().trim(),
          password_hash: passwordHash,
        })
        .select('id, email')
        .single()
      user = result.data
      insertError = result.error
    }
    
    // If admin client failed or isn't available, try regular client
    if (insertError || !user) {
      const result = await supabase
        .from('users')
        .insert({
          email: email.toLowerCase().trim(),
          password_hash: passwordHash,
        })
        .select('id, email')
        .single()
      user = result.data
      insertError = result.error
    }

    if (insertError) {
      console.error('Signup insert error:', JSON.stringify(insertError, null, 2))
      // Check if it's a duplicate key error
      if (insertError.code === '23505' || insertError.message?.includes('duplicate') || insertError.message?.includes('unique')) {
        return NextResponse.json(
          { error: 'An account with this email already exists' },
          { status: 409 }
      )
      }
      // Return detailed error in development, generic in production
      const errorMessage = process.env.NODE_ENV === 'development' 
        ? insertError.message || JSON.stringify(insertError)
        : 'Failed to create account. Please try again.'
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      )
    }

    if (!user) {
      console.error('Signup error: No user returned')
      return NextResponse.json(
        { error: 'Failed to create account. Please try again.' },
        { status: 500 }
      )
    }

    // Generate a simple token (in production, use JWT or similar)
    const token = crypto.randomBytes(32).toString('hex')

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    })
  } catch (error) {
    console.error('Signup error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An error occurred during sign up'
    const detailedError = process.env.NODE_ENV === 'development'
      ? errorMessage
      : 'An error occurred during sign up'
    return NextResponse.json(
      { error: detailedError },
      { status: 500 }
    )
  }
}
