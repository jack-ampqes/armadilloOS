import type { QuickBooksApiCredentials } from './quickbooks-connection'

const QB_BASE = 'https://quickbooks.api.intuit.com/v3/company'

async function qbRequest<T>(
  creds: QuickBooksApiCredentials,
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const url = `${QB_BASE}/${creds.realmId}${path}`
  const headers: Record<string, string> = {
    Authorization: `Bearer ${creds.accessToken}`,
    Accept: 'application/json',
  }
  if (body) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`QuickBooks API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

/** Create an estimate in QuickBooks. Customer must exist in QB or pass a CustomerRef.value from a prior create. */
export interface CreateEstimateInput {
  customerRef: string | { value: string; name?: string }
  docNumber?: string
  txnDate?: string
  expirationDate?: string
  lines: Array<{
    description: string
    amount?: number
    quantity: number
    unitPrice?: number
    detailType?: 'SalesItemLineDetail'
    salesItemLineDetail?: { itemRef?: { value: string }; unitPrice?: number; qty?: number }
  }>
  customerMemo?: { value: string }
}

export async function createEstimate(
  creds: QuickBooksApiCredentials,
  input: CreateEstimateInput
): Promise<{ Estimate: { Id: string; DocNumber?: string } }> {
  const customerRef =
    typeof input.customerRef === 'string'
      ? { value: input.customerRef }
      : { value: input.customerRef.value, name: input.customerRef.name }
  const Line = input.lines.map((ln) => ({
    DetailType: ln.detailType || 'SalesItemLineDetail',
    Amount: ln.amount ?? (ln.quantity * (ln.unitPrice ?? 0)),
    Description: ln.description,
    SalesItemLineDetail: {
      Qty: ln.quantity,
      UnitPrice: ln.unitPrice ?? (ln.amount ?? 0) / ln.quantity,
      ...ln.salesItemLineDetail,
    },
  }))
  const body = {
    CustomerRef: customerRef,
    TxnDate: input.txnDate || new Date().toISOString().slice(0, 10),
    DocNumber: input.docNumber,
    ExpirationDate: input.expirationDate,
    Line,
    CustomerMemo: input.customerMemo ? { value: input.customerMemo.value } : undefined,
  }
  return qbRequest(creds, 'POST', '/estimate', body)
}

/** Send an estimate by email. */
export async function sendEstimate(
  creds: QuickBooksApiCredentials,
  estimateId: string,
  sendTo?: string
): Promise<{ Estimate: { Id: string; EmailStatus?: string } }> {
  const path = `/estimate/${estimateId}/send${sendTo ? `?sendTo=${encodeURIComponent(sendTo)}` : ''}`
  return qbRequest(creds, 'POST', path, undefined)
}

/** Create an invoice in QuickBooks. */
export interface CreateInvoiceInput {
  customerRef: string | { value: string; name?: string }
  docNumber?: string
  txnDate?: string
  lines: Array<{
    description: string
    amount?: number
    quantity: number
    unitPrice?: number
    salesItemLineDetail?: { itemRef?: { value: string }; unitPrice?: number; qty?: number }
  }>
  customerMemo?: { value: string }
}

export async function createInvoice(
  creds: QuickBooksApiCredentials,
  input: CreateInvoiceInput
): Promise<{ Invoice: { Id: string; DocNumber?: string } }> {
  const customerRef =
    typeof input.customerRef === 'string'
      ? { value: input.customerRef }
      : { value: input.customerRef.value, name: input.customerRef.name }
  const Line = input.lines.map((ln) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: ln.amount ?? ln.quantity * (ln.unitPrice ?? 0),
    Description: ln.description,
    SalesItemLineDetail: {
      Qty: ln.quantity,
      UnitPrice: ln.unitPrice ?? (ln.amount ?? 0) / ln.quantity,
      ...ln.salesItemLineDetail,
    },
  }))
  const body = {
    CustomerRef: customerRef,
    TxnDate: input.txnDate || new Date().toISOString().slice(0, 10),
    DocNumber: input.docNumber,
    Line,
    CustomerMemo: input.customerMemo ? { value: input.customerMemo.value } : undefined,
  }
  return qbRequest(creds, 'POST', '/invoice', body)
}

/** Send an invoice by email. */
export async function sendInvoice(
  creds: QuickBooksApiCredentials,
  invoiceId: string,
  sendTo?: string
): Promise<{ Invoice: { Id: string; EmailStatus?: string } }> {
  const path = `/invoice/${invoiceId}/send${sendTo ? `?sendTo=${encodeURIComponent(sendTo)}` : ''}`
  return qbRequest(creds, 'POST', path, undefined)
}
