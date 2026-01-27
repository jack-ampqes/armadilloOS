import { NextResponse } from 'next/server'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { queryAccounts } from '@/lib/quickbooks'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const creds = await getDefaultQuickBooksCredentials()
    const result = await queryAccounts(creds, 5)
    const accounts = result.QueryResponse?.Account ?? []
    const totalCount = result.QueryResponse?.totalCount ?? accounts.length
    return NextResponse.json({
      ok: true,
      count: accounts.length,
      totalCount,
      accounts: accounts.map((a) => ({
        id: a.Id,
        name: a.Name,
        type: a.AccountType,
        subType: a.AccountSubType,
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'QuickBooks request failed'
    return NextResponse.json(
      { ok: false, error: message },
      { status: message.includes('Reconnect') || message.includes('not configured') ? 401 : 502 }
    )
  }
}
