'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

interface Order {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  createdAt: string
  source?: 'local' | 'shopify'
  customer: {
    id: string
    name: string
    email: string
  }
  salesRep?: {
    id: string
    name: string
  }
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
}

interface ShopifyConnection {
  connected: boolean
  source: 'supabase' | 'env' | null
  shop?: string | null
  scope?: string | null
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shopifyConnection, setShopifyConnection] = useState<ShopifyConnection | null>(null)
  const [showScopes, setShowScopes] = useState(false)

  useEffect(() => {
    fetchOrders()
    fetchShopifyConnection()
  }, [])

  const fetchShopifyConnection = async () => {
    try {
      const res = await fetch('/api/shopify/connection')
      if (res.ok) {
        const data = await res.json() as ShopifyConnection
        setShopifyConnection(data)
      }
    } catch {
      // ignore
    }
  }

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const fetchOrders = async () => {
    setLoading(true)
    setError(null)
    try {
      // Always fetch from Shopify Headless API
      const response = await fetch('/api/orders')
      
      // Check content type before parsing
      const contentType = response.headers.get('content-type')
      const isJson = contentType?.includes('application/json')
      
      if (response.ok) {
        if (isJson) {
          const data = await response.json()
          setOrders(Array.isArray(data) ? data : [])
          setError(null)
        } else {
          const text = await response.text()
          console.error('Unexpected response format:', text)
          setError('Invalid response format from server')
          setOrders([])
        }
      } else {
        // Handle error response
        let errorData: Record<string, unknown> = {}
        let errorText = ''

        try {
          if (isJson) {
            errorData = (await response.json()) as Record<string, unknown>
          } else {
            errorText = await response.text()
            errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` }
          }
        } catch (parseError) {
          errorData = {
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: errorText || 'Could not parse error response',
          }
        }

        const status = response.status
        const statusText = response.statusText
        console.error(
          'Error fetching orders:',
          status,
          statusText,
          Object.keys(errorData).length ? errorData : `body: ${errorText || '(empty)'}`
        )

        const hint = errorData.hint ? ` (${errorData.hint})` : ''
        const errorMessage =
          (typeof errorData.message === 'string' ? errorData.message : null) ||
          (typeof errorData.error === 'string' ? errorData.error : null) ||
          `HTTP ${status}: ${statusText}${hint}`
        setError(errorMessage)
        setOrders([])
      }
    } catch (error) {
      console.error('Network error fetching orders:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect to server'
      setError(errorMessage)
      setOrders([])
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "success" | "warning" | "destructive" => {
    switch (status) {
      case 'FULFILLED':
      case 'PAID':
        return 'success'
      case 'PENDING':
      case 'AUTHORIZED':
        return 'default'
      case 'PARTIALLY_FULFILLED':
      case 'PARTIALLY_PAID':
        return 'warning'
      case 'REFUNDED':
      case 'VOIDED':
        return 'secondary'
      case 'UNFULFILLED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="loader"></div>
      </div>
    )
  }

        {/* Header */}
  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Orders
          </h1>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchOrders()}
            disabled={loading}
            title="Refresh orders"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href="/orders/new" title="Create Order">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
      
          
      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search orders by number, customer, or status..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Orders Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid gap-4"
      >
        {filteredOrders.map((order, index) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * index }}
          >
            <Link href={`/orders/${order.orderNumber.replace('#', '')}`}>
              <Card className="group cursor-pointer hover:bg-white/5 transition-colors">
                <CardContent className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  {/* Order Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-white">
                        {order.orderNumber}
                      </h3>
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.status}
                      </Badge>
                      {order.shopifyData?.financialStatus && (
                        <Badge variant="outline" className="text-xs">
                          {order.shopifyData.financialStatus.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-white font-medium">{order.customer.name}</p>
                      <p className="text-white/60 text-sm">{order.customer.email}</p>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-white/60">
                        Sales Rep: <span className="text-white font-medium">{order.salesRep?.name || 'N/A'}</span>
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="text-white/60">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="text-right">
                    <p className="text-sm text-white/60">Total Amount</p>
                    <p className="text-2xl font-bold text-white">
                      ${order.totalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
          </motion.div>
        ))}
      </motion.div>

      {filteredOrders.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <Card className="text-center py-16">
            <CardContent>
              <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-xl flex items-center justify-center">
                <Plus className="w-10 h-10 text-black" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">No orders found</h3>
              <p className="text-white/60 mb-6">Get started by creating your first order.</p>
              <Button asChild>
                <Link href="/orders/new" title="Create Order">
                  <Plus className="w-5 h-5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
