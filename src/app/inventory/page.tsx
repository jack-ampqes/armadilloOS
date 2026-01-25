'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Pencil, AlertTriangle, RefreshCw, Minus, PackagePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { CirclePile, DollarSign, OctagonAlert, OctagonX } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const [sortBy, setSortBy] = useState('sku') // name, sku, price, stock
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [stockDialogOpen, setStockDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantityInput, setQuantityInput] = useState('')
  const [updatingStock, setUpdatingStock] = useState(false)
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 })
  const PRODUCTS_PER_PAGE = 50

  useEffect(() => {
    fetchProducts()
  }, [])

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
      const response = await fetch('/api/inventory')
      if (response.ok) {
        const inventoryData = await response.json()
        
        // Transform inventory data from armadillo_inventory.inventory schema
        const transformedProducts = (inventoryData.inventory || []).map((item: any) => {
          const product = item.product || {}
          
          return {
            id: item.sku,
            name: product.name || item.name || 'Unknown Product',
            description: product.description,
            sku: item.sku,
            price: product.price ? parseFloat(product.price) : (item.price ? parseFloat(item.price) : 0),
            color: product.color || item.color,
            leadtime: product.leadtime || item.leadtime,
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
        // Sort by SKU by default
        const sorted = getSortedProducts(transformedProducts)
        setDisplayedProducts(sorted.slice(0, PRODUCTS_PER_PAGE))
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Error fetching inventory:', response.status, response.statusText, errorData)
        setAllProducts([])
        setDisplayedProducts([])
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

  const handleStockClick = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Get click position relative to viewport
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    let x = rect.left + rect.width / 2 // Center horizontally on the cell
    let y = rect.top + rect.height + 8 // Position below the cell with small offset
    
    // Adjust position to keep popup within viewport
    const popupWidth = 320 // w-80 = 320px
    const popupHeight = 200 // approximate height
    
    // Adjust horizontal position if it would overflow
    if (x - popupWidth / 2 < 8) {
      x = popupWidth / 2 + 8
    } else if (x + popupWidth / 2 > window.innerWidth - 8) {
      x = window.innerWidth - popupWidth / 2 - 8
    }
    
    // Adjust vertical position if it would overflow (show above instead)
    if (y + popupHeight > window.innerHeight - 8) {
      y = rect.top - popupHeight - 8
    }
    
    setPopupPosition({ x, y })
    setSelectedProduct(product)
    setQuantityInput('')
    setStockDialogOpen(true)
  }

  const handleStockUpdate = async (operation: 'add' | 'subtract') => {
    if (!selectedProduct) return
    
    const quantity = parseInt(quantityInput) || 0
    if (quantity <= 0) {
      alert('Please enter a valid quantity greater than 0')
      return
    }

    const adjustment = operation === 'add' ? quantity : -quantity
    setUpdatingStock(true)

    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sku: selectedProduct.sku,
          quantity: adjustment,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to update stock')
      }

      // Refresh the products list
      await fetchProducts()
      setStockDialogOpen(false)
      setQuantityInput('')
      setSelectedProduct(null)
    } catch (error) {
      console.error('Error updating stock:', error)
      alert(error instanceof Error ? error.message : 'Failed to update stock')
    } finally {
      setUpdatingStock(false)
    }
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
        </div>
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <Button variant="outline" asChild>
            <Link href="/inventory/manufacturer-orders">
            <PackagePlus size={20} aria-hidden="true" /> Manufacturer Orders
            </Link>
          </Button>

          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchProducts()}
            disabled={loading}
            title="Refresh inventory"
            className="group"
          >
            <RefreshCw className={`h-5 w-5 transition-transform duration-300 ${loading ? 'animate-spin' : 'group-hover:rotate-180'}`} />
          </Button>

          <Button asChild size="icon">
            <Link href="/inventory/new" title="Add Product">
              <Plus size={20} aria-hidden="true" />
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
                </SelectContent>
              </Select>
              <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as 'asc' | 'desc')}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">
                    {sortBy === 'name' || sortBy === 'sku' ? 'A-Z' : 'Low-High'}
                  </SelectItem>
                  <SelectItem value="desc">
                    {sortBy === 'name' || sortBy === 'sku' ? 'Z-A' : 'High-Low'}
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
                        <TableCell className="text-white font-medium whitespace-nowrap">
                          ${(product.price ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell 
                          className="text-white whitespace-nowrap"
                          onClick={(e) => handleStockClick(product, e)}
                        >
                          <span 
                            className="font-semibold cursor-pointer hover:text-blue-400 transition-colors"
                            title="Click to adjust stock"
                          >
                            {product.inventory?.quantity ?? 0}
                          </span>
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

      {/* Stock Adjustment Popup */}
      {stockDialogOpen && (
        <>
          {/* Positioned Popup */}
          <div
            className="fixed z-50 w-80 rounded-lg border bg-[#181818] p-4 shadow-lg"
            style={{
              left: `${popupPosition.x}px`,
              top: `${popupPosition.y}px`,
              transform: 'translateX(-50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Adjust Stock</h3>
                {selectedProduct && (
                  <p className="mt-1 text-xs text-white/60">
                    {selectedProduct.name}
                    <br />
                    <span className="font-mono text-xs">{selectedProduct.sku}</span>
                    <br />
                    Current: <span className="font-semibold text-white">{selectedProduct.inventory?.quantity ?? 0}</span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-xs text-white/80">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  placeholder="Enter quantity"
                  disabled={updatingStock}
                  className="bg-white/10 text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  style={{ MozAppearance: 'textfield' }}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && quantityInput && parseInt(quantityInput) > 0) {
                      handleStockUpdate('add')
                    } else if (e.key === 'Escape') {
                      setStockDialogOpen(false)
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleStockUpdate('subtract')}
                  disabled={updatingStock || !quantityInput || parseInt(quantityInput) <= 0}
                  className="flex-1 flex items-center justify-center gap-2"
                  size="sm"
                >
                  <Minus className="h-4 w-4" />
                  Subtract
                </Button>
                <Button
                  onClick={() => handleStockUpdate('add')}
                  disabled={updatingStock || !quantityInput || parseInt(quantityInput) <= 0}
                  className="flex-1 flex items-center justify-center gap-2"
                  size="sm"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
