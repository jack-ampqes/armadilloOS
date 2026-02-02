'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Eye, Pencil, Phone, Mail, Building, DollarSign, Map } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Distributor {
  id: string
  name: string
  contactName?: string
  email: string
  phone?: string
  address?: string
  discountRate?: number
}

export default function DistributorsListPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchDistributors()
  }, [])

  const fetchDistributors = async () => {
    try {
      const response = await fetch('/api/distributors')
      if (response.ok) {
        const data = await response.json()
        setDistributors(data)
      }
    } catch (error) {
      console.error('Error fetching distributors:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredDistributors = distributors.filter(distributor =>
    distributor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    distributor.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (distributor.contactName && distributor.contactName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (distributor.phone && distributor.phone.includes(searchTerm))
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
          <h1 className="text-3xl font-bold text-white">Distributors</h1>
          <p className="mt-2 text-white/60">
            Manage distributors and partnership agreements.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/distributors" title="View map">
              <Map className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild className="self-start sm:self-auto">
            <Link href="/distributors/new" title="Add Distributor">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Input
          type="text"
          placeholder="Search distributors by name, contact, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Distributors Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDistributors.map((distributor) => (
            <Card key={distributor.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Building className="h-8 w-8 text-white/70 mr-3" />
                    <h3 className="text-lg font-medium text-white truncate">
                      {distributor.name}
                    </h3>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/distributors/${distributor.id}`}>
                        <Eye className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">View</span>
                      </Link>
                    </Button>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/distributors/${distributor.id}/edit`}>
                        <Pencil className="h-5 w-5" aria-hidden="true" />
                        <span className="sr-only">Edit</span>
                      </Link>
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {distributor.contactName && (
                    <div className="text-sm text-white/60">
                      <span className="font-medium">Contact:</span> {distributor.contactName}
                    </div>
                  )}
                  <div className="flex items-center text-sm text-white/60">
                    <Mail className="mr-2 h-4 w-4" />
                    {distributor.email}
                  </div>
                  {distributor.phone && (
                    <div className="flex items-center text-sm text-white/60">
                      <Phone className="mr-2 h-4 w-4" />
                      {distributor.phone}
                    </div>
                  )}
                </div>

                {distributor.discountRate && (
                  <div className="mt-4 flex items-center text-sm text-white/60">
                    <DollarSign className="mr-2 h-4 w-4" />
                    {distributor.discountRate}% discount rate
                  </div>
                )}

                {distributor.address && (
                  <div className="mt-4 text-sm text-white/60 truncate" title={distributor.address}>
                    {distributor.address}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

      {filteredDistributors.length === 0 && (
        <div className="text-center py-12">
          <div className="text-white/60">
            <p className="text-lg">
              {searchTerm ? 'No distributors found matching your search' : 'No distributors found'}
            </p>
            <p className="text-sm mt-2">
              {searchTerm ? 'Try a different search term.' : 'Get started by adding your first distributor.'}
            </p>
            {!searchTerm && (
              <Button asChild className="mt-4">
                <Link href="/distributors/new" title="Add Distributor">
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
