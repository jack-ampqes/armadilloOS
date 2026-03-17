import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'documents'
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['application/pdf']
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

/** PUT /api/admin/documents/[id] — replace PDF file for a document (Admin only). */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Use form field "file".' },
        { status: 400 }
      )
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF is allowed.' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File must be 20MB or smaller.' },
        { status: 400 }
      )
    }

    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('id, storage_path')
      .eq('id', id)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    const uploadResult = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(existing.storage_path, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadResult.error) {
      console.error('Document replace upload error:', uploadResult.error)
      return NextResponse.json(
        { error: uploadResult.error.message || 'Failed to upload new PDF' },
        { status: 500 }
      )
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('documents')
      .update({
        name: file.name,
        file_size: file.size,
        content_type: file.type,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, title, file_size, content_type, created_at, thumbnail_path')
      .single()

    if (updateError || !updated) {
      console.error('Document replace update error:', updateError)
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update document record' },
        { status: 500 }
      )
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Admin document replace error:', error)
    return NextResponse.json(
      { error: 'Failed to replace document' },
      { status: 500 }
    )
  }
}
