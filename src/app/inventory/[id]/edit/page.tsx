'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface Product {
  id: string
  name: string
  description?: string
  sku: string
  price: number
  color?: string
  leadtime?: string
  category?: string
  inventory?: {
    quantity: number
    minStock: number
    location?: string
  }
}

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sku: '',
    price: '',
    color: '',
    leadtime: '',
    category: '',
    quantity: '',
    minStock: '',
    location: '',
  })

  useEffect(() => {
    if (productId) {
      fetchProduct()
    }
  }, [productId])

  const fetchProduct = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/products/${productId}`)
      if (response.ok) {
        const product: Product = await response.json()
        setFormData({
          name: product.name || '',
          description: product.description || '',
          sku: product.sku || '',
          price: product.price?.toString() || '',
          color: product.color || '',
          leadtime: product.leadtime || '',
          category: product.category || '',
          quantity: product.inventory?.quantity?.toString() || '',
          minStock: product.inventory?.minStock?.toString() || '',
          location: product.inventory?.location || '',
        })
      } else {
        alert('Failed to load product')
        router.push('/inventory')
      }
    } catch (error) {
      console.error('Error fetching product:', error)
      alert('Failed to load product')
      router.push('/inventory')
    } finally {
      setLoading(false)
    }
  }

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

    setSaving(true)
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          price: parseFloat(formData.price),
          color: formData.color || null,
          leadtime: formData.leadtime || null,
          quantity: formData.quantity ? parseInt(formData.quantity) : undefined,
          minStock: formData.minStock ? parseInt(formData.minStock) : undefined,
          location: formData.location || null,
        }),
      })

      if (response.ok) {
        router.push('/inventory')
      } else {
        const error = await response.json()
        alert(`Error updating product: ${error.error}`)
      }
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8 max-w-7xl">
        <div>
          <Skeleton className="h-10 w-48 mb-4" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {[...Array(8)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
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
        <h1 className="text-2xl font-bold text-white">Edit Product</h1>
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
                  disabled
                />
                <p className="text-xs text-white/50 mt-1">SKU cannot be changed</p>
              </div>

              <div>
                <Label htmlFor="category">
                  Category
                </Label>
                <Select
                  value={formData.category || undefined}
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
                  placeholder="e.g., Red, Blue"
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
                  Stock Quantity
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
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}

