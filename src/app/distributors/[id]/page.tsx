'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Building, Mail, Phone, MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

export default function DistributorDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDistributor()
  }, [id])

  const fetchDistributor = async () => {
    try {
      const res = await fetch(`/api/distributors/${id}`)
      if (!res.ok) {
        if (res.status === 404) {
          router.push('/distributors')
          return
        }
        throw new Error('Failed to fetch')
      }
      const data = await res.json()
      setDistributor(data)
    } catch (e) {
      console.error('Error fetching distributor:', e)
      router.push('/distributors')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!distributor) return null

  const addressStr = distributor.address?.trim() || ''

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button
            variant="ghost"
            className="mb-4 text-white/60 hover:text-white"
            asChild
          >
            <Link href="/distributors/list">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Distributors
            </Link>
          </Button>
          <h1 className="text-2xl font-bold text-white">{distributor.name}</h1>
        </div>
        <Button asChild>
          <Link href={`/distributors/${id}/edit`}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {distributor.contactName && (
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-white/60" />
                <div>
                  <p className="text-sm text-white/60">Contact</p>
                  <p className="text-white">{distributor.contactName}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-white/60" />
              <div>
                <p className="text-sm text-white/60">Email</p>
                <a href={`mailto:${distributor.email}`} className="text-white hover:underline">
                  {distributor.email}
                </a>
              </div>
            </div>
            {distributor.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-white/60" />
                <div>
                  <p className="text-sm text-white/60">Phone</p>
                  <a href={`tel:${distributor.phone}`} className="text-white hover:underline">
                    {distributor.phone}
                  </a>
                </div>
              </div>
            )}
            {addressStr && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-white/60 mt-0.5" />
                <div>
                  <p className="text-sm text-white/60">Address</p>
                  <p className="text-white">{addressStr}</p>
                </div>
              </div>
            )}
            {distributor.discountRate != null && (
              <div>
                <p className="text-sm text-white/60">Discount Rate</p>
                <p className="text-white">{distributor.discountRate}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
