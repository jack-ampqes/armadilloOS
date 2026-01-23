'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, PackageX, TrendingUp } from 'lucide-react'

interface InventoryReportData {
  summary: {
    totalValue: number
    totalItems: number
    lowStockCount: number
    outOfStockCount: number
  }
  productPerformance: Array<{
    name: string
    sku: string
    quantity: number
    minStock: number
    value: number
    status: string
  }>
  reorderRecommendations: Array<{
    sku: string
    name: string
    currentStock: number
    minStock: number
    recommendedOrder: number
    category: string
  }>
  categoryBreakdown: Array<{
    name: string
    value: number
    count: number
  }>
  lowStockItems: Array<{
    sku: string
    name: string
    quantity: number
    minStock: number
  }>
  outOfStockItems: Array<{
    sku: string
    name: string
  }>
}

export default function InventoryReportsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<InventoryReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReport()
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/reports/inventory')
      if (response.ok) {
        const reportData = await response.json()
        setData(reportData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load inventory report')
      }
    } catch (error) {
      console.error('Error fetching inventory report:', error)
      setError('Failed to load inventory report')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'out_of_stock':
        return <Badge variant="destructive">Out of Stock</Badge>
      case 'low_stock':
        return <Badge variant="warning">Low Stock</Badge>
      default:
        return <Badge variant="success">In Stock</Badge>
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8 max-w-7xl">
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Inventory Reports</h1>
        <p className="text-white/60 mt-1">Stock levels, value, and reorder recommendations</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Total Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              ${data.summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Total Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{data.summary.totalItems}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Low Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-400">{data.summary.lowStockCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
              <PackageX className="h-4 w-4" />
              Out of Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-400">{data.summary.outOfStockCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reorder Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Reorder Recommendations
          </CardTitle>
          <CardDescription>Products that need to be reordered</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/60">Product</TableHead>
                  <TableHead className="text-white/60">SKU</TableHead>
                  <TableHead className="text-white/60 text-right">Current Stock</TableHead>
                  <TableHead className="text-white/60 text-right">Min Stock</TableHead>
                  <TableHead className="text-white/60 text-right">Recommended Order</TableHead>
                  <TableHead className="text-white/60">Category</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.reorderRecommendations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-white/60 py-8">
                      No reorder recommendations at this time
                    </TableCell>
                  </TableRow>
                ) : (
                  data.reorderRecommendations.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium text-white">{item.name}</TableCell>
                      <TableCell className="font-mono text-white/60">{item.sku}</TableCell>
                      <TableCell className="text-right text-white">{item.currentStock}</TableCell>
                      <TableCell className="text-right text-white/60">{item.minStock}</TableCell>
                      <TableCell className="text-right font-medium text-yellow-400">{item.recommendedOrder}</TableCell>
                      <TableCell className="text-white/60">{item.category}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Inventory by Category</CardTitle>
          <CardDescription>Total value and item count by category</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/60">Category</TableHead>
                  <TableHead className="text-white/60 text-right">Value</TableHead>
                  <TableHead className="text-white/60 text-right">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.categoryBreakdown.map((category, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-white">{category.name}</TableCell>
                    <TableCell className="text-right text-white">
                      ${category.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-white/60">{category.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Low Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              Low Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.lowStockItems.length === 0 ? (
                <p className="text-white/60 text-center py-4">No low stock items</p>
              ) : (
                data.lowStockItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-white/60 text-xs font-mono">{item.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-medium">{item.quantity}</p>
                      <p className="text-white/40 text-xs">min: {item.minStock}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Out of Stock Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PackageX className="h-5 w-5 text-red-400" />
              Out of Stock Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.outOfStockItems.length === 0 ? (
                <p className="text-white/60 text-center py-4">No out of stock items</p>
              ) : (
                data.outOfStockItems.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-white/5 rounded">
                    <div>
                      <p className="text-white font-medium">{item.name}</p>
                      <p className="text-white/60 text-xs font-mono">{item.sku}</p>
                    </div>
                    <Badge variant="destructive">Out of Stock</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
