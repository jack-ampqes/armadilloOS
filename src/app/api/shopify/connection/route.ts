import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  // Prefer Supabase connection; fall back to env. Never return tokens.
  try {
    const { data, error } = await supabaseAdmin
      .from('shopify_connections')
      .select('shop, scope, installed_at, updated_at, connected_by_email')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const row = data[0] as any
      return NextResponse.json({
        connected: true,
        source: 'supabase',
        shop: row.shop,
        scope: row.scope ?? null,
        installed_at: row.installed_at ?? null,
        updated_at: row.updated_at ?? null,
        connected_by_email: row.connected_by_email ?? null,
      })
    }
  } catch {
    // ignore, fall back to env
  }

  const shop = process.env.SHOPIFY_STORE_DOMAIN || null
  const hasToken = Boolean(process.env.SHOPIFY_ACCESS_TOKEN)

  return NextResponse.json({
    connected: Boolean(shop && hasToken),
    source: shop && hasToken ? 'env' : null,
    shop,
  })
}

