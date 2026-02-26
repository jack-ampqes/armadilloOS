import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'documents'
const THUMBNAIL_EXPIRY_SEC = 3600 // 1 hour
const MAX_THUMB_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** GET /api/admin/documents/[id]/thumbnail — redirect to signed thumbnail URL (Admin only). */
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
    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('thumbnail_path')
      .eq('id', id)
      .single()

    if (fetchError || !doc?.thumbnail_path) {
      return NextResponse.json({ error: 'No thumbnail' }, { status: 404 })
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.thumbnail_path, THUMBNAIL_EXPIRY_SEC)

    if (signedError || !signed?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate thumbnail URL' }, { status: 500 })
    }

    return NextResponse.redirect(signed.signedUrl)
  } catch (error) {
    console.error('Document thumbnail GET error:', error)
    return NextResponse.json({ error: 'Failed to load thumbnail' }, { status: 500 })
  }
}

/** POST /api/admin/documents/[id]/thumbnail — upload thumbnail image (Admin only). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('id, thumbnail_path')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('thumbnail') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Use form field "thumbnail".' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_THUMB_SIZE) {
      return NextResponse.json(
        { error: 'Image must be 2MB or smaller.' },
        { status: 400 }
      )
    }

    const thumbnailPath = `thumbnails/${id}`

    const buffer = Buffer.from(await file.arrayBuffer())
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(thumbnailPath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error('Thumbnail upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload thumbnail' },
        { status: 500 }
      )
    }

    if (existing.thumbnail_path && existing.thumbnail_path !== thumbnailPath) {
      await supabaseAdmin.storage.from(BUCKET).remove([existing.thumbnail_path])
    }

    const { data: doc, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({ thumbnail_path: thumbnailPath })
      .eq('id', id)
      .select('id, name, title, file_size, content_type, created_at, thumbnail_path')
      .single()

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to save thumbnail' },
        { status: 500 }
      )
    }

    return NextResponse.json(doc)
  } catch (error) {
    console.error('Document thumbnail POST error:', error)
    return NextResponse.json(
      { error: 'Failed to upload thumbnail' },
      { status: 500 }
    )
  }
}
