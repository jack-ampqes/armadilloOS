import { supabaseAdmin } from './supabase'

export type AlertType = 'low_stock' | 'out_of_stock' | 'pending_order' | 'quote_expired' | 'manufacturer_order'
export type AlertSeverity = 'critical' | 'warning' | 'info'

interface CreateAlertParams {
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  entityType?: string
  entityId?: string
}

export async function createAlert(params: CreateAlertParams) {
  try {
    if (params.entityId && params.entityType) {
      const { data: existingRows } = await supabaseAdmin
        .from('alerts')
        .select('id')
        .eq('type', params.type)
        .eq('entity_type', params.entityType)
        .eq('entity_id', params.entityId)
        .eq('resolved', false)
        .limit(1)

      const existing = existingRows?.[0]
      if (existing) {
        const now = new Date().toISOString()
        const { data: updated } = await supabaseAdmin
          .from('alerts')
          .update({
            title: params.title,
            message: params.message,
            severity: params.severity,
            read: false,
            created_at: now,
          })
          .eq('id', existing.id)
          .select()
          .single()
        return updated
      }
    }

    const { data: inserted } = await supabaseAdmin
      .from('alerts')
      .insert({
        type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        entity_type: params.entityType ?? null,
        entity_id: params.entityId ?? null,
      })
      .select()
      .single()
    return inserted
  } catch (error) {
    console.error('Error creating alert:', error)
    throw error
  }
}

export async function checkLowStockAlerts() {
  try {
    const { data: inventoryData } = await supabaseAdmin
      .schema('armadillo_inventory')
      .from('inventory')
      .select(`
        sku,
        quantity,
        min_stock,
        name,
        product:products!inner (
          name,
          sku
        )
      `)

    if (!inventoryData) return

    for (const item of inventoryData) {
      const quantity = item.quantity || 0
      const minStock = item.min_stock || 0
      const product = Array.isArray(item.product) ? item.product[0] : item.product
      const productName = product?.name || item.name || item.sku

      if (quantity === 0) {
        await createAlert({
          type: 'out_of_stock',
          severity: 'critical',
          title: `Out of Stock: ${productName}`,
          message: `${productName} (SKU: ${item.sku}) is out of stock.`,
          entityType: 'product',
          entityId: item.sku,
        })
      } else if (quantity > 0 && quantity <= minStock) {
        await createAlert({
          type: 'low_stock',
          severity: 'warning',
          title: `Low Stock: ${productName}`,
          message: `${productName} (SKU: ${item.sku}) has ${quantity} units remaining (min: ${minStock}).`,
          entityType: 'product',
          entityId: item.sku,
        })
      } else {
        const now = new Date().toISOString()
        await supabaseAdmin
          .from('alerts')
          .update({ resolved: true, resolved_at: now })
          .in('type', ['low_stock', 'out_of_stock'])
          .eq('entity_type', 'product')
          .eq('entity_id', item.sku)
          .eq('resolved', false)
      }
    }
  } catch (error) {
    console.error('Error checking low stock alerts:', error)
  }
}

export async function checkQuoteExpirationAlerts() {
  try {
    const now = new Date()
    const nowIso = now.toISOString()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: expiringRows } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .eq('status', 'SENT')
      .gte('valid_until', nowIso)
      .lte('valid_until', sevenDaysFromNow)

    for (const quote of expiringRows || []) {
      const validUntil = quote.valid_until ? new Date(quote.valid_until) : null
      const daysUntilExpiry = validUntil
        ? Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      await createAlert({
        type: 'quote_expired',
        severity: daysUntilExpiry <= 1 ? 'critical' : 'warning',
        title: `Quote Expiring: ${quote.quote_number}`,
        message: `Quote ${quote.quote_number} for ${quote.customer_name} expires in ${daysUntilExpiry} day(s).`,
        entityType: 'quote',
        entityId: quote.id,
      })
    }

    const { data: expiredRows } = await supabaseAdmin
      .from('quotes')
      .select('*')
      .neq('status', 'EXPIRED')
      .lt('valid_until', nowIso)

    for (const quote of expiredRows || []) {
      await createAlert({
        type: 'quote_expired',
        severity: 'critical',
        title: `Quote Expired: ${quote.quote_number}`,
        message: `Quote ${quote.quote_number} for ${quote.customer_name} has expired.`,
        entityType: 'quote',
        entityId: quote.id,
      })
    }
  } catch (error) {
    console.error('Error checking quote expiration alerts:', error)
  }
}

export async function checkPendingOrdersAlerts() {
  try {
    // This would check for orders that have been pending for too long
    // For now, we'll skip this as orders come from Shopify
  } catch (error) {
    console.error('Error checking pending orders alerts:', error)
  }
}

export async function runAllAlertChecks() {
  await Promise.all([
    checkLowStockAlerts(),
    checkQuoteExpirationAlerts(),
    checkPendingOrdersAlerts(),
  ])
}
