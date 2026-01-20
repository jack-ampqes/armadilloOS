'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, Package, User, MapPin, CreditCard, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface OrderDetail {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  updatedAt: string
  source?: 'local' | 'shopify'
  customer: {
    id: string
    name: string
    email: string
    phone?: string | null
  }
  salesRep?: {
    id: string
    name: string
  } | null
  orderItems: Array<{
    id: string
    quantity: number
    unitPrice: number
    product: {
      id: string
      name: string
      sku: string
    }
  }>
  shopifyData?: {
    financialStatus: string
    fulfillmentStatus: string | null
    tags: string
    note: string | null
  }
  shippingAddress?: {
    first_name: string
    last_name: string
    address1: string
    address2?: string | null
    city: string
    province: string
    country: string
    zip: string
    phone?: string | null
  } | null
  billingAddress?: {
    first_name: string
    last_name: string
    address1: string
    address2?: string | null
    city: string
    province: string
    country: string
    zip: string
  } | null
}

export default function OrderDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const orderNumber = params.id as string

  useEffect(() => {
    if (orderNumber) {
      fetchOrder()
    }
  }, [orderNumber])

  const fetchOrder = async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch order by name/number using query parameter
      const response = await fetch(`/api/orders/by-number/${orderNumber}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch order (${response.status})`)
      }

      const data = await response.json()
      const o = data.order // This is already in ShopifyOrder format from getOrders

      // Transform to our detail format
      const transformedOrder: OrderDetail = {
        id: `shopify-${o.id}`,
        orderNumber: o.name,
        status: mapFulfillmentStatus(o.fulfillment_status),
        totalAmount: parseFloat(o.total_price),
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        source: 'shopify',
        customer: o.customer ? {
          id: `shopify-${o.customer.id}`,
          name: `${o.customer.first_name} ${o.customer.last_name}`.trim() || o.email,
          email: o.customer.email || o.email,
          phone: o.customer.phone,
        } : {
          id: 'unknown',
          name: o.email || 'Unknown Customer',
          email: o.email || '',
        },
        salesRep: null,
        orderItems: o.line_items.map((item: any) => ({
          id: `shopify-${item.id}`,
          quantity: item.quantity,
          unitPrice: parseFloat(item.price),
          product: {
            id: `shopify-${item.product_id}`,
            name: item.title,
            sku: item.sku || 'N/A',
          }
        })),
        shopifyData: {
          financialStatus: o.financial_status,
          fulfillmentStatus: o.fulfillment_status,
          tags: o.tags,
          note: o.note,
        },
        shippingAddress: o.shipping_address,
        billingAddress: o.billing_address,
      }

      setOrder(transformedOrder)
    } catch (err) {
      console.error('Error fetching order:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch order')
    } finally {
      setLoading(false)
    }
  }

  const mapFulfillmentStatus = (status: string | null): string => {
    if (status === 'fulfilled') return 'FULFILLED'
    if (status === 'partial') return 'PARTIALLY_FULFILLED'
    return 'UNFULFILLED'
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" => {
    switch (status) {
      case 'FULFILLED':
        return 'success'
      case 'PARTIALLY_FULFILLED':
        return 'warning'
      case 'UNFULFILLED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const getFinancialStatusVariant = (status: string): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'success'
      case 'pending':
      case 'authorized':
        return 'warning'
      case 'refunded':
      case 'voided':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-4xl">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="space-y-8 max-w-4xl">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-6">
            <p className="text-red-400 font-medium">Error loading order</p>
            <p className="text-red-300/80 text-sm mt-1">{error || 'Order not found'}</p>
            <Button variant="outline" size="sm" onClick={fetchOrder} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-white">{order.orderNumber}</h1>
            <p className="text-white/60 text-sm mt-1">
              {new Date(order.createdAt).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant(order.status)}>
            {order.status}
          </Badge>
          {order.shopifyData?.financialStatus && (
            <Badge variant={getFinancialStatusVariant(order.shopifyData.financialStatus)}>
              {order.shopifyData.financialStatus.toUpperCase()}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Order Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-white/10 rounded-lg">
                <Package className="w-5 h-5 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-white">Order Items</h2>
            </div>
            
            <div className="space-y-4">
              {order.orderItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-4 border-b border-white/10 last:border-0"
                >
                  <div className="flex-1">
                    <p className="text-white font-medium">{item.product.name}</p>
                    <p className="text-white/60 text-sm">SKU: {item.product.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-medium">
                      ${item.unitPrice.toFixed(2)} x {item.quantity}
                    </p>
                    <p className="text-white/60 text-sm">
                      ${(item.unitPrice * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center">
              <span className="text-white/60">Total</span>
              <span className="text-2xl font-bold text-white">
                ${order.totalAmount.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Customer & Addresses */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Customer Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white">Customer</h2>
              </div>
              <div className="space-y-2">
                <p className="text-white font-medium">{order.customer.name}</p>
                <p className="text-white/60 text-sm">{order.customer.email}</p>
                {order.customer.phone && (
                  <p className="text-white/60 text-sm">{order.customer.phone}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Shipping Address */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Truck className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white">Shipping Address</h2>
              </div>
              {order.shippingAddress ? (
                <div className="space-y-1 text-white/80 text-sm">
                  <p>{order.shippingAddress.first_name} {order.shippingAddress.last_name}</p>
                  <p>{order.shippingAddress.address1}</p>
                  {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                  <p>
                    {order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}
                  </p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              ) : (
                <p className="text-white/40 text-sm">No shipping address</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Notes */}
      {order.shopifyData?.note && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-3">Order Notes</h2>
              <p className="text-white/80 text-sm whitespace-pre-wrap">{order.shopifyData.note}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Tags */}
      {order.shopifyData?.tags && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold text-white mb-3">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {order.shopifyData.tags.split(',').filter(Boolean).map((tag, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs">
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
