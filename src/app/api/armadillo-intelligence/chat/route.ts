import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { getOrders as getShopifyOrders } from '@/lib/shopify'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const MODEL = 'llama-3.3-70b-versatile'
const MAX_MESSAGES = 6
const MAX_MESSAGE_LENGTH = 800

const ROW_LIMITS = {
  inventory_low_stock: 40,
  inventory_recent: 10,
  orders_raw_sample: 10,
  orders_fetch: 60,
  manufacturer_orders: 8,
  manufacturer_order_items_per_order: 5,
  order_line_items: 3,
  customers: 8,
  users: 8,
  documents: 6,
  top_sellers: 25,
  open_mo_incoming: 25,
  recent_outflows: 20,
  reorder_candidates: 20,
}

const SALES_WINDOW_DAYS = 30
const OPEN_MO_STATUSES = new Set([
  'pending',
  'ordered',
  'confirmed',
  'in_transit',
  'in transit',
  'shipped',
  'processing',
  'partial',
  'partially_received',
])

const FIELD_CAP = 60

function cap(value: unknown, max = FIELD_CAP): unknown {
  if (typeof value === 'string') {
    if (value.length <= max) return value
    return `${value.slice(0, max)}…`
  }
  return value
}

function truncateText(value: string, max = MAX_MESSAGE_LENGTH): string {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function normalizeMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return []
  return input
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const maybeRole = (item as { role?: unknown }).role
      const maybeContent = (item as { content?: unknown }).content
      if ((maybeRole !== 'user' && maybeRole !== 'assistant') || typeof maybeContent !== 'string') {
        return null
      }
      return {
        role: maybeRole,
        content: truncateText(maybeContent.trim()),
      } as ChatMessage
    })
    .filter((message): message is ChatMessage => Boolean(message && message.content))
    .slice(-MAX_MESSAGES)
}

async function safeFetch<T>(
  name: string,
  query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>
): Promise<T[]> {
  const result = await query
  if (result.error) {
    console.warn(`[Armadillo Intelligence] Failed to load ${name}: ${result.error.message || 'Unknown error'}`)
    return []
  }
  return result.data ?? []
}

// Pull anything that looks like a SKU out of the latest user message(s).
// Intentionally permissive because SKUs can have dashes, dots, and digits.
const SKU_REGEX = /\b[A-Z]{1,6}[-]?[A-Z0-9.]{2,}\b/g

function extractSkus(messages: ChatMessage[]): string[] {
  const pool = new Set<string>()
  for (const message of messages) {
    if (message.role !== 'user') continue
    const upper = message.content.toUpperCase()
    const matches = upper.match(SKU_REGEX)
    if (!matches) continue
    for (const raw of matches) {
      const cleaned = raw.trim()
      // Skip short/common words accidentally captured
      if (/^\d+$/.test(cleaned)) continue
      if (cleaned.length < 3) continue
      // Heuristic: must contain at least one digit, since all real SKUs here do.
      if (!/\d/.test(cleaned)) continue
      pool.add(cleaned)
    }
  }
  return Array.from(pool).slice(0, 10)
}

async function fetchTargetedSkuData(skus: string[]) {
  if (!skus.length) {
    return {
      inventory: [] as Record<string, unknown>[],
      inventory_history: [] as Record<string, unknown>[],
      manufacturer_order_items: [] as Record<string, unknown>[],
    }
  }

  const [inventory, history, moItems] = await Promise.all([
    safeFetch<Record<string, unknown>>(
      'inventory (targeted)',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory')
        .select('sku, quantity, updated_at, price')
        .in('sku', skus)
    ),
    safeFetch<Record<string, unknown>>(
      'inventory history (targeted)',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory_history')
        .select('sku, quantity_change, quantity_after, source, created_at')
        .in('sku', skus)
        .order('created_at', { ascending: false })
        .limit(20)
    ),
    safeFetch<Record<string, unknown>>(
      'manufacturer order items (targeted)',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('manufacturer_order_items')
        .select('order_id, sku, quantity_ordered, quantity_received, unit_cost')
        .in('sku', skus)
        .limit(30)
    ),
  ])

  return {
    inventory,
    inventory_history: history,
    manufacturer_order_items: moItems,
  }
}

