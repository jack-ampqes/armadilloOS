import { parseSkuToProduct } from '@/lib/sku-parser'
import type { ShopifyProduct, ShopifyVariant } from '@/lib/shopify'

/**
 * Matches Armabase SKUs (armadillo_inventory.inventory) to Shopify variants so
 * Armabase stock levels can be pushed into Shopify.
 *
 * Most Shopify variants in the Armadillo store have no SKU filled in, so an
 * exact SKU match only covers a handful of items. Everything else is matched
 * structurally from the product title + variant options, and is reported as a
 * *proposal* - callers must confirm a proposal before anything is written.
 */

export type MatchConfidence = 'exact' | 'proposed'

export type ShopifyVariantRef = {
  productId: number
  variantId: number
  inventoryItemId: number
  productTitle: string
  variantTitle: string
  sku: string
  quantity: number
  /** Shopify only accepts inventory levels for variants it tracks. */
  tracked: boolean
}

export type SkuMatch = {
  sku: string
  confidence: MatchConfidence
  reason: string
  variant: ShopifyVariantRef
}

export type UnmatchedSku = {
  sku: string
  reason: string
}

/**
 * Accessory SKUs carry no structure to match on, so their Shopify product
 * titles are listed explicitly. These are still surfaced as proposals for a
 * human to confirm - nothing here is written without approval.
 */
const ACCESSORY_TITLES: Record<string, { productTitle: string; variantTitle?: string }> = {
  AACGB12: { productTitle: '12" Canvas Glove Bag' },
  AACGB20: { productTitle: '20" Canvas Glove Bag' },
  AAGSB30: { productTitle: 'Glove/Sleeve Combo Canvas Bag' },
  AALP10: { productTitle: '10" Leather Protectors' },
  AALP14: { productTitle: '14" Leather Protectors' },
  'AST-8': { productTitle: "8' Shotgun Stick" },
  LS3: { productTitle: 'Logo Sticker', variantTitle: '3″×3″' },
  LS4: { productTitle: 'Logo Sticker', variantTitle: '4″×4″' },
  'LS5.5': { productTitle: 'Logo Sticker', variantTitle: '5.5″×5.5″' },
  LS15: { productTitle: 'Logo Sticker', variantTitle: '15″×3.75″' },
}

function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    // Shopify titles mix straight quotes, curly quotes and the double-prime mark.
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”″〃]/g, '"')
    .replace(/[×✕]/g, 'x')
    .replace(/\s+/g, ' ')
}

export function toVariantRef(product: ShopifyProduct, variant: ShopifyVariant): ShopifyVariantRef {
  return {
    productId: product.id,
    variantId: variant.id,
    inventoryItemId: variant.inventory_item_id,
    productTitle: product.title,
    variantTitle: variant.title,
    sku: (variant.sku || '').trim(),
    quantity: variant.inventory_quantity ?? 0,
    tracked: variant.inventory_management === 'shopify',
  }
}

type TitleParse = {
  family: 'AA' | 'AF' | 'AAK' | 'AFK'
  classCode: string
}

/**
 * "Class 2 Rubber Gloves"                  -> AA / class 2
 * "Class 00 Rubber Gloves - Special Order" -> AA / class 00
 * "ArmaFlex Class 3 Rubber Gloves"         -> AF / class 3
 * "Class 2 Rubber Glove Kit"               -> AAK / class 2
 */
function parseProductTitle(title: string): TitleParse | null {
  const match = normalizeTitle(title).match(/^(armaflex )?class (00|[0-4]) rubber glove(s| kit)\b/)
  if (!match) return null

  const isArmaFlex = Boolean(match[1])
  const isKit = match[3].trim() === 'kit'
  const family = isArmaFlex ? (isKit ? 'AFK' : 'AF') : isKit ? 'AAK' : 'AA'

  return { family, classCode: match[2] }
}

type VariantOptions = {
  color?: string
  size?: string
  inches?: number
}

