import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/auth'

const BUCKET = 'manufacturer-logos'
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'])
const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
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
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Please upload a PNG, JPG, WEBP, or GIF image.' }, { status: 400 })
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'Logo file must be 5MB or smaller.' }, { status: 400 })
    }

    const extension = EXT_BY_TYPE[file.type] || 'png'
    const path = `${id}/logo-${Date.now()}.${extension}`
    const buffer = Buffer.from(await file.arrayBuffer())

    // Remove old logos first so one current logo exists per manufacturer.
    const listResult = await supabaseAdmin.storage
      .from(BUCKET)
      .list(id, { limit: 100 })

    if (
      listResult.error?.message?.toLowerCase().includes('bucket') &&
      listResult.error.message.toLowerCase().includes('not found')
    ) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
    }

    const existing = await supabaseAdmin.storage
      .from(BUCKET)
      .list(id, { limit: 100 })

    if (existing.data && existing.data.length > 0) {
      const oldPaths = existing.data.map((entry) => `${id}/${entry.name}`)
      await supabaseAdmin.storage.from(BUCKET).remove(oldPaths)
    }

    const uploadResult = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: false })

    if (uploadResult.error) {
      return NextResponse.json(
        { error: uploadResult.error.message || 'Failed to upload logo' },
        { status: 500 }
      )
    }

    const { data: publicData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const logoUrl = publicData.publicUrl

    return NextResponse.json({ id, logo_url: logoUrl })
  } catch (error) {
    console.error('Error uploading manufacturer logo:', error)
    return NextResponse.json(
      { error: 'Failed to upload logo' },
      { status: 500 }
    )
  }
}
