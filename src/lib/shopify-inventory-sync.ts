import { supabaseAdmin } from '@/lib/supabase'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { getLocations, getProducts, setInventory } from '@/lib/shopify'

type ShopifySyncResult = {
  ok: boolean
  sku: string
  quantity: number
  inventoryItemId?: number
  locationId?: number
  source?: 'mapping' | 'resolved'
  message?: string
}

type ShopifyMappingRow = {
  sku: string
  inventory_item_id: number
  location_id: number | null
  shopify_variant_id: number | null
  shopify_product_id: number | null
}

function parseOptionalNumber(value: string | undefined): number | null {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function getMappingBySku(sku: string): Promise<ShopifyMappingRow | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('shopify_inventory_mappings')
      .select('sku, inventory_item_id, location_id, shopify_variant_id, shopify_product_id')
      .eq('sku', sku)
      .single()

    if (error || !data) return null
    return data as ShopifyMappingRow
  } catch {
    // Table might not exist yet in some environments.
    return null
  }
}

async function upsertMapping(row: ShopifyMappingRow): Promise<void> {
  try {
    await supabaseAdmin
      .from('shopify_inventory_mappings')
      .upsert(
        {
          sku: row.sku,
          inventory_item_id: row.inventory_item_id,
          location_id: row.location_id,
          shopify_variant_id: row.shopify_variant_id,
          shopify_product_id: row.shopify_product_id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'sku' }
      )
  } catch {
    // Non-fatal: syncing still succeeded, only cache write failed.
  }
}

async function resolveLocationId(credentials: { shopDomain: string; accessToken: string }): Promise<number> {
  const envLocationId = parseOptionalNumber(process.env.SHOPIFY_LOCATION_ID)
  if (envLocationId) return envLocationId

  const locations = await getLocations(credentials)
  const active = locations.find((loc) => loc.active) || locations[0]
  if (!active) {
    throw new Error(
      'No Shopify locations found. Set SHOPIFY_LOCATION_ID or create at least one Shopify location.'
    )
  }
  return active.id
}

async function resolveVariantBySku(
  sku: string,
  credentials: { shopDomain: string; accessToken: string }
): Promise<{ inventoryItemId: number; variantId: number; productId: number }> {
  const products = await getProducts({ limit: 250, status: 'active' }, credentials)

  for (const product of products) {
    const variant = product.variants.find((v) => (v.sku || '').trim() === sku.trim())
    if (variant) {
      return {
        inventoryItemId: variant.inventory_item_id,
        variantId: variant.id,
        productId: product.id,
      }
    }
  }

  throw new Error(
    `SKU "${sku}" was not found in the first 250 active Shopify products. Ensure the SKU exists in Shopify and is tracked.`
  )
}

export async function syncSkuQuantityToShopify(params: {
  sku: string
  quantity: number
}): Promise<ShopifySyncResult> {
  const sku = params.sku.trim()
  const quantity = Math.max(0, Math.trunc(params.quantity))

  if (!sku) {
    return { ok: false, sku: params.sku, quantity, message: 'Missing SKU' }
  }

  try {
    const creds = await getDefaultShopifyCredentials()
    const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken }

    const existing = await getMappingBySku(sku)
    if (existing) {
      const locationId = existing.location_id ?? (await resolveLocationId(credentials))
      const level = await setInventory(existing.inventory_item_id, locationId, quantity, credentials)
      await upsertMapping({
        ...existing,
        location_id: locationId,
      })

      return {
        ok: true,
        sku,
        quantity,
        inventoryItemId: level.inventory_item_id,
        locationId: level.location_id,
        source: 'mapping',
      }
    }

    const variant = await resolveVariantBySku(sku, credentials)
    const locationId = await resolveLocationId(credentials)
    const level = await setInventory(variant.inventoryItemId, locationId, quantity, credentials)

    await upsertMapping({
      sku,
      inventory_item_id: variant.inventoryItemId,
      location_id: locationId,
      shopify_variant_id: variant.variantId,
      shopify_product_id: variant.productId,
    })

    return {
      ok: true,
      sku,
      quantity,
      inventoryItemId: level.inventory_item_id,
      locationId: level.location_id,
      source: 'resolved',
    }
  } catch (error) {
    return {
      ok: false,
      sku,
      quantity,
      message: error instanceof Error ? error.message : 'Shopify sync failed',
    }
  }
}