/** Variant titles look like `Black / 9.5 / 16"` (options in any order). */
function parseVariantOptions(variantTitle: string): VariantOptions {
  const options: VariantOptions = {}

  for (const rawPart of variantTitle.split('/')) {
    const part = rawPart.trim()
    if (!part || part.toLowerCase() === 'default title') continue

    const inchMatch = part.match(/^(\d+)\s*["”″]$/)
    if (inchMatch) {
      options.inches = Number(inchMatch[1])
      continue
    }

    if (/^\d+(\.\d+)?$/.test(part)) {
      options.size = part
      continue
    }

    if (/^[a-z\s]+$/i.test(part)) {
      options.color = part
    }
  }

  return options
}

/** "Black/Red" and "Black" both answer to the Shopify colour option "Black". */
function colorMatches(armabaseColorName: string | undefined, shopifyColor: string | undefined): boolean {
  if (!armabaseColorName || !shopifyColor) return false
  const primary = armabaseColorName.split('/')[0].trim().toLowerCase()
  return primary === shopifyColor.trim().toLowerCase()
}

function structuralKey(family: string, classCode: string, inches: number, size: string): string {
  return `${family}|${classCode}|${inches}|${size}`
}

export function matchSkusToVariants(
  skus: string[],
  products: ShopifyProduct[]
): { matches: SkuMatch[]; unmatched: UnmatchedSku[]; unmatchedVariants: ShopifyVariantRef[] } {
  const allVariants: ShopifyVariantRef[] = []
  for (const product of products) {
    for (const variant of product.variants) {
      allVariants.push(toVariantRef(product, variant))
    }
  }

  const bySku = new Map<string, ShopifyVariantRef>()
  const byStructure = new Map<string, ShopifyVariantRef[]>()
  const byTitle = new Map<string, ShopifyVariantRef[]>()

  for (const product of products) {
    const titleParse = parseProductTitle(product.title)

    for (const variant of product.variants) {
      const ref = toVariantRef(product, variant)

      if (ref.sku && !ref.sku.startsWith('SHOP-')) {
        bySku.set(ref.sku.toUpperCase(), ref)
      }

      const titleKey = normalizeTitle(product.title)
      byTitle.set(titleKey, [...(byTitle.get(titleKey) || []), ref])

      if (titleParse) {
        const options = parseVariantOptions(variant.title)
        if (options.size && options.inches) {
          const key = structuralKey(titleParse.family, titleParse.classCode, options.inches, options.size)
          byStructure.set(key, [...(byStructure.get(key) || []), ref])
        }
      }
    }
  }

  const matches: SkuMatch[] = []
  const unmatched: UnmatchedSku[] = []
  const claimed = new Set<number>()

  for (const sku of skus) {
    const normalized = sku.trim().toUpperCase()

    // 1. The variant already carries this SKU - no guessing needed.
    const exact = bySku.get(normalized)
    if (exact) {
      matches.push({ sku, confidence: 'exact', reason: 'Shopify variant SKU matches', variant: exact })
      claimed.add(exact.variantId)
      continue
    }

    const parsed = parseSkuToProduct(sku)

    // 2. Structured glove SKUs: match on class + cuff length + size, then colour.
    if (parsed.valid && parsed.classCode && parsed.inches && parsed.size) {
      const key = structuralKey(parsed.familyCode, parsed.classCode, parsed.inches, parsed.size)
      const candidates = byStructure.get(key) || []
      const colorFiltered = candidates.filter((candidate) =>
        colorMatches(parsed.colorName, parseVariantOptions(candidate.variantTitle).color)
      )
      const pool = colorFiltered.length > 0 ? colorFiltered : candidates

      if (pool.length === 1) {
        matches.push({
          sku,
          confidence: 'proposed',
          reason: `Class ${parsed.classCode} · ${parsed.inches}" · ${parsed.colorName} · size ${parsed.size}`,
          variant: pool[0],
        })
        claimed.add(pool[0].variantId)
        continue
      }

      unmatched.push({
        sku,
        reason:
          pool.length === 0
            ? `No Shopify variant for class ${parsed.classCode}, ${parsed.inches}", size ${parsed.size}`
            : `Ambiguous: ${pool.length} Shopify variants match class ${parsed.classCode}, ${parsed.inches}", size ${parsed.size}`,
      })
      continue
    }

    // 3. Accessories: matched by their known Shopify product title.
    const accessory = ACCESSORY_TITLES[normalized]
    if (accessory) {
      const candidates = byTitle.get(normalizeTitle(accessory.productTitle)) || []
      const pool = accessory.variantTitle
        ? candidates.filter(
            (candidate) => normalizeTitle(candidate.variantTitle) === normalizeTitle(accessory.variantTitle!)
          )
        : candidates

      if (pool.length === 1) {
        matches.push({
          sku,
          confidence: 'proposed',
          reason: `Shopify product "${pool[0].productTitle}"${
            accessory.variantTitle ? ` · ${accessory.variantTitle}` : ''
          }`,
          variant: pool[0],
        })
        claimed.add(pool[0].variantId)
        continue
      }

      unmatched.push({
        sku,
        reason:
          pool.length === 0
            ? `Shopify product "${accessory.productTitle}" not found`
            : `Ambiguous: ${pool.length} variants under "${accessory.productTitle}"`,
      })
      continue
    }

    unmatched.push({ sku, reason: 'No matching rule for this SKU' })
  }

  return {
    matches,
    unmatched,
    unmatchedVariants: allVariants.filter((variant) => !claimed.has(variant.variantId)),
  }
}
