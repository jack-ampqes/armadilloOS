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
  inventory: 30,
  inventory_history: 20,
  orders: 15,
  manufacturer_orders: 15,
  manufacturer_order_items_per_order: 3,
  order_line_items: 2,
  customers: 25,
  users: 25,
  documents: 20,
}

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

async function fetchContextSnapshot() {
  const [
    inventoryData,
    inventoryHistoryData,
    manufacturerOrdersData,
    manufacturerOrderItemsData,
    customersData,
    usersData,
    documentsData,
  ] = await Promise.all([
    safeFetch(
      'inventory',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory')
        .select('sku, quantity, updated_at, price')
        .order('updated_at', { ascending: false })
        .limit(ROW_LIMITS.inventory)
    ),
    safeFetch(
      'inventory history',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('inventory_history')
        .select('sku, quantity_change, quantity_after, source, created_at')
        .order('created_at', { ascending: false })
        .limit(ROW_LIMITS.inventory_history)
    ),
    safeFetch(
      'manufacturer orders',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('manufacturer_orders')
        .select('id, order_number, status, order_date, expected_delivery, carrier, total_amount')
        .order('order_date', { ascending: false })
        .limit(ROW_LIMITS.manufacturer_orders)
    ),
    safeFetch(
      'manufacturer order items',
      supabaseAdmin
        .schema('armadillo_inventory')
        .from('manufacturer_order_items')
        .select('order_id, sku, quantity_ordered, quantity_received, unit_cost')
        .limit(ROW_LIMITS.manufacturer_orders * ROW_LIMITS.manufacturer_order_items_per_order)
    ),
    safeFetch(
      'customers',
      supabaseAdmin
        .from('customers')
        .select('id, name, company_name, email, city, state')
        .order('updated_at', { ascending: false })
        .limit(ROW_LIMITS.customers)
    ),
    safeFetch(
      'users',
      supabaseAdmin
        .from('users')
        .select('id, email, name, role, updated_at')
        .order('updated_at', { ascending: false })
        .limit(ROW_LIMITS.users)
    ),
    safeFetch(
      'documents',
      supabaseAdmin
        .from('documents')
        .select('id, name, title, content_type, created_at')
        .order('created_at', { ascending: false })
        .limit(ROW_LIMITS.documents)
    ),
  ])

  let shopifyOrders: Array<Record<string, unknown>> = []
  try {
    const credentials = await getDefaultShopifyCredentials()
    const orders = await getShopifyOrders(
      { limit: ROW_LIMITS.orders, status: 'any' },
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
            title: cap(item.title),
            sku: cap(item.sku),
            quantity: item.quantity,
          }))
        : [],
    }))
  } catch {
    shopifyOrders = []
  }

  const itemsByOrderId = new Map<string, Record<string, unknown>[]>()
  for (const item of manufacturerOrderItemsData ?? []) {
    const orderId = String((item as { order_id?: unknown }).order_id ?? '')
    if (!orderId) continue
    const list = itemsByOrderId.get(orderId) ?? []
    if (list.length < ROW_LIMITS.manufacturer_order_items_per_order) {
      list.push(item as Record<string, unknown>)
      itemsByOrderId.set(orderId, list)
    }
  }

  const manufacturerOrdersWithItems = (manufacturerOrdersData ?? []).map((order) => {
    const orderId = String((order as { id?: unknown }).id ?? '')
    return {
      ...(order as Record<string, unknown>),
      items: itemsByOrderId.get(orderId) ?? [],
    }
  })

  return {
    summary: {
      inventory: (inventoryData ?? []).length,
      inventory_history: (inventoryHistoryData ?? []).length,
      orders: shopifyOrders.length,
      manufacturer_orders: (manufacturerOrdersData ?? []).length,
      customers: (customersData ?? []).length,
      users: (usersData ?? []).length,
      documents: (documentsData ?? []).length,
    },
    inventory: inventoryData ?? [],
    inventory_history: inventoryHistoryData ?? [],
    orders: shopifyOrders,
    manufacturer_orders: manufacturerOrdersWithItems,
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

    const contextSnapshot = await fetchContextSnapshot()
    const client = new OpenAI({
      apiKey: groqApiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })

    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content:
            'You are Armadillo Intelligence, an operations assistant for Armadillo. You only see a TRUNCATED snapshot of recent data (limited rows, limited fields). If the user asks about data not present, say so and suggest where to verify in the app. Be concise and practical. Prefer short bullet points.',
        },
        {
          role: 'system',
          content: `Data snapshot (truncated JSON):\n${JSON.stringify(contextSnapshot)}`,
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
