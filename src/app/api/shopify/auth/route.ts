import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

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

export async function GET(request: NextRequest) {
  const apiKey = process.env.SHOPIFY_API_KEY
  const appUrl = process.env.SHOPIFY_APP_URL
  const scopes =
    process.env.SHOPIFY_APP_SCOPES ||
    'read_orders,read_products,read_inventory,read_customers'

  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'Missing SHOPIFY_API_KEY',
        message:
          'Set SHOPIFY_API_KEY (Shopify app client id) in your environment.',
      },
      { status: 500 }
    )
  }

  const searchParams = request.nextUrl.searchParams
  const shop = normalizeShopDomain(searchParams.get('shop') || '')
  const userEmail = (searchParams.get('userEmail') || '').trim().toLowerCase()

  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      {
        error: 'Invalid shop',
        message:
          'Provide a valid shop domain (e.g. "your-store.myshopify.com") as ?shop=',
      },
      { status: 400 }
    )
  }

  if (!userEmail) {
    return NextResponse.json(
      {
        error: 'Missing userEmail',
        message:
          'This app expects ?userEmail= so we can attribute the connection.',
      },
      { status: 400 }
    )
  }

  const state = crypto.randomBytes(16).toString('hex')
  const origin =
    appUrl?.replace(/\/+$/, '') || request.nextUrl.origin.replace(/\/+$/, '')
  const redirectUri = `${origin}/api/shopify/callback`

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`)
  authUrl.searchParams.set('client_id', apiKey)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authUrl.toString())
  res.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10, // 10 minutes
  })
  res.cookies.set('shopify_oauth_user_email', userEmail, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  })

  return res
}

