/**
 * Map Supabase snake_case rows to API camelCase and vice versa for quotes/quote_items.
 * Use at API boundary so frontend keeps receiving camelCase.
 */

export type QuoteRow = {
  id: string
  quote_number: string
  status: string
  customer_name: string
  customer_email: string | null
  customer_phone: string | null
  customer_address: string | null
  customer_city: string | null
  customer_state: string | null
  customer_zip: string | null
  customer_country: string | null
  subtotal: number
  discount_type: string | null
  discount_value: number | null
  discount_amount: number
  total: number
  valid_until: string | null
  created_at: string
  updated_at: string
  notes: string | null
  quickbooks_estimate_id: string | null
  quickbooks_synced_at: string | null
}

export type QuoteItemRow = {
  id: string
  quote_id: string
  product_id: string | null
  product_name: string
  sku: string | null
  quantity: number
  unit_price: number
  total_price: number
}

export type QuoteWithItemsRow = QuoteRow & { quote_items: QuoteItemRow[] }

function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function keysToCamel<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    if (v !== undefined && v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)) {
      ;(out as Record<string, unknown>)[toCamel(k)] = keysToCamel(v as Record<string, unknown>)
    } else {
      ;(out as Record<string, unknown>)[toCamel(k)] = v
    }
  }
  return out
}

export function mapQuoteItemRowToApi(row: QuoteItemRow): Record<string, unknown> {
  return keysToCamel(row as unknown as Record<string, unknown>) as Record<string, unknown>
}

export function mapQuoteRowToApi(row: QuoteWithItemsRow): Record<string, unknown> {
  const { quote_items, ...rest } = row
  const base = keysToCamel(rest as unknown as Record<string, unknown>) as Record<string, unknown>
  base.quoteItems = (quote_items || []).map(mapQuoteItemRowToApi)
  return base
}

/** Build insert row for quotes (snake_case). */
export function quoteApiToInsertRow(body: {
  quoteNumber: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  customerCity?: string | null
  customerState?: string | null
  customerZip?: string | null
  customerCountry?: string | null
  subtotal: number
  discountType?: string | null
  discountValue?: number | null
  discountAmount?: number
  total: number
  validUntil?: string | null
  notes?: string | null
}): Record<string, unknown> {
  return {
    quote_number: body.quoteNumber,
    customer_name: body.customerName,
    customer_email: body.customerEmail ?? null,
    customer_phone: body.customerPhone ?? null,
    customer_address: body.customerAddress ?? null,
    customer_city: body.customerCity ?? null,
    customer_state: body.customerState ?? null,
    customer_zip: body.customerZip ?? null,
    customer_country: body.customerCountry ?? null,
    subtotal: body.subtotal,
    discount_type: body.discountType ?? null,
    discount_value: body.discountValue ?? null,
    discount_amount: body.discountAmount ?? 0,
    total: body.total,
    valid_until: body.validUntil ? new Date(body.validUntil).toISOString() : null,
    notes: body.notes ?? null,
  }
}

/** Build insert row for quote_items (snake_case). */
export function quoteItemApiToInsertRow(quoteId: string, item: {
  productId?: string | null
  productName: string
  sku?: string | null
  quantity: number
  unitPrice: number
  totalPrice: number
}): Record<string, unknown> {
  return {
    quote_id: quoteId,
    product_id: item.productId ?? null,
    product_name: item.productName,
    sku: item.sku ?? null,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total_price: item.totalPrice,
  }
}

/** Map alert row (snake_case) to API camelCase. */
export function mapAlertRowToApi(row: Record<string, unknown>): Record<string, unknown> {
  return keysToCamel(row)
}

/** Build QuoteForQuickBooks shape from Supabase quote row with quote_items. */
export function quoteRowToQuickBooksShape(row: QuoteWithItemsRow): {
  quoteNumber: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  customerAddress?: string | null
  customerCity?: string | null
  customerState?: string | null
  customerZip?: string | null
  customerCountry?: string | null
  validUntil?: string | null
  notes?: string | null
  discountType?: string | null
  discountValue?: number | null
  discountAmount?: number
  total?: number
  quoteItems: Array<{ productName: string; sku?: string | null; quantity: number; unitPrice: number; totalPrice?: number }>
  quickbooksEstimateId?: string | null
} {
  const items = (row.quote_items || []).map((i) => ({
    productName: i.product_name,
    sku: i.sku ?? undefined,
    quantity: i.quantity,
    unitPrice: i.unit_price,
    totalPrice: i.total_price,
  }))
  return {
    quoteNumber: row.quote_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    customerAddress: row.customer_address ?? undefined,
    customerCity: row.customer_city ?? undefined,
    customerState: row.customer_state ?? undefined,
    customerZip: row.customer_zip ?? undefined,
    customerCountry: row.customer_country ?? undefined,
    validUntil: row.valid_until ?? undefined,
    notes: row.notes ?? undefined,
    discountType: row.discount_type ?? undefined,
    discountValue: row.discount_value ?? undefined,
    discountAmount: row.discount_amount ?? undefined,
    total: row.total ?? undefined,
    quoteItems: items,
    quickbooksEstimateId: row.quickbooks_estimate_id ?? undefined,
  }
}
