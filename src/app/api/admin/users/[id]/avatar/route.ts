import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'avatars'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** POST /api/admin/users/[id]/avatar — set another user's profile picture (Admin only). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id: targetUserId } = await params

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

    const path = `${targetUserId}/avatar`
    const buffer = Buffer.from(await file.arrayBuffer())

    let uploadError: { message?: string } | null = null
    const uploadResult = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
      })
    uploadError = uploadResult.error

    if (uploadError?.message?.toLowerCase().includes('bucket') && uploadError?.message?.toLowerCase().includes('not found')) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
      const retry = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: true })
      uploadError = retry.error
    }

    if (uploadError) {
      console.error('Admin avatar upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload image' },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const avatarUrl = urlData.publicUrl

    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select('id, email, name, role, avatar_url, created_at, updated_at')
      .single()

    if (updateError) {
      if (updateError.message?.includes('avatar_url') || updateError.code === '42703') {
        return NextResponse.json(
          { error: 'Profile pictures are not set up yet. Add an avatar_url column to the users table.' },
          { status: 501 }
        )
      }
      console.error('Admin user avatar update error:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to save profile picture' },
        { status: 500 }
      )
    }

    return NextResponse.json(updatedUser)
  } catch (error) {
    console.error('Admin avatar upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload' },
      { status: 500 }
    )
  }
}
