'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { SalesBarChart } from '@/components/charts/SalesBarChart'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TrendingUp, Clock } from 'lucide-react'

interface QuoteReportData {
  summary: {
    totalQuotes: number
    acceptedQuotes: number
    sentQuotes: number
    draftQuotes: number
    rejectedQuotes: number
    expiredQuotes: number
    totalValue: number
    averageQuoteValue: number
    conversionRate: number
  }
  statusBreakdown: Array<{ name: string; value: number }>
  topCustomers: Array<{ name: string; count: number; value: number }>
  quoteTrend: Array<{ date: string; count: number; value: number }>
  expiringSoon: Array<{
    id: string
    quoteNumber: string
    customerName: string
    total: number
    validUntil: string | null
  }>
}

export default function QuoteReportsPage() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<QuoteReportData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchReport()
  }, [])

  const fetchReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/reports/quotes')
      if (response.ok) {
        const reportData = await response.json()
        setData(reportData)
      } else {
        const errorData = await response.json()
        setError(errorData.error || 'Failed to load quote report')
      }
    } catch (error) {
      console.error('Error fetching quote report:', error)
      setError('Failed to load quote report')
    } finally {
      setLoading(false)
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
        <h1 className="text-3xl font-bold text-white">Quote Reports</h1>
        <p className="text-white/60 mt-1">Quote performance and conversion metrics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Total Quotes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{data.summary.totalQuotes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Total Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              ${data.summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-400">{data.summary.conversionRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-white/60 text-sm font-normal">Avg Quote Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              ${data.summary.averageQuoteValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quote Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Quote Trend</CardTitle>
          <CardDescription>Quotes and value over time</CardDescription>
        </CardHeader>
        <CardContent>
          <RevenueChart 
            data={data.quoteTrend.map(d => ({ date: d.date, revenue: d.value, orders: d.count }))} 
            period="monthly" 
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Status Distribution</CardTitle>
            <CardDescription>Breakdown of quote statuses</CardDescription>
          </CardHeader>
          <CardContent>
            <StatusPieChart data={data.statusBreakdown} />
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Customers</CardTitle>
            <CardDescription>By quote value</CardDescription>
          </CardHeader>
          <CardContent>
            <SalesBarChart data={data.topCustomers} name="Quote Value" color="#8b5cf6" />
          </CardContent>
        </Card>
      </div>

      {/* Expiring Soon */}
      {data.expiringSoon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-400" />
              Quotes Expiring Soon
            </CardTitle>
            <CardDescription>Quotes expiring within the next 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-white/60">Quote Number</TableHead>
                    <TableHead className="text-white/60">Customer</TableHead>
                    <TableHead className="text-white/60 text-right">Value</TableHead>
                    <TableHead className="text-white/60 text-right">Valid Until</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expiringSoon.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium text-white">{quote.quoteNumber}</TableCell>
                      <TableCell className="text-white/80">{quote.customerName}</TableCell>
                      <TableCell className="text-right text-white">
                        ${quote.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-white/60">
                        {quote.validUntil 
                          ? new Date(quote.validUntil).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-5">
            <div className="text-center p-4 bg-white/5 rounded">
              <p className="text-2xl font-bold text-white">{data.summary.draftQuotes}</p>
              <p className="text-white/60 text-sm mt-1">Draft</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded">
              <p className="text-2xl font-bold text-yellow-400">{data.summary.sentQuotes}</p>
              <p className="text-white/60 text-sm mt-1">Sent</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded">
              <p className="text-2xl font-bold text-green-400">{data.summary.acceptedQuotes}</p>
              <p className="text-white/60 text-sm mt-1">Accepted</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded">
              <p className="text-2xl font-bold text-red-400">{data.summary.rejectedQuotes}</p>
              <p className="text-white/60 text-sm mt-1">Rejected</p>
            </div>
            <div className="text-center p-4 bg-white/5 rounded">
              <p className="text-2xl font-bold text-gray-400">{data.summary.expiredQuotes}</p>
              <p className="text-white/60 text-sm mt-1">Expired</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
