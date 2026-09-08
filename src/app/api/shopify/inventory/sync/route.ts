import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { requirePermission } from '@/lib/auth'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { getLocations, getProducts, setInventory, updateVariantSku } from '@/lib/shopify'
import { matchSkusToVariants, type SkuMatch } from '@/lib/shopify-sku-match'

/**
 * Pushes Armabase stock levels into Shopify so the storefront shows Armabase's
 * numbers.
 *
 * GET  - dry run. Reports what would change and what cannot be matched.
 *        Never writes to Shopify.
 * POST - applies the push for an explicit list of SKUs the caller has reviewed.
 */

type InventoryRow = {
  sku: string
  quantity: number | null
}

type PlanRow = {
  sku: string
  confidence: 'exact' | 'proposed'
  reason: string
  armabaseQuantity: number | null
  shopifyQuantity: number
  delta: number | null
  productTitle: string
  variantTitle: string
  variantId: number
  inventoryItemId: number
  variantSku: string
  tracked: boolean
  /** Why this row cannot be pushed, if it cannot. */
  blockedReason?: string
}

async function loadInventory(): Promise<InventoryRow[]> {
  const { data, error } = await supabase
    .schema('armadillo_inventory')
    .from('inventory')
    .select('sku, quantity')

  if (error) throw error
  return (data || []) as InventoryRow[]
}

