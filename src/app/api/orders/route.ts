import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getOrders as getShopifyOrders, formatShopifyPrice } from '@/lib/shopify'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get('source')

    // If source=shopify, fetch from Shopify API
    if (source === 'shopify') {
      const shopifyOrders = await getShopifyOrders({
        limit: parseInt(searchParams.get('limit') || '50'),
        status: (searchParams.get('status') as 'open' | 'closed' | 'cancelled' | 'any') || 'any',
      })

      // Transform Shopify orders to match local format
      const transformedOrders = shopifyOrders.map((order) => ({
        id: `shopify-${order.id}`,
        orderNumber: order.name,
        status: mapShopifyStatus(order.financial_status, order.fulfillment_status),
        totalAmount: parseFloat(order.total_price),
        createdAt: order.created_at,
        updatedAt: order.updated_at,
        source: 'shopify',
        customer: order.customer ? {
          id: `shopify-${order.customer.id}`,
          name: `${order.customer.first_name} ${order.customer.last_name}`.trim() || order.email,
          email: order.customer.email || order.email,
          phone: order.customer.phone,
        } : {
          id: 'unknown',
          name: order.email || 'Unknown Customer',
          email: order.email || '',
        },
        salesRep: null,
        orderItems: order.line_items.map((item) => ({
          id: `shopify-${item.id}`,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          product: {
            id: `shopify-${item.product_id}`,
            name: item.title,
            sku: item.sku,
          }
        })),
        shopifyData: {
          financialStatus: order.financial_status,
          fulfillmentStatus: order.fulfillment_status,
          tags: order.tags,
          note: order.note,
        }
      }))

      return NextResponse.json(transformedOrders)
    }

    // Default: fetch from Supabase
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        customers(*),
        sales_reps(*),
        order_items(
          *,
          products(*)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Transform data to match expected format
    const transformedOrders = orders?.map((order: any) => ({
      id: order.id,
      orderNumber: order.order_number,
      customerId: order.customer_id,
      salesRepId: order.sales_rep_id,
      status: order.status,
      totalAmount: parseFloat(order.total_amount),
      notes: order.notes,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
      customer: order.customers ? {
        id: order.customers.id,
        name: order.customers.name,
        email: order.customers.email,
        phone: order.customers.phone,
        address: order.customers.address,
        city: order.customers.city,
        state: order.customers.state,
        zipCode: order.customers.zip_code,
        country: order.customers.country,
        createdAt: order.customers.created_at,
        updatedAt: order.customers.updated_at
      } : null,
      salesRep: order.sales_reps ? {
        id: order.sales_reps.id,
        name: order.sales_reps.name,
        email: order.sales_reps.email,
        phone: order.sales_reps.phone,
        territory: order.sales_reps.territory,
        commissionRate: order.sales_reps.commission_rate ? parseFloat(order.sales_reps.commission_rate) : null,
        createdAt: order.sales_reps.created_at,
        updatedAt: order.sales_reps.updated_at
      } : null,
      orderItems: (order.order_items || []).map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        product: item.products ? {
          id: item.products.id,
          name: item.products.name,
          description: item.products.description,
          sku: item.products.sku,
          price: parseFloat(item.products.price),
          category: item.products.category,
          createdAt: item.products.created_at,
          updatedAt: item.products.updated_at
        } : null
      }))
    })) || []

    // Add source identifier for local orders
    const ordersWithSource = transformedOrders.map((order: any) => ({
      ...order,
      source: 'local'
    }))

    return NextResponse.json(ordersWithSource)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

// Map Shopify status to local status format
function mapShopifyStatus(
  financialStatus: string,
  fulfillmentStatus: string | null
): string {
  if (fulfillmentStatus === 'fulfilled') return 'DELIVERED'
  if (fulfillmentStatus === 'partial') return 'SHIPPED'
  if (financialStatus === 'paid' && !fulfillmentStatus) return 'CONFIRMED'
  if (financialStatus === 'pending') return 'PENDING'
  if (financialStatus === 'refunded' || financialStatus === 'voided') return 'CANCELLED'
  return 'PROCESSING'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { customerId, salesRepId, orderItems, notes } = body

    // Generate order number - get count of existing orders
    const { count } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })

    const orderNumber = `ORD-${String((count || 0) + 1).padStart(4, '0')}`

    // Calculate total amount
    let totalAmount = 0
    for (const item of orderItems) {
      // Get product by SKU (using SKU as ID)
      const { data: productData, error: productError } = await supabase.rpc('get_product_by_sku', {
        product_sku: item.productId // productId is actually SKU
      })
      const product = productData?.[0] // RPC returns array, get first item

      if (productError || !product) {
        return NextResponse.json(
          { error: `Product ${item.productId} not found` },
          { status: 400 }
        )
      }
      totalAmount += parseFloat(product.price) * item.quantity
    }

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        customer_id: customerId,
        sales_rep_id: salesRepId || null,
        total_amount: totalAmount,
        notes
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Create order items
    const orderItemsData = orderItems.map((item: any) => ({
      order_id: order.id,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total_price: item.unitPrice * item.quantity
    }))

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsData)

    if (itemsError) throw itemsError

    // Fetch complete order with relations
    const { data: completeOrder, error: fetchError } = await supabase
      .from('orders')
      .select(`
        *,
        customers(*),
        sales_reps(*),
        order_items(
          *,
          products(*)
        )
      `)
      .eq('id', order.id)
      .single()

    if (fetchError) throw fetchError

    // Transform to expected format
    const transformedOrder = {
      id: completeOrder.id,
      orderNumber: completeOrder.order_number,
      customerId: completeOrder.customer_id,
      salesRepId: completeOrder.sales_rep_id,
      status: completeOrder.status,
      totalAmount: parseFloat(completeOrder.total_amount),
      notes: completeOrder.notes,
      createdAt: completeOrder.created_at,
      updatedAt: completeOrder.updated_at,
      customer: completeOrder.customers ? {
        id: completeOrder.customers.id,
        name: completeOrder.customers.name,
        email: completeOrder.customers.email,
        phone: completeOrder.customers.phone,
        address: completeOrder.customers.address,
        city: completeOrder.customers.city,
        state: completeOrder.customers.state,
        zipCode: completeOrder.customers.zip_code,
        country: completeOrder.customers.country,
        createdAt: completeOrder.customers.created_at,
        updatedAt: completeOrder.customers.updated_at
      } : null,
      salesRep: completeOrder.sales_reps ? {
        id: completeOrder.sales_reps.id,
        name: completeOrder.sales_reps.name,
        email: completeOrder.sales_reps.email,
        phone: completeOrder.sales_reps.phone,
        territory: completeOrder.sales_reps.territory,
        commissionRate: completeOrder.sales_reps.commission_rate ? parseFloat(completeOrder.sales_reps.commission_rate) : null,
        createdAt: completeOrder.sales_reps.created_at,
        updatedAt: completeOrder.sales_reps.updated_at
      } : null,
      orderItems: (completeOrder.order_items || []).map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_price),
        product: item.products ? {
          id: item.products.id,
          name: item.products.name,
          description: item.products.description,
          sku: item.products.sku,
          price: parseFloat(item.products.price),
          category: item.products.category,
          createdAt: item.products.created_at,
          updatedAt: item.products.updated_at
        } : null
      }))
    }

    return NextResponse.json(transformedOrder, { status: 201 })
  } catch (error) {
    console.error('Error creating order:', error)
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    )
  }
}