type InventoryRow = {
  sku: string
  quantity: number
  price?: number | string | null
  updated_at?: string | null
}

type ShopifyLineItem = { title?: string | null; sku?: string | null; quantity?: number | null }
type ShopifyOrderRow = {
  name?: string
  created_at?: string
  financial_status?: string
  fulfillment_status?: string
  total_price?: string | number
  customer_email?: string | null
  line_items: ShopifyLineItem[]
}

function toInventoryRow(row: Record<string, unknown>): InventoryRow {
  return {
    sku: String(row.sku ?? ''),
    quantity: Number(row.quantity ?? 0),
    price: (row.price as InventoryRow['price']) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  }
}

function aggregateSalesVelocity(orders: ShopifyOrderRow[]) {
  const cutoff = Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const bySku = new Map<string, { units: number; order_count: number; _orders: Set<string> }>()
  for (const order of orders) {
    const ts = order.created_at ? new Date(order.created_at).getTime() : 0
    if (ts && ts < cutoff) continue
    const orderKey = order.name || order.created_at || ''
    for (const item of order.line_items ?? []) {
      const sku = String(item.sku ?? '').trim()
      if (!sku) continue
      const qty = Number(item.quantity) || 0
      const entry = bySku.get(sku) ?? { units: 0, order_count: 0, _orders: new Set<string>() }
      entry.units += qty
      if (orderKey && !entry._orders.has(orderKey)) {
        entry._orders.add(orderKey)
        entry.order_count += 1
      }
      bySku.set(sku, entry)
    }
  }
  return Array.from(bySku.entries())
    .map(([sku, v]) => ({ sku, units_sold: v.units, order_count: v.order_count }))
    .sort((a, b) => b.units_sold - a.units_sold)
    .slice(0, ROW_LIMITS.top_sellers)
}

function aggregateIncomingStock(
  orders: Array<Record<string, unknown>>,
  items: Array<Record<string, unknown>>
) {
  const openOrderIds = new Set<string>()
  for (const o of orders) {
    const status = String(o.status ?? '').toLowerCase()
    if (!status || OPEN_MO_STATUSES.has(status) || status.includes('pending') || status.includes('transit')) {
      openOrderIds.add(String(o.id ?? ''))
    }
  }
  const bySku = new Map<string, number>()
  for (const it of items) {
    const orderId = String(it.order_id ?? '')
    if (!openOrderIds.has(orderId)) continue
    const sku = String(it.sku ?? '').trim()
    if (!sku) continue
    const ordered = Number(it.quantity_ordered) || 0
    const received = Number(it.quantity_received) || 0
    const remaining = Math.max(0, ordered - received)
    if (remaining <= 0) continue
    bySku.set(sku, (bySku.get(sku) ?? 0) + remaining)
  }
  return Array.from(bySku.entries())
    .map(([sku, incoming]) => ({ sku, incoming_units: incoming }))
    .sort((a, b) => b.incoming_units - a.incoming_units)
    .slice(0, ROW_LIMITS.open_mo_incoming)
}

function aggregateRecentOutflows(history: Array<Record<string, unknown>>) {
  const cutoff = Date.now() - SALES_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const bySku = new Map<string, number>()
  for (const h of history) {
    const ts = h.created_at ? new Date(String(h.created_at)).getTime() : 0
    if (ts && ts < cutoff) continue
    const change = Number(h.quantity_change) || 0
    if (change >= 0) continue
    const sku = String(h.sku ?? '').trim()
    if (!sku) continue
    bySku.set(sku, (bySku.get(sku) ?? 0) + Math.abs(change))
  }
  return Array.from(bySku.entries())
    .map(([sku, units]) => ({ sku, units_out: units }))
    .sort((a, b) => b.units_out - a.units_out)
    .slice(0, ROW_LIMITS.recent_outflows)
}

