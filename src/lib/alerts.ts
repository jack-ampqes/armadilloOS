import { PrismaClient } from '@prisma/client'
import { supabaseAdmin } from './supabase'

const prisma = new PrismaClient()

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
    // Check if alert already exists for this entity
    if (params.entityId && params.entityType) {
      const existing = await prisma.alert.findFirst({
        where: {
          type: params.type,
          entityType: params.entityType,
          entityId: params.entityId,
          resolved: false,
        },
      })

      if (existing) {
        // Update existing alert instead of creating duplicate
        return await prisma.alert.update({
          where: { id: existing.id },
          data: {
            title: params.title,
            message: params.message,
            severity: params.severity,
            read: false,
            createdAt: new Date(),
          },
        })
      }
    }

    return await prisma.alert.create({
      data: {
        type: params.type,
        severity: params.severity,
        title: params.title,
        message: params.message,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    })
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
        // Out of stock
        await createAlert({
          type: 'out_of_stock',
          severity: 'critical',
          title: `Out of Stock: ${productName}`,
          message: `${productName} (SKU: ${item.sku}) is out of stock.`,
          entityType: 'product',
          entityId: item.sku,
        })
      } else if (quantity > 0 && quantity <= minStock) {
        // Low stock
        await createAlert({
          type: 'low_stock',
          severity: 'warning',
          title: `Low Stock: ${productName}`,
          message: `${productName} (SKU: ${item.sku}) has ${quantity} units remaining (min: ${minStock}).`,
          entityType: 'product',
          entityId: item.sku,
        })
      } else {
        // Stock is good - resolve any existing alerts
        await prisma.alert.updateMany({
          where: {
            type: { in: ['low_stock', 'out_of_stock'] },
            entityType: 'product',
            entityId: item.sku,
            resolved: false,
          },
          data: {
            resolved: true,
            resolvedAt: new Date(),
          },
        })
      }
    }
  } catch (error) {
    console.error('Error checking low stock alerts:', error)
  }
}

export async function checkQuoteExpirationAlerts() {
  try {
    const now = new Date()
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // Find quotes expiring soon
    const expiringQuotes = await prisma.quote.findMany({
      where: {
        status: 'SENT',
        validUntil: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
    })

    for (const quote of expiringQuotes) {
      const daysUntilExpiry = Math.ceil(
        (new Date(quote.validUntil!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      )

      await createAlert({
        type: 'quote_expired',
        severity: daysUntilExpiry <= 1 ? 'critical' : 'warning',
        title: `Quote Expiring: ${quote.quoteNumber}`,
        message: `Quote ${quote.quoteNumber} for ${quote.customerName} expires in ${daysUntilExpiry} day(s).`,
        entityType: 'quote',
        entityId: quote.id,
      })
    }

    // Find expired quotes
    const expiredQuotes = await prisma.quote.findMany({
      where: {
        status: { not: 'EXPIRED' },
        validUntil: {
          lt: now,
        },
      },
    })

    for (const quote of expiredQuotes) {
      await createAlert({
        type: 'quote_expired',
        severity: 'critical',
        title: `Quote Expired: ${quote.quoteNumber}`,
        message: `Quote ${quote.quoteNumber} for ${quote.customerName} has expired.`,
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
    // Could be implemented if we track order creation dates locally
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
