import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'documents'
const SIGNED_URL_EXPIRY_SEC = 3600 // 1 hour

/** GET /api/admin/documents/[id] — get document metadata and a signed view URL (Admin only). */
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
      .select('id, name, title, storage_path, file_size, content_type, created_at, thumbnail_path')
      .eq('id', id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const { data: signed, error: signedError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, SIGNED_URL_EXPIRY_SEC)

    if (signedError || !signed?.signedUrl) {
      console.error('Signed URL error:', signedError)
      return NextResponse.json(
        { ...doc, viewUrl: null, error: 'Could not generate view URL' },
        { status: 200 }
      )
    }

    return NextResponse.json({ ...doc, viewUrl: signed.signedUrl })
  } catch (error) {
    console.error('Admin document get error:', error)
    return NextResponse.json(
      { error: 'Failed to load document' },
      { status: 500 }
    )
  }
}

/** DELETE /api/admin/documents/[id] — delete document (Admin only). */
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

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('storage_path, thumbnail_path')
      .eq('id', id)
      .single()

    if (fetchError || !doc) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const pathsToRemove = [doc.storage_path]
    if (doc.thumbnail_path) pathsToRemove.push(doc.thumbnail_path)
    await supabaseAdmin.storage.from(BUCKET).remove(pathsToRemove)
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Document delete error:', deleteError)
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete document' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin document delete error:', error)
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    )
  }
}

/** PATCH /api/admin/documents/[id] — update document title (Admin only). */
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
    const title = typeof body?.title === 'string' ? body.title.trim() || null : undefined
    if (title === undefined) {
      return NextResponse.json(
        { error: 'Body must include title (string or null)' },
        { status: 400 }
      )
    }

    const { data: doc, error } = await supabaseAdmin
      .from('documents')
      .update({ title: title ?? null })
      .eq('id', id)
      .select('id, name, title, file_size, content_type, created_at, thumbnail_path')
      .single()

    if (error || !doc) {
      return NextResponse.json(
        { error: error?.message || 'Document not found' },
        { status: error ? 500 : 404 }
      )
    }
    return NextResponse.json(doc)
  } catch (error) {
    console.error('Admin document patch error:', error)
    return NextResponse.json(
      { error: 'Failed to update document' },
      { status: 500 }
    )
  }
}
