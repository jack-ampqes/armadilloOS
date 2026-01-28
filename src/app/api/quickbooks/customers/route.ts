import { NextRequest, NextResponse } from 'next/server'
import { getDefaultQuickBooksCredentials } from '@/lib/quickbooks-connection'
import { queryCustomersSearch, type QuickBooksCustomer } from '@/lib/quickbooks'

export const runtime = 'nodejs'

/** GET /api/quickbooks/customers?q=searchTerm — search QuickBooks customers by display name. */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q') ?? ''
    const creds = await getDefaultQuickBooksCredentials()
    const customers: QuickBooksCustomer[] = await queryCustomersSearch(creds, q, 20)
    return NextResponse.json({
      ok: true,
      customers: customers.map((c) => ({
        id: c.Id,
        displayName: c.DisplayName ?? '',
        email: c.PrimaryEmailAddr?.Address ?? '',
        phone: c.PrimaryPhone?.FreeFormNumber ?? '',
        billAddr: c.BillAddr
          ? {
              line1: c.BillAddr.Line1 ?? '',
              city: c.BillAddr.City ?? '',
              state: c.BillAddr.CountrySubDivisionCode ?? '',
              postalCode: c.BillAddr.PostalCode ?? '',
              country: c.BillAddr.Country ?? '',
            }
          : undefined,
      })),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'QuickBooks request failed'
    const isConfig =
      message.includes('not configured') ||
      message.includes('Reconnect') ||
      message.includes('QuickBooks')
    return NextResponse.json(
      { ok: false, error: message },
      { status: isConfig ? 401 : 502 }
    )
  }
}
