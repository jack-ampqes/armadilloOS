'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewDistributorPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    discountRate: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.email) {
      alert('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/distributors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          contactName: formData.contactName || null,
          email: formData.email,
          phone: formData.phone || null,
          address: formData.address || null,
          city: formData.city || null,
          state: formData.state || null,
          zipCode: formData.zipCode || null,
          country: formData.country || null,
          discountRate: formData.discountRate ? parseFloat(formData.discountRate) : null,
        }),
      })

      if (response.ok) {
        router.push('/distributors')
      } else {
        const error = await response.json()
        alert(`Error creating distributor: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating distributor:', error)
      alert('Failed to create distributor')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Distributors
        </Button>
        <h1 className="text-2xl font-bold text-white">Add New Distributor</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Distributor Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">
                  Company Name *
                </Label>
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
                <Label htmlFor="contactName">
                  Contact Person
                </Label>
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
                <Label htmlFor="email">
                  Email Address *
                </Label>
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
                <Label htmlFor="phone">
                  Phone Number
                </Label>
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
                <Label htmlFor="discountRate">
                  Discount Rate (%)
                </Label>
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
                <Label htmlFor="address">
                  Street Address
                </Label>
                <Input
                  type="text"
                  name="address"
                  id="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="123 Business Street"
                />
              </div>

              <div>
                <Label htmlFor="city">
                  City
                </Label>
                <Input
                  type="text"
                  name="city"
                  id="city"
                  value={formData.city}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="state">
                  State/Province
                </Label>
                <Input
                  type="text"
                  name="state"
                  id="state"
                  value={formData.state}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="zipCode">
                  ZIP/Postal Code
                </Label>
                <Input
                  type="text"
                  name="zipCode"
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={handleChange}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="country">
                  Country
                </Label>
                <Select
                  value={formData.country || undefined}
                  onValueChange={(value) => handleSelectChange('country', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a country" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="Mexico">Mexico</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                    <SelectItem value="Germany">Germany</SelectItem>
                    <SelectItem value="France">France</SelectItem>
                    <SelectItem value="Japan">Japan</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Distributor'}
          </Button>
        </div>
      </form>
    </div>
  )
}

