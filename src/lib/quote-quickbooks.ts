import type { QuickBooksApiCredentials } from './quickbooks-connection'
import {
  queryCustomersByDisplayName,
  createCustomer,
  createEstimate,
  getEstimate,
  updateEstimate,
  type QuickBooksEstimate,
  type QuickBooksEstimateLine,
} from './quickbooks'

/** Quote shape used for pushing to QuickBooks (from Supabase or API). */
export interface QuoteForQuickBooks {
  quoteNumber: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  customerCity?: string | null
  customerState?: string | null
  customerZip?: string | null
  customerCountry?: string | null
  validUntil?: Date | string | null
  notes?: string | null
  discountType?: string | null
  discountValue?: number | null
  discountAmount?: number
  total?: number
  quoteItems: Array<{
    productName: string
    sku?: string | null
    quantity: number
    unitPrice: number
    totalPrice?: number
  }>
  quickbooksEstimateId?: string | null
}

/**
 * Resolve QuickBooks customer id by display name, or create customer if missing.
 */
export async function resolveOrCreateCustomer(
  creds: QuickBooksApiCredentials,
  quote: QuoteForQuickBooks
): Promise<string> {
  const existing = await queryCustomersByDisplayName(creds, quote.customerName)
  if (existing.length > 0 && existing[0].Id) {
    return existing[0].Id
  }
  const fullAddress = [quote.customerAddress, quote.customerCity, quote.customerState, quote.customerZip, quote.customerCountry]
    .filter(Boolean)
    .join(', ')
  const line1 = fullAddress ? fullAddress : (quote.customerAddress ?? undefined)
  const created = await createCustomer(creds, {
    displayName: quote.customerName,
    email: quote.customerEmail ?? undefined,
    phone: quote.customerPhone ?? undefined,
    line1,
    city: quote.customerCity ?? undefined,
    state: quote.customerState ?? undefined,
    postalCode: quote.customerZip ?? undefined,
    country: quote.customerCountry ?? undefined,
  })
  return created.Customer.Id
}

/**
 * Push a quote to QuickBooks as an Estimate (create or update).
 * Returns the QuickBooks Estimate Id.
 */
export async function pushQuoteToQuickBooks(
  quote: QuoteForQuickBooks,
  creds: QuickBooksApiCredentials
): Promise<{ quickbooksEstimateId: string }> {
  const customerId = await resolveOrCreateCustomer(creds, quote)
  const lines = quote.quoteItems.map((item) => ({
    description: item.productName + (item.sku ? ` (${item.sku})` : ''),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: (item.totalPrice ?? item.unitPrice * item.quantity),
  }))
  const txnDate = new Date().toISOString().slice(0, 10)
  const expirationDate = quote.validUntil
    ? (typeof quote.validUntil === 'string' ? quote.validUntil : quote.validUntil.toISOString().slice(0, 10))
    : undefined
  const customerMemo = quote.notes ? { value: quote.notes } : undefined

  if (quote.quickbooksEstimateId) {
    const { Estimate } = await getEstimate(creds, quote.quickbooksEstimateId)
    const syncToken = Estimate.SyncToken ?? '0'
    await updateEstimate(creds, {
      id: quote.quickbooksEstimateId,
      syncToken,
      customerRef: customerId,
      docNumber: quote.quoteNumber,
      txnDate,
      expirationDate,
      lines,
      customerMemo,
    })
    return { quickbooksEstimateId: quote.quickbooksEstimateId }
  }

  const result = await createEstimate(creds, {
    customerRef: customerId,
    docNumber: quote.quoteNumber,
    txnDate,
    expirationDate,
    lines,
    customerMemo,
  })
  return { quickbooksEstimateId: result.Estimate.Id }
}

/** Map QB TxnStatus to app quote status. Never use DRAFT for synced-from-QB quotes. */
function mapQuickBooksStatusToQuoteStatus(txnStatus?: string): string {
  const s = (txnStatus ?? '').toLowerCase()
  if (s === 'accepted') return 'ACCEPTED'
  if (s === 'rejected') return 'REJECTED'
  if (s === 'closed') return 'EXPIRED'
  // Pending or unknown -> SENT (so synced quotes are never DRAFT)
  return 'SENT'
}

/**
 * Map a QuickBooks Estimate to app quote/line shape for upsert.
 */
export function mapQuickBooksEstimateToQuote(qb: QuickBooksEstimate): {
  quoteNumber: string
  customerName: string
  customerEmail: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  customerCountry: string | null
  subtotal: number
  discountType: string | null
  discountValue: number | null
  discountAmount: number
  total: number
  validUntil: string | null
  notes: string | null
  status: string
  quoteItems: Array<{ productName: string; sku: string | null; quantity: number; unitPrice: number; totalPrice: number }>
} {
  const customerName = qb.CustomerRef?.name ?? 'Unknown'
  const total = qb.TotalAmt ?? 0
  const lineItems = (qb.Line ?? []).filter(
    (l): l is QuickBooksEstimateLine & { SalesItemLineDetail?: { Qty?: number; UnitPrice?: number } } =>
      l.DetailType === 'SalesItemLineDetail' && l.SalesItemLineDetail != null
  )
  const quoteItems = lineItems.map((l) => {
    const qty = l.SalesItemLineDetail?.Qty ?? 1
    const unitPrice = l.SalesItemLineDetail?.UnitPrice ?? (l.Amount ?? 0) / qty
    const totalPrice = l.Amount ?? qty * unitPrice
    return {
      productName: l.Description ?? 'Item',
      sku: null as string | null,
      quantity: Math.round(qty),
      unitPrice,
      totalPrice,
    }
  })
  const subtotal = quoteItems.reduce((s, i) => s + i.totalPrice, 0)
  const discountAmount = Math.max(0, subtotal - total)
  const quoteNumber = qb.DocNumber ?? `QB-${qb.Id}`
  const validUntil = qb.ExpirationDate ?? null
  const notes = qb.CustomerMemo?.value ?? qb.PrivateNote ?? null
  const status = mapQuickBooksStatusToQuoteStatus(qb.TxnStatus)
  return {
    quoteNumber,
    customerName,
    customerEmail: null,
    customerPhone: null,
    customerAddress: null,
    customerCity: null,
    customerState: null,
    customerZip: null,
    customerCountry: null,
    subtotal,
    discountType: discountAmount > 0 ? 'fixed' : null,
    discountValue: discountAmount > 0 ? discountAmount : null,
    discountAmount,
    total,
    validUntil,
    notes,
    status,
    quoteItems,
  }
}
