import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requirePermission } from '@/lib/auth'
import { checkLowStockAlerts } from '@/lib/alerts'

/**
 * POST /api/manufacturer-orders/[id]/apply-to-inventory
 * Add this order's line item quantities to inventory. Idempotent: only runs once per order
 * (when inventory_applied_at is null). Call when order is "received" (e.g. FedEx delivered).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requirePermission(request, 'ManufacturerOrders')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { id: orderId } = await params

    const { data: order, error: orderError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .select('*')
      .eq('id', orderId)
      .single()

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    }

    if ((order as { inventory_applied_at?: string | null }).inventory_applied_at) {
      return NextResponse.json({
        applied: false,
        message: 'Order quantities already applied to inventory.',
      })
    }

    const { data: items, error: itemsError } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_order_items')
      .select('sku, quantity_ordered')
      .eq('order_id', orderId)

    if (itemsError || !items?.length) {
      return NextResponse.json({
        applied: false,
        error: 'No order items found.',
      })
    }

    const skipped: string[] = []
    const applied: { sku: string; quantity: number }[] = []

    for (const item of items) {
      const sku = item.sku
      const addQty = Number(item.quantity_ordered) || 0
      if (addQty <= 0) continue

      const { data: existing, error: fetchErr } = await supabase
        .schema('armadillo_inventory')
        .from('inventory')
        .select('quantity')
        .eq('sku', sku)
        .single()

      if (fetchErr || !existing) {
        skipped.push(sku)
        continue
      }

      const currentQty = Number(existing.quantity) || 0
      const { error: updateErr } = await supabase
        .schema('armadillo_inventory')
        .from('inventory')
        .update({
          quantity: currentQty + addQty,
          updated_at: new Date().toISOString(),
        })
        .eq('sku', sku)

      if (updateErr) {
        skipped.push(sku)
        continue
      }
      applied.push({ sku, quantity: addQty })
    }

    const { error: updateOrderErr } = await supabase
      .schema('armadillo_inventory')
      .from('manufacturer_orders')
      .update({
        inventory_applied_at: new Date().toISOString(),
        status: 'delivered',
        actual_delivery: new Date().toISOString().split('T')[0],
      })
      .eq('id', orderId)

    if (updateOrderErr) {
      console.error('Failed to set inventory_applied_at:', updateOrderErr)
      return NextResponse.json(
        { error: 'Inventory updated but failed to mark order as applied.' },
        { status: 500 }
      )
    }

    try {
      await checkLowStockAlerts()
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      applied: true,
      appliedItems: applied,
      skippedSkus: skipped.length ? skipped : undefined,
    })
  } catch (error) {
    console.error('Apply to inventory error:', error)
    return NextResponse.json(
      {
        error: 'Failed to apply order to inventory',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
