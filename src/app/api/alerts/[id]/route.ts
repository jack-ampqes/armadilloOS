import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { mapAlertRowToApi } from '@/lib/quote-supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { read, resolved } = body

    const updateData: Record<string, unknown> = {}
    if (read !== undefined) {
      updateData.read = read
    }
    if (resolved !== undefined) {
      updateData.resolved = resolved
      updateData.resolved_at = resolved ? new Date().toISOString() : null
    }

    const { data: alert, error } = await supabaseAdmin
      .from('alerts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error updating alert:', error)
      return NextResponse.json(
        { error: 'Failed to update alert' },
        { status: 500 }
      )
    }
    return NextResponse.json(mapAlertRowToApi((alert ?? {}) as Record<string, unknown>))
  } catch (error) {
    console.error('Error updating alert:', error)
    return NextResponse.json(
      { error: 'Failed to update alert' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { error } = await supabaseAdmin.from('alerts').delete().eq('id', id)

    if (error) {
      console.error('Error deleting alert:', error)
      return NextResponse.json(
        { error: 'Failed to delete alert' },
        { status: 500 }
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting alert:', error)
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    )
  }
}
