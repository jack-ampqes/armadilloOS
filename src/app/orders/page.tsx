'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Eye, Pencil, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

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
        let errorData: any = {}
        let errorText = ''
        
        try {
          if (isJson) {
            errorData = await response.json()
          } else {
            errorText = await response.text()
            errorData = { error: errorText || `HTTP ${response.status}: ${response.statusText}` }
          }
        } catch (parseError) {
          errorData = { 
            error: `HTTP ${response.status}: ${response.statusText}`,
            details: errorText || 'Could not parse error response'
          }
        }
        
        console.error('Error fetching orders:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          contentType
        })
        
        const statusCode = errorData.statusCode || response.status
        const hint = errorData.hint ? ` (${errorData.hint})` : ''
        const errorMessage = `${errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`}${hint}`
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
        <Skeleton className="h-16 w-16 rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Orders
          </h1>
          <p className="mt-2 text-white/60">
            Manage customer orders and track their status.
          </p>
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

      {/* Shopify Connection Status */}
      {shopifyConnection?.connected && (
        <Card className="border-blue-500/50 bg-blue-500/10">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <Badge variant="success" className="text-xs">
                    Shopify Connected
                  </Badge>
                  {shopifyConnection.shop && (
                    <span className="text-white/80 text-sm">
                      {shopifyConnection.shop}
                    </span>
                  )}
                </div>
                {shopifyConnection.scope && (
                  <div className="mt-3">
                    <button
                      onClick={() => setShowScopes(!showScopes)}
                      className="flex items-center gap-2 text-white/60 hover:text-white/80 text-sm transition-colors"
                    >
                      {showScopes ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      <span>View App Scopes ({shopifyConnection.scope.split(',').length} permissions)</span>
                    </button>
                    {showScopes && (
                      <div className="mt-3 p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex flex-wrap gap-2">
                          {shopifyConnection.scope.split(',').map((scope, idx) => (
                            <Badge
                              key={idx}
                              variant="outline"
                              className="text-xs font-mono bg-white/5 border-white/20 text-white/70"
                            >
                              {scope.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-red-400 font-medium">Error loading orders</p>
                <p className="text-red-300/80 text-sm mt-1">{error}</p>
                {(error.includes('not configured') || error.includes('Missing Shopify credentials')) && (
                  <p className="text-red-300/60 text-xs mt-2">
                    Please add SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN to your .env.local file and restart the server.
                  </p>
                )}
                {(error.includes('Invalid API key') || error.includes('401') || error.includes('unrecognized login')) && (
                  <div className="text-red-300/60 text-xs mt-2 space-y-1">
                    <p>Your Shopify credentials are invalid. Please check:</p>
                    <ul className="list-disc list-inside ml-2 space-y-1">
                      <li>SHOPIFY_STORE_DOMAIN should be your store domain (e.g., "your-store.myshopify.com")</li>
                      <li>SHOPIFY_ACCESS_TOKEN should be a valid Admin API access token</li>
                      <li>Make sure you've restarted the dev server after adding credentials</li>
                    </ul>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => fetchOrders()}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
            <Card className="group">
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

                  {/* Amount & Actions */}
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-white/60">Total Amount</p>
                      <p className="text-2xl font-bold text-white">
                        ${order.totalAmount.toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" asChild>
                        <Link href={`/orders/${order.id}`}>
                          <Eye className="w-5 h-5" />
                        </Link>
                      </Button>
                      <Button size="icon" asChild>
                        <Link href={`/orders/${order.id}/edit`}>
                          <Pencil className="w-5 h-5" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
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
