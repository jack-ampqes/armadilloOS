import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requirePermission } from '@/lib/auth'

/**
 * GET /api/inventory/history?sku=...&limit=100
 * Returns inventory adjustment history (adds/removes). Requires InventoryViewing.
 */
export async function GET(request: NextRequest) {
  const auth = requirePermission(request, 'InventoryViewing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)
    const sku = searchParams.get('sku')
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 500)

    let query = supabase
      .schema('armadillo_inventory')
      .from('inventory_history')
      .select('id, sku, quantity_change, quantity_after, source, created_at, user_email')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (sku) {
      query = query.eq('sku', sku)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({ history: data || [] })
  } catch (error) {
    console.error('Error fetching inventory history:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch inventory history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
