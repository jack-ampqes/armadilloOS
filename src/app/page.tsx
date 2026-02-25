'use client'

import { useState, useEffect } from 'react'
import Link from "next/link"
import Image from "next/image"
import { 
  ShoppingCart, 
  Box, 
  Handshake, 
  MapPinned, 
  Warehouse,
  CirclePile,
  FileText,
  DollarSign,
  AlertTriangle,
  PackageX,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  FileStack,
} from "lucide-react"
import { usePermissions } from '@/lib/usePermissions'
import type { Role } from '@/lib/permissions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { SalesBarChart } from '@/components/charts/SalesBarChart'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { SyncedGif } from '@/components/SyncedGif'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface DashboardStats {
  period: string
  periodLabel: string
  revenue: {
    total: number
    orderCount: number
  }
  orders: {
    pending: number
    pendingValue: number
    total: number
  }
  inventory: {
    lowStock: number
    outOfStock: number
  }
  quotes: {
    active: number
  }
  charts: {
    revenueTrend: Array<{ date: string; revenue: number }>
    topProducts: Array<{ name: string; revenue: number; quantity: number }>
    statusDistribution: Array<{ name: string; value: number }>
  }
  topCustomers: Array<{ name: string; revenue: number }>
  quickbooks?: {
    connected: boolean
    thisMonth?: { totalIncome: number; totalExpenses: number; netIncome: number; grossProfit: number }
    thisYear?: { totalIncome: number; totalExpenses: number; netIncome: number; grossProfit: number }
  }
  error?: string
}

type FinancialPeriod = 'thisMonth' | 'last3Months' | 'last6Months' | 'ytd' | 'lastYear' | 'allTime'

