import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

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
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(shopDomain)
}

function verifyShopifyCallbackHmac(
  searchParams: URLSearchParams,
  apiSecret: string
): boolean {
  const providedHmac = searchParams.get('hmac') || ''
  if (!providedHmac) return false

  // Per Shopify docs: compute HMAC of the query string excluding hmac/signature,
  // with keys sorted lexicographically and joined as "key=value" with "&".
  const pairs: Array<[string, string]> = []
  for (const [key, value] of searchParams.entries()) {
    if (key === 'hmac' || key === 'signature') continue
    pairs.push([key, value])
  }
  pairs.sort(([a], [b]) => a.localeCompare(b))
  const message = pairs.map(([k, v]) => `${k}=${v}`).join('&')

  const digest = crypto
    .createHmac('sha256', apiSecret)
    .update(message)
    .digest('hex')

  try {
    return crypto.timingSafeEqual(
      Buffer.from(digest, 'utf8'),
      Buffer.from(providedHmac, 'utf8')
    )
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.SHOPIFY_API_KEY
  const apiSecret = process.env.SHOPIFY_API_SECRET
  const appUrl = process.env.SHOPIFY_APP_URL

  if (!apiKey || !apiSecret) {
    return NextResponse.json(
      {
        error: 'Missing Shopify OAuth env vars',
        message:
          'Set SHOPIFY_API_KEY and SHOPIFY_API_SECRET (Shopify app credentials).',
      },
      { status: 500 }
    )
  }

  const origin =
    appUrl?.replace(/\/+$/, '') || request.nextUrl.origin.replace(/\/+$/, '')

  const shop = normalizeShopDomain(request.nextUrl.searchParams.get('shop') || '')
  const code = request.nextUrl.searchParams.get('code') || ''
  const state = request.nextUrl.searchParams.get('state') || ''

  if (!shop || !isValidShopDomain(shop) || !code || !state) {
    return NextResponse.json(
      {
        error: 'Invalid callback parameters',
        message: 'Missing or invalid shop/code/state.',
      },
      { status: 400 }
    )
  }

  const expectedState = request.cookies.get('shopify_oauth_state')?.value || ''
  const connectedByEmail =
    request.cookies.get('shopify_oauth_user_email')?.value || null

  if (!expectedState || state !== expectedState) {
    return NextResponse.json(
      { error: 'Invalid state', message: 'OAuth state mismatch.' },
      { status: 401 }
    )
  }

  const hmacOk = verifyShopifyCallbackHmac(request.nextUrl.searchParams, apiSecret)
  if (!hmacOk) {
    return NextResponse.json(
      { error: 'Invalid HMAC', message: 'Shopify callback HMAC verification failed.' },
      { status: 401 }
    )
  }

  // Exchange code for permanent access token
  const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: apiKey,
      client_secret: apiSecret,
      code,
    }),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return NextResponse.json(
      {
        error: 'Token exchange failed',
        message: `Shopify returned ${tokenRes.status}: ${text}`,
      },
      { status: 502 }
    )
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string
    scope?: string
  }

  const accessToken = tokenJson.access_token
  const scope = tokenJson.scope || null

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Token exchange failed', message: 'Missing access_token in response.' },
      { status: 502 }
    )
  }

  // Persist connection (Supabase)
  // Table expected: shopify_connections(shop text unique, access_token text, scope text, installed_at, updated_at, connected_by_email)
  const now = new Date().toISOString()
  const { error: upsertError } = await supabaseAdmin
    .from('shopify_connections')
    .upsert(
      {
        shop,
        access_token: accessToken,
        scope,
        installed_at: now,
        updated_at: now,
        connected_by_email: connectedByEmail,
      },
      { onConflict: 'shop' }
    )

  if (upsertError) {
    // Don’t leak token in logs; just surface a helpful message.
    return NextResponse.json(
      {
        error: 'Failed to save Shopify connection',
        message:
          'Could not upsert into Supabase table "shopify_connections". Make sure the table exists and your server has permission (service role key recommended).',
        details: upsertError.message,
      },
      { status: 500 }
    )
  }

  // Clear cookies and redirect back to profile
  const res = NextResponse.redirect(
    `${origin}/profile?shopify=connected&shop=${encodeURIComponent(shop)}`
  )
  res.cookies.set('shopify_oauth_state', '', { path: '/', maxAge: 0 })
  res.cookies.set('shopify_oauth_user_email', '', { path: '/', maxAge: 0 })
  return res
}

