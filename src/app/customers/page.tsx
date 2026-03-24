'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, Phone, Mail, RefreshCw, Search, X, Users, Building2, Receipt, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'

interface Customer {
  id: string
  name: string
  companyName?: string
  email?: string
  emails?: string[]
  phone?: string
  phones?: string[]
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  orders: Array<{
    id: string
    orderNumber: string
    totalAmount: number
    status: string
    createdAt: string
  }>
}

export default function CustomersPage() {
  const PAGE_SIZE = 250
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const getVisiblePages = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    if (page <= 4) return [1, 2, 3, 4, 5, -1, totalPages]
    if (page >= totalPages - 3) return [1, -1, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, -1, page - 1, page, page + 1, -1, totalPages]
  }

  useEffect(() => {
    fetchCustomers()
  }, [page])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1)
      fetchCustomers(false, 1, searchTerm)
    }, 250)
    return () => clearTimeout(timeout)
  }, [searchTerm])

  const fetchCustomers = async (isRefresh = false, pageOverride?: number, searchOverride?: string) => {
    if (isRefresh) setRefreshing(true)
    try {
      const currentPage = pageOverride ?? page
      const currentSearch = (searchOverride ?? searchTerm).trim()
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(PAGE_SIZE),
      })
      if (currentSearch) params.set('search', currentSearch)

      const response = await fetch(`/api/customers?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        setCustomers(data.data || [])
        setTotalCustomers(data.pagination?.total || 0)
        setTotalPages(data.pagination?.totalPages || 1)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const getEmails = (customer: Customer) => {
    if (customer.emails && customer.emails.length > 0) return customer.emails
    return customer.email ? [customer.email] : []
  }

  const getPhones = (customer: Customer) => {
    if (customer.phones && customer.phones.length > 0) return customer.phones
    return customer.phone ? [customer.phone] : []
  }

  const customersWithOrders = customers.filter(c => c.orders.length > 0).length
  const totalOrders = customers.reduce((sum, c) => sum + c.orders.length, 0)
  const totalRevenue = customers.reduce(
    (sum, c) => sum + c.orders.reduce((orderSum, order) => orderSum + order.totalAmount, 0),
    0
  )

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="flex justify-center">
          <Skeleton className="h-12 w-12 rounded-full" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Customers</h1>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button
            variant="outline"
            size="icon"
            onClick={() => fetchCustomers(true)}
            disabled={refreshing}
            title="Refresh customers"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild size="icon">
            <Link href="/customers/new" title="Add Customer">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-black stroke-[1.5]" />
              </div>
              <div className="ml-5">
                <p className="text-sm text-white/60">Total Customers</p>
                <p className="text-lg font-medium text-white">{totalCustomers}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="sm:flex sm:items-center sm:gap-4">
        <div className="sm:flex-auto min-w-0">
          <h2 className="text-lg font-medium text-white">Directory</h2>
        </div>
        <div className="mt-4 sm:mt-0 sm:w-80 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
          <Input
            type="search"
            placeholder="Search name, company, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 w-full [&::-webkit-search-cancel-button]:hidden [&::-moz-search-cancel-button]:hidden"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1 || loading}
          title="Previous page"
          className="border-transparent"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-xs text-white/60 px-1">
          {page} / {totalPages}
        </p>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages || loading}
          title="Next page"
          className="border-transparent"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-white/60">#</TableHead>
                <TableHead className="text-white/60">Customer</TableHead>
                <TableHead className="text-white/60">Email(s)</TableHead>
                <TableHead className="text-white/60">Phone(s)</TableHead>
                <TableHead className="text-white/60">Location</TableHead>
                <TableHead className="text-white/60">Orders</TableHead>
                <TableHead className="text-white/60">Spent</TableHead>
                <TableHead className="w-20 text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer, index) => {
                const emails = getEmails(customer)
                const phones = getPhones(customer)
                const spent = customer.orders.reduce((sum, order) => sum + order.totalAmount, 0)
                return (
                  <TableRow key={customer.id} className="hover:bg-white/5 transition-colors">
                    <TableCell className="text-white/60 font-mono">{(page - 1) * PAGE_SIZE + index + 1}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-white">{customer.name}</p>
                        {customer.companyName && customer.companyName !== customer.name && (
                          <p className="text-xs text-white/50">{customer.companyName}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-white/70">
                      {emails.length > 0 ? (
                        <div className="space-y-1">
                          {emails.slice(0, 2).map((email) => (
                            <div key={email} className="flex items-center gap-2">
                              <Mail className="h-3.5 w-3.5 text-white/50" />
                              <span className="truncate max-w-[220px]">{email}</span>
                            </div>
                          ))}
                          {emails.length > 2 && (
                            <p className="text-xs text-white/50">+{emails.length - 2} more</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-white/70">
                      {phones.length > 0 ? (
                        <div className="space-y-1">
                          {phones.slice(0, 2).map((phone) => (
                            <div key={phone} className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 text-white/50" />
                              <span>{phone}</span>
                            </div>
                          ))}
                          {phones.length > 2 && (
                            <p className="text-xs text-white/50">+{phones.length - 2} more</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-white/70">
                      {customer.city && customer.state
                        ? `${customer.city}, ${customer.state}${customer.zipCode ? ` ${customer.zipCode}` : ''}`
                        : customer.country || '—'}
                    </TableCell>
                    <TableCell className="text-white">{customer.orders.length}</TableCell>
                    <TableCell className="text-white font-medium">${spent.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/customers/${customer.id}`}>
                            <Eye className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">View</span>
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/customers/${customer.id}/edit`}>
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-white/60">
          Page {page} of {totalPages} · {PAGE_SIZE} per page · {totalCustomers.toLocaleString()} total
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage(1)}
            disabled={page <= 1 || loading}
            title="First page"
            className="border-transparent"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            title="Previous page"
            className="border-transparent"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {getVisiblePages().map((pageNumber, idx) =>
            pageNumber === -1 ? (
              <span key={`ellipsis-${idx}`} className="px-2 text-white/50 select-none">…</span>
            ) : (
              <Button
                key={pageNumber}
                variant={pageNumber === page ? 'outline' : 'ghost'}
                size="sm"
                onClick={() => setPage(pageNumber)}
                disabled={loading}
                className={pageNumber === page ? 'min-w-9' : 'min-w-9 border-transparent'}
              >
                {pageNumber}
              </Button>
            )
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            title="Next page"
            className="border-transparent"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages || loading}
            title="Last page"
            className="border-transparent"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {customers.length === 0 && (
        <div className="text-center py-12">
          <div className="text-white/60">
            <p className="text-lg">
              {searchTerm ? 'No customers found matching your search' : 'No customers found'}
            </p>
            <p className="text-sm mt-2">
              {searchTerm ? 'Try a different search term.' : 'Get started by adding your first customer.'}
            </p>
            {!searchTerm && (
              <Button asChild className="mt-4">
                <Link href="/customers/new" title="Add Customer">
                  <Plus className="h-5 w-5" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

