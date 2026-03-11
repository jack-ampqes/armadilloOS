import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'companies'
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

/** POST /api/admin/companies/[id]/logo — upload company logo (shared profile photo) (Admin only). */
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
    const file = formData.get('logo') as File | null
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No image file provided. Use form field "logo".' },
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
        { error: 'Logo must be 2MB or smaller.' },
        { status: 400 }
      )
    }

    const path = `${companyId}/logo`
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
      console.error('Company logo upload error:', uploadError)
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload logo' },
        { status: 500 }
      )
    }

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
    const logoUrl = urlData.publicUrl

    const { data: company, error: updateError } = await supabaseAdmin
      .from('companies')
      .update({
        logo_url: logoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', companyId)
      .select('id, name, icon_url, logo_url, created_at, updated_at')
      .single()

    if (updateError) {
      console.error('Company logo_url update error:', updateError)
      return NextResponse.json(
        { error: updateError.message || 'Failed to save logo' },
        { status: 500 }
      )
    }
    return NextResponse.json(company)
  } catch (error) {
    console.error('Company logo upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload' },
      { status: 500 }
    )
  }
}
