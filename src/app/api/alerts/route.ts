import { NextRequest, NextResponse } from 'next/server'
import { runAllAlertChecks } from '@/lib/alerts'
import { supabaseAdmin } from '@/lib/supabase'
import { mapAlertRowToApi } from '@/lib/quote-supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const resolved = searchParams.get('resolved')
    const type = searchParams.get('type')
    const severity = searchParams.get('severity')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let query = supabaseAdmin
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (resolved === 'false' || resolved === null || resolved === '') {
      query = query.eq('resolved', false)
    } else if (resolved === 'true') {
      query = query.eq('resolved', true)
    }
    if (type) {
      query = query.eq('type', type)
    }
    if (severity) {
      query = query.eq('severity', severity)
    }

    const { data: rows, error } = await query

    if (error) {
      console.error('Error fetching alerts:', error)
      return NextResponse.json(
        { error: 'Failed to fetch alerts' },
        { status: 500 }
      )
    }

    const alerts = (rows || []).map((r) => mapAlertRowToApi(r as Record<string, unknown>))
    return NextResponse.json(alerts)
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    await runAllAlertChecks()
    return NextResponse.json({ success: true, message: 'Alert checks completed' })
  } catch (error) {
    console.error('Error running alert checks:', error)
    return NextResponse.json(
      { error: 'Failed to run alert checks' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, read, resolved } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      )
    }

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
