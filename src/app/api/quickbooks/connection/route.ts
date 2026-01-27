import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('quickbooks_connections')
      .select('realm_id, token_expires_at, connected_by_email, updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)

    if (!error && data && data.length > 0) {
      const row = data[0] as {
        realm_id: string
        token_expires_at: string | null
        connected_by_email: string | null
        updated_at: string | null
      }
      const expiresAt = row.token_expires_at ? new Date(row.token_expires_at) : null
      const expired = expiresAt ? expiresAt.getTime() < Date.now() : false
      return NextResponse.json({
        connected: true,
        source: 'supabase',
        realmId: row.realm_id,
        expiresAt: row.token_expires_at ?? null,
        expired,
        connected_by_email: row.connected_by_email ?? null,
        updated_at: row.updated_at ?? null,
      })
    }
  } catch {
    // ignore
  }

  const realmId = process.env.QUICKBOOKS_REALM_ID || null
  const hasToken = Boolean(process.env.QUICKBOOKS_ACCESS_TOKEN)

  return NextResponse.json({
    connected: Boolean(realmId && hasToken),
    source: realmId && hasToken ? 'env' : null,
    realmId,
  })
}
