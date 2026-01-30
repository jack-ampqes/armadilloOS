'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePermissions } from '@/lib/usePermissions'

interface Product {
  id: string
  name: string
  description?: string
  sku: string
  price: number
  color?: string
  leadtime?: string
  inventory?: {
    quantity: number
    minStock: number
    location?: string
    lastUpdated?: string
  }
}

export default function ProductDetailPage() {
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string
  const { hasPermission } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [product, setProduct] = useState<Product | null>(null)

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
        const productData: Product = await response.json()
        setProduct(productData)
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

  const getStockStatus = (product: Product) => {
    const quantity = product.inventory?.quantity || 0
    const minStock = product.inventory?.minStock || 0

    if (quantity === 0) return { status: 'Out of Stock', variant: 'destructive' as const }
    if (quantity <= minStock) return { status: 'Low Stock', variant: 'warning' as const }
    return { status: 'In Stock', variant: 'success' as const }
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
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="space-y-8 max-w-7xl">
        <div className="text-center py-12">
          <p className="text-white/60">Product not found</p>
          <Button
            variant="outline"
            onClick={() => router.push('/inventory')}
            className="mt-4"
          >
            Back to Inventory
          </Button>
        </div>
      </div>
    )
  }

  const stockStatus = getStockStatus(product)

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">{product.name}</h1>
            <p className="mt-2 text-white/60">
              Product Details
            </p>
          </div>
          {hasPermission('InventoryEditing') && (
            <Button asChild>
              <Link href={`/inventory/${product.id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit Product
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Product Information */}
        <Card>
          <CardHeader>
            <CardTitle>Product Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white/60">Product Name</label>
              <p className="mt-1 text-white">{product.name}</p>
            </div>

            {product.description && (
              <div>
                <label className="text-sm font-medium text-white/60">Description</label>
                <p className="mt-1 text-white">{product.description}</p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-white/60">SKU</label>
              <p className="mt-1 text-white font-mono">{product.sku}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-white/60">Price</label>
              <p className="mt-1 text-white font-medium">${product.price.toFixed(2)}</p>
            </div>


            {product.color && (
              <div>
                <label className="text-sm font-medium text-white/60">Color</label>
                <p className="mt-1 text-white">{product.color}</p>
              </div>
            )}

            {product.leadtime && (
              <div>
                <label className="text-sm font-medium text-white/60">Lead Time</label>
                <p className="mt-1 text-white">{product.leadtime}</p>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Inventory Information */}
        <Card>
          <CardHeader>
            <CardTitle>Inventory Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-white/60">Stock Status</label>
              <div className="mt-1">
                <Badge variant={stockStatus.variant}>
                  {stockStatus.status}
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-white/60">Current Quantity</label>
              <p className="mt-1 text-white font-semibold text-xl">
                {product.inventory?.quantity || 0}
              </p>
            </div>

            {product.inventory?.minStock !== undefined && (
              <div>
                <label className="text-sm font-medium text-white/60">Minimum Stock Level</label>
                <p className="mt-1 text-white">{product.inventory.minStock}</p>
              </div>
            )}

            {product.inventory?.location && (
              <div>
                <label className="text-sm font-medium text-white/60">Storage Location</label>
                <p className="mt-1 text-white">{product.inventory.location}</p>
              </div>
            )}

            {product.inventory?.lastUpdated && (
              <div>
                <label className="text-sm font-medium text-white/60">Last Updated</label>
                <p className="mt-1 text-white">
                  {new Date(product.inventory.lastUpdated).toLocaleString()}
                </p>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  )
}
