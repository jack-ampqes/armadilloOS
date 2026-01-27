import type { QuickBooksApiCredentials } from './quickbooks-connection'

function getQbBase(): string {
  return process.env.QUICKBOOKS_SANDBOX === 'true'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company'
}

async function qbRequest<T>(
  creds: QuickBooksApiCredentials,
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const base = getQbBase()
  const url = `${base}/${creds.realmId}${path}`
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

/** QBO QueryResponse for Account. */
export interface AccountQueryResponse {
  QueryResponse?: {
    Account?: Array<{ Id?: string; Name?: string; AccountType?: string; AccountSubType?: string }>
    startPosition?: number
    maxResults?: number
    totalCount?: number
  }
}

/** Query Account entity (chart of accounts). Uses getDefaultQuickBooksCredentials + refresh when expired. */
export async function queryAccounts(
  creds: QuickBooksApiCredentials,
  maxResults = 5
): Promise<AccountQueryResponse> {
  const query = `select * from Account maxresults ${Math.min(Math.max(1, maxResults), 100)}`
  return qbRequest<AccountQueryResponse>(
    creds,
    'GET',
    `/query?query=${encodeURIComponent(query)}`
  )
}

/** P&L Report row structure */
export interface ProfitAndLossRow {
  ColData?: Array<{ value?: string; id?: string }>
  Summary?: { ColData?: Array<{ value?: string }> }
  Rows?: { Row?: ProfitAndLossRow[] }
  group?: string
  type?: string
}

/** P&L Report response */
export interface ProfitAndLossResponse {
  Header?: {
    Time?: string
    ReportName?: string
    StartPeriod?: string
    EndPeriod?: string
  }
  Columns?: { Column?: Array<{ ColTitle?: string; ColType?: string }> }
  Rows?: {
    Row?: ProfitAndLossRow[]
  }
}

/** Fetch Profit & Loss report from QuickBooks */
export async function getProfitAndLoss(
  creds: QuickBooksApiCredentials,
  startDate?: string,
  endDate?: string
): Promise<ProfitAndLossResponse> {
  const params = new URLSearchParams()
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  params.set('summarize_column_by', 'Total')
  
  const queryString = params.toString()
  return qbRequest<ProfitAndLossResponse>(
    creds,
    'GET',
    `/reports/ProfitAndLoss${queryString ? `?${queryString}` : ''}`
  )
}

/** Parse P&L report to extract key totals */
export function parseProfitAndLoss(report: ProfitAndLossResponse): {
  totalIncome: number
  totalExpenses: number
  netIncome: number
  costOfGoodsSold: number
  grossProfit: number
} {
  let totalIncome = 0
  let totalExpenses = 0
  let netIncome = 0
  let costOfGoodsSold = 0
  let grossProfit = 0

  const rows = report.Rows?.Row || []
  
  for (const row of rows) {
    const group = row.group?.toLowerCase() || ''
    const summary = row.Summary?.ColData?.[1]?.value
    const value = summary ? parseFloat(summary) || 0 : 0

    if (group === 'income') {
      totalIncome = value
    } else if (group === 'cogs') {
      costOfGoodsSold = value
    } else if (group === 'grossprofit') {
      grossProfit = value
    } else if (group === 'expenses') {
      totalExpenses = value
    } else if (group === 'netincome' || row.type === 'Section' && row.group === 'NetIncome') {
      netIncome = value
    }
  }

  // If netIncome wasn't found directly, calculate it
  if (netIncome === 0 && (totalIncome !== 0 || totalExpenses !== 0)) {
    netIncome = totalIncome - costOfGoodsSold - totalExpenses
  }

  return { totalIncome, totalExpenses, netIncome, costOfGoodsSold, grossProfit }
}
