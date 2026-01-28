import type { QuickBooksApiCredentials } from './quickbooks-connection'

function getQbBase(): string {
  return process.env.QUICKBOOKS_SANDBOX === 'false'
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

/** Escape single quotes for QB query strings (DisplayName in WHERE clause). */
function escapeDisplayName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** QB Customer from query. */
export interface QuickBooksCustomer {
  Id: string
  DisplayName?: string
  SyncToken?: string
  PrimaryEmailAddr?: { Address?: string }
  PrimaryPhone?: { FreeFormNumber?: string }
  BillAddr?: {
    Line1?: string
    City?: string
    CountrySubDivisionCode?: string
    PostalCode?: string
    Country?: string
  }
}

/** QueryResponse for Customer. */
export interface CustomerQueryResponse {
  QueryResponse?: {
    Customer?: QuickBooksCustomer[]
    startPosition?: number
    maxResults?: number
    totalCount?: number
  }
}

/** Find customers by display name. Returns first match or empty array. */
export async function queryCustomersByDisplayName(
  creds: QuickBooksApiCredentials,
  displayName: string
): Promise<QuickBooksCustomer[]> {
  const escaped = escapeDisplayName(displayName.trim())
  const query = `select * from Customer where DisplayName='${escaped}' maxresults 10`
  const res = await qbRequest<CustomerQueryResponse>(creds, 'GET', `/query?query=${encodeURIComponent(query)}`)
  return res.QueryResponse?.Customer ?? []
}

/** Escape value for use inside a LIKE pattern (literal % and _). */
function escapeLikeValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/'/g, "\\'")
}

/** Search customers by display name (partial match). Returns up to maxResults. */
export async function queryCustomersSearch(
  creds: QuickBooksApiCredentials,
  searchTerm: string,
  maxResults = 20
): Promise<QuickBooksCustomer[]> {
  const trimmed = searchTerm.trim()
  if (!trimmed) return []
  const escaped = escapeLikeValue(trimmed)
  const n = Math.min(Math.max(1, maxResults), 100)
  const query = `select * from Customer where DisplayName like '%${escaped}%' maxresults ${n}`
  const res = await qbRequest<CustomerQueryResponse>(creds, 'GET', `/query?query=${encodeURIComponent(query)}`)
  return res.QueryResponse?.Customer ?? []
}

/** Create customer input. */
export interface CreateCustomerInput {
  displayName: string
  email?: string
  phone?: string
  companyName?: string
  line1?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
}

/** Create a customer in QuickBooks. */
export async function createCustomer(
  creds: QuickBooksApiCredentials,
  input: CreateCustomerInput
): Promise<{ Customer: QuickBooksCustomer }> {
  const body: Record<string, unknown> = {
    DisplayName: input.displayName.trim(),
  }
  if (input.email) {
    body.PrimaryEmailAddr = { Address: input.email }
  }
  if (input.phone) {
    body.PrimaryPhone = { FreeFormNumber: input.phone }
  }
  if (input.companyName) {
    body.CompanyName = input.companyName
  }
  const addrParts: string[] = []
  if (input.line1) addrParts.push(input.line1)
  if (input.city) addrParts.push(input.city)
  if (input.state) addrParts.push(input.state)
  if (input.postalCode) addrParts.push(input.postalCode)
  if (input.country) addrParts.push(input.country)
  if (addrParts.length > 0) {
    body.BillAddr = { Line1: input.line1, City: input.city, CountrySubDivisionCode: input.state, PostalCode: input.postalCode, Country: input.country }
  }
  return qbRequest(creds, 'POST', '/customer', body)
}

/** QB Estimate line from API. */
export interface QuickBooksEstimateLine {
  Id?: string
  DetailType?: string
  Description?: string
  Amount?: number
  SalesItemLineDetail?: {
    Qty?: number
    UnitPrice?: number
    ItemRef?: { value?: string; name?: string }
  }
}

/** QB Estimate from query/read. */
export interface QuickBooksEstimate {
  Id: string
  SyncToken?: string
  DocNumber?: string
  TxnDate?: string
  ExpirationDate?: string
  TotalAmt?: number
  TxnStatus?: string  // Pending, Accepted, Rejected, Closed
  CustomerRef?: { value?: string; name?: string }
  Line?: QuickBooksEstimateLine[]
  CustomerMemo?: { value?: string }
  PrivateNote?: string
}