async function fetchContextSnapshot() {
  const [
    inventoryAll,
    inventoryHistoryData,
    manufacturerOrdersData,
    manufacturerOrderItemsData,
    customersData,
    usersData,
    documentsData,
  ] = await Promise.all([
    safeFetch<Record<string, unknown>>(
      'inventory',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory')
        .select('sku, quantity, updated_at, price')
        .limit(2000)
    ),
    safeFetch<Record<string, unknown>>(
      'inventory history',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory_history')
        .select('sku, quantity_change, quantity_after, source, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
    ),
    safeFetch<Record<string, unknown>>(
      'manufacturer orders',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('manufacturer_orders')
        .select('id, order_number, status, order_date, expected_delivery, carrier, total_amount')
        .order('order_date', { ascending: false })
        .limit(50)
    ),
    safeFetch<Record<string, unknown>>(
      'manufacturer order items',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('manufacturer_order_items')
        .select('order_id, sku, quantity_ordered, quantity_received, unit_cost')
        .limit(500)
    ),
    safeFetch<Record<string, unknown>>(
      'customers',
      supabaseAdmin
        .from('customers')
        .select('id, name, company_name, email, city, state')
        .order('updated_at', { ascending: false })
        .limit(ROW_LIMITS.customers)
    ),
    safeFetch<Record<string, unknown>>(
      'users',
      supabaseAdmin
        .from('users')
        .select('id, email, name, role, updated_at')
        .order('updated_at', { ascending: false })
        .limit(ROW_LIMITS.users)
    ),
    safeFetch<Record<string, unknown>>(
      'documents',
      supabaseAdmin
        .from('documents')
        .select('id, name, title, content_type, created_at')
        .order('created_at', { ascending: false })
        .limit(ROW_LIMITS.documents)
    ),
  ])

  const inventoryRows = (inventoryAll ?? []).map(toInventoryRow).filter((r) => r.sku)
  const totalInventorySkus = inventoryRows.length
  const lowStockItems = [...inventoryRows]
    .sort((a, b) => a.quantity - b.quantity)
    .slice(0, ROW_LIMITS.inventory_low_stock)
  const outOfStockCount = inventoryRows.filter((r) => r.quantity <= 0).length
  const recentlyUpdated = [...inventoryRows]
    .filter((r) => r.updated_at)
    .sort((a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime())
    .slice(0, ROW_LIMITS.inventory_recent)
    .map((r) => ({ sku: r.sku, quantity: r.quantity, updated_at: r.updated_at }))

  let shopifyOrders: ShopifyOrderRow[] = []
  try {
    const credentials = await getDefaultShopifyCredentials()
    const orders = await getShopifyOrders(
      { limit: ROW_LIMITS.orders_fetch, status: 'any' },
      {
        shopDomain: credentials.shopDomain,
        accessToken: credentials.accessToken,
      }
    )
    shopifyOrders = orders.map((order) => ({
      name: order.name,
      created_at: order.created_at,
      financial_status: order.financial_status,
      fulfillment_status: order.fulfillment_status,
      total_price: order.total_price,
      customer_email: order.customer?.email || order.email,
      line_items: Array.isArray(order.line_items)
        ? order.line_items.slice(0, ROW_LIMITS.order_line_items).map((item) => ({
            title: cap(item.title) as string | null,
            sku: cap(item.sku) as string | null,
            quantity: item.quantity,
          }))
        : [],
    }))
  } catch {
    shopifyOrders = []
  }

  const itemsByOrderId = new Map<string, Record<string, unknown>[]>()
  for (const item of manufacturerOrderItemsData ?? []) {
    const orderId = String(item.order_id ?? '')
    if (!orderId) continue
    const list = itemsByOrderId.get(orderId) ?? []
    if (list.length < ROW_LIMITS.manufacturer_order_items_per_order) {
      list.push(item)
      itemsByOrderId.set(orderId, list)
    }
  }

  const manufacturerOrdersWithItems = (manufacturerOrdersData ?? [])
    .slice(0, ROW_LIMITS.manufacturer_orders)
    .map((order) => {
      const orderId = String(order.id ?? '')
      return { ...order, items: itemsByOrderId.get(orderId) ?? [] }
    })

  const salesVelocity = aggregateSalesVelocity(shopifyOrders)
  const incomingStock = aggregateIncomingStock(manufacturerOrdersData ?? [], manufacturerOrderItemsData ?? [])
  const recentOutflows = aggregateRecentOutflows(inventoryHistoryData ?? [])

  const incomingBySku = new Map(incomingStock.map((i) => [i.sku, i.incoming_units]))
  const velocityBySku = new Map(salesVelocity.map((s) => [s.sku, s.units_sold]))

  const reorderCandidates = lowStockItems
    .map((r) => {
      const units_sold_30d = velocityBySku.get(r.sku) ?? 0
      const incoming = incomingBySku.get(r.sku) ?? 0
      const days_of_stock = units_sold_30d > 0 ? Math.round((r.quantity / units_sold_30d) * SALES_WINDOW_DAYS) : null
      const urgency =
        (units_sold_30d > 0 && r.quantity <= units_sold_30d ? 2 : 0) +
        (r.quantity <= 0 ? 2 : 0) +
        (incoming <= 0 ? 1 : 0)
      return {
        sku: r.sku,
        quantity: r.quantity,
        units_sold_30d,
        incoming_units: incoming,
        days_of_stock_est: days_of_stock,
        urgency,
      }
    })
    .sort((a, b) => {
      if (b.urgency !== a.urgency) return b.urgency - a.urgency
      return b.units_sold_30d - a.units_sold_30d
    })
    .slice(0, ROW_LIMITS.reorder_candidates)

  const openManufacturerOrders = (manufacturerOrdersData ?? []).filter((o) => {
    const status = String(o.status ?? '').toLowerCase()
    return OPEN_MO_STATUSES.has(status) || status.includes('pending') || status.includes('transit')
  }).length

  return {
    summary: {
      inventory_total_skus: totalInventorySkus,
      inventory_out_of_stock: outOfStockCount,
      inventory_history_rows: (inventoryHistoryData ?? []).length,
      shopify_orders_sampled: shopifyOrders.length,
      sales_window_days: SALES_WINDOW_DAYS,
      manufacturer_orders_total: (manufacturerOrdersData ?? []).length,
      manufacturer_orders_open: openManufacturerOrders,
      customers_sampled: (customersData ?? []).length,
      users_sampled: (usersData ?? []).length,
      documents_sampled: (documentsData ?? []).length,
    },
    analytics: {
      reorder_candidates: reorderCandidates,
      top_sellers_30d: salesVelocity,
      incoming_stock_by_sku: incomingStock,
      recent_outflows_30d: recentOutflows,
    },
    low_stock_items: lowStockItems,
    recently_updated_inventory: recentlyUpdated,
    manufacturer_orders: manufacturerOrdersWithItems,
    orders_recent_sample: shopifyOrders.slice(0, ROW_LIMITS.orders_raw_sample).map((o) => ({
      name: o.name,
      created_at: o.created_at,
      financial_status: o.financial_status,
      fulfillment_status: o.fulfillment_status,
      line_items: o.line_items,
    })),
    customers: customersData ?? [],
    users: usersData ?? [],
    documents: documentsData ?? [],
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdmin(request)
  if ('response' in auth) {
    return auth.response
  }

  try {
    const groqApiKey = process.env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json(
        {
          error: 'Groq API key not configured',
          hint: 'Set GROQ_API_KEY in your environment to use Armadillo Intelligence.',
        },
        { status: 500 }
      )
    }

    const body = await request.json()
    const messages = normalizeMessages((body as { messages?: unknown })?.messages)

    if (!messages.length) {
      return NextResponse.json({ error: 'At least one chat message is required.' }, { status: 400 })
    }

    const requestedSkus = extractSkus(messages)
    const [contextSnapshot, targetedSkuData] = await Promise.all([
      fetchContextSnapshot(),
      fetchTargetedSkuData(requestedSkus),
    ])

    const client = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.1,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: [
            'You are Armadillo Intelligence, an internal operations assistant for Armadillo Safety.',
            'You receive the following data blocks per turn:',
            '  1) "TARGETED DATA" — authoritative rows fetched live for the exact SKUs the user mentioned. ALWAYS prefer these values for those SKUs.',
            '  2) "GENERAL SNAPSHOT" — a curated view of the business state. It includes:',
            '       - summary: totals (SKUs, out-of-stock count, open manufacturer orders, sales window).',
            '       - analytics.reorder_candidates: precomputed list combining current stock, 30-day sales, incoming stock from open manufacturer orders, and an urgency score (higher = more urgent). Treat this as the ranked shortlist for "what should I order next?"',
            '       - analytics.top_sellers_30d: units sold per SKU in the last 30 days (from Shopify orders).',
            '       - analytics.incoming_stock_by_sku: remaining (ordered - received) on currently open manufacturer orders.',
            '       - analytics.recent_outflows_30d: inventory history outflows per SKU (30d).',
            '       - low_stock_items: SKUs sorted ascending by current quantity.',
            '       - manufacturer_orders: most recent manufacturer orders with their items.',
            '       - orders_recent_sample: a few of the most recent Shopify orders with line items (sales totals already captured in analytics.top_sellers_30d).',
            'General rules:',
            ' - Never alter, abbreviate, or "correct" a SKU string. Treat SKUs as opaque exact identifiers (e.g. AA0011B8 ≠ AA011B8).',
            ' - If a SKU the user asked about is NOT in TARGETED DATA, say it was not found in inventory (do not guess).',
            ' - Only report quantities/prices that appear in the data blocks. Never invent numbers.',
            ' - Be concise. Prefer short bullet points. Include the SKU verbatim when reporting values.',
            'Recommendation rules (use when the user asks what to order, reorder, manufacture, restock, etc.):',
            ' - Start from analytics.reorder_candidates (they are already ranked by urgency and recent sales).',
            ' - For each SKU you recommend: show current quantity, 30-day sales, any incoming_units, and estimated days_of_stock_est when present.',
            ' - Suggest a reorder quantity using this heuristic unless the user specifies otherwise: target ~60 days of cover based on units_sold_30d, minus incoming_units, minus current quantity; round up to a sensible manufacturing batch. If units_sold_30d is 0 but stock is 0, suggest a small safety order and flag low confidence.',
            ' - Briefly explain the "why" for the top picks (e.g. "out of stock, sold 40 units in 30 days, nothing incoming").',
            ' - If analytics.reorder_candidates is empty (e.g. no sales data available), fall back to low_stock_items and be explicit that the recommendation is based only on stock level.',
            ' - Never refuse with "no data" if any of summary/analytics/low_stock_items/orders_recent_sample/manufacturer_orders has content — use what is there and state what is missing.',
          ].join('\n'),
        },
        {
          role: 'system',
          content:
            `TARGETED DATA (authoritative, live-fetched for the SKUs in the user's latest message).\n` +
            `Requested SKUs: ${JSON.stringify(requestedSkus)}\n` +
            `Rows:\n${JSON.stringify(targetedSkuData)}`,
        },
        {
          role: 'system',
          content: `GENERAL SNAPSHOT (truncated, not authoritative for specific SKUs):\n${JSON.stringify(contextSnapshot)}`,
        },
        ...messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
    })

    const answer = response.choices[0]?.message?.content?.trim()
    if (!answer) {
      return NextResponse.json(
        { error: 'Model returned an empty response.' },
        { status: 502 }
      )
    }

    return NextResponse.json({ message: answer })
  } catch (error: unknown) {
    console.error('Armadillo Intelligence chat error:', error)
    if (error && typeof error === 'object' && 'status' in error && (error as { status?: number }).status === 413) {
      return NextResponse.json(
        {
          error: 'Request too large for current Groq plan/model limits.',
          details:
            'Your Groq plan has a per-minute token limit that cannot fit the full data snapshot. Try a simpler question, wait ~30s, or upgrade the Groq plan.',
        },
        { status: 413 }
      )
    }
    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
