'use client'

import { useState, useEffect } from 'react'
import Link from "next/link"
import Image from "next/image"
import { 
  ShoppingCart, 
  Box, 
  Handshake, 
  Tags, 
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { RevenueChart } from '@/components/charts/RevenueChart'
import { SalesBarChart } from '@/components/charts/SalesBarChart'
import { StatusPieChart } from '@/components/charts/StatusPieChart'
import { SyncedGif } from '@/components/SyncedGif'

interface DashboardStats {
  revenue: {
    today: number
    thisMonth: number
    thisYear: number
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
  error?: string
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [analyticsExpanded, setAnalyticsExpanded] = useState(false)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/dashboard/stats')
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

  const sections = [
    {
      title: "Orders",
      description: "Create, view, and process customer orders",
      href: "/orders",
      icon: ShoppingCart
    },
    {
      title: "Quotes",
      description: "Create and manage customer quotes",
      href: "/quotes",
      icon: FileText
    },
    {
      title: "Inventory",
      description: "Track and manage product inventory",
      href: "/inventory",
      icon: CirclePile
    },
    {
      title: "Customers",
      description: "Manage customer information and contacts",
      href: "/customers",
      icon: Handshake
    },
    {
      title: "Sales Reps",
      description: "Manage sales representatives",
      href: "/sales-reps",
      icon: Tags
    },
    {
      title: "Distributors",
      description: "Manage distributors and partnerships",
      href: "/distributors",
      icon: Warehouse
    },
    {
      title: "Reports",
      description: "View sales, inventory, and quote reports",
      href: "/reports/sales",
      icon: TrendingUp
    },
  ]

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

      {/* Analytics Card */}
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              ) : stats && (
                <>
                  {/* Revenue Metrics */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Revenue Today
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-white">
                          ${stats.revenue.today.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Revenue This Month
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-white">
                          ${stats.revenue.thisMonth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-white/60 text-sm font-normal flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Revenue This Year
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-white">
                          ${stats.revenue.thisYear.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

                  {/* Charts */}
                  {stats.charts.revenueTrend.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <Card>
                        <CardHeader>
                          <CardTitle>Revenue Trend (Last 30 Days)</CardTitle>
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
                        <CardTitle>Top Products (Last 30 Days)</CardTitle>
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
                        <CardTitle>Top Customers (Last 30 Days)</CardTitle>
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