/** QueryResponse for Estimate. */
export interface EstimateQueryResponse {
  QueryResponse?: {
    Estimate?: QuickBooksEstimate[]
    startPosition?: number
    maxResults?: number
    totalCount?: number
  }
}

/** Query estimates. */
export interface QueryEstimatesOptions {
  maxResults?: number
  startPosition?: number
}

/** Fetch estimates from QuickBooks. */
export async function queryEstimates(
  creds: QuickBooksApiCredentials,
  options: QueryEstimatesOptions = {}
): Promise<QuickBooksEstimate[]> {
  const { maxResults = 100, startPosition } = options
  const n = Math.min(Math.max(1, maxResults), 1000)
  let query = `select * from Estimate maxresults ${n}`
  if (startPosition != null && startPosition > 0) {
    query += ` startposition ${startPosition}`
  }
  const res = await qbRequest<EstimateQueryResponse>(creds, 'GET', `/query?query=${encodeURIComponent(query)}`)
  return res.QueryResponse?.Estimate ?? []
}

/** Fetch a single estimate by id. */
export async function getEstimate(
  creds: QuickBooksApiCredentials,
  estimateId: string
): Promise<{ Estimate: QuickBooksEstimate }> {
  return qbRequest(creds, 'GET', `/estimate/${estimateId}`)
}

/** Update estimate input: same as create plus Id and SyncToken. */
export interface UpdateEstimateInput extends CreateEstimateInput {
  id: string
  syncToken: string
}

/** Update an existing estimate in QuickBooks. */
export async function updateEstimate(
  creds: QuickBooksApiCredentials,
  input: UpdateEstimateInput
): Promise<{ Estimate: { Id: string; DocNumber?: string; SyncToken?: string } }> {
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
    Id: input.id,
    SyncToken: input.syncToken,
    CustomerRef: customerRef,
    TxnDate: input.txnDate || new Date().toISOString().slice(0, 10),
    DocNumber: input.docNumber,
    ExpirationDate: input.expirationDate,
    Line,
    CustomerMemo: input.customerMemo ? { value: input.customerMemo.value } : undefined,
  }
  return qbRequest(creds, 'POST', '/estimate', body)
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

/** Flatten nested P&L rows so we don't miss sections inside Section rows */
function flattenPlRows(rows: ProfitAndLossRow[]): ProfitAndLossRow[] {
  const out: ProfitAndLossRow[] = []
  for (const row of rows) {
    out.push(row)
    const nested = row.Rows?.Row
    if (nested?.length) {
      out.push(...flattenPlRows(nested))
    }
  }
  return out
}

/** Get the total-column value from Summary; with summarize_column_by=Total the total is usually the last ColData */
function summaryTotal(colData: Array<{ value?: string }> | undefined): number {
  if (!colData?.length) return 0
  const raw = colData[colData.length - 1]?.value ?? colData[0]?.value ?? ''
  return parseFloat(raw) || 0
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

  const rows = flattenPlRows(report.Rows?.Row ?? [])

  for (const row of rows) {
    const group = (row.group ?? '').toLowerCase().replace(/\s+/g, '')
    const value = summaryTotal(row.Summary?.ColData)

    if (group === 'income') {
      totalIncome = value
    } else if (group === 'cogs') {
      costOfGoodsSold = value
    } else if (group === 'grossprofit') {
      grossProfit = value
    } else if (group === 'expense' || group === 'expenses') {
      // QuickBooks may return expenses as negative; store as positive for "Total Expenses" display
      totalExpenses = Math.abs(value)
    } else if (group === 'netincome' || (row.type === 'Section' && row.group === 'NetIncome')) {
      netIncome = value
    }
  }

  // If netIncome wasn't found directly, derive it
  if (netIncome === 0 && (totalIncome !== 0 || totalExpenses !== 0)) {
    netIncome = totalIncome - costOfGoodsSold - totalExpenses
  }

  return { totalIncome, totalExpenses, netIncome, costOfGoodsSold, grossProfit }
}
