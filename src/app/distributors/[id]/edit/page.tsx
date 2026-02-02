'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AddressSearchInput } from '@/components/AddressSearchInput'

export default function EditDistributorPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    discountRate: '',
  })
  const [addressCoords, setAddressCoords] = useState<{ latitude: number; longitude: number } | null>(null)

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
      setFormData({
        name: data.name ?? '',
        contactName: data.contactName ?? '',
        email: data.email ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        discountRate: data.discountRate != null ? String(data.discountRate) : '',
      })
      if (data.longitude != null && data.latitude != null) {
        setAddressCoords({ latitude: data.latitude, longitude: data.longitude })
      } else {
        setAddressCoords(null)
      }
    } catch (e) {
      console.error('Error fetching distributor:', e)
      router.push('/distributors')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email) {
      alert('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: formData.name,
        contactName: formData.contactName || null,
        email: formData.email,
        phone: formData.phone || null,
        address: formData.address || null,
        discountRate: formData.discountRate ? parseFloat(formData.discountRate) : null,
      }
      if (addressCoords) {
        body.longitude = addressCoords.longitude
        body.latitude = addressCoords.latitude
      }
      const res = await fetch(`/api/distributors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        router.push('/distributors/list')
      } else {
        const err = await res.json()
        alert(`Error updating: ${err.error}`)
      }
    } catch (e) {
      console.error('Error updating distributor:', e)
      alert('Failed to update distributor')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 text-white/60 hover:text-white"
          asChild
        >
          <Link href="/distributors/list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Distributors
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-white">Edit Distributor</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Distributor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="contactName">Contact Person</Label>
                <Input
                  type="text"
                  name="contactName"
                  id="contactName"
                  value={formData.contactName}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="John Smith"
                />
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  type="email"
                  name="email"
                  id="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  type="tel"
                  name="phone"
                  id="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div>
                <Label htmlFor="discountRate">Discount Rate (%)</Label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 z-10">
                    <span className="text-white/70 sm:text-sm">%</span>
                  </div>
                  <Input
                    type="number"
                    name="discountRate"
                    id="discountRate"
                    value={formData.discountRate}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="100"
                    className="pr-12"
                    placeholder="10.0"
                  />
                </div>
                <p className="mt-1 text-sm text-white/50">
                  Discount percentage offered to this distributor
                </p>
              </div>

              <div className="sm:col-span-2">
                <AddressSearchInput
                  id="address"
                  label="Address"
                  value={formData.address}
                  onChange={(address, latitude, longitude) => {
                    setFormData((prev) => ({ ...prev, address }))
                    if (latitude != null && longitude != null) {
                      setAddressCoords({ latitude, longitude })
                    } else {
                      setAddressCoords(null)
                    }
                  }}
                  placeholder="Search address (min 3 chars) — click result to fill lat/long"
                  selectedLat={addressCoords?.latitude}
                  selectedLng={addressCoords?.longitude}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
