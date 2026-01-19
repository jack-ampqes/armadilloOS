'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Plus, Eye, Pencil, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [dataSource, setDataSource] = useState<'local' | 'shopify' | 'all'>('all')

  useEffect(() => {
    fetchOrders()
  }, [dataSource])

  const filteredOrders = orders.filter(order =>
    order.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const fetchOrders = async () => {
    setLoading(true)
    try {
      if (dataSource === 'all') {
        // Fetch from both sources
        const [localRes, shopifyRes] = await Promise.all([
          fetch('/api/orders'),
          fetch('/api/orders?source=shopify').catch(() => ({ ok: false, json: () => [] }))
        ])
        
        const localOrders = localRes.ok ? await localRes.json() : []
        let shopifyOrders: Order[] = []
        
        if (shopifyRes.ok) {
          shopifyOrders = await shopifyRes.json()
        }
        
        // Combine and sort by date
        const combined = [...localOrders, ...shopifyOrders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setOrders(combined)
      } else {
        const url = dataSource === 'shopify' ? '/api/orders?source=shopify' : '/api/orders'
        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()
          setOrders(data)
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" | "success" | "warning" => {
    switch (status) {
      case 'PENDING':
        return 'secondary'
      case 'CONFIRMED':
      case 'DELIVERED':
        return 'success'
      case 'PROCESSING':
        return 'outline'
      case 'SHIPPED':
        return 'default'
      case 'CANCELLED':
        return 'secondary'
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
          <Select value={dataSource} onValueChange={(value: 'local' | 'shopify' | 'all') => setDataSource(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="local">Local Only</SelectItem>
              <SelectItem value="shopify">Shopify Only</SelectItem>
            </SelectContent>
          </Select>
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
                      {order.source === 'shopify' && (
                        <Badge variant="outline">
                          Shopify
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
