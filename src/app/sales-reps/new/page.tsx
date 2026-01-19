'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewSalesRepPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    territory: '',
    commissionRate: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
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
      const response = await fetch('/api/sales-reps', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          territory: formData.territory || null,
          commissionRate: formData.commissionRate ? parseFloat(formData.commissionRate) : null,
        }),
      })

      if (response.ok) {
        router.push('/sales-reps')
      } else {
        const error = await response.json()
        alert(`Error creating sales rep: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating sales rep:', error)
      alert('Failed to create sales rep')
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
          Back to Sales Reps
        </Button>
        <h1 className="text-2xl font-bold text-white">Add New Sales Representative</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Sales Representative Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="name">
                  Full Name *
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
                <Label htmlFor="territory">
                  Territory
                </Label>
                <Input
                  type="text"
                  name="territory"
                  id="territory"
                  value={formData.territory}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="e.g., Northeast Region, California"
                />
              </div>

              <div>
                <Label htmlFor="commissionRate">
                  Commission Rate (%)
                </Label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 z-10">
                    <span className="text-white/70 sm:text-sm">%</span>
                  </div>
                  <Input
                    type="number"
                    name="commissionRate"
                    id="commissionRate"
                    value={formData.commissionRate}
                    onChange={handleChange}
                    step="0.1"
                    min="0"
                    max="100"
                    className="pr-12"
                    placeholder="5.0"
                  />
                </div>
                <p className="mt-1 text-sm text-white/50">
                  Percentage of order total this rep earns as commission
                </p>
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
            {loading ? 'Creating...' : 'Create Sales Rep'}
          </Button>
        </div>
      </form>
    </div>
  )
}

