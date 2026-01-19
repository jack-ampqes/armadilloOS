'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Customer {
  id: string
  name: string
  email: string
  phone?: string
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchCustomers()
  }, [])

  const fetchCustomers = async () => {
    try {
      const response = await fetch('/api/customers')
      if (response.ok) {
        const data = await response.json()
        setCustomers(data)
      }
    } catch (error) {
      console.error('Error fetching customers:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (customer.phone && customer.phone.includes(searchTerm))
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Customers</h1>
          <p className="mt-2 text-white/60">
            Manage customer information and contact details.
          </p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/customers/new" title="Add Customer">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </Link>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search customers by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCustomers.map((customer) => (
            <Card key={customer.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white truncate">
                    {customer.name}
                  </h3>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/customers/${customer.id}`}>
                        <Eye className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/customers/${customer.id}/edit`}>
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center text-sm text-white/60">
                    <Mail className="mr-2 h-4 w-4" />
                    {customer.email}
                  </div>
                  {customer.phone && (
                    <div className="flex items-center text-sm text-white/60">
                      <Phone className="mr-2 h-4 w-4" />
                      {customer.phone}
                    </div>
                  )}
                </div>

                {customer.city && customer.state && (
                  <div className="mt-4 text-sm text-white/60">
                    {customer.city}, {customer.state}
                    {customer.zipCode && ` ${customer.zipCode}`}
                  </div>
                )}

                <div className="mt-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">Orders</span>
                    <span className="font-medium text-white">{customer.orders.length}</span>
                  </div>
                  {customer.orders.length > 0 && (
                    <div className="mt-2 text-sm text-white/60">
                      Total spent: ${customer.orders.reduce((sum, order) => sum + order.totalAmount, 0).toFixed(2)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

      {filteredCustomers.length === 0 && (
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

