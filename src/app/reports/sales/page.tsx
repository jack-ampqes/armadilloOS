'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { SalesBarChart } from '@/components/charts/SalesBarChart'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface SalesReportData {
  revenueTrend: Array<{ date: string; revenue: number; orders: number }>
  topCustomers: Array<{ name: string; value: number; count: number }>
  topProducts: Array<{ name: string; value: number; quantity: number }>
  statusDistribution: Array<{ name: string; value: number }>
  summary: {
    totalRevenue: number
    totalOrders: number
    averageOrderValue: number
  }
}

export default function SalesReportsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<SalesReportData | null>(null)
  const [period, setPeriod] = useState('monthly')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReport()
  }, [period])

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/reports/sales?period=${period}`)
      if (response.ok) {
        const reportData = await response.json()
        setData(reportData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load sales report')
      }
    } catch (error) {
      console.error('Error fetching sales report:', error)
      setError('Failed to load sales report')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => (
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Sales Reports</h1>
          <p className="text-white/60 mt-1">Revenue, orders, and sales performance</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              ${data.summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{data.summary.totalOrders}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Average Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              ${data.summary.averageOrderValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Trend</CardTitle>
          <CardDescription>Revenue and orders over time</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart data={data.revenueTrend} period={period as 'daily' | 'weekly' | 'monthly'} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>By revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesBarChart data={data.topCustomers} name="Revenue" color="#10b981" />
          </CardContent>
        </Card>

        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Order Status</CardTitle>
            <CardDescription>Distribution of order statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusPieChart data={data.statusDistribution} />
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle>Top Products</CardTitle>
          <CardDescription>Best selling products by revenue</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-white/60">Product</TableHead>
                  <TableHead className="text-white/60 text-right">Revenue</TableHead>
                  <TableHead className="text-white/60 text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topProducts.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium text-white">{product.name}</TableCell>
                    <TableCell className="text-right text-white">
                      ${product.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right text-white/60">{product.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
