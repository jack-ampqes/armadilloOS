import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'documents'
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
const ALLOWED_TYPES = ['application/pdf']

/** GET /api/admin/documents — list all documents (Admin only). */
export async function GET(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('documents')
      .select('id, name, title, file_size, content_type, created_at, thumbnail_path')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Admin documents list error:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to list documents' },
        { status: 500 }
      )
    }

    return NextResponse.json(data ?? [])
  } catch (error) {
    console.error('Admin documents list error:', error)
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    )
  }
}

/** POST /api/admin/documents — upload a document (Admin only). */
export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
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

    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${auth.user.id}/${Date.now()}_${sanitizedName}`

    const buffer = Buffer.from(await file.arrayBuffer())

    let uploadError: { message?: string } | null = null
    const uploadResult = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      })
    uploadError = uploadResult.error

    if (uploadError?.message?.toLowerCase().includes('bucket') && uploadError?.message?.toLowerCase().includes('not found')) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
      const retry = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: file.type, upsert: false })
      uploadError = retry.error
    }

    if (uploadError) {
      console.error('Documents upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload document' },
        { status: 500 }
      )
    }

    const { data: doc, error: insertError } = await supabaseAdmin
      .from('documents')
      .insert({
        name: file.name,
        storage_path: storagePath,
        file_size: file.size,
        content_type: file.type,
        uploaded_by: auth.user.id,
      })
      .select('id, name, title, file_size, content_type, created_at, thumbnail_path')
      .single()

    if (insertError) {
      console.error('Documents insert error:', insertError)
      await supabaseAdmin.storage.from(BUCKET).remove([storagePath])
      return NextResponse.json(
        { error: insertError.message || 'Failed to save document record' },
        { status: 500 }
      )
    }

    return NextResponse.json(doc)
  } catch (error) {
    console.error('Admin documents upload error:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
