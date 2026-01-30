import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAuthWithRole } from '@/lib/auth'

const BUCKET = 'avatars'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(request: NextRequest) {
  try {
    const auth = requireAuthWithRole(request)
    if ('response' in auth) {
      return auth.response
    }

    const userEmail = auth.user.email

    const formData = await request.formData()
    const file = formData.get('avatar') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file provided. Use form field "avatar".' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Image must be 2MB or smaller.' },
        { status: 400 }
      )
    }

    // Get user id for path
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', userEmail.toLowerCase().trim())
      .single()

    if (userError || !user?.id) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpeg', 'jpg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg'
    const path = `${user.id}/avatar.${safeExt}`

    const buffer = Buffer.from(await file.arrayBuffer())

    let uploadError: { message?: string } | null = null
    const uploadResult = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })
    uploadError = uploadResult.error

    // Create bucket if it doesn't exist (e.g. "Bucket not found") and retry
    if (uploadError?.message?.toLowerCase().includes('bucket') && uploadError?.message?.toLowerCase().includes('not found')) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
      const retry = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: true })
      uploadError = retry.error
    }

    if (uploadError) {
      console.error('Avatar upload error:', uploadError)
      const message = uploadError.message || 'Failed to upload image'
      return NextResponse.json(
        { error: message, details: uploadError.message },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const avatarUrl = urlData.publicUrl

    // Update user.avatar_url (column may not exist yet)
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
      .select('id, email, name, role, avatar_url, created_at, updated_at')
      .single()

    if (updateError) {
      if (updateError.message?.includes('avatar_url') || updateError.code === '42703') {
        return NextResponse.json(
          { error: 'Profile pictures are not set up yet. Add an avatar_url column to the users table.' },
          { status: 501 }
        )
      }
      console.error('Profile avatar_url update error:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to save profile picture', details: updateError.message },
        { status: 500 }
      )
    }

    const body =
      process.env.NODE_ENV === 'development'
        ? { ...updatedUser, _dev: { usingServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY } }
        : updatedUser
    return NextResponse.json(body)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred while uploading'
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.stack : String(error) },
      { status: 500 }
    )
  }
}
