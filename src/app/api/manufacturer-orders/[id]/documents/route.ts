import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { supabase, supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'manufacturer-order-documents'
const MAX_SIZE_BYTES = 25 * 1024 * 1024 // 25MB
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
])
const SIGNED_URL_EXPIRY_SEC = 3600 // 1 hour

type StoredDocument = {
  id: string
  name: string
  path: string
  contentType: string
  size: number
  uploadedAt: string
}

type InternalNotesPayload = {
  notesText?: string
  documents: StoredDocument[]
}

function parseInternalNotes(raw: unknown): InternalNotesPayload {
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { documents: [] }
  }

  try {
    const parsed = JSON.parse(raw) as Partial<InternalNotesPayload>
    if (Array.isArray(parsed.documents)) {
      return {
        notesText: typeof parsed.notesText === 'string' ? parsed.notesText : undefined,
        documents: parsed.documents.filter(
          (doc): doc is StoredDocument =>
            !!doc &&
            typeof doc.id === 'string' &&
            typeof doc.name === 'string' &&
            typeof doc.path === 'string' &&
            typeof doc.contentType === 'string' &&
            typeof doc.size === 'number' &&
            typeof doc.uploadedAt === 'string'
        ),
      }
    }
  } catch {
    // Existing internal_notes may be plain text; preserve it.
    return { notesText: raw, documents: [] }
  }

  return { documents: [] }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'ManufacturerOrders')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    const { data: order, error } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('internal_notes')
      .eq('id', id)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const parsed = parseInternalNotes(order.internal_notes)
    const docsWithUrls = await Promise.all(
      parsed.documents.map(async (doc) => {
        const { data, error: signedError } = await supabaseAdmin.storage
          .from(BUCKET)
          .createSignedUrl(doc.path, SIGNED_URL_EXPIRY_SEC)
        return {
          ...doc,
          viewUrl: signedError ? null : (data?.signedUrl ?? null),
        }
      })
    )

    return NextResponse.json({ documents: docsWithUrls })
  } catch (error) {
    console.error('Error fetching manufacturer order documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'ManufacturerOrders')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id } = await params
    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: 'Only PDF, PNG, JPG, and WebP files are allowed.' },
        { status: 400 }
      )
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File must be 25MB or smaller.' },
        { status: 400 }
      )
    }

    const { data: order, error: orderError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('id, internal_notes')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${id}/${Date.now()}_${safeName}`
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    let uploadResult = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, fileBuffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadResult.error?.message?.toLowerCase().includes('bucket') &&
      uploadResult.error.message.toLowerCase().includes('not found')) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: false })
      uploadResult = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, fileBuffer, { contentType: file.type, upsert: false })
    }

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message || 'Failed to upload file' },
        { status: 500 }
      )
    }

    const parsed = parseInternalNotes(order.internal_notes)
    const newDoc: StoredDocument = {
      id: crypto.randomUUID(),
      name: file.name,
      path,
      contentType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    }

    const payload: InternalNotesPayload = {
      ...parsed,
      documents: [...parsed.documents, newDoc],
    }

    const { error: updateError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .update({ internal_notes: JSON.stringify(payload) })
      .eq('id', id)

    if (updateError) {
      await supabaseAdmin.storage.from(BUCKET).remove([path])
      return NextResponse.json(
        { error: 'Failed to save document metadata' },
        { status: 500 }
      )
    }

    const { data: signedData } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_SEC)

    return NextResponse.json({
      document: {
        ...newDoc,
        viewUrl: signedData?.signedUrl ?? null,
      },
    })
  } catch (error) {
    console.error('Error uploading manufacturer order document:', error)
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    )
  }
}
