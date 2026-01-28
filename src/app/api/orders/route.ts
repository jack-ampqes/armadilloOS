import { NextRequest, NextResponse } from 'next/server'
import { getOrders as getShopifyOrders, createDraftOrder, completeDraftOrder, DraftOrderInput } from '@/lib/shopify'
import { getDefaultShopifyCredentials } from '@/lib/shopify-connection'
import { requirePermission } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = requirePermission(request, 'OrdersViewing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const { searchParams } = new URL(request.url)

    const credentials = await getDefaultShopifyCredentials()

    // Fetch from Shopify API (Headless API)
    const shopifyOrders = await getShopifyOrders({
      limit: parseInt(searchParams.get('limit') || '50'),
      status: (searchParams.get('status') as 'open' | 'closed' | 'cancelled' | 'any') || 'any',
      fulfillment_status: searchParams.get('fulfillment_status') as 'shipped' | 'partial' | 'unshipped' | 'any' | undefined,
      financial_status: searchParams.get('financial_status') as 'authorized' | 'pending' | 'paid' | 'partially_paid' | 'refunded' | 'voided' | 'partially_refunded' | 'any' | undefined,
      created_at_min: searchParams.get('created_at_min') || undefined,
      created_at_max: searchParams.get('created_at_max') || undefined,
    }, {
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
    })

    // Transform Shopify orders to match expected format
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
  } catch (error) {
    console.error('Error fetching orders from Shopify:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    // Check if it's a credentials error
    if (errorMessage.includes('Missing Shopify credentials') || errorMessage.includes('not configured')) {
      return NextResponse.json(
        { 
          error: 'Shopify integration not configured',
          message: errorMessage
        },
        { status: 400 }
      )
    }
    
    // Check if it's an API error
    if (errorMessage.includes('Shopify API error')) {
      // Extract the actual error from Shopify's response
      let shopifyError = errorMessage
      let upstreamStatus: number | null = null
      try {
        // Shopify errors are often in format: "Shopify API error (401): {\"errors\":\"...\"}"
        const match = errorMessage.match(/\((\d+)\):\s*(.+)/)
        if (match) {
          const statusCode = match[1]
          upstreamStatus = Number(statusCode)
          const errorBody = match[2]
          try {
            const parsed = JSON.parse(errorBody)
            shopifyError = parsed.errors || parsed.error || errorBody
          } catch {
            shopifyError = errorBody
          }
        }
      } catch {
        // Keep original error message
      }
      
      return NextResponse.json(
        { 
          error: 'Shopify API error',
          message: shopifyError,
          statusCode: upstreamStatus ?? undefined,
          hint:
            upstreamStatus === 401
              ? 'Your Admin API access token is invalid (or you are using a Storefront token by mistake).'
              : upstreamStatus === 403
                ? 'Your Admin API token is valid, but it likely lacks the required scopes (need read_orders).'
                : undefined,
        },
        {
          // If Shopify explicitly tells us it is unauthorized/forbidden, pass that through so the UI can react.
          status: upstreamStatus === 401 || upstreamStatus === 403 ? upstreamStatus : 502,
        }
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch orders from Shopify',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

// Map Shopify fulfillment status to display format
// This is for the primary badge (fulfillment status)
function mapShopifyStatus(
  financialStatus: string,
  fulfillmentStatus: string | null
): string {
  // Show fulfillment status as the primary badge
  if (fulfillmentStatus === 'fulfilled') return 'FULFILLED'
  if (fulfillmentStatus === 'partial') return 'PARTIALLY_FULFILLED'
  
  // If not fulfilled, show as UNFULFILLED
  return 'UNFULFILLED'
}

// Create a new draft order in Shopify
export async function POST(request: NextRequest) {
  const auth = requirePermission(request, 'OrdersViewing')
  if ('response' in auth) {
    return auth.response
  }

  try {
    const body = await request.json()
    const { 
      orderItems, 
      customerEmail, 
      customerPhone,
      shippingAddress,
      billingAddress,
      notes,
      tags,
      salesRepName,
      completeOrder,
    } = body

    // Validate required fields
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      return NextResponse.json(
        { error: 'At least one order item is required' },
        { status: 400 }
      )
    }

    const credentials = await getDefaultShopifyCredentials()

    // Build line items for draft order
    const lineItems = orderItems.map((item: any) => {
      // If we have a Shopify variant ID, use it
      if (item.shopifyVariantId) {
        return {
          variantId: item.shopifyVariantId,
          quantity: item.quantity,
        }
      }
      
      // Otherwise create a custom line item
      return {
        title: item.productName || item.title || 'Custom Item',
        quantity: item.quantity,
        originalUnitPrice: item.unitPrice?.toString() || '0.00',
        sku: item.sku,
      }
    })

    // Build custom attributes for additional info
    const customAttributes: Array<{ key: string; value: string }> = []
    if (salesRepName) {
      customAttributes.push({ key: 'Sales Rep', value: salesRepName })
    }

    // Build draft order input
    const draftOrderInput: DraftOrderInput = {
      lineItems,
      email: customerEmail,
      phone: customerPhone,
      note: notes,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      customAttributes: customAttributes.length > 0 ? customAttributes : undefined,
    }

    // Add shipping address if provided
    if (shippingAddress && shippingAddress.address1) {
      draftOrderInput.shippingAddress = {
        firstName: shippingAddress.firstName,
        lastName: shippingAddress.lastName,
        address1: shippingAddress.address1,
        address2: shippingAddress.address2,
        city: shippingAddress.city,
        province: shippingAddress.state || shippingAddress.province,
        country: shippingAddress.country || 'US',
        zip: shippingAddress.zip || shippingAddress.zipCode,
        phone: shippingAddress.phone,
        company: shippingAddress.company,
      }
    }

    // Add billing address if provided
    if (billingAddress && billingAddress.address1) {
      draftOrderInput.billingAddress = {
        firstName: billingAddress.firstName,
        lastName: billingAddress.lastName,
        address1: billingAddress.address1,
        address2: billingAddress.address2,
        city: billingAddress.city,
        province: billingAddress.state || billingAddress.province,
        country: billingAddress.country || 'US',
        zip: billingAddress.zip || billingAddress.zipCode,
        phone: billingAddress.phone,
        company: billingAddress.company,
      }
    }

    // Create the draft order
    const draftOrder = await createDraftOrder(draftOrderInput, {
      shopDomain: credentials.shopDomain,
      accessToken: credentials.accessToken,
    })

    // If completeOrder is true, convert draft to real order (payment pending)
    if (completeOrder) {
      const completedOrder = await completeDraftOrder(
        draftOrder.id,
        true, // paymentPending = true (mark as awaiting payment)
        {
          shopDomain: credentials.shopDomain,
          accessToken: credentials.accessToken,
        }
      )

      return NextResponse.json({
        success: true,
        orderType: 'completed',
        order: {
          id: `shopify-${completedOrder.id}`,
          orderNumber: completedOrder.name,
          status: 'UNFULFILLED',
          totalAmount: parseFloat(completedOrder.total_price),
          createdAt: completedOrder.created_at,
        },
      }, { status: 201 })
    }

    // Return the draft order
    return NextResponse.json({
      success: true,
      orderType: 'draft',
      draftOrder: {
        id: draftOrder.id,
        name: draftOrder.name,
        status: draftOrder.status,
        totalPrice: parseFloat(draftOrder.totalPrice),
        invoiceUrl: draftOrder.invoiceUrl,
        createdAt: draftOrder.createdAt,
        lineItems: draftOrder.lineItems,
      },
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating order:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

    // Check if it's a credentials error
    if (errorMessage.includes('Missing Shopify credentials') || errorMessage.includes('not configured')) {
      return NextResponse.json(
        { 
          error: 'Shopify integration not configured',
          message: errorMessage
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Failed to create order',
        message: errorMessage
      },
      { status: 500 }
    )
  }
}

