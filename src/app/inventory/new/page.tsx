'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    category: '',
    quantity: '',
    minStock: '',
    location: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    if (!formData.name || !formData.sku || !formData.price) {
      alert('Please fill in all required fields')
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
          name: formData.name,
          description: formData.description || null,
          sku: formData.sku,
          price: parseFloat(formData.price),
          category: formData.category || null,
          quantity: formData.quantity ? parseInt(formData.quantity) : 0,
          minStock: formData.minStock ? parseInt(formData.minStock) : 0,
          location: formData.location || null,
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
              <div className="sm:col-span-2">
                <Label htmlFor="name">
                  Product Name *
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

              <div className="sm:col-span-2">
                <Label htmlFor="description">
                  Description
                </Label>
                <Textarea
                  name="description"
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="Product description..."
                />
              </div>

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
                <Label htmlFor="category">
                  Category
                </Label>
                <Select
                  value={formData.category || ''}
                  onValueChange={(value) => handleSelectChange('category', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hard Hats">Hard Hats</SelectItem>
                    <SelectItem value="Safety Glasses">Safety Glasses</SelectItem>
                    <SelectItem value="Gloves">Gloves</SelectItem>
                    <SelectItem value="Ear Protection">Ear Protection</SelectItem>
                    <SelectItem value="Respiratory Protection">Respiratory Protection</SelectItem>
                    <SelectItem value="High Visibility">High Visibility</SelectItem>
                    <SelectItem value="Fall Protection">Fall Protection</SelectItem>
                    <SelectItem value="Footwear">Footwear</SelectItem>
                    <SelectItem value="First Aid">First Aid</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
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
                <Label htmlFor="quantity">
                  Initial Stock Quantity
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

              <div>
                <Label htmlFor="minStock">
                  Minimum Stock Level
                </Label>
                <Input
                  type="number"
                  name="minStock"
                  id="minStock"
                  value={formData.minStock}
                  onChange={handleChange}
                  min="0"
                  className="mt-1"
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="location">
                  Storage Location
                </Label>
                <Input
                  type="text"
                  name="location"
                  id="location"
                  value={formData.location}
                  onChange={handleChange}
                  className="mt-1"
                  placeholder="e.g., Warehouse A, Shelf 3"
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

