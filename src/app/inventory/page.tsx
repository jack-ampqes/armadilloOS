'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CirclePile, DollarSign, OctagonAlert, OctagonX } from 'lucide-react'

interface Product {
  id: string
  name: string
  description?: string
  sku: string
  price: number
  category?: string
  source?: 'local' | 'shopify'
  inventory?: {
    quantity: number
    minStock: number
    location?: string
    lastUpdated?: string
    inventoryItemId?: number
  }
  shopifyData?: {
    productId: number
    variantId: number
    inventoryItemId: number
    handle: string
  }
  orderItems: Array<{
    quantity: number
  }>
}

export default function InventoryPage() {
  const router = useRouter()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState('all') // all, low-stock, out-of-stock
  const [sortBy, setSortBy] = useState('name') // name, sku, price, stock, category
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [dataSource, setDataSource] = useState<'local' | 'shopify' | 'all'>('all')
  const PRODUCTS_PER_PAGE = 50

  useEffect(() => {
    fetchProducts()
  }, [dataSource])

  useEffect(() => {
    // Load more products when page changes
    if (page > 1) {
      loadMoreProducts()
    }
  }, [page])

  useEffect(() => {
    // Reset to first page when filter or sort changes
    setPage(1)
    const filtered = getFilteredProducts()
    const sorted = getSortedProducts(filtered)
    setDisplayedProducts(sorted.slice(0, PRODUCTS_PER_PAGE))
  }, [filter, sortBy, sortOrder, allProducts])

  useEffect(() => {
    // Set up infinite scroll
    const handleScroll = () => {
      const scrolledToBottom = 
        window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 500

      if (scrolledToBottom && !loadingMore && hasMoreProducts()) {
        setPage(prev => prev + 1)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [loadingMore, displayedProducts, allProducts, filter])

  const fetchProducts = async () => {
    setLoading(true)
    try {
      if (dataSource === 'all') {
        // Fetch from both sources
        const [inventoryRes, shopifyRes] = await Promise.all([
          fetch('/api/inventory'),
          fetch('/api/products?source=shopify').catch(() => ({ ok: false, status: 500, json: async () => ({ error: 'Network error' }) }))
        ])
        
        // Transform inventory data from armadillo_inventory.inventory schema
        let localProducts: Product[] = []
        if (inventoryRes.ok) {
          const inventoryData = await inventoryRes.json()
          
          // Debug: Log the first item to see structure
          if (inventoryData.inventory && inventoryData.inventory.length > 0) {
            console.log('Sample inventory item from API:', inventoryData.inventory[0])
          }
          
          // inventoryData.inventory is an array of inventory items with product info
          localProducts = (inventoryData.inventory || []).map((item: any) => {
            const product = item.product || {}
            
            // Debug: Log if name is missing or looks like UUID
            if (!product.name || product.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              console.warn('Product name issue:', {
                itemSku: item.sku,
                productName: product.name,
                itemName: item.name,
                fullItem: item
              })
            }
            
            return {
              id: item.sku,
              name: product.name || item.name || 'Unknown Product',
              description: product.description,
              sku: item.sku,
              price: product.price ? parseFloat(product.price) : (item.price ? parseFloat(item.price) : 0),
              category: product.category,
              color: product.color || item.color,
              leadtime: product.leadtime || item.leadtime,
              source: 'local' as const,
              inventory: {
                quantity: item.quantity ?? 0,
                minStock: item.min_stock ?? item.minStock ?? 0,
                location: item.location,
                lastUpdated: item.updatedAt || item.updated_at,
              },
              orderItems: []
            }
          })
        }
        
        let shopifyProducts: Product[] = []
        if (shopifyRes.ok) {
          shopifyProducts = await shopifyRes.json()
        } else if (shopifyRes.status === 400) {
          // Shopify not configured - this is expected, just log it
          const errorData = await shopifyRes.json().catch(() => ({}))
          console.warn('Shopify integration not configured:', errorData.message || 'Missing credentials')
        }
        
        // Combine products
        const combined = [...localProducts, ...shopifyProducts]
        setAllProducts(combined)
        setDisplayedProducts(combined.slice(0, PRODUCTS_PER_PAGE))
      } else if (dataSource === 'shopify') {
        const response = await fetch('/api/products?source=shopify')
        if (response.ok) {
          const data = await response.json()
          setAllProducts(data)
          setDisplayedProducts(data.slice(0, PRODUCTS_PER_PAGE))
        } else if (response.status === 400) {
          // Shopify not configured - show empty state with helpful message
          const errorData = await response.json().catch(() => ({}))
          console.warn('Shopify integration not configured:', errorData.message || 'Missing credentials')
          setAllProducts([])
          setDisplayedProducts([])
        } else {
          console.error('Error fetching products:', response.status, response.statusText)
          setAllProducts([])
          setDisplayedProducts([])
        }
      } else {
        // Local only - fetch from inventory API
        const response = await fetch('/api/inventory')
        if (response.ok) {
          const inventoryData = await response.json()
          
          // Debug: Log the first item to see structure
          if (inventoryData.inventory && inventoryData.inventory.length > 0) {
            console.log('Sample inventory item from API (local only):', inventoryData.inventory[0])
          }
          
          // Transform inventory data from armadillo_inventory.inventory schema
          const transformedProducts = (inventoryData.inventory || []).map((item: any) => {
            const product = item.product || {}
            
            // Debug: Log if name is missing or looks like UUID
            if (!product.name || product.name.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              console.warn('Product name issue:', {
                itemSku: item.sku,
                productName: product.name,
                itemName: item.name,
                fullItem: item
              })
            }
            
            return {
              id: item.sku,
              name: product.name || item.name || 'Unknown Product',
              description: product.description,
              sku: item.sku,
              price: product.price ? parseFloat(product.price) : (item.price ? parseFloat(item.price) : 0),
              category: product.category,
              color: product.color || item.color,
              leadtime: product.leadtime || item.leadtime,
              source: 'local' as const,
              inventory: {
                quantity: item.quantity ?? 0,
                minStock: item.min_stock ?? item.minStock ?? 0,
                location: item.location,
                lastUpdated: item.updatedAt || item.updated_at,
              },
              orderItems: []
            }
          })
          setAllProducts(transformedProducts)
          setDisplayedProducts(transformedProducts.slice(0, PRODUCTS_PER_PAGE))
        } else {
          const errorData = await response.json().catch(() => ({}))
          console.error('Error fetching inventory:', response.status, response.statusText, errorData)
          setAllProducts([])
          setDisplayedProducts([])
        }
      }
    } catch (error) {
      console.error('Error fetching products:', error)
      setAllProducts([])
      setDisplayedProducts([])
    } finally {
      setLoading(false)
    }
  }

  const getFilteredProducts = () => {
    return allProducts.filter(product => {
      switch (filter) {
        case 'low-stock':
          return (product.inventory?.quantity || 0) <= (product.inventory?.minStock || 0) && (product.inventory?.quantity || 0) > 0
        case 'out-of-stock':
          return (product.inventory?.quantity || 0) === 0
        default:
          return true
      }
    })
  }

  const getSortedProducts = (products: Product[]) => {
    const sorted = [...products].sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'sku':
          comparison = a.sku.localeCompare(b.sku)
          break
        case 'price':
          comparison = a.price - b.price
          break
        case 'stock':
          comparison = (a.inventory?.quantity || 0) - (b.inventory?.quantity || 0)
          break
        case 'category':
          comparison = (a.category || '').localeCompare(b.category || '')
          break
        default:
          comparison = 0
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return sorted
  }

  const hasMoreProducts = () => {
    const filtered = getFilteredProducts()
    const sorted = getSortedProducts(filtered)
    return displayedProducts.length < sorted.length
  }

  const loadMoreProducts = () => {
    setLoadingMore(true)
    const filtered = getFilteredProducts()
    const sorted = getSortedProducts(filtered)
    const nextProducts = sorted.slice(0, page * PRODUCTS_PER_PAGE)
    
    setTimeout(() => {
      setDisplayedProducts(nextProducts)
      setLoadingMore(false)
    }, 300)
  }

  const getStockStatus = (product: Product) => {
    const quantity = product.inventory?.quantity || 0
    const minStock = product.inventory?.minStock || 0

    if (quantity === 0) return { status: 'Out of Stock' }
    if (quantity <= minStock) return { status: 'Low Stock' }
    return { status: 'In Stock' }
  }

  const getTotalInventoryValue = () => {
    return allProducts.reduce((total, product) => {
      const quantity = product.inventory?.quantity ?? 0
      const price = product.price ?? 0
      return total + (price * quantity)
    }, 0)
  }

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0 max-w-7xl">
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
          <h1 className="text-3xl font-bold text-white">Inventory</h1>
          <p className="mt-2 text-white/60">
            Manage your safety products and track inventory levels.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Select value={dataSource} onValueChange={(value: 'local' | 'shopify' | 'all') => setDataSource(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="local">Local Only</SelectItem>
              <SelectItem value="shopify">Shopify Only</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchProducts()}
            disabled={loading}
            title="Refresh inventory"
          >
            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button asChild>
            <Link href="/inventory/new" title="Add Product">
              <Plus className="h-5 w-5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <CirclePile className="w-5 h-5 text-black stroke-[1.5]" />
              </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-white/60 truncate">Total Products</dt>
                  <dd className="text-lg font-medium text-white">{allProducts.length}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-black stroke-[1.5]" />
              </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-white/60 truncate">Inventory Value</dt>
                  <dd className="text-lg font-medium text-white">${getTotalInventoryValue().toFixed(2)}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <OctagonAlert className="w-5 h-5 text-black stroke-[1.5]" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-white/60 truncate">Low Stock Items</dt>
                  <dd className="text-lg font-medium text-white">
                    {allProducts.filter(p => (p.inventory?.quantity || 0) <= (p.inventory?.minStock || 0) && (p.inventory?.quantity || 0) > 0).length}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <OctagonX className="w-5 h-5 text-black stroke-[1.5]" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-white/60 truncate">Out of Stock</dt>
                  <dd className="text-lg font-medium text-white">
                    {allProducts.filter(p => (p.inventory?.quantity || 0) === 0).length}
                  </dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

        <div className="mt-8">
          <div className="sm:flex sm:items-center">
            <div className="sm:flex-auto">
              <h2 className="text-lg font-medium text-white">Products</h2>
              <p className="text-sm text-white/60 mt-1">
                Showing {displayedProducts.length} of {getFilteredProducts().length} products
              </p>
            </div>
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none flex gap-3">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="sku">SKU</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="stock">Stock</SelectItem>
                  <SelectItem value="category">Category</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    {sortBy === 'name' || sortBy === 'sku' || sortBy === 'category' ? 'A-Z' : 'Low-High'}
                  </SelectItem>
                  <SelectItem value="desc">
                    {sortBy === 'name' || sortBy === 'sku' || sortBy === 'category' ? 'Z-A' : 'High-Low'}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="low-stock">Low Stock</SelectItem>
                  <SelectItem value="out-of-stock">Out of Stock</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

        <div className="mt-8">
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-white/60">#</TableHead>
                    <TableHead className="w-1/4 text-white/60">Product</TableHead>
                    <TableHead className="text-white/60">SKU</TableHead>
                    <TableHead className="hidden lg:table-cell text-white/60">Category</TableHead>
                    <TableHead className="text-white/60">Price</TableHead>
                    <TableHead className="text-white/60">Stock</TableHead>
                    <TableHead className="text-white/60">Status</TableHead>
                    <TableHead className="w-12 text-white/60">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedProducts.map((product) => {
                    const stockStatus = getStockStatus(product)
                    const filtered = getFilteredProducts()
                    const sorted = getSortedProducts(filtered)
                    const lineNumber = sorted.findIndex(p => p.id === product.id) + 1
                    let badgeVariant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "default"
                    if (stockStatus.status === 'Out of Stock') badgeVariant = "destructive"
                    else if (stockStatus.status === 'Low Stock') badgeVariant = "warning"
                    else badgeVariant = "success"
                    
                    return (
                      <TableRow 
                        key={product.id}
                        className="cursor-pointer hover:bg-white/5 transition-colors"
                        onClick={() => router.push(`/inventory/${product.id}`)}
                      >
                        <TableCell className="text-white/60 font-mono">
                          {lineNumber}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-white truncate">{product.name}</span>
                              {product.source === 'shopify' && (
                                <Badge variant="outline" className="text-xs shrink-0">
                                  Shopify
                                </Badge>
                              )}
                            </div>
                            {product.description && (
                              <div className="text-white/60 text-xs truncate" title={product.description}>
                                {product.description.substring(0, 50)}...
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-white/60 font-mono">
                          {product.sku}
                        </TableCell>
                        <TableCell className="text-white/60 hidden lg:table-cell">
                          <span className="inline-block max-w-[120px] truncate" title={product.category}>
                            {product.category || 'N/A'}
                          </span>
                        </TableCell>
                        <TableCell className="text-white font-medium whitespace-nowrap">
                          ${(product.price ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-white whitespace-nowrap">
                          <span className="font-semibold">{product.inventory?.quantity ?? 0}</span>
                          {product.inventory?.minStock != null && product.inventory.minStock > 0 && (
                            <span className="text-xs text-white/50 ml-1 hidden xl:inline">
                              (min: {product.inventory.minStock})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge variant={badgeVariant}>
                            {stockStatus.status}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/inventory/${product.id}/edit`}
                            className="text-white hover:text-white/60"
                            title="Edit product"
                          >
                            <Pencil className="h-5 w-5" aria-hidden="true" />
                            <span className="sr-only">Edit</span>
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
          
          {/* Loading More Indicator */}
          {loadingMore && (
            <div className="flex justify-center py-8">
              <div className="flex items-center space-x-2">
                <Skeleton className="h-6 w-6 rounded-full" />
                <span className="text-sm text-white/60">Loading more products...</span>
              </div>
            </div>
          )}

          {/* End of List Indicator */}
          {!hasMoreProducts() && displayedProducts.length > 0 && (
            <div className="text-center py-6 text-sm text-white/60">
              End of list - All {displayedProducts.length} products loaded
            </div>
          )}
        </div>

        {displayedProducts.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-white/60">
              <p className="text-lg">
                {filter === 'all' ? 'No products found' : `No products with ${filter.replace('-', ' ')}`}
              </p>
              <p className="text-sm mt-2">
                {filter === 'all' ? 'Get started by adding your first product.' : 'Try a different filter.'}
              </p>
              {filter === 'all' && (
                <Button asChild className="mt-4">
                  <Link href="/inventory/new" title="Add Product">
                    <Plus className="h-5 w-5" aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
