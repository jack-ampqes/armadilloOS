'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, Phone, Mail, MapPin, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface SalesRep {
  id: string
  name: string
  email: string
  phone?: string
  territory?: string
  commissionRate?: number
  orders: Array<{
    id: string
    orderNumber: string
    totalAmount: number
    status: string
    createdAt: string
  }>
}

export default function SalesRepsPage() {
  const [salesReps, setSalesReps] = useState<SalesRep[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchSalesReps()
  }, [])

  const fetchSalesReps = async () => {
    try {
      const response = await fetch('/api/sales-reps')
      if (response.ok) {
        const data = await response.json()
        setSalesReps(data)
      }
    } catch (error) {
      console.error('Error fetching sales reps:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSalesReps = salesReps.filter(rep =>
    rep.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rep.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (rep.phone && rep.phone.includes(searchTerm)) ||
    (rep.territory && rep.territory.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const getTotalCommission = (rep: SalesRep) => {
    if (!rep.commissionRate) return 0
    const rate = rep.commissionRate
    return rep.orders.reduce((sum, order) => sum + (order.totalAmount * rate / 100), 0)
  }

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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Sales Representatives</h1>
          <p className="mt-2 text-white/60">
            Manage sales representatives and track their performance.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/sales-reps/new" title="Add Sales Rep">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search sales reps by name, email, phone, or territory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Sales Reps Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSalesReps.map((rep) => (
            <Card key={rep.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white truncate">
                    {rep.name}
                  </h3>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/sales-reps/${rep.id}`}>
                        <Eye className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/sales-reps/${rep.id}/edit`}>
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-white/60">
                    <Mail className="mr-2 h-4 w-4" />
                    {rep.email}
                  </div>
                  {rep.phone && (
                    <div className="flex items-center text-sm text-white/60">
                      <Phone className="mr-2 h-4 w-4" />
                      {rep.phone}
                    </div>
                  )}
                  {rep.territory && (
                    <div className="flex items-center text-sm text-white/60">
                      <MapPin className="mr-2 h-4 w-4" />
                      {rep.territory}
                    </div>
                  )}
                  {rep.commissionRate && (
                    <div className="flex items-center text-sm text-white/60">
                      <DollarSign className="mr-2 h-4 w-4" />
                      {rep.commissionRate}% commission
                    </div>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Orders</span>
                      <span className="font-medium text-white">{rep.orders.length}</span>
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      ${rep.orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)} total
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Commission</span>
                      <span className="font-medium text-white">${getTotalCommission(rep).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      {filteredSalesReps.length === 0 && (
        <div className="text-center py-12">
          <div className="text-white/60">
            <p className="text-lg">
              {searchTerm ? 'No sales reps found matching your search' : 'No sales representatives found'}
            </p>
            <p className="text-sm mt-2">
              {searchTerm ? 'Try a different search term.' : 'Get started by adding your first sales representative.'}
            </p>
            {!searchTerm && (
              <Button asChild className="mt-4">
                <Link href="/sales-reps/new" title="Add Sales Rep">
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

