import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

function getBasicAuthHeader(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
}

export async function GET(request: NextRequest) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  const appUrl = process.env.QUICKBOOKS_APP_URL || process.env.SHOPIFY_APP_URL

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: 'Missing QuickBooks OAuth env vars',
        message: 'Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.',
      },
      { status: 500 }
    )
  }

  const origin = appUrl?.replace(/\/+$/, '') || request.nextUrl.origin.replace(/\/+$/, '')
  const redirectUri = `${origin}/api/quickbooks/callback`

  const code = request.nextUrl.searchParams.get('code') || ''
  const realmId = request.nextUrl.searchParams.get('realmId') || ''
  const state = request.nextUrl.searchParams.get('state') || ''

  if (!code || !realmId || !state) {
    return NextResponse.json(
      {
        error: 'Invalid callback parameters',
        message: 'Missing or invalid code/realmId/state.',
      },
      { status: 400 }
    )
  }

  const expectedState = request.cookies.get('quickbooks_oauth_state')?.value || ''
  const connectedByEmail =
    request.cookies.get('quickbooks_oauth_user_email')?.value || null

  if (!expectedState || state !== expectedState) {
    return NextResponse.json(
      { error: 'Invalid state', message: 'OAuth state mismatch.' },
      { status: 401 }
    )
  }

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(clientId, clientSecret),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }).toString(),
  })

  if (!tokenRes.ok) {
    const text = await tokenRes.text()
    return NextResponse.json(
      {
        error: 'Token exchange failed',
        message: `Intuit returned ${tokenRes.status}: ${text}`,
      },
      { status: 502 }
    )
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  const accessToken = tokenJson.access_token
  const refreshToken = tokenJson.refresh_token || ''
  const expiresIn = tokenJson.expires_in ?? 3600
  const now = new Date()
  const tokenExpiresAt = new Date(now.getTime() + expiresIn * 1000)
  const iso = now.toISOString()

  try {
    const { error: upsertError } = await supabaseAdmin
      .from('quickbooks_connections')
      .upsert(
        {
          realm_id: realmId,
          access_token: accessToken,
          refresh_token: refreshToken,
          token_expires_at: tokenExpiresAt.toISOString(),
          connected_by_email: connectedByEmail,
          updated_at: iso,
        },
        { onConflict: 'realm_id' }
      )

    if (upsertError) {
      return NextResponse.json(
        {
          error: 'Failed to save QuickBooks connection',
          message:
            'Could not upsert into Supabase table "quickbooks_connections". Ensure the table exists and the server has permission.',
          details: upsertError.message,
        },
        { status: 500 }
      )
    }
  } catch (e) {
    return NextResponse.json(
      {
        error: 'Failed to save QuickBooks connection',
        message: 'Database error.',
      },
      { status: 500 }
    )
  }

  const res = NextResponse.redirect(
    `${origin}/profile?quickbooks=connected&realmId=${encodeURIComponent(realmId)}`
  )
  res.cookies.set('quickbooks_oauth_state', '', { path: '/', maxAge: 0 })
  res.cookies.set('quickbooks_oauth_user_email', '', { path: '/', maxAge: 0 })
  return res
}
