import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'companies'
const MAX_SIZE_BYTES = 512 * 1024 // 512KB for small badge
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** POST /api/admin/companies/[id]/icon — upload company badge icon (Admin only). */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id: companyId } = await params

    const formData = await request.formData()
    const file = formData.get('icon') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file provided. Use form field "icon".' },
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
        { error: 'Icon must be 512KB or smaller.' },
        { status: 400 }
      )
    }

    const path = `${companyId}/icon`
    const buffer = Buffer.from(await file.arrayBuffer())

    let uploadError: { message?: string } | null = null
    let uploadResult = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })
    uploadError = uploadResult.error

    if (uploadError?.message?.toLowerCase().includes('bucket') && uploadError?.message?.toLowerCase().includes('not found')) {
      await supabaseAdmin.storage.createBucket(BUCKET, { public: true })
      const retry = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, { contentType: file.type, upsert: true })
      uploadError = retry.error
    }

    if (uploadError) {
      console.error('Company icon upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload icon' },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const iconUrl = urlData.publicUrl

    const { data: company, error: updateError } = await supabaseAdmin
      .from('companies')
      .update({
        icon_url: iconUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('id, name, icon_url, logo_url, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('Company icon_url update error:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to save icon' },
        { status: 500 }
      )
    }
    return NextResponse.json(company)
  } catch (error) {
    console.error('Company icon upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload' },
      { status: 500 }
    )
  }
}