function buildPlan(rows: InventoryRow[], matches: SkuMatch[]): PlanRow[] {
  const quantityBySku = new Map(rows.map((row) => [row.sku, row.quantity]))

  return matches.map((match) => {
    const armabaseQuantity = quantityBySku.get(match.sku) ?? null
    const shopifyQuantity = match.variant.quantity

    let blockedReason: string | undefined
    if (armabaseQuantity === null) {
      // Pushing a null as 0 would silently zero out a live storefront listing.
      blockedReason = 'Armabase quantity is not set'
    } else if (!match.variant.tracked) {
      blockedReason = 'Shopify is not tracking inventory for this variant'
    }

    return {
      sku: match.sku,
      confidence: match.confidence,
      reason: match.reason,
      armabaseQuantity,
      shopifyQuantity,
      delta: armabaseQuantity === null ? null : armabaseQuantity - shopifyQuantity,
      productTitle: match.variant.productTitle,
      variantTitle: match.variant.variantTitle,
      variantId: match.variant.variantId,
      inventoryItemId: match.variant.inventoryItemId,
      variantSku: match.variant.sku,
      tracked: match.variant.tracked,
      blockedReason,
    }
  })
}

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, 'InventoryEditing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const creds = await getDefaultShopifyCredentials()
    const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken }

    const [rows, products] = await Promise.all([
      loadInventory(),
      getProducts({ limit: 250, status: 'active' }, credentials),
    ])

    const { matches, unmatched, unmatchedVariants } = matchSkusToVariants(
      rows.map((row) => row.sku),
      products
    )

    const plan = buildPlan(rows, matches)
    const ready = plan.filter((row) => !row.blockedReason)

    return NextResponse.json({
      dryRun: true,
      summary: {
        armabaseSkus: rows.length,
        shopifyVariants: products.reduce((total, product) => total + product.variants.length, 0),
        matched: plan.length,
        matchedExact: plan.filter((row) => row.confidence === 'exact').length,
        matchedProposed: plan.filter((row) => row.confidence === 'proposed').length,
        readyToPush: ready.length,
        wouldChange: ready.filter((row) => row.delta !== 0).length,
        blocked: plan.length - ready.length,
        unmatchedSkus: unmatched.length,
        unmatchedVariants: unmatchedVariants.length,
      },
      plan,
      unmatched,
      unmatchedVariants,
    })
  } catch (error) {
    console.error('Error building Shopify inventory sync plan:', error)
    return NextResponse.json(
      {
        error: 'Failed to build sync plan',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = requirePermission(request, 'InventoryEditing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { skus, writeSkus } = body as { skus?: unknown; writeSkus?: boolean }

    // Deliberately explicit: the caller must name the SKUs it reviewed in the
    // dry run. There is no "sync everything" shortcut.
    if (!Array.isArray(skus) || skus.length === 0) {
      return NextResponse.json(
        { error: 'Provide a "skus" array of the SKUs to push (run GET first to review the plan)' },
        { status: 400 }
      )
    }

    const requested = new Set(skus.map((sku) => String(sku)))

    const creds = await getDefaultShopifyCredentials()
    const credentials = { shopDomain: creds.shopDomain, accessToken: creds.accessToken }

    const [rows, products] = await Promise.all([
      loadInventory(),
      getProducts({ limit: 250, status: 'active' }, credentials),
    ])

    const selectedRows = rows.filter((row) => requested.has(row.sku))
    const { matches } = matchSkusToVariants(
      selectedRows.map((row) => row.sku),
      products
    )
    const plan = buildPlan(selectedRows, matches)

    // SHOPIFY_LOCATION_ID first: the store's app scopes may not include
    // read_locations, in which case getLocations() 403s.
    let locationId = Number(process.env.SHOPIFY_LOCATION_ID) || null
    if (!locationId) {
      try {
        const locations = await getLocations(credentials)
        locationId = (locations.find((location) => location.active) || locations[0])?.id ?? null
      } catch (locationError) {
        console.error('Could not list Shopify locations:', locationError)
      }
    }

    if (!locationId) {
      return NextResponse.json(
        {
          error:
            'No Shopify location available. Set SHOPIFY_LOCATION_ID, or grant the read_locations scope so it can be looked up.',
        },
        { status: 400 }
      )
    }

    const results: Array<{
      sku: string
      ok: boolean
      quantity?: number
      previousQuantity?: number
      skuWritten?: boolean
      message?: string
    }> = []

    for (const row of plan) {
      if (row.blockedReason) {
        results.push({ sku: row.sku, ok: false, message: row.blockedReason })
        continue
      }

      try {
        const level = await setInventory(
          row.inventoryItemId,
          locationId,
          row.armabaseQuantity as number,
          credentials
        )

        let skuWritten = false
        if (writeSkus && !row.variantSku) {
          // Stamping the SKU makes every future sync an exact match, including
          // the automatic push that already runs when stock is edited.
          try {
            await updateVariantSku(
              products.find((product) =>
                product.variants.some((variant) => variant.id === row.variantId)
              )!.id,
              row.variantId,
              row.sku,
              credentials
            )
            skuWritten = true
          } catch (skuError) {
            console.error(`Failed to write SKU ${row.sku} to Shopify:`, skuError)
          }
        }

        await supabaseAdmin.from('shopify_inventory_mappings').upsert(
          {
            sku: row.sku,
            inventory_item_id: row.inventoryItemId,
            location_id: locationId,
            shopify_variant_id: row.variantId,
            shopify_product_id:
              products.find((product) =>
                product.variants.some((variant) => variant.id === row.variantId)
              )?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'sku' }
        )

        results.push({
          sku: row.sku,
          ok: true,
          quantity: level.available,
          previousQuantity: row.shopifyQuantity,
          skuWritten,
        })
      } catch (error) {
        results.push({
          sku: row.sku,
          ok: false,
          message: error instanceof Error ? error.message : 'Shopify push failed',
        })
      }
    }

    const notMatched = [...requested].filter((sku) => !plan.some((row) => row.sku === sku))

    return NextResponse.json({
      dryRun: false,
      locationId,
      requested: requested.size,
      pushed: results.filter((result) => result.ok).length,
      failed: results.filter((result) => !result.ok).length,
      notMatched,
      results,
    })
  } catch (error) {
    console.error('Error running Shopify inventory sync:', error)
    return NextResponse.json(
      {
        error: 'Failed to run sync',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
