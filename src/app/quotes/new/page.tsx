'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus, Minus, Trash2, Package, User, Info, Percent, DollarSign, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface Product {
  id: string
  name: string
  sku: string
  price: number
  source?: 'local' | 'shopify'
}

interface QuoteItem {
  productId: string | null
  productName: string
  sku: string
  quantity: number
  unitPrice: number
}

interface QuickBooksCustomerResult {
  id: string
  displayName: string
  email: string
  phone: string
  billAddr?: {
    line1: string
    city: string
    state: string
    postalCode: string
    country: string
  }
}

export default function NewQuotePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(true)
  
  // Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerCity, setCustomerCity] = useState('')
  const [customerState, setCustomerState] = useState('')
  const [customerZip, setCustomerZip] = useState('')
  const [customerCountry, setCustomerCountry] = useState('US')

  // QuickBooks customer search popup
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [customerSearchQuery, setCustomerSearchQuery] = useState('')
  const [customerSearchResults, setCustomerSearchResults] = useState<QuickBooksCustomerResult[]>([])
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false)
  const [customerSearchError, setCustomerSearchError] = useState<string | null>(null)
  
  // Discount
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed' | null>(null)
  const [discountValue, setDiscountValue] = useState('')
  
  // Other
  const [validDays, setValidDays] = useState('30')
  const [notes, setNotes] = useState('')
  const [pushToQuickBooks, setPushToQuickBooks] = useState(false)
  
  // Product search
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  
  // Custom item
  const [showCustomItem, setShowCustomItem] = useState(false)
  const [customItemName, setCustomItemName] = useState('')
  const [customItemSku, setCustomItemSku] = useState('')
  const [customItemPrice, setCustomItemPrice] = useState('')
  const [customItemQty, setCustomItemQty] = useState('1')

  useEffect(() => {
    fetchProducts()
  }, [])

  const searchQuickBooksCustomers = useCallback(async () => {
    const q = customerSearchQuery.trim()
    if (!q) {
      setCustomerSearchResults([])
      return
    }
    setCustomerSearchLoading(true)
    setCustomerSearchError(null)
    try {
      const res = await fetch(`/api/quickbooks/customers?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      if (!res.ok) {
        setCustomerSearchError(data.error ?? 'Search failed')
        setCustomerSearchResults([])
        return
      }
      setCustomerSearchResults(data.customers ?? [])
    } catch {
      setCustomerSearchError('Failed to search QuickBooks')
      setCustomerSearchResults([])
    } finally {
      setCustomerSearchLoading(false)
    }
  }, [customerSearchQuery])

  const selectQuickBooksCustomer = (customer: QuickBooksCustomerResult) => {
    setCustomerName(customer.displayName)
    setCustomerEmail(customer.email)
    setCustomerPhone(customer.phone)
    if (customer.billAddr) {
      setCustomerAddress(customer.billAddr.line1)
      setCustomerCity(customer.billAddr.city)
      setCustomerState(customer.billAddr.state)
      setCustomerZip(customer.billAddr.postalCode)
      setCustomerCountry(customer.billAddr.country || 'US')
    }
    setShowCustomerSearch(false)
    setCustomerSearchQuery('')
    setCustomerSearchResults([])
    setCustomerSearchError(null)
  }

  const fetchProducts = async () => {
    setLoadingProducts(true)
    try {
      // Fetch products from armadillo_inventory.inventory table only
      const inventoryRes = await fetch('/api/inventory')

      const allProducts: Product[] = []

      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json()
        const inventory = inventoryData.inventory || []
        
        if (Array.isArray(inventory)) {
          allProducts.push(...inventory.map((item: any) => ({
            id: item.sku || item.id,
            name: item.product?.name || `Product ${item.sku}`,
            sku: item.sku,
            price: item.product?.price || 0,
            source: 'local' as const,
          })))
        }
      }

      setProducts(allProducts)
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  const filteredProducts = products.filter(p => {
    const name = p.name.toLowerCase()
    const sku = p.sku.toLowerCase()
    
    // Handle special Class filters (exclude leather)
    if (activeFilter === 'Class 2') {
      const hasClass2 = name.includes('class 2') || sku.includes('2')
      const isLeather = name.includes('leather')
      return hasClass2 && !isLeather
    }
    if (activeFilter === 'Class 3') {
      const hasClass3 = name.includes('class 3') || sku.includes('3')
      const isLeather = name.includes('leather')
      return hasClass3 && !isLeather
    }
    
    // Regular search
    if (!searchQuery) return true // Show all products by default
    const query = searchQuery.toLowerCase()
    return name.includes(query) || sku.includes(query)
  })

  const addQuoteItem = (product: Product) => {
    const existingItem = quoteItems.find(item => item.productId === product.id)
    if (existingItem) {
      setQuoteItems(quoteItems.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setQuoteItems([...quoteItems, {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.price,
      }])
    }
    setSearchQuery('')
  }

  const addCustomItem = () => {
    if (!customItemName || !customItemPrice) return
    
    setQuoteItems([...quoteItems, {
      productId: null,
      productName: customItemName,
      sku: customItemSku || 'CUSTOM',
      quantity: parseInt(customItemQty) || 1,
      unitPrice: parseFloat(customItemPrice) || 0,
    }])
    
    // Reset custom item form
    setCustomItemName('')
    setCustomItemSku('')
    setCustomItemPrice('')
    setCustomItemQty('1')
    setShowCustomItem(false)
  }

  const updateQuantity = (index: number, delta: number) => {
    setQuoteItems(quoteItems.map((item, i) => {
      if (i !== index) return item
      const newQuantity = item.quantity + delta
      return newQuantity > 0 ? { ...item, quantity: newQuantity } : item
    }).filter(item => item.quantity > 0))
  }

  const updatePrice = (index: number, newPrice: string) => {
    const price = parseFloat(newPrice) || 0
    setQuoteItems(quoteItems.map((item, i) => 
      i === index ? { ...item, unitPrice: price } : item
    ))
  }

  const removeItem = (index: number) => {
    setQuoteItems(quoteItems.filter((_, i) => i !== index))
  }

  const getSubtotal = () => {
    return quoteItems.reduce((total, item) => total + (item.unitPrice * item.quantity), 0)
  }

  const getDiscountAmount = () => {
    const subtotal = getSubtotal()
    const value = parseFloat(discountValue) || 0
    
    if (!discountType || value <= 0) return 0
    
    if (discountType === 'percentage') {
      return subtotal * (value / 100)
    }
    return value
  }

  const getTotal = () => {
    return getSubtotal() - getDiscountAmount()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (quoteItems.length === 0) {
      alert('Please add at least one item to the quote')
      return
    }

    if (!customerName) {
      alert('Please provide a customer name')
      return
    }

    setLoading(true)
    try {
      const validUntil = validDays 
        ? new Date(Date.now() + parseInt(validDays) * 24 * 60 * 60 * 1000).toISOString()
        : null

      const response = await fetch('/api/quotes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerName,
          customerEmail: customerEmail || null,
          customerPhone: customerPhone || null,
          customerAddress: customerAddress || null,
          customerCity: customerCity || null,
          customerState: customerState || null,
          customerZip: customerZip || null,
          customerCountry: customerCountry || null,
          quoteItems: quoteItems.map(item => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          discountType: discountType,
          discountValue: parseFloat(discountValue) || 0,
          validUntil,
          notes: notes || null,
          pushToQuickBooks: pushToQuickBooks || undefined,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        const msg = data.warning
          ? `Quote ${data.quoteNumber} created. ${data.warning}`
          : `Quote ${data.quoteNumber} created successfully!`
        alert(msg)
        router.push('/quotes')
      } else {
        alert(`Error creating quote: ${data.error || data.message}`)
      }
    } catch (error) {
      console.error('Error creating quote:', error)
      alert('Failed to create quote')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-4 text-white/60 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Quotes
        </Button>
        <h1 className="text-2xl font-bold text-white">New Quote</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="customerName">Customer Name *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCustomerSearchQuery(customerName)
                      setShowCustomerSearch(true)
                      setCustomerSearchResults([])
                      setCustomerSearchError(null)
                    }}
                    className="shrink-0 border-0 w-9 h-9 p-0 flex items-center justify-center"
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="mt-1"
                  placeholder="Company or individual name"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="customerEmail">Email</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="mt-1"
                  placeholder="customer@example.com"
                />
              </div>
              
              <div>
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="mt-1"
                  placeholder="+1 555-123-4567"
                />
              </div>
              
              <div className="sm:col-span-2">
                <Label htmlFor="customerAddress">Address</Label>
                <Input
                  id="customerAddress"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  className="mt-1"
                  placeholder="Street address"
                />
              </div>
              
              <div>
                <Label htmlFor="customerCity">City</Label>
                <Input
                  id="customerCity"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="customerState">State / Province</Label>
                <Input
                  id="customerState"
                  value={customerState}
                  onChange={(e) => setCustomerState(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="customerZip">ZIP / Postal Code</Label>
                <Input
                  id="customerZip"
                  value={customerZip}
                  onChange={(e) => setCustomerZip(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="customerCountry">Country</Label>
                <Input
                  id="customerCountry"
                  value={customerCountry}
                  onChange={(e) => setCustomerCountry(e.target.value)}
                  className="mt-1"
                  placeholder="US"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quote Items Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Quote Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Product Search */}
            <div className="mb-6">
              <Label htmlFor="product-search">Search Products</Label>
              <Input
                id="product-search"
                type="text"
                placeholder="Search by name or SKU..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setActiveFilter(null) // Clear special filter when typing
                }}
                className="mt-1"
              />
              
              {/* Quick Filter Buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                <Button
                  type="button"
                  variant={searchQuery === 'ArmaFlex' && !activeFilter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveFilter(null)
                    setSearchQuery(searchQuery === 'ArmaFlex' ? '' : 'ArmaFlex')
                  }}
                >
                  ArmaFlex
                </Button>
                <Button
                  type="button"
                  variant={searchQuery === 'Rubber' && !activeFilter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveFilter(null)
                    setSearchQuery(searchQuery === 'Rubber' ? '' : 'Rubber')
                  }}
                >
                  Rubber
                </Button>
                <Button
                  type="button"
                  variant={searchQuery === 'Leather' && !activeFilter ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setActiveFilter(null)
                    setSearchQuery(searchQuery === 'Leather' ? '' : 'Leather')
                  }}
                >
                  Leather
                </Button>
                <Button
                  type="button"
                  variant={activeFilter === 'Class 2' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveFilter(activeFilter === 'Class 2' ? null : 'Class 2')
                  }}
                >
                  Class 2
                </Button>
                <Button
                  type="button"
                  variant={activeFilter === 'Class 3' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setActiveFilter(activeFilter === 'Class 3' ? null : 'Class 3')
                  }}
                >
                  Class 3
                </Button>
              </div>
              
              {/* Product List */}
              <div className="mt-4 border border-white/20 rounded-lg max-h-64 overflow-y-auto">
                {loadingProducts ? (
                  <div className="p-4 text-center text-white/60">Loading products...</div>
                ) : filteredProducts.length === 0 ? (
                  <div className="p-4 text-center text-white/60">
                    {searchQuery || activeFilter ? 'No products found' : 'No products in inventory'}
                  </div>
                ) : (
                  filteredProducts.slice(0, 20).map((product, index) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => addQuoteItem(product)}
                      className={`w-full px-4 py-3 text-left hover:bg-white/10 flex justify-between items-center ${
                        index !== filteredProducts.slice(0, 20).length - 1 ? 'border-b border-white/10' : ''
                      }`}
                    >
                      <div>
                        <div className="font-medium text-white">{product.name}</div>
                        <div className="text-sm text-white/60 font-mono">{product.sku}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/80">${product.price.toFixed(2)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Add Custom Item Button */}
            <div className="mb-6">
              {!showCustomItem ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCustomItem(true)}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Custom Line Item
                </Button>
              ) : (
                <div className="p-4 border border-white/20 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="sm:col-span-2">
                      <Label htmlFor="customName">Item Name</Label>
                      <Input
                        id="customName"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        className="mt-1"
                        placeholder="Custom item name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customSku">SKU (optional)</Label>
                      <Input
                        id="customSku"
                        value={customItemSku}
                        onChange={(e) => setCustomItemSku(e.target.value)}
                        className="mt-1"
                        placeholder="SKU"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customPrice">Unit Price</Label>
                      <Input
                        id="customPrice"
                        type="number"
                        step="0.01"
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(e.target.value)}
                        className="mt-1"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      onClick={addCustomItem}
                      disabled={!customItemName || !customItemPrice}
                    >
                      Add Item
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCustomItem(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Quote Items List */}
            {quoteItems.length === 0 ? (
              <div className="text-center py-8 text-white/40 border border-dashed border-white/20 rounded-lg"> </div>
            ) : (
              <div className="space-y-3">
                {quoteItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-white">{item.productName}</div>
                      <div className="text-sm text-white/60 font-mono">{item.sku}</div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1">
                        <span className="text-white/60 text-sm">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updatePrice(index, e.target.value)}
                          className="w-24 h-8 text-right"
                        />
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(index, -1)}
                          className="h-8 w-8 p-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-white font-medium">
                          {item.quantity}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => updateQuantity(index, 1)}
                          className="h-8 w-8 p-0"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="w-24 text-right text-white font-medium">
                        ${(item.unitPrice * item.quantity).toFixed(2)}
                      </div>
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-white/40 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Discount Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Discount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={discountType === 'percentage' ? 'default' : 'outline'}
                  onClick={() => setDiscountType(discountType === 'percentage' ? null : 'percentage')}
                  className="gap-2"
                >
                  <Percent className="h-4 w-4" />
                  Percentage
                </Button>
                <Button
                  type="button"
                  variant={discountType === 'fixed' ? 'default' : 'outline'}
                  onClick={() => setDiscountType(discountType === 'fixed' ? null : 'fixed')}
                  className="gap-2"
                >
                  <DollarSign className="h-4 w-4" />
                  Fixed Amount
                </Button>
              </div>
              
              {discountType && (
                <div className="flex items-center gap-2">
                  {discountType === 'fixed' && <span className="text-white/60">$</span>}
                  <Input
                    type="number"
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    min="0"
                    max={discountType === 'percentage' ? '100' : undefined}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-24"
                    placeholder="0"
                  />
                  {discountType === 'percentage' && <span className="text-white/60">%</span>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Totals Card */}
        {quoteItems.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <div className="space-y-2">
                <div className="flex justify-between text-white/60">
                  <span>Subtotal</span>
                  <span>${getSubtotal().toFixed(2)}</span>
                </div>
                {getDiscountAmount() > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>
                      Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed'})
                    </span>
                    <span>-${getDiscountAmount().toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-white pt-2 border-t border-white/20">
                  <span>Total</span>
                  <span>${getTotal().toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Additional Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Additional Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="validDays">Quote Valid For (days)</Label>
                <Input
                  id="validDays"
                  type="number"
                  min="1"
                  value={validDays}
                  onChange={(e) => setValidDays(e.target.value)}
                  className="mt-1 w-32"
                  placeholder="30"
                />
                {validDays && (
                  <p className="text-sm text-white/60 mt-1">
                    Expires: {new Date(Date.now() + parseInt(validDays) * 24 * 60 * 60 * 1000).toLocaleDateString()}
                  </p>
                )}
              </div>
              
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1"
                  placeholder="Terms, conditions, or any additional information..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* QuickBooks (optional) */}
        <Card>
          <CardContent className="pt-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pushToQuickBooks}
                onChange={(e) => setPushToQuickBooks(e.target.checked)}
                className="rounded border-white/30 bg-white/5"
              />
              <span className="text-white/80 text-sm">Push to QuickBooks after creating</span>
            </label>
            <p className="text-white/50 text-xs mt-1 ml-6">Requires QuickBooks connected in Profile.</p>
          </CardContent>
        </Card>

        {/* Submit Buttons */}
        <div className="flex justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || quoteItems.length === 0 || !customerName}
            className="bg-[#ffffff] hover:bg-white/10 text-[#181818] hover:text-[#ffffff]"
          >
            {loading ? 'Creating...' : 'Create Quote'}
          </Button>
        </div>
      </form>

      {/* QuickBooks customer search popup */}
      <Dialog open={showCustomerSearch} onOpenChange={setShowCustomerSearch}>
        <DialogContent className="sm:max-w-md bg-[#181818] border-white/20 text-white">
          <DialogHeader>
            <DialogTitle>Look up customer from QuickBooks</DialogTitle>
            <DialogDescription className="text-white/60">
              Search by customer name. Select a customer to fill the form.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Search by name..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchQuickBooksCustomers())}
                className="bg-white/5 border-white/20 text-white placeholder:text-white/40"
              />
              <Button
                type="button"
                onClick={searchQuickBooksCustomers}
                disabled={customerSearchLoading}
              >
                {customerSearchLoading ? 'Searching...' : 'Search'}
              </Button>
            </div>
            {customerSearchError && (
              <p className="text-sm text-red-400">{customerSearchError}</p>
            )}
            <div className="border border-white/20 rounded-lg max-h-64 overflow-y-auto">
              {customerSearchResults.length === 0 && !customerSearchLoading && (
                <div className="p-4 text-center text-white/50 text-sm">
                  {customerSearchQuery.trim()
                    ? 'No customers found. Try a different search.'
                    : 'Enter a name and click Search.'}
                </div>
              )}
              {customerSearchResults.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => selectQuickBooksCustomer(customer)}
                  className="w-full px-4 py-3 text-left hover:bg-white/10 flex flex-col gap-0.5 border-b border-white/10 last:border-0"
                >
                  <span className="font-medium text-white">{customer.displayName}</span>
                  {(customer.email || customer.phone) && (
                    <span className="text-sm text-white/60">
                      {[customer.email, customer.phone].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