interface FinancialsData {
  ok: boolean
  period: string
  label: string
  startDate: string | null
  endDate: string
  totalIncome: number
  costOfGoodsSold: number
  totalExpenses: number
  netIncome: number
  grossProfit: number
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false)
  const [financialPeriod, setFinancialPeriod] = useState<FinancialPeriod>('thisMonth')
  const [financials, setFinancials] = useState<FinancialsData | null>(null)
  const [financialsLoading, setFinancialsLoading] = useState(false)

  useEffect(() => {
    fetchStats(financialPeriod)
  }, [financialPeriod])

  useEffect(() => {
    if (stats?.quickbooks?.connected) {
      fetchFinancials(financialPeriod)
    }
  }, [financialPeriod, stats?.quickbooks?.connected])

  const fetchStats = async (period: FinancialPeriod) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/dashboard/stats?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFinancials = async (period: FinancialPeriod) => {
    setFinancialsLoading(true)
    try {
      const response = await fetch(`/api/quickbooks/financials?period=${period}`)
      if (response.ok) {
        const data = await response.json()
        if (data.ok) {
          setFinancials(data)
        }
      }
    } catch (error) {
      console.error('Error fetching financials:', error)
    } finally {
      setFinancialsLoading(false)
    }
  }

  const allSections = [
    { title: "Orders", description: "Create, view, and process customer orders", href: "/orders", icon: ShoppingCart },
    { title: "Quotes", description: "Create and manage customer quotes", href: "/quotes", icon: FileText },
    { title: "Inventory", description: "Track and manage product inventory", href: "/inventory", icon: CirclePile },
    { title: "Customers", description: "Manage customer information and contacts", href: "/customers", icon: Handshake },
    { title: "Sales Reps", description: "Manage sales representatives", href: "/sales-reps", icon: MapPinned },
    { title: "Distributors", description: "Manage distributors and partnerships", href: "/distributors", icon: Warehouse },
    { title: "Reports", description: "View sales, inventory, and quote reports", href: "/reports/sales", icon: TrendingUp },
    { title: "Alerts", description: "View and manage system alerts", href: "/alerts", icon: AlertTriangle },
    { title: "Documents", description: "Safely store and view documents (admin)", href: "/admin/documents", icon: FileStack },
  ]

  /** Dashboard section hrefs allowed per role. Admin sees all. */
  const DASHBOARD_SECTIONS_BY_ROLE: Record<Role, Set<string>> = {
    Admin: new Set(allSections.map((s) => s.href)),
    'Sales Rep': new Set(['/inventory', '/alerts']),
    Distributor: new Set(['/inventory', '/alerts']),
    Technician: new Set(['/inventory', '/alerts']),
  }

  const { role } = usePermissions()
  const sections = role
    ? allSections.filter((s) => DASHBOARD_SECTIONS_BY_ROLE[role]?.has(s.href))
    : []

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">
          Dashboard
        </h1>
      </div>

      {/* Banner */}
      <div className="w-full flex justify-center">
        <SyncedGif
          src="/armadillosrunning.gif"
          alt="Armadillo Cartoon Banner"
          width={1200}
          height={100}
          className="max-w-[75%] h-auto rounded-lg"
          priority
          unoptimized
        />
      </div>

      {/* Analytics Card (Admin only) */}
      {role === 'Admin' && (
      <div className="space-y-6">
        <div className="relative border border-white/20 rounded-lg overflow-hidden bg-[#181818] transition-all duration-500 ease-in-out">
          <button
            onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
            className="block group w-full"
          >
            <div className="relative flex items-center gap-4 py-8 px-5 hover:border-white/30 transition-colors">
              <div className={`absolute top-0 left-0 h-full bg-white/10 transition-all duration-[400ms] ease-in-out ${
                analyticsExpanded 
                  ? 'w-0 opacity-0' 
                  : 'w-0 group-hover:w-[120%] group-hover:bg-white/15 opacity-100'
              }`}></div>
              <TrendingUp className="w-6 h-6 text-white relative z-10" />
              <div className="relative z-10 flex-1">
                <div className="flex items-center justify-between">
                  <div className="text-left">
                    <h3 className="text-xl font-semibold text-white">
                      Analytics
                    </h3>
                    <p className="text-white text-sm mt-1">
                      View revenue, orders, inventory, and performance metrics
                    </p>
                  </div>
                  {analyticsExpanded ? (
                    <ChevronUp className="h-5 w-5 text-white/60 relative z-10" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-white/60 relative z-10" />
                  )}
                </div>
              </div>
              <div className={`absolute right-0 bottom-0 z-20 flex items-end transition-all duration-[400ms] ease-in-out ${
                analyticsExpanded
                  ? 'translate-x-full opacity-0'
                  : 'translate-x-full group-hover:translate-x-0 opacity-100'
              }`}>
                <Image
                  src="/JustHead.png"
                  alt="Armadillo Head"
                  width={150}
                  height={150}
                  style={{ opacity: 0.5 }}
                  className="object-contain"
                  unoptimized
                />
              </div>
            </div>
          </button>
          
          <div 
            className={`overflow-hidden transition-all duration-500 ease-in-out ${
              analyticsExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="px-5 pb-5 space-y-6">
              {loading ? (
                <div className="flex justify-center items-center min-h-[40vh]">
                  <div className="loader" />
                </div>
              ) : stats && (
                <>
                  {/* Period Selector */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                      Analytics: {stats.periodLabel}
                    </h3>
                    <Select value={financialPeriod} onValueChange={(v) => setFinancialPeriod(v as FinancialPeriod)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="thisMonth">This Month</SelectItem>
                        <SelectItem value="last3Months">Last 3 Months</SelectItem>
                        <SelectItem value="last6Months">Last 6 Months</SelectItem>
                        <SelectItem value="ytd">Year to Date</SelectItem>
                        <SelectItem value="lastYear">Last Year</SelectItem>
                        <SelectItem value="allTime">All Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Revenue Metrics */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Total Revenue
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-white">
                          ${stats.revenue.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-white/50 text-sm mt-1">{stats.revenue.orderCount} orders</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Average Order Value
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-white">
                          ${stats.revenue.orderCount > 0 
                            ? (stats.revenue.total / stats.revenue.orderCount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Status Metrics */}
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Pending Orders
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-yellow-400">{stats.orders.pending}</p>
                        <p className="text-white/60 text-sm mt-1">
                          ${stats.orders.pendingValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
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
                        <p className="text-2xl font-bold text-yellow-400">{stats.inventory.lowStock}</p>
                        <p className="text-white/60 text-sm mt-1">items need reordering</p>
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
                        <p className="text-2xl font-bold text-red-400">{stats.inventory.outOfStock}</p>
                        <p className="text-white/60 text-sm mt-1">items unavailable</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Active Quotes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-2xl font-bold text-white">{stats.quotes.active}</p>
                        <p className="text-white/60 text-sm mt-1">draft or sent</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Financials (QuickBooks) */}
                  {stats.quickbooks?.connected && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Profit & Loss
                      </h3>
                      <Card className="bg-gradient-to-br from-[#1f1f1f] to-[#252525]">
                        <CardHeader>
                          <CardTitle className="text-white/80 text-sm font-medium">
                            {financialsLoading ? 'Loading...' : stats.periodLabel}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {financialsLoading ? (
                            <div className="space-y-3">
                              <Skeleton className="h-6 w-full" />
                              <Skeleton className="h-6 w-full" />
                              <Skeleton className="h-8 w-full" />
                            </div>
                          ) : financials ? (
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Income</span>
                                <span className="text-green-400 font-semibold">
                                  ${(financials.totalIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">COGS</span>
                                <span className="text-orange-400 font-semibold">
                                  ${Math.abs(financials.costOfGoodsSold || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-white/60 text-sm">Expenses</span>
                                <span className="text-red-400 font-semibold">
                                  ${(financials.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                                <span className="text-white/80 text-sm font-medium">Net Income</span>
                                <span className={`text-lg font-bold ${(financials.netIncome || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  ${(financials.netIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              {financials.grossProfit !== 0 && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-white/50">Gross Profit</span>
                                  <span className="text-white/70">
                                    ${(financials.grossProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-white/50 text-sm">Select a period to view financials</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {/* Charts */}
                  {stats.charts.revenueTrend.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Revenue Trend</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <RevenueChart data={stats.charts.revenueTrend} period="daily" />
                        </CardContent>
                      </Card>
                      {stats.charts.statusDistribution.length > 0 && (
                        <Card>
                          <CardHeader>
                            <CardTitle>Order Status</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <StatusPieChart data={stats.charts.statusDistribution} />
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Top Products */}
                  {stats.charts.topProducts.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Products</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <SalesBarChart 
                          data={stats.charts.topProducts.map(p => ({ name: p.name, value: p.revenue }))} 
                          name="Revenue"
                          color="#808080"
                        />
                      </CardContent>
                    </Card>
                  )}

                  {/* Top Customers */}
                  {stats.topCustomers.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Top Customers</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {stats.topCustomers.map((customer, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-white/5 rounded">
                              <div>
                                <p className="text-white font-medium">{customer.name}</p>
                              </div>
                              <p className="text-white font-bold">
                                ${customer.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Sections List */}
      <div className="space-y-6">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.title}
              href={section.href}
              className="block group"
            >
              <div className="relative flex items-center gap-4 py-8 px-5 border border-white/20 rounded-lg hover:border-white/30 transition-colors overflow-hidden bg-[#181818]">
                <div className="absolute top-0 left-0 w-0 h-full bg-white/10 group-hover:w-[120%] group-hover:bg-white/15 transition-all duration-[400ms] ease-in-out"></div>
                <Icon className="w-6 h-6 text-white relative z-10" />
                <div className="relative z-10">
                  <h3 className="text-xl font-semibold text-white">
                    {section.title}
                  </h3>
                  <p className="text-white text-sm mt-1">
                    {section.description}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 translate-x-full group-hover:translate-x-0 transition-transform duration-[200ms] ease-in-out z-20 flex items-end">
                  <Image
                    src="/JustHead.png"
                    alt="Armadillo Head"
                    width={150}
                    height={150}
                    style={{ opacity: 0.5 }}
                    className="object-contain"
                    unoptimized
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
