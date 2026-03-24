'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Pencil, Phone, Mail, MapPin, RefreshCw, Search, X, Users, Building2, Receipt, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  const [viewCustomer, setViewCustomer] = useState<Customer | null>(null)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingEdit, setDeletingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
  })

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
    const raw = customer.emails && customer.emails.length > 0
      ? customer.emails
      : (customer.email ? [customer.email] : [])

    return raw
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean)
  }

  const getPhones = (customer: Customer) => {
    const raw = customer.phones && customer.phones.length > 0
      ? customer.phones
      : (customer.phone ? [customer.phone] : [])

    return raw
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean)
  }

  const toTelHref = (phone: string) => {
    const cleaned = phone.replace(/[^\d+]/g, '')
    return `tel:${cleaned}`
  }

  // Location pin uses only public.customers.address (not city/state/country alone).
  const hasCustomerLocation = (customer: Customer) => Boolean(customer.address?.trim())

  const getLocationLabel = (customer: Customer) => customer.address?.trim() || ''

  const googleMapsSearchUrl = (address: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`

  const openEditModal = (customer: Customer) => {
    setEditCustomer(customer)
    setEditForm({
      name: customer.name || '',
      companyName: customer.companyName || '',
      email: getEmails(customer)[0] || '',
      phone: getPhones(customer)[0] || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zipCode: customer.zipCode || '',
      country: customer.country || '',
    })
  }

  const handleEditSave = async () => {
    if (!editCustomer) return
    if (!editForm.name.trim()) {
      alert('Name is required')
      return
    }
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to update customer')
      }
      setEditCustomer(null)
      await fetchCustomers(false, page, searchTerm)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update customer')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDeleteCustomer = async () => {
    if (!editCustomer) return
    const confirmed = window.confirm(`Delete customer "${editCustomer.name}"? This cannot be undone.`)
    if (!confirmed) return

    setDeletingEdit(true)
    try {
      const res = await fetch(`/api/customers/${editCustomer.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to delete customer')
      }

      setEditCustomer(null)

      const nextPage = customers.length === 1 && page > 1 ? page - 1 : page
      if (nextPage !== page) {
        setPage(nextPage)
      } else {
        await fetchCustomers(false, nextPage, searchTerm)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete customer')
    } finally {
      setDeletingEdit(false)
    }
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


      <div className="sm:flex sm:items-center sm:justify-left sm:gap-2">
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
        <div className="mt-2 sm:mt-0 flex items-center justify-end gap-1.5">
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
                <TableHead className="w-14 text-white/60 text-center">Location</TableHead>
                <TableHead className="w-20 text-white/60">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer, index) => {
                const emails = getEmails(customer)
                const phones = getPhones(customer)
                const hasLocation = hasCustomerLocation(customer)
                return (
                  <TableRow
                    key={customer.id}
                    className="hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setViewCustomer(customer)}
                  >
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
                              <a
                                href={`mailto:${email}`}
                                className="truncate max-w-[220px] text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {email}
                              </a>
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
                              <a
                                href={toTelHref(phone)}
                                className="text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {phone}
                              </a>
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
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        {hasLocation ? (
                          <Button variant="ghost" size="icon" className="border-none" asChild>
                            <a
                              href={googleMapsSearchUrl(getLocationLabel(customer))}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title={getLocationLabel(customer)}
                            >
                              <MapPin className="h-4 w-4 text-white" aria-hidden />
                              <span className="sr-only">Open address in Google Maps (new tab)</span>
                            </a>
                          </Button>
                        ) : (
                          <div
                            className="flex h-9 w-9 items-center justify-center"
                            aria-label="No address on file"
                          >
                            <MapPin className="h-4 w-4 text-white/30" aria-hidden />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="border-none"
                          onClick={() => openEditModal(customer)}
                          title="Edit customer"
                        >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                            <span className="sr-only">Edit</span>
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

      {viewCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setViewCustomer(null)}>
          <Card className="w-full max-w-2xl border border-white/10 bg-[#181818] text-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{viewCustomer.name}</h3>
                  {viewCustomer.companyName && viewCustomer.companyName !== viewCustomer.name && (
                    <p className="text-white/60 text-sm mt-1">{viewCustomer.companyName}</p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="border-none" onClick={() => setViewCustomer(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="rounded-lg border border-white/10 p-4">
                  <p className="text-white/50 mb-2">Email(s)</p>
                  {getEmails(viewCustomer).length > 0 ? getEmails(viewCustomer).map((email) => (
                    <a
                      key={email}
                      href={`mailto:${email}`}
                      className="block text-blue-300 hover:text-blue-200 break-words underline-offset-2 hover:underline"
                    >
                      {email}
                    </a>
                  )) : <p className="text-white/40">—</p>}
                </div>
                <div className="rounded-lg border border-white/10 p-4">
                  <p className="text-white/50 mb-2">Phone(s)</p>
                  {getPhones(viewCustomer).length > 0 ? getPhones(viewCustomer).map((phone) => (
                    <a
                      key={phone}
                      href={toTelHref(phone)}
                      className="block text-blue-300 hover:text-blue-200 underline-offset-2 hover:underline"
                    >
                      {phone}
                    </a>
                  )) : <p className="text-white/40">—</p>}
                </div>
                <div className="rounded-lg border border-white/10 p-4 sm:col-span-2">
                  <p className="text-white/50 mb-2">Address</p>
                  <p className="text-white whitespace-pre-wrap">{viewCustomer.address || '—'}</p>
                  {(viewCustomer.city || viewCustomer.state || viewCustomer.zipCode || viewCustomer.country) && (
                    <p className="text-white/70 mt-2">
                      {[viewCustomer.city, viewCustomer.state, viewCustomer.zipCode, viewCustomer.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {editCustomer && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => !savingEdit && setEditCustomer(null)}>
          <Card className="w-full max-w-2xl border border-white/10 bg-[#181818] text-white max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Edit Customer</h3>
                <Button variant="ghost" size="icon" className="border-none" onClick={() => setEditCustomer(null)} disabled={savingEdit}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-name">Name</Label>
                  <Input id="edit-name" value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-company">Company</Label>
                  <Input id="edit-company" value={editForm.companyName} onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div>
                  <Label htmlFor="edit-email">Primary Email</Label>
                  <Input id="edit-email" value={editForm.email} onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div>
                  <Label htmlFor="edit-phone">Primary Phone</Label>
                  <Input id="edit-phone" value={editForm.phone} onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Textarea id="edit-address" value={editForm.address} onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" rows={3} />
                </div>
                <div>
                  <Label htmlFor="edit-city">City</Label>
                  <Input id="edit-city" value={editForm.city} onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div>
                  <Label htmlFor="edit-state">State</Label>
                  <Input id="edit-state" value={editForm.state} onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div>
                  <Label htmlFor="edit-zip">ZIP</Label>
                  <Input id="edit-zip" value={editForm.zipCode} onChange={(e) => setEditForm(prev => ({ ...prev, zipCode: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
                <div>
                  <Label htmlFor="edit-country">Country</Label>
                  <Input id="edit-country" value={editForm.country} onChange={(e) => setEditForm(prev => ({ ...prev, country: e.target.value }))} className="mt-1 bg-white/10 border-white/20 text-white placeholder:text-white/40" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={handleDeleteCustomer}
                  disabled={savingEdit || deletingEdit}
                  className="border-none bg-white/10 text-red-300 hover:bg-red-500/10 hover:text-red-200"
                >
                  {deletingEdit ? 'Deleting...' : 'Delete'}
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" className="border-none bg-white/10" onClick={() => setEditCustomer(null)} disabled={savingEdit || deletingEdit}>Cancel</Button>
                  <Button className="border-none bg-white/10" onClick={handleEditSave} disabled={savingEdit || deletingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

