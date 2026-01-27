import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export const runtime = 'nodejs'

const QB_SCOPES = 'com.intuit.quickbooks.accounting'

export async function GET(request: NextRequest) {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const appUrl = process.env.QUICKBOOKS_APP_URL || process.env.SHOPIFY_APP_URL
  const userEmail = (request.nextUrl.searchParams.get('userEmail') || '').trim().toLowerCase()

  if (!clientId) {
    return NextResponse.json(
      {
        error: 'Missing QUICKBOOKS_CLIENT_ID',
        message:
          'Set QUICKBOOKS_CLIENT_ID in .env.local (local) or in your host\'s env vars (e.g. Vercel → Settings → Environment Variables). Restart the dev server after changing .env.local.',
      },
      { status: 500 }
    )
  }

  if (!userEmail) {
    return NextResponse.json(
      {
        error: 'Missing userEmail',
        message: 'This app expects ?userEmail= so we can attribute the connection.',
      },
      { status: 400 }
    )
  }

  const state = crypto.randomBytes(16).toString('hex')
  const origin = appUrl?.replace(/\/+$/, '') || request.nextUrl.origin.replace(/\/+$/, '')
  const redirectUri = `${origin}/api/quickbooks/callback`

  const authUrl = new URL('https://appcenter.intuit.com/connect/oauth2')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', QB_SCOPES)
  authUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authUrl.toString())
  res.cookies.set('quickbooks_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  })
  res.cookies.set('quickbooks_oauth_user_email', userEmail, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  })

  return res
}
