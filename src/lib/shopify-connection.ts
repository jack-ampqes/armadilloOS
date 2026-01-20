import { supabaseAdmin } from '@/lib/supabase'

export type ShopifyApiCredentials = {
  shopDomain: string
  accessToken: string
  scope?: string | null
  source: 'supabase' | 'env'
}

function normalizeShopDomain(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed)
      return url.host
    } catch {
      return trimmed
    }
  }
  return trimmed
}

function isValidShopDomain(shopDomain: string): boolean {
  // Shopify shop domains are typically like: example.myshopify.com
  // We accept custom domains too, but at least require a hostname-looking string.
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(shopDomain)
}

export async function getDefaultShopifyCredentials(): Promise<ShopifyApiCredentials> {
  // Prefer stored connection (OAuth) if the table exists.
  try {
    const { data, error } = await supabaseAdmin
      .from('shopify_connections')
      .select('shop, access_token, scope, installed_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const row = data[0] as any
      const shopDomain = normalizeShopDomain(String(row.shop || ''))
      const accessToken = String(row.access_token || '')
      const scope = row.scope ?? null

      if (shopDomain && accessToken && isValidShopDomain(shopDomain)) {
        return { shopDomain, accessToken, scope, source: 'supabase' }
      }
    }
  } catch {
    // Table missing or Supabase not configured; fall back to env.
  }

  const shopDomain = normalizeShopDomain(process.env.SHOPIFY_STORE_DOMAIN || '')
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || ''

  if (!shopDomain || !accessToken) {
    throw new Error(
      'Shopify integration not configured. Either connect via Shopify OAuth or set SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN.'
    )
  }

  if (!isValidShopDomain(shopDomain)) {
    throw new Error(
      `Invalid SHOPIFY_STORE_DOMAIN: "${shopDomain}". Expected a hostname like "your-store.myshopify.com".`
    )
  }

  return { shopDomain, accessToken, scope: null, source: 'env' }
}

