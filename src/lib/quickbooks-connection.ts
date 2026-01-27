import { supabaseAdmin } from '@/lib/supabase'

export type QuickBooksApiCredentials = {
  realmId: string
  accessToken: string
  refreshToken?: string
  source: 'supabase' | 'env'
}

const REFRESH_ENDPOINT = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
const BUFFER_MS = 5 * 60 * 1000 // 5 min buffer before expiry

function getBasicAuthHeader(clientId: string, clientSecret: string): string {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')
}

async function refreshQuickBooksTokens(
  realmId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error(
      'QuickBooks token expired. Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET, then reconnect via Profile.'
    )
  }

  const res = await fetch(REFRESH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: getBasicAuthHeader(clientId, clientSecret),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QuickBooks token expired. Reconnect via Profile. (Refresh failed: ${res.status})`)
  }

  const json = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
  const accessToken = json.access_token
  const newRefreshToken = json.refresh_token ?? refreshToken
  const expiresIn = json.expires_in ?? 3600
  return { accessToken, refreshToken: newRefreshToken, expiresIn }
}

export async function getDefaultQuickBooksCredentials(): Promise<QuickBooksApiCredentials> {
  try {
    const { data, error } = await supabaseAdmin
      .from('quickbooks_connections')
      .select('realm_id, access_token, refresh_token, token_expires_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const row = data[0] as {
        realm_id: string
        access_token: string
        refresh_token: string
        token_expires_at: string | null
      }
      const realmId = String(row.realm_id || '').trim()
      const accessToken = String(row.access_token || '').trim()
      const refreshToken = String(row.refresh_token || '').trim()
      const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null
      const now = new Date()

      if (realmId && accessToken && (!expiresAt || expiresAt.getTime() > now.getTime() + BUFFER_MS)) {
        return {
          realmId,
          accessToken,
          refreshToken: refreshToken || undefined,
          source: 'supabase',
        }
      }

      // Token expired or within buffer: refresh before returning
      if (realmId && refreshToken) {
        const { accessToken: newAccess, refreshToken: newRefresh, expiresIn } =
          await refreshQuickBooksTokens(realmId, refreshToken)
        const tokenExpiresAt = new Date(now.getTime() + expiresIn * 1000)
        const iso = now.toISOString()

        const { error: upsertError } = await supabaseAdmin
          .from('quickbooks_connections')
          .upsert(
            {
              realm_id: realmId,
              access_token: newAccess,
              refresh_token: newRefresh,
              token_expires_at: tokenExpiresAt.toISOString(),
              updated_at: iso,
            },
            { onConflict: 'realm_id' }
          )

        if (!upsertError) {
          return {
            realmId,
            accessToken: newAccess,
            refreshToken: newRefresh,
            source: 'supabase',
          }
        }
      }

      throw new Error('QuickBooks token expired. Reconnect via Profile.')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('QuickBooks')) throw e
    // Table missing or Supabase not configured – fall through to env
  }

  const realmId = (process.env.QUICKBOOKS_REALM_ID || '').trim()
  const accessToken = (process.env.QUICKBOOKS_ACCESS_TOKEN || '').trim()
  if (!realmId || !accessToken) {
    throw new Error(
      'QuickBooks not configured. Connect via Profile → QuickBooks or set QUICKBOOKS_REALM_ID and QUICKBOOKS_ACCESS_TOKEN.'
    )
  }
  return {
    realmId,
    accessToken,
    source: 'env',
  }
}
