'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    sku: '',
    price: '',
    color: '',
    leadtime: '',
    quantity: '',
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

    if (!formData.sku || !formData.price) {
      alert('Please fill in SKU and Price (required fields)')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: formData.sku,
          price: parseFloat(formData.price),
          color: formData.color || null,
          leadtime: formData.leadtime || null,
          quantity: formData.quantity ? parseInt(formData.quantity) : 0,
        }),
      })

      if (response.ok) {
        router.push('/inventory')
      } else {
        const error = await response.json()
        const errorMessage = error.message || error.error || 'Unknown error'
        const errorDetails = error.details ? `\n\nDetails: ${error.details}` : ''
        const errorHint = error.hint ? `\n\nHint: ${error.hint}` : ''
        alert(`Error creating product: ${errorMessage}${errorDetails}${errorHint}`)
        console.error('Product creation error:', error)
      }
    } catch (error) {
      console.error('Error creating product:', error)
      alert('Failed to create product')
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
          Back to Inventory
        </Button>
        <h1 className="text-2xl font-bold text-white">Add New Product</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="sku">
                  SKU *
                </Label>
                <Input
                  type="text"
                  name="sku"
                  id="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className="mt-1 font-mono"
                  placeholder="e.g., ASP-001"
                  required
                />
              </div>

              <div>
                <Label htmlFor="price">
                  Price *
                </Label>
                <div className="relative mt-1">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 z-10">
                    <span className="text-white/70 sm:text-sm">$</span>
                  </div>
                  <Input
                    type="number"
                    name="price"
                    id="price"
                    value={formData.price}
                    onChange={handleChange}
                    step="0.01"
                    min="0"
                    className="pl-7"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="color">
                  Color
                </Label>
                <Input
                  type="text"
                  name="color"
                  id="color"
                  value={formData.color}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="e.g., Red, Blue, Black"
                />
              </div>

              <div>
                <Label htmlFor="leadtime">
                  Lead Time
                </Label>
                <Input
                  type="text"
                  name="leadtime"
                  id="leadtime"
                  value={formData.leadtime}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="e.g., 2-3 weeks"
                />
              </div>

              <div>
                <Label htmlFor="quantity">
                  Quantity
                </Label>
                <Input
                  type="number"
                  name="quantity"
                  id="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="0"
                  className="mt-1"
                  placeholder="0"
                />
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
            {loading ? 'Creating...' : 'Create Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}

