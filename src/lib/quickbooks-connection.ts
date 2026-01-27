import { supabaseAdmin } from '@/lib/supabase'

export type QuickBooksApiCredentials = {
  realmId: string
  accessToken: string
  refreshToken?: string
  source: 'supabase' | 'env'
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
      const bufferMs = 5 * 60 * 1000 // 5 min buffer
      if (realmId && accessToken && (!expiresAt || expiresAt.getTime() > now.getTime() + bufferMs)) {
        return {
          realmId,
          accessToken,
          refreshToken: refreshToken || undefined,
          source: 'supabase',
        }
      }
      // Token expired: caller can use refresh_token to refresh; we still return credentials
      if (realmId && accessToken) {
        return { realmId, accessToken, refreshToken: refreshToken || undefined, source: 'supabase' }
      }
    }
  } catch {
    // Table missing or Supabase not configured
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
